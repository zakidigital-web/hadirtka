export interface DbColumnSpec {
  name: string;
  type: string;
  constraint: string;
  description: string;
}

export interface DbTableSpec {
  id: string;
  tableName: string;
  title: string;
  purpose: string;
  relations: string[];
  columns: DbColumnSpec[];
}

export const DATABASE_SCHEMA_TABLES: DbTableSpec[] = [
  {
    id: 'users',
    tableName: 'users',
    title: 'Akun Guru & Admin',
    purpose: 'Autentikasi role-based (RBAC) antara Guru Kelas dan Admin Bimbel TKA.',
    relations: ['1:N -> classrooms (teacher_id)', '1:N -> teacher_journals (recorded_by)'],
    columns: [
      { name: 'id', type: 'UUID', constraint: 'PRIMARY KEY', description: 'ID unik pengguna' },
      { name: 'full_name', type: 'VARCHAR(100)', constraint: 'NOT NULL', description: 'Nama lengkap guru/admin' },
      { name: 'email', type: 'VARCHAR(120)', constraint: 'UNIQUE NOT NULL', description: 'Email login akun' },
      { name: 'password_hash', type: 'TEXT', constraint: 'NOT NULL', description: 'Hash sandi Argon2/Bcrypt' },
      { name: 'role', type: "ENUM('admin','guru')", constraint: 'NOT NULL', description: 'Hak akses aplikasi' },
      { name: 'whatsapp_phone', type: 'VARCHAR(20)', constraint: 'NULL', description: 'Nomor WA aktif staf' },
    ],
  },
  {
    id: 'classrooms',
    tableName: 'classrooms',
    title: 'Master Kelas TKA',
    purpose: 'Menyimpan rombel kelas, guru pengampu, jadwal harian, dan ruangan.',
    relations: ['N:1 -> users (teacher_id)', '1:N -> students', '1:N -> teacher_journals'],
    columns: [
      { name: 'id', type: 'UUID', constraint: 'PRIMARY KEY', description: 'ID unik kelas' },
      { name: 'name', type: 'VARCHAR(80)', constraint: 'NOT NULL', description: 'Nama kelas (mis. TKA Numerasi 6A)' },
      { name: 'program', type: 'VARCHAR(120)', constraint: 'NOT NULL', description: 'Fokus program TKA' },
      { name: 'teacher_id', type: 'UUID', constraint: 'FK -> users.id', description: 'Wali / guru pengampu utama' },
      { name: 'schedule', type: 'VARCHAR(80)', constraint: 'NOT NULL', description: 'Hari dan jam operasional kelas' },
      { name: 'room', type: 'VARCHAR(50)', constraint: 'NOT NULL', description: 'Nama ruang belajar' },
    ],
  },
  {
    id: 'students',
    tableName: 'students',
    title: 'Data Siswa & Kontak Wali',
    purpose: 'Profil anak bimbel TKA beserta nomor WA orang tua untuk notifikasi otomatis.',
    relations: ['N:1 -> classrooms (class_id)', '1:N -> attendance_records'],
    columns: [
      { name: 'id', type: 'UUID', constraint: 'PRIMARY KEY', description: 'ID unik siswa' },
      { name: 'nis', type: 'VARCHAR(24)', constraint: 'UNIQUE NOT NULL', description: 'Nomor induk siswa bimbel' },
      { name: 'class_id', type: 'UUID', constraint: 'FK -> classrooms.id', description: 'Kelas tempat siswa belajar' },
      { name: 'full_name', type: 'VARCHAR(100)', constraint: 'NOT NULL', description: 'Nama lengkap siswa' },
      { name: 'parent_name', type: 'VARCHAR(100)', constraint: 'NOT NULL', description: 'Nama orang tua / wali' },
      { name: 'parent_whatsapp', type: 'VARCHAR(20)', constraint: 'NOT NULL', description: 'Nomor WA aktif (628xxx)' },
      { name: 'school_origin', type: 'VARCHAR(100)', constraint: 'NULL', description: 'Asal sekolah siswa' },
    ],
  },
  {
    id: 'attendance_records',
    tableName: 'attendance_records',
    title: 'Absensi & Monitoring Harian',
    purpose: 'Log harian status kehadiran siswa, waktu datang, pemahaman materi, dan catatan guru.',
    relations: ['N:1 -> students (student_id)', 'N:1 -> classrooms (class_id)'],
    columns: [
      { name: 'id', type: 'UUID', constraint: 'PRIMARY KEY', description: 'ID catatan absensi' },
      { name: 'session_date', type: 'DATE', constraint: 'INDEX NOT NULL', description: 'Tanggal sesi bimbel' },
      { name: 'student_id', type: 'UUID', constraint: 'FK -> students.id', description: 'Referensi siswa' },
      { name: 'class_id', type: 'UUID', constraint: 'FK -> classrooms.id', description: 'Referensi kelas' },
      { name: 'status', type: "ENUM('hadir','izin','sakit','alpha')", constraint: 'NOT NULL', description: 'Status kehadiran harian' },
      { name: 'comprehension', type: 'VARCHAR(24)', constraint: 'NULL', description: 'Level pemahaman materi TKA' },
      { name: 'note', type: 'TEXT', constraint: 'NULL', description: 'Catatan guru untuk siswa' },
    ],
  },
  {
    id: 'teacher_journals',
    tableName: 'teacher_journals',
    title: 'Jurnal Kehadiran & Materi Guru',
    purpose: 'Mencatat kehadiran guru (jam masuk/selesai), materi TKA, modul, dan kendala kelas untuk laporan PDF.',
    relations: ['N:1 -> classrooms (class_id)', 'N:1 -> users (teacher_id)'],
    columns: [
      { name: 'id', type: 'UUID', constraint: 'PRIMARY KEY', description: 'ID jurnal harian' },
      { name: 'session_date', type: 'DATE', constraint: 'INDEX NOT NULL', description: 'Tanggal mengajar' },
      { name: 'class_id', type: 'UUID', constraint: 'FK -> classrooms.id', description: 'Kelas yang diajar' },
      { name: 'teacher_status', type: "ENUM('hadir','digantikan')", constraint: 'NOT NULL', description: 'Status kehadiran guru utama' },
      { name: 'check_in_time', type: 'TIME', constraint: 'NOT NULL', description: 'Jam mulai sesi kelas' },
      { name: 'check_out_time', type: 'TIME', constraint: 'NOT NULL', description: 'Jam selesai sesi kelas' },
      { name: 'topic', type: 'VARCHAR(160)', constraint: 'NOT NULL', description: 'Topik/materi TKA diajarkan' },
      { name: 'summary', type: 'TEXT', constraint: 'NOT NULL', description: 'Ringkasan progres & kendala kelas' },
      { name: 'verified', type: 'BOOLEAN', constraint: 'DEFAULT FALSE', description: 'Status verifikasi jurnal guru' },
    ],
  },
  {
    id: 'whatsapp_notifications',
    tableName: 'whatsapp_notifications',
    title: 'Log Notifikasi WhatsApp Real-Time',
    purpose: 'Antrean dan audit pengiriman pesan WA otomatis ke orang tua saat siswa tidak hadir.',
    relations: ['N:1 -> students (student_id)', 'N:1 -> attendance_records (attendance_id)'],
    columns: [
      { name: 'id', type: 'UUID', constraint: 'PRIMARY KEY', description: 'ID log notifikasi' },
      { name: 'student_id', type: 'UUID', constraint: 'FK -> students.id', description: 'Siswa terkait' },
      { name: 'parent_whatsapp', type: 'VARCHAR(20)', constraint: 'NOT NULL', description: 'Nomor WA tujuan' },
      { name: 'trigger_status', type: 'VARCHAR(16)', constraint: 'NOT NULL', description: 'Status pemicu (alpha/sakit/izin)' },
      { name: 'message_body', type: 'TEXT', constraint: 'NOT NULL', description: 'Isi pesan WA hasil template' },
      { name: 'delivery_status', type: "ENUM('siap_kirim','terkirim','gagal')", constraint: 'NOT NULL', description: 'Status pengiriman real-time' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraint: 'DEFAULT NOW()', description: 'Waktu notifikasi dipicu' },
    ],
  },
];

