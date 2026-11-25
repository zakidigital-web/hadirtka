import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { initialAccounts } from './accounts.mjs';

function hash(password, salt) {
  return scryptSync(password, salt, 32);
}

export function accountApi(env = process.env) {
  const dir = process.env.HADIRTKA_ACCOUNT_DIR || path.join(homedir(), '.local/share/hadirtka');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dir, 'accounts.sqlite'));
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, salt TEXT, digest BLOB, visible INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, account TEXT, expires INTEGER);`);
  db.exec(`CREATE TABLE IF NOT EXISTS profiles(
    id TEXT PRIMARY KEY REFERENCES accounts(id), username TEXT UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL, profile TEXT NOT NULL, active INTEGER DEFAULT 1, revision INTEGER DEFAULT 0)`);
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  db.exec('CREATE TABLE IF NOT EXISTS removed_seed_accounts(id TEXT PRIMARY KEY)');
  transaction(() => {
    for (const {id, username, role, ...profile} of initialAccounts) {
      if (db.prepare('SELECT id FROM removed_seed_accounts WHERE id=?').get(id)) continue;
      if (!db.prepare('SELECT id FROM accounts WHERE id=?').get(id)) {
        const variable = role === 'admin' ? 'HADIRTKA_ADMIN_PASSWORD' : 'HADIRTKA_TEACHER_PASSWORD';
        const password = env[variable];
        if (!password || password.length < 12) throw new Error(`Atur ${variable} (minimal 12 karakter) untuk inisialisasi akun.`);
        const salt = randomBytes(16).toString('hex');
        db.prepare('INSERT INTO accounts(id,salt,digest) VALUES(?,?,?)').run(id,salt,hash(password,salt));
      }
      db.prepare('INSERT OR IGNORE INTO profiles(id,username,role,profile) VALUES(?,?,?,?)')
        .run(id,username,role,JSON.stringify({...profile,accountName:profile.name}));
    }
  });
  const roster = 'SELECT p.*, a.visible FROM profiles p JOIN accounts a ON a.id=p.id';
  function publicUser(row) {
    return {...JSON.parse(row.profile),id:row.id,username:row.username,role:row.role,revision:row.revision};
  }
  function teacherRow(row) {
    const {id,username,name,title,teacherSubject,classId,revision} = publicUser(row);
    return {id,username,name,title,teacherSubject,classId,revision,active:Boolean(row.active),visible:Boolean(row.visible)};
  }
  db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
  const app = express();
  app.use(express.json({limit:'256kb'}));
  app.use((req,res,next) => {
    res.set('Cache-Control','no-store');
    if (req.method === 'POST' && !req.is('application/json')) return res.sendStatus(415);
    req.token = /(?:^|;\s*)hadirtka_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1] || '';
    const session = db.prepare('SELECT account FROM sessions WHERE token=? AND expires>?').get(req.token, Date.now());
    req.account = session && db.prepare(roster+' WHERE p.id=? AND p.active=1').get(session.account);
    next();
  });
  app.get('/teachers', (req,res) => {
    const admin = req.account?.role === 'admin';
    const rows = db.prepare(roster+" WHERE role='guru'"+(admin ? '' : ' AND active=1 AND visible=1')+' ORDER BY username').all();
    res.json(rows.map(row => {
      const teacher = teacherRow(row);
      if (admin) return teacher;
      const {id,name,username,title,visible} = teacher;
      return {id,name,username,title,visible};
    }));
  });
  app.post('/teachers',(req,res) => {
    if (req.account?.role !== 'admin') return res.sendStatus(403);
    const {id,revision,password='',active,visible,teacherSubject} = req.body;
    const field = key => typeof req.body[key] === 'string' ? req.body[key].trim() : '';
    const username=field('username').toLowerCase(), name=field('name'), title=field('title'), classId=field('classId');
    if (!/^[a-z0-9._-]{3,64}$/.test(username) || !name || name.length>120 || !title || title.length>160 ||
        !['matematika','bahasa_indonesia'].includes(teacherSubject) || !classId || classId.length>128 ||
        typeof active!=='boolean' || typeof visible!=='boolean' || typeof password!=='string' ||
        ((!id || password) && password.length<8))
      return res.status(400).json({error:'Periksa identitas, username, dan kata sandi (minimal 8 karakter).'});
    transaction(() => {
      const old = id && db.prepare(roster+" WHERE p.id=? AND role='guru'").get(id);
      if (id && !old) return res.status(404).json({error:'Akun guru tidak ditemukan.'});
      if (old && revision !== old.revision) return res.status(409).json({error:'Akun telah berubah. Tutup formulir dan muat ulang daftar.'});
      const teacherId = id || randomUUID();
      if (db.prepare('SELECT id FROM profiles WHERE username=? AND id<>?').get(username,teacherId))
        return res.status(409).json({error:'Username sudah digunakan.'});
      const profile = {...(old ? JSON.parse(old.profile) : {avatarUrl:initialAccounts[0].avatarUrl,accountName:name}),name,title,teacherSubject,classId};
      if (old) {
        db.prepare('UPDATE profiles SET username=?,profile=?,active=?,revision=revision+1 WHERE id=?')
          .run(username,JSON.stringify(profile),Number(active),id);
        db.prepare('UPDATE accounts SET visible=? WHERE id=?').run(Number(visible),id);
      } else {
        db.prepare('INSERT INTO accounts(id,visible) VALUES(?,?)').run(teacherId,Number(visible));
        db.prepare("INSERT INTO profiles(id,username,role,profile,active,revision) VALUES(?,?,'guru',?,?,1)")
          .run(teacherId,username,JSON.stringify(profile),Number(active));
      }
      if (password) {
        const salt=randomBytes(16).toString('hex');
        db.prepare('UPDATE accounts SET salt=?,digest=? WHERE id=?').run(salt,hash(password,salt),teacherId);
      }
      if (!active || password || (old && username!==old.username))
        db.prepare('DELETE FROM sessions WHERE account=?').run(teacherId);
      return teacherId;
    });
    if (!res.headersSent) res.json(true);
  });
  app.post('/teachers/delete', (req, res) => {
    if (req.account?.role !== 'admin') return res.sendStatus(403);
    const {id, revision} = req.body || {};
    if (typeof id !== 'string' || !Number.isInteger(revision)) return res.sendStatus(400);
    const status = transaction(() => {
      const row = db.prepare("SELECT revision FROM profiles WHERE id=? AND role='guru'").get(id);
      if (!row) return 404;
      if (row.revision !== revision) return 409;
      if (initialAccounts.some(account => account.id === id)) {
        db.prepare('INSERT OR IGNORE INTO removed_seed_accounts(id) VALUES(?)').run(id);
      }
      db.prepare('DELETE FROM sessions WHERE account=?').run(id);
      db.prepare('DELETE FROM profiles WHERE id=?').run(id);
      db.prepare('DELETE FROM accounts WHERE id=?').run(id);
      return 200;
    });
    if (status === 404) return res.status(status).json({error:'Akun guru sudah tidak tersedia.'});
    if (status === 409) return res.status(status).json({error:'Akun telah berubah. Periksa kembali sebelum menghapus.'});
    res.json(true);
  });
  app.post('/login',(req,res) => {
    const {username,password,role,rememberMe} = req.body || {};
    const account = db.prepare(roster+' WHERE username=? AND role=? AND active=1').get(String(username).trim(),String(role));
    const row = account && db.prepare('SELECT * FROM accounts WHERE id=?').get(account.id);
    if (!row || typeof password !== 'string' || !timingSafeEqual(row.digest,hash(password,row.salt)))
      return res.status(401).json({error:'Username atau kata sandi salah.'});
    const token = randomBytes(32).toString('hex');
    const seconds = rememberMe ? 604800 : 43200;
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,account.id,Date.now()+seconds*1000);
    res.set('Set-Cookie', 'hadirtka_session='+token+'; HttpOnly; SameSite=Strict; Path=/'+(rememberMe ? '; Max-Age='+seconds : ''));
    res.json(publicUser(account));
  });
  app.get('/me',(req,res) => res.json(req.account ? publicUser(req.account) : null));
  app.post('/logout',(req,res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(req.token);
    res.set('Set-Cookie','hadirtka_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0').json(true);
  });
  app.post('/visibility',(req,res) => {
    if(req.account?.role!=='admin') return res.sendStatus(403);
    const {id,visible}=req.body;
    if(typeof visible!=='boolean' || !db.prepare("SELECT id FROM profiles WHERE role='guru' AND id=?").get(id)) return res.sendStatus(400);
    db.prepare('UPDATE accounts SET visible=? WHERE id=?').run(Number(visible),id);
    res.json(true);
  });
  app.post('/profile',(req,res) => {
    if (!req.account) return res.sendStatus(401);
    const {name,title,phone,nip,avatarUrl,teacherSubject,revision} = req.body;
    if (![name,title].every(x => typeof x==='string' && x.trim()) ||
        typeof avatarUrl!=='string' || (req.account.role==='guru' && !['matematika','bahasa_indonesia'].includes(teacherSubject)))
      return res.status(400).json({error:'Periksa nama, jabatan dan mata pelajaran.'});
    const profile = {...JSON.parse(req.account.profile),name:name.trim(),title:title.trim(),phone,nip,avatarUrl,teacherSubject};
    const result = db.prepare('UPDATE profiles SET profile=?,revision=revision+1 WHERE id=? AND revision=?')
      .run(JSON.stringify(profile),req.account.id,revision);
    if (!result.changes) return res.status(409).json({error:'Profil telah berubah. Muat ulang sebelum menyimpan.'});
    res.json(publicUser(db.prepare(roster+' WHERE p.id=?').get(req.account.id)));
  });
  app.post('/password',(req,res) => {
    if(req.account?.role!=='guru') return res.sendStatus(403);
    const {oldPassword,newPassword}=req.body;
    const row=db.prepare('SELECT * FROM accounts WHERE id=?').get(req.account.id);
    if(typeof oldPassword!=='string' || !timingSafeEqual(row.digest,hash(oldPassword,row.salt)))
      return res.status(400).json({error:'Kata sandi lama salah.'});
    if(typeof newPassword!=='string' || newPassword.length<8) return res.status(400).json({error:'Gunakan minimal 8 karakter.'});
    const salt=randomBytes(16).toString('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE accounts SET salt=?,digest=? WHERE id=?').run(salt,hash(newPassword,salt),row.id);
      db.prepare('DELETE FROM sessions WHERE account=? AND token<>?').run(row.id,req.token);
      db.exec('COMMIT');
    } catch(error) { db.exec('ROLLBACK'); throw error; }
    res.json(true);
  });
  return app;
}
