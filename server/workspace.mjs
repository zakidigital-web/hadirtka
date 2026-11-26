import { isDeepStrictEqual } from 'node:util';
import { fail } from './database.mjs';

const collections = new Set([
  'students',
  'classrooms',
  'attendance',
  'journals',
  'whatsappLogs',
  'whatsappSettings',
  'reportSchedule',
]);
const settings = new Set(['whatsappSettings', 'reportSchedule']);
const statuses = ['hadir', 'izin', 'sakit', 'alpha'];
const subjects = ['matematika', 'bahasa_indonesia'];
const record = async (db, kind, id) =>
  (await db.query('SELECT value FROM ht_records WHERE kind=$1 AND id=$2', [kind, id])).rows[0]?.value ??
  null;

export async function readChanges(db, account, after = '0') {
  if (!/^\d{1,18}$/.test(after)) fail(400, 'Penanda sinkronisasi tidak valid.');
  const { rows } = await db.query(
    `SELECT kind,id,value,version FROM ht_records
    WHERE version>$1 AND ($2 OR kind<>'whatsappLogs') ORDER BY version LIMIT 101`,
    [after, account.role === 'admin'],
  );
  return { rows: rows.slice(0, 100), more: rows.length > 100 };
}

async function validateSession(db, kind, value) {
  if (!subjects.includes(value.subject) || !/^\d{4}-\d{2}-\d{2}$/.test(value.date))
    fail(400, 'Tanggal atau mata pelajaran tidak valid.');
  const attendance = kind === 'attendance';
  if (value.id !== [value.date, value.subject, attendance ? value.studentId : value.classId].join('_'))
    fail(400, 'Identitas sesi tidak valid.');
  if (!(await record(db, 'classrooms', value.classId))) fail(409, 'Kelas tidak tersedia.');
  if (attendance) {
    const student = await record(db, 'students', value.studentId);
    if (student?.classId !== value.classId || !statuses.includes(value.status))
      fail(409, 'Siswa atau status absensi tidak valid.');
  }
}

async function notification(db, account, change, attendance, student) {
  const classroom = await record(db, 'classrooms', attendance.classId);
  const settings = await record(db, 'whatsappSettings', 'settings');
  const status = attendance.status;
  const label = status[0].toUpperCase() + status.slice(1);
  if (!settings['autoNotify' + label]) fail(403, 'Notifikasi otomatis untuk status ini tidak aktif.');
  const math = attendance.subject === 'matematika';
  const className = classroom.name + ' · ' + (math ? 'MTK' : 'BIN');
  const timestamp = new Date().toISOString();
  const tokens = {
    nama_siswa: student.name,
    nama_ortu: student.parentName,
    kelas: classroom.name + ' (' + (math ? 'Matematika TKA' : 'Bahasa Indonesia TKA') + ')',
    status: label,
    tanggal: new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' }).format(
      new Date(attendance.date + 'T12:00:00Z'),
    ),
    waktu: attendance.checkInTime,
    guru: account.profile.name,
    catatan: attendance.note || '-',
    lembaga: settings.institutionName,
  };
  const message = settings.templates[status].replace(/\{(\w+)\}/g, (match, key) => tokens[key] ?? match);
  return {
    id: change.id,
    date: attendance.date,
    timestamp,
    subject: attendance.subject,
    studentId: student.id,
    studentName: student.name,
    classId: classroom.id,
    className,
    parentName: student.parentName,
    parentWhatsapp: student.parentWhatsapp,
    triggerStatus: status,
    message,
    deliveryStatus: 'siap_kirim',
    autoTriggered: true,
  };
}

