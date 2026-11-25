import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fail } from './database.mjs';

const magic = Buffer.from('HADIRTKA-BACKUP-1\n');
const partSize = 384 * 1024;
const maxBytes = 64 * 1024 * 1024;
const maxPlain = 192 * 1024 * 1024;
const kinds = [
  'classrooms',
  'students',
  'attendance',
  'journals',
  'whatsappLogs',
  'whatsappSettings',
  'reportSchedule',
];
const accountColumns = 'id,username,role,profile,salt,digest,visible,active,revision';

function key(password, salt) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256)
    fail(400, 'Gunakan kata sandi cadangan 12–256 karakter.');
  return scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

async function pack(db, password) {
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(password, salt), iv);
  const accounts = (
    await db.query(
      "SELECT id,username,role,profile,salt,encode(digest,'hex') AS digest,visible,active,revision FROM ht_accounts ORDER BY id",
    )
  ).rows;
  const records = (
    await db.query('SELECT kind,id,value FROM ht_records WHERE value IS NOT NULL ORDER BY kind,id')
  ).rows;
  const plaintext = Buffer.from(
    JSON.stringify({ schema: 1, created: new Date().toISOString(), accounts, records }),
  );
  if (plaintext.length > maxPlain) fail(413, 'Ukuran database melebihi batas cadangan aplikasi.');
  const encrypted = Buffer.concat([cipher.update(gzipSync(plaintext)), cipher.final()]);
  return Buffer.concat([magic, salt, iv, cipher.getAuthTag(), encrypted]);
}

function unpack(bytes, password) {
  if (!bytes.subarray(0, magic.length).equals(magic)) fail(400, 'Format file cadangan tidak dikenali.');
  let offset = magic.length;
  const take = (n) => bytes.subarray(offset, (offset += n));
  const salt = take(16),
    iv = take(12),
    tag = take(16);
  const secret = key(password, salt);
  let doc;
  try {
    const decipher = createDecipheriv('aes-256-gcm', secret, iv);
    decipher.setAuthTag(tag);
    const zipped = Buffer.concat([decipher.update(bytes.subarray(offset)), decipher.final()]);
    doc = JSON.parse(gunzipSync(zipped, { maxOutputLength: maxPlain }));
  } catch {
    fail(400, 'Kata sandi salah atau file cadangan rusak.');
  }
  if (
    doc?.schema !== 1 ||
    !Number.isFinite(Date.parse(doc.created)) ||
    !Array.isArray(doc.accounts) ||
    !Array.isArray(doc.records)
  )
    fail(400, 'Versi atau isi cadangan tidak didukung.');
  const ids = new Set(),
    usernames = new Set(),
    entries = new Set();
  for (const a of doc.accounts) {
    if (
      !a ||
      typeof a.id !== 'string' ||
      !a.id ||
      typeof a.username !== 'string' ||
      !a.username ||
      !['guru', 'admin'].includes(a.role) ||
      !a.profile?.name ||
      typeof a.visible !== 'boolean' ||
      typeof a.active !== 'boolean' ||
      !Number.isInteger(a.revision) ||
      !/^[a-f0-9]{32}$/.test(a.salt) ||
      !/^[a-f0-9]{64}$/.test(a.digest) ||
      ids.has(a.id) ||
      usernames.has(a.username)
    )
      fail(400, 'Data akun dalam cadangan tidak valid.');
    ids.add(a.id);
    usernames.add(a.username);
  }
  if (!doc.accounts.some((a) => a.active && a.role === 'admin'))
    fail(400, 'Cadangan harus memiliki admin aktif.');
  for (const r of doc.records) {
    if (
      !r ||
      !kinds.includes(r.kind) ||
      typeof r.id !== 'string' ||
      !r.id ||
      !r.value ||
      typeof r.value !== 'object' ||
      (['whatsappSettings', 'reportSchedule'].includes(r.kind)
        ? r.id !== 'settings'
        : r.id !== r.value.id) ||
      entries.has(r.kind + '|' + r.id)
    )
      fail(400, 'Data sekolah dalam cadangan tidak valid.');
    entries.add(r.kind + '|' + r.id);
  }
  if (!entries.has('whatsappSettings|settings') || !entries.has('reportSchedule|settings'))
    fail(400, 'Pengaturan aplikasi tidak lengkap.');
  return doc;
}

async function startJob(db, owner, purpose, bytes) {
  if (!Number.isSafeInteger(bytes) || bytes <= magic.length + 44 || bytes > maxBytes)
    fail(413, 'File cadangan harus berukuran maksimal 64 MiB.');
  await db.query('DELETE FROM ht_backup_jobs WHERE expires<=now() OR (owner=$1 AND purpose=$2)', [
    owner,
    purpose,
  ]);
  const id = randomUUID();
  await db.query('INSERT INTO ht_backup_jobs(id,owner,purpose,bytes) VALUES($1,$2,$3,$4)', [
    id,
    owner,
    purpose,
    bytes,
  ]);
  return { id, bytes, partSize };
}

