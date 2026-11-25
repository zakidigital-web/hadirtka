import pg from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';
import defaults from '../shared/defaults.json' with { type: 'json' };
import { initialAccounts } from './accounts.mjs';

export function credentials(password) {
  const salt = randomBytes(16).toString('hex');
  return [salt, scryptSync(password, salt, 32)];
}

export function database(env) {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error('Atur DATABASE_URL pada server.');
  return new pg.Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
}

export async function transaction(pool, work) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    // Serialize school writes so a published change cursor always follows commit order.
    await db.query('SELECT pg_advisory_xact_lock(629013)');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

export async function initialize(pool, env, legacyAccounts) {
  await transaction(pool, async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ht_accounts (
        id text PRIMARY KEY, username text UNIQUE NOT NULL, role text NOT NULL,
        profile jsonb NOT NULL, salt text NOT NULL, digest bytea NOT NULL,
        visible boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ht_sessions (
        token text PRIMARY KEY, account text NOT NULL REFERENCES ht_accounts ON DELETE CASCADE, expires timestamptz NOT NULL
      );
      CREATE SEQUENCE IF NOT EXISTS ht_version;
      CREATE TABLE IF NOT EXISTS ht_records (
        kind text NOT NULL, id text NOT NULL, value jsonb, version bigint NOT NULL DEFAULT nextval('ht_version'),
        PRIMARY KEY(kind,id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ht_records_version ON ht_records(version);
      CREATE TABLE IF NOT EXISTS ht_schema (version integer PRIMARY KEY);
    `);
    if ((await db.query('SELECT 1 FROM ht_schema WHERE version=1')).rowCount) {
      if (legacyAccounts)
        throw new Error('Impor akun hanya tersedia untuk database baru sebelum server dijalankan.');
      return;
    }
    if (legacyAccounts) {
      for (const row of legacyAccounts) {
        await db.query(
          `INSERT INTO ht_accounts(id,username,role,profile,salt,digest,visible,active,revision)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            row.id,
            row.username.toLowerCase(),
            row.role,
            JSON.parse(row.profile),
            row.salt,
            Buffer.from(row.digest),
            !!row.visible,
            !!row.active,
            row.revision,
          ],
        );
      }
    } else {
      for (const { id, username, role, ...profile } of initialAccounts) {
        const key = role === 'admin' ? 'HADIRTKA_ADMIN_PASSWORD' : 'HADIRTKA_TEACHER_PASSWORD';
        if (!env[key] || env[key].length < 12)
          throw new Error('Atur ' + key + ' pada server (minimal 12 karakter).');
        await db.query(
          'INSERT INTO ht_accounts(id,username,role,profile,salt,digest) VALUES($1,$2,$3,$4,$5,$6)',
          [id, username, role, { ...profile, accountName: profile.name }, ...credentials(env[key])],
        );
      }
    }
    for (const c of defaults.classrooms)
      await db.query('INSERT INTO ht_records(kind,id,value) VALUES($1,$2,$3)', ['classrooms', c.id, c]);
    for (const kind of ['whatsappSettings', 'reportSchedule']) {
      await db.query('INSERT INTO ht_records(kind,id,value) VALUES($1,$2,$3)', [
        kind,
        'settings',
        defaults[kind],
      ]);
    }
    await db.query('INSERT INTO ht_schema VALUES(1)');
  });
}

export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