export const DATABASE_SQL_DDL = `-- Skema Database Relasional HadirTKA (PostgreSQL / MySQL Compatible)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'guru')),
  whatsapp_phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE classrooms (
  id UUID PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  program VARCHAR(120) NOT NULL,
  teacher_id UUID REFERENCES users(id),
  schedule VARCHAR(80) NOT NULL,
  room VARCHAR(50) NOT NULL
);

CREATE TABLE students (
  id UUID PRIMARY KEY,
  nis VARCHAR(24) UNIQUE NOT NULL,
  class_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  parent_name VARCHAR(100) NOT NULL,
  parent_whatsapp VARCHAR(20) NOT NULL,
  school_origin VARCHAR(100),
  notes TEXT
);

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY,
  session_date DATE NOT NULL,
  class_id UUID NOT NULL REFERENCES classrooms(id),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alpha')),
  check_in_time TIME NOT NULL,
  comprehension VARCHAR(24),
  note TEXT,
  recorded_by UUID REFERENCES users(id),
  UNIQUE (session_date, student_id)
);

CREATE TABLE teacher_journals (
  id UUID PRIMARY KEY,
  session_date DATE NOT NULL,
  class_id UUID NOT NULL REFERENCES classrooms(id),
  teacher_id UUID REFERENCES users(id),
  teacher_status VARCHAR(20) NOT NULL CHECK (teacher_status IN ('hadir', 'digantikan')),
  substitute_teacher VARCHAR(100),
  check_in_time TIME NOT NULL,
  check_out_time TIME NOT NULL,
  topic VARCHAR(160) NOT NULL,
  module_ref VARCHAR(120),
  summary TEXT NOT NULL,
  obstacles TEXT,
  verified BOOLEAN DEFAULT FALSE,
  UNIQUE (session_date, class_id)
);

CREATE TABLE whatsapp_notifications (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
  parent_whatsapp VARCHAR(20) NOT NULL,
  trigger_status VARCHAR(16) NOT NULL,
  message_body TEXT NOT NULL,
  delivery_status VARCHAR(20) NOT NULL CHECK (delivery_status IN ('siap_kirim', 'terkirim', 'gagal')),
  auto_triggered BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attendance_date_class ON attendance_records(session_date, class_id);
CREATE INDEX idx_journals_date_class ON teacher_journals(session_date, class_id);
CREATE INDEX idx_wa_status_created ON whatsapp_notifications(delivery_status, created_at DESC);`;
