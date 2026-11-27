export type RoleMode = 'guru' | 'admin';

export type TkaSubject = 'matematika' | 'bahasa_indonesia';

export type NavTab =
  | 'absensi'
  | 'jurnal'
  | 'whatsapp'
  | 'laporan'
  | 'akun_guru'
  | 'analitik'
  | 'kelas';

export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alpha';

export type ComprehensionLevel = 'sangat_baik' | 'baik' | 'cukup' | 'perlu_bimbingan';

export interface Classroom {
  id: string;
  name: string;
  program: string;
  teacherName: string; // Wali rombel / penanggung jawab kelas
  teacherPhone: string;
  schedule: string;
  scheduleDetails?: {
    mode: 'weekly' | 'date';
    days: string[];
    date: string;
    start: string;
    end: string;
  };
  room: string;
  groupWaName?: string;
}

export interface Student {
  id: string;
  nis: string;
  name: string;
  classId: string;
  parentName: string;
  parentWhatsapp: string;
  schoolOrigin: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string; // `${date}_${subject}_${studentId}`
  date: string; // YYYY-MM-DD
  subject: TkaSubject;
  classId: string;
  studentId: string;
  status: AttendanceStatus;
  checkInTime: string; // HH:mm
  comprehension?: ComprehensionLevel;
  note?: string;
  recordedBy: string;
  updatedAt: string; // ISO string
}

export interface TeacherJournal {
  id: string; // `${date}_${subject}_${classId}`
  date: string; // YYYY-MM-DD
  subject: TkaSubject;
  classId: string;
  teacherName: string;
  teacherId?: string;
  scheduledTeacherId?: string;
  scheduledTeacherName?: string;
  teacherStatus: 'hadir' | 'digantikan' | 'tidak_masuk';
  substituteTeacher?: string;
  checkInTime: string;
  checkOutTime: string;
  topic: string;
  moduleRef: string;
  summary: string;
  obstacles: string;
  verified: boolean;
  updatedAt: string;
}

export type WhatsAppDeliveryStatus = 'siap_kirim' | 'terkirim' | 'gagal';

export interface WhatsAppLog {
  id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  subject?: TkaSubject;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  parentName: string;
  parentWhatsapp: string;
  triggerStatus: AttendanceStatus;
  message: string;
  deliveryStatus: WhatsAppDeliveryStatus;
  autoTriggered: boolean;
}

export interface WhatsAppSettings {
  autoNotifyAlpha: boolean;
  autoNotifySakit: boolean;
  autoNotifyIzin: boolean;
  autoNotifyHadir: boolean;
  institutionName: string;
  massGroupName?: string;
  templates: Record<AttendanceStatus, string>;
}

export interface ToastNotice {
  id: string;
  title: string;
  subtitle: string;
  whatsappUrl?: string;
  logId?: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
}

export interface AuthUser {
  accountName?: string;
  revision?: number;
  id: string;
  name: string;
  username: string;
  role: RoleMode;
  title: string;
  nip?: string;
  phone?: string;
  teacherSubject?: TkaSubject;
  classId?: string;
  avatarUrl: string;
}

export interface ReportSignatures {
  approverName: string;
  approverRole: string;
  reporterName: string;
  reporterRole: string;
}

export interface ScheduledReportConfig {
  signatures?: ReportSignatures;
  frequency: 'mingguan' | 'bulanan';
  dayOfWeek: string;
  dayOfMonth: number;
  timeWib: string;
  includeJournalDetails: boolean;
  includeAttendanceSummary: boolean;
  lastGeneratedAt?: string;
}

export interface ExcelImportRow {
  rowNumber: number;
  nis: string;
  name: string;
  className: string;
  parentName: string;
  parentWhatsapp: string;
  schoolOrigin: string;
  notes: string;
  valid: boolean;
  error?: string;
  willCreateClass?: boolean;
}

export interface AppData {
  classrooms: Classroom[];
  students: Student[];
  attendance: AttendanceRecord[];
  journals: TeacherJournal[];
  whatsappLogs: WhatsAppLog[];
  whatsappSettings: WhatsAppSettings;
  reportSchedule?: ScheduledReportConfig;
}
