// Run locally with a fresh target database for accounts, then import each browser export.
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { database, initialize, transaction } from '../server/database.mjs';
import { writeChanges } from '../server/workspace.mjs';
import defaults from '../shared/defaults.json' with { type: 'json' };

const [mode, file] = process.argv.slice(2);
if (!file || !['accounts', 'school'].includes(mode))
  throw new Error('Gunakan migrate accounts FILE.sqlite atau migrate school FILE.json');
const pool = database(process.env);
try {
  if (mode === 'accounts') {
    const { DatabaseSync } = await import('node:sqlite');
    const sqlite = new DatabaseSync(file, { readOnly: true });
    const rows = sqlite
      .prepare('SELECT p.*,a.salt,a.digest,a.visible FROM profiles p JOIN accounts a ON p.id=a.id')
      .all();
    sqlite.close();
    if (!rows.some((r) => r.role === 'admin' && r.active))
      throw new Error('Akun admin aktif diperlukan.');
    await initialize(pool, process.env, rows);
    console.log('Akun diimpor:', rows.length);
  } else {
    const snapshot = JSON.parse(await readFile(file, 'utf8'));
    const lists = ['classrooms', 'students', 'attendance', 'journals', 'whatsappLogs'];
    if (lists.some((k) => !Array.isArray(snapshot[k])) || !snapshot.whatsappSettings)
      throw new Error('Berkas bukan ekspor data HadirTKA.');
    await initialize(pool, process.env);
    const total = await transaction(pool, async (db) => {
      let count = 0;
      for (const kind of [...lists, 'whatsappSettings', 'reportSchedule']) {
        const rows = lists.includes(kind) ? snapshot[kind] : [snapshot[kind]].filter(Boolean);
        for (const value of rows) {
          const id = lists.includes(kind) ? value.id : 'settings';
          const existing = (
            await db.query('SELECT value FROM ht_records WHERE kind=$1 AND id=$2', [kind, id])
          ).rows[0];
          if (existing && isDeepStrictEqual(existing.value, value)) continue;
          const original =
            kind === 'classrooms' ? defaults.classrooms.find((c) => c.id === id) : defaults[kind];
          if (existing && !isDeepStrictEqual(existing.value, original))
            throw new Error(
              'Konflik ' + kind + ' ' + id + '; batalkan impor dan periksa kedua salinan.',
            );
          await writeChanges(db, { role: 'admin' }, [
            { kind, id, before: existing?.value ?? null, value },
          ]);
          count++;
        }
      }
      return count;
    });
    console.log('Rekaman diimpor:', total);
  }
} finally {
  await pool.end();
}
