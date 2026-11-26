import {backupRoutes} from './backup.mjs';
import express from 'express';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { database, initialize, credentials, transaction, fail } from './database.mjs';
import { readChanges, writeChanges } from './workspace.mjs';

const user = (row) => ({
  ...row.profile,
  id: row.id,
  username: row.username,
  role: row.role,
  revision: row.revision,
});
const digest = (token) => createHash('sha256').update(token).digest('hex');
const passwordMatches = (password, row) =>
  typeof password === 'string' && row && timingSafeEqual(scryptSync(password, row.salt, 32), row.digest);
const textField = (body, key, max) => {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail(400, 'Periksa isian ' + key + '.');
  return value.trim();
};
export function accountApi(env = process.env) {
  const app = express();
  let pool, ready;
  app.use(express.json({ limit: '3mb' }));
  function route(method, path, permission, handler) {
    app[method](path, async (req, res, next) => {
      try {
        res.set('Cache-Control', 'private, no-store');
        if (method === 'post' && !req.is('application/json')) fail(415, 'Gunakan JSON.');
        pool ??= database(env);
        ready ??= initialize(pool, env).catch((err) => {
          ready = null;
          throw err;
        });
        await ready;
        const token = /(?:^|;\s*)hadirtka_session=([a-f0-9]{64})(?:;|$)/.exec(
          req.headers.cookie || '',
        )?.[1];
        const run = async (db) => {
          const account =
            token &&
            (
              await db.query(
                'SELECT a.* FROM ht_sessions s JOIN ht_accounts a ON a.id=s.account WHERE s.token=$1 AND s.expires>now() AND a.active',
                [digest(token)],
              )
            ).rows[0];
          if (permission && !account) fail(401, 'Silakan masuk kembali.');
          if (permission && permission !== 'user' && account.role !== permission)
            fail(403, 'Akses ditolak.');
          return handler(db, req.body || {}, account, req, res, token);
        };
        res.json(await (method === 'post' ? transaction(pool, run) : run(pool)));
      } catch (error) {
        next(error);
      }
    });
  }
  const cookie = {
    httpOnly: true,
    sameSite: 'strict',
    secure: !!env.VERCEL || env.NODE_ENV === 'production',
    path: '/',
  };
  route('post', '/login', null, async (db, b, _a, _req, res) => {
    const row = (
      await db.query('SELECT * FROM ht_accounts WHERE active AND username=$1 AND role=$2', [
        String(b.username).trim().toLowerCase(),
        b.role,
      ])
    ).rows[0];
    if (!passwordMatches(b.password, row)) fail(401, 'Username atau kata sandi salah.');
    const token = randomBytes(32).toString('hex');
    const lifetime = (b.rememberMe ? 168 : 12) * 3600000;
    await db.query('DELETE FROM ht_sessions WHERE expires<=now()');
    await db.query('INSERT INTO ht_sessions VALUES($1,$2,$3)', [
      digest(token),
      row.id,
      new Date(Date.now() + lifetime),
    ]);
    res.cookie('hadirtka_session', token, b.rememberMe ? { ...cookie, maxAge: lifetime } : cookie);
    return user(row);
  });
  route('get', '/me', null, async (_db, _b, a) => (a ? user(a) : null));
  route('post', '/logout', null, async (db, _b, _a, _req, res, token) => {
    if (token) await db.query('DELETE FROM ht_sessions WHERE token=$1', [digest(token)]);
    res.clearCookie('hadirtka_session', cookie);
    return true;
  });
  route('get', '/teachers', null, async (db, _b, a) => {
    const admin = a?.role === 'admin';
    const { rows } = await db.query(
      "SELECT id,username,profile,active,visible,revision FROM ht_accounts WHERE role='guru' AND ($1 OR (active AND visible)) ORDER BY username",
      [admin],
    );
    return rows.map(({ id, username, profile, active, visible, revision }) => ({
      id,
      username,
      name: profile.name,
      title: profile.title,
      visible,
      ...(admin
        ? { active, revision, teacherSubject: profile.teacherSubject, classId: profile.classId }
        : {}),
    }));
  });
  route('post', '/teachers', 'admin', async (db, b) => {
    const username = textField(b, 'username', 64).toLowerCase();
    const name = textField(b, 'name', 120),
      title = textField(b, 'title', 160),
      classId = textField(b, 'classId', 128);
    if (
      !/^[a-z0-9._-]{3,64}$/.test(username) ||
      !['matematika', 'bahasa_indonesia'].includes(b.teacherSubject) ||
      typeof b.active !== 'boolean' ||
      typeof b.visible !== 'boolean' ||
      ((!b.id || b.password) && (typeof b.password !== 'string' || b.password.length < 8))
    )
      fail(400, 'Periksa isian akun dan kata sandi.');
    if (!(await db.query("SELECT 1 FROM ht_records WHERE kind='classrooms' AND id=$1 AND value IS NOT NULL", [classId])).rowCount)
      fail(409, 'Kelas sudah dihapus. Pilih kelas lain.');
    const old =
      b.id && (await db.query("SELECT * FROM ht_accounts WHERE role='guru' AND id=$1", [b.id])).rows[0];
    if (b.id && !old) fail(404, 'Akun tidak ditemukan.');
    if (old && old.revision !== b.revision) fail(409, 'Akun telah berubah. Muat ulang daftar.');
    const profile = {
      ...(old?.profile || { accountName: name, avatarUrl: '/src/assets/images/guru.svg' }),
      name,
      title,
      classId,
      teacherSubject: b.teacherSubject,
    };
    const id = b.id || randomUUID();
    const [salt, hash] = b.password ? credentials(b.password) : [old.salt, old.digest];
    await db.query(
      `INSERT INTO ht_accounts(id,username,role,profile,active,visible,salt,digest,revision) VALUES($1,$2,'guru',$3,$4,$5,$6,$7,1)
      ON CONFLICT(id) DO UPDATE SET username=excluded.username,profile=excluded.profile,active=excluded.active,visible=excluded.visible,
      salt=excluded.salt,digest=excluded.digest,revision=ht_accounts.revision+1`,
      [id, username, profile, b.active, b.visible, salt, hash],
    );
    if (old && (!b.active || b.password || username !== old.username))
      await db.query('DELETE FROM ht_sessions WHERE account=$1', [id]);
    return true;
  });
  route('post', '/teachers/delete', 'admin', async (db, b) => {
    const result = await db.query(
      "DELETE FROM ht_accounts WHERE id=$1 AND role='guru' AND revision=$2",
      [b.id, b.revision],
    );
    if (!result.rowCount) fail(409, 'Akun telah diubah atau dihapus.');
    return true;
  });
  route('post', '/profile', 'user', async (db, b, a) => {
    if (
      typeof b.avatarUrl !== 'string' ||
      b.avatarUrl.length > 250000 ||
      (a.role === 'guru' && !['matematika', 'bahasa_indonesia'].includes(b.teacherSubject))
    )
      fail(400, 'Periksa foto dan mata pelajaran.');
    const profile = {
      ...a.profile,
      name: textField(b, 'name', 120),
      title: textField(b, 'title', 160),
      avatarUrl: b.avatarUrl,
      nip: b.nip,
      phone: b.phone,
      teacherSubject: b.teacherSubject,
    };
    const row = (
      await db.query(
        'UPDATE ht_accounts SET profile=$1,revision=revision+1 WHERE id=$2 AND revision=$3 RETURNING *',
        [profile, a.id, b.revision],
      )
    ).rows[0];
    if (!row) fail(409, 'Profil telah berubah. Muat ulang halaman.');
    return user(row);
  });
  route('post', '/password', 'guru', async (db, b, a, _req, _res, token) => {
    if (!passwordMatches(b.oldPassword, a)) fail(400, 'Kata sandi lama salah.');
    if (typeof b.newPassword !== 'string' || b.newPassword.length < 8)
      fail(400, 'Gunakan minimal 8 karakter.');
    await db.query('UPDATE ht_accounts SET salt=$1,digest=$2 WHERE id=$3', [
      ...credentials(b.newPassword),
      a.id,
    ]);
    await db.query('DELETE FROM ht_sessions WHERE account=$1 AND token<>$2', [a.id, digest(token)]);
    return true;
  });
  backupRoutes(route);
  route('get', '/workspace', 'user', (db, _b, a, req) => readChanges(db, a, req.query.after));
  route('post', '/classrooms/delete', 'admin', async (db, b) => {
    const id = textField(b, 'id', 180);
    const removed = await db.query(`UPDATE ht_records SET value=NULL, version=nextval('ht_version')
      WHERE kind='classrooms' AND id=$1 AND value IS NOT NULL RETURNING id`, [id]);
    if (!removed.rowCount) fail(409, 'Kelas sudah dihapus. Muat ulang daftar kelas.');
    await db.query(`WITH students AS (
      SELECT id FROM ht_records WHERE kind='students' AND value->>'classId'=$1
    ) UPDATE ht_records SET value=NULL, version=nextval('ht_version')
      WHERE (kind IN ('students','attendance','journals','whatsappLogs') AND value->>'classId'=$1)
         OR (kind IN ('attendance','whatsappLogs') AND value->>'studentId' IN (SELECT id FROM students))`, [id]);
    await db.query("UPDATE ht_accounts SET profile=profile-'classId', revision=revision+1 WHERE profile->>'classId'=$1", [id]);
    return true;
  });
  route('post', '/workspace', 'user', (db, b, a) => writeChanges(db, a, b.changes));
  app.use((err, _req, res, _next) => {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Username atau data sudah digunakan.' });
    if (!err.status) console.error('HadirTKA database/API error:', err.code || err.name);
    res
      .status(err.status || 503)
      .json({
        error: err.status ? err.message : 'Layanan database belum tersedia. Periksa konfigurasi server.',
      });
  });
  return app;
}