async function job(db, a, id, purpose) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) fail(400, 'ID cadangan tidak valid.');
  const result = await db.query(
    'SELECT * FROM ht_backup_jobs WHERE id=$1 AND owner=$2 AND purpose=$3 AND expires>now()',
    [id, a.id, purpose],
  );
  if (!result.rowCount) fail(410, 'Sesi cadangan berakhir. Mulai kembali.');
  return result.rows[0];
}

async function readArchive(db, j, password) {
  const { rows } = await db.query('SELECT part,data FROM ht_backup_chunks WHERE job=$1 ORDER BY part', [
    j.id,
  ]);
  if (rows.length !== Math.ceil(j.bytes / partSize) || rows.some((r, i) => r.part !== i))
    fail(400, 'Unggahan belum lengkap.');
  return unpack(Buffer.concat(rows.map((r) => r.data)), password);
}

export function backupRoutes(route) {
  route('post', '/backup/export', 'admin', async (db, b, a) => {
    const file = await pack(db, b.password);
    const j = await startJob(db, a.id, 'export', file.length);
    for (let offset = 0; offset < file.length; offset += partSize)
      await db.query('INSERT INTO ht_backup_chunks VALUES($1,$2,$3)', [
        j.id,
        offset / partSize,
        file.subarray(offset, offset + partSize),
      ]);
    return j;
  });
  route('get', '/backup/download', 'admin', async (db, _b, a, req) => {
    const j = await job(db, a, req.query.id, 'export');
    const part = Number(req.query.part);
    if (!Number.isInteger(part) || part < 0 || part >= Math.ceil(j.bytes / partSize))
      fail(400, 'Bagian file tidak valid.');
    const { rows } = await db.query('SELECT data FROM ht_backup_chunks WHERE job=$1 AND part=$2', [
      j.id,
      part,
    ]);
    return rows[0].data.toString('base64');
  });
  route('post', '/backup/start', 'admin', async (db, b, a) => startJob(db, a.id, 'restore', b.bytes));
  route('post', '/backup/upload', 'admin', async (db, b, a) => {
    const j = await job(db, a, b.id, 'restore');
    if (
      j.reviewed ||
      !Number.isInteger(b.part) ||
      b.part < 0 ||
      b.part >= Math.ceil(j.bytes / partSize) ||
      typeof b.data !== 'string'
    )
      fail(400, 'Bagian unggahan tidak valid.');
    const part = Buffer.from(b.data, 'base64');
    if (part.length !== Math.min(partSize, j.bytes - b.part * partSize))
      fail(400, 'Ukuran bagian tidak sesuai.');
    await db.query(
      'INSERT INTO ht_backup_chunks VALUES($1,$2,$3) ON CONFLICT(job,part) DO UPDATE SET data=excluded.data',
      [j.id, b.part, part],
    );
    return true;
  });
  route('post', '/backup/preview', 'admin', async (db, b, a) => {
    const j = await job(db, a, b.id, 'restore');
    const doc = await readArchive(db, j, b.password);
    await db.query('UPDATE ht_backup_jobs SET reviewed=true WHERE id=$1', [j.id]);
    const count = (kind) => doc.records.filter((r) => r.kind === kind).length;
    return {
      created: doc.created,
      accounts: doc.accounts.length,
      students: count('students'),
      attendance: count('attendance'),
      journals: count('journals'),
    };
  });
  route('post', '/backup/restore', 'admin', async (db, b, a) => {
    const j = await job(db, a, b.id, 'restore');
    if (!j.reviewed || b.confirm !== 'PULIHKAN')
      fail(400, 'Periksa ringkasan cadangan dan konfirmasi pemulihan.');
    const doc = await readArchive(db, j, b.password);
    // Route runs inside the same locked transaction used for account and school writes.
    await db.query('DELETE FROM ht_accounts');
    await db.query('DELETE FROM ht_records');
    await db.query(
      'INSERT INTO ht_accounts(' +
        accountColumns +
        ") SELECT id,username,role,profile,salt,decode(digest,'hex'),visible,active,revision FROM jsonb_to_recordset($1) AS a(id text,username text,role text,profile jsonb,salt text,digest text,visible boolean,active boolean,revision integer)",
      [JSON.stringify(doc.accounts)],
    );
    await db.query(
      'INSERT INTO ht_records(kind,id,value) SELECT kind,id,value FROM jsonb_to_recordset($1) AS r(kind text,id text,value jsonb)',
      [JSON.stringify(doc.records)],
    );
    await db.query('DELETE FROM ht_backup_jobs');
    return true;
  });
  route('post', '/backup/close', 'admin', async (db, b, a) => {
    await db.query('DELETE FROM ht_backup_jobs WHERE id=$1 AND owner=$2', [b.id, a.id]);
    return true;
  });
}