export async function writeChanges(db, account, changes) {
  if (!Array.isArray(changes) || changes.length > 10000) fail(400, 'Daftar perubahan tidak valid.');
  const teacher = account.role !== 'admin';
  const notified = new Set();
  for (const change of changes) {
    const { kind, id, before, value } = change;
    let stored = value;
    if (
      !collections.has(kind) ||
      typeof id !== 'string' ||
      !id ||
      id.length > 180 ||
      (settings.has(kind) && (id !== 'settings' || !value)) ||
      (value !== null && (typeof value !== 'object' || (!settings.has(kind) && value.id !== id)))
    )
      fail(400, 'Data tidak valid.');
    if (teacher && (!['attendance', 'journals', 'whatsappLogs'].includes(kind) || !value))
      fail(403, 'Akses ditolak.');
    const current = await record(db, kind, id);
    if (isDeepStrictEqual(current, value)) continue;
    if (!isDeepStrictEqual(current, before))
      fail(409, 'Data ini sudah berubah di perangkat lain. Periksa data terbaru lalu ulangi.');
    if (value && ['attendance', 'journals'].includes(kind)) await validateSession(db, kind, value);
    if (value && kind === 'students' && !(await record(db, 'classrooms', value.classId)))
      fail(409, 'Kelas siswa tidak tersedia.');
    if (teacher && kind === 'attendance' && value.recordedBy !== account.profile.name)
      fail(403, 'Nama pencatat tidak sesuai.');
    if (kind === 'journals' && value && !['hadir', 'tidak_masuk', 'digantikan'].includes(value.teacherStatus))
      fail(400, 'Status kehadiran guru tidak valid.');
    if (teacher && kind === 'journals') {
      if (value.scheduledTeacherId && (value.scheduledTeacherId !== account.id || value.scheduledTeacherName !== account.profile.name))
        fail(403, 'Identitas guru terjadwal tidak sesuai.');
      if (current?.teacherId && current.teacherId !== account.id) fail(403, 'Jurnal milik guru lain.');
      if (value.teacherId && value.teacherId !== account.id) fail(403, 'Identitas guru tidak sesuai.');
      if (
        value.teacherStatus !== 'digantikan' &&
        (value.teacherId !== account.id || value.teacherName !== account.profile.name)
      )
        fail(403, 'Identitas pengajar tidak sesuai.');
    }
    if (teacher && kind === 'whatsappLogs') {
      const recording = changes.find(
        (change) =>
          change.kind === 'attendance' &&
          change.value?.id === [value.date, value.subject, value.studentId].join('_'),
      );
      const att = recording?.value;
      const student = await record(db, 'students', value.studentId);
      if (
        current ||
        !att ||
        !student ||
        notified.has(att.id) ||
        recording.before?.status === att.status ||
        att.status !== value.triggerStatus ||
        att.classId !== value.classId ||
        value.parentWhatsapp !== student?.parentWhatsapp ||
        value.deliveryStatus !== 'siap_kirim' ||
        value.autoTriggered !== true
      )
        fail(403, 'Guru hanya dapat mencatat notifikasi otomatis saat mengisi absensi.');
      notified.add(att.id);
      stored = await notification(db, account, change, att, student);
    }
    await db.query(
      `INSERT INTO ht_records(kind,id,value) VALUES($1,$2,$3)
      ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value, version=nextval('ht_version')`,
      [kind, id, stored],
    );
  }
  for (const {kind, id, value} of changes) {
    if (kind !== 'classrooms' || value !== null) continue;
    const result = await db.query(`SELECT
      EXISTS (SELECT FROM ht_records WHERE kind='classrooms' AND value IS NOT NULL) AS has_class,
      EXISTS (SELECT FROM ht_records WHERE kind IN ('students','attendance','journals') AND value->>'classId'=$1)
      OR EXISTS (SELECT FROM ht_accounts WHERE profile->>'classId'=$1) AS in_use`, [id]);
    if (!result.rows[0].has_class || result.rows[0].in_use)
      fail(409, 'Sisakan satu kelas dan pastikan kelas yang dihapus tidak terhubung ke siswa, akun, absensi, atau jurnal.');
  }
  return true;
}
