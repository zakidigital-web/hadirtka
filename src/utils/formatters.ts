import {
  AttendanceRecord,
  AttendanceStatus,
  Classroom,
  ComprehensionLevel,
  Student,
  TeacherJournal,
  TkaSubject,
} from '../types';

export const INDONESIAN_DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const INDONESIAN_DAYS_LONG = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];
export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
export const INDONESIAN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export const SUBJECT_META: Record<
  TkaSubject,
  { label: string; short: string; full: string }
> = {
  matematika: {
    label: 'Matematika',
    short: 'MTK',
    full: 'Matematika TKA',
  },
  bahasa_indonesia: {
    label: 'B. Indonesia',
    short: 'BIN',
    full: 'Bahasa Indonesia TKA',
  },
};

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysISO(iso: string, deltaDays: number): string {
  const dt = parseISODate(iso);
  dt.setDate(dt.getDate() + deltaDays);
  return toISODate(dt);
}

export function formatDateLongID(iso: string): string {
  const dt = parseISODate(iso);
  return `${INDONESIAN_DAYS_LONG[dt.getDay()]}, ${dt.getDate()} ${INDONESIAN_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function formatDateShortID(iso: string): string {
  const dt = parseISODate(iso);
  return `${dt.getDate()} ${INDONESIAN_MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function formatDateCompactID(iso: string): string {
  const dt = parseISODate(iso);
  return `${dt.getDate()} ${INDONESIAN_MONTHS_SHORT[dt.getMonth()]}`;
}

export function formatDateDayShortID(iso: string): string {
  const dt = parseISODate(iso);
  return `${INDONESIAN_DAYS_SHORT[dt.getDay()]}, ${dt.getDate()} ${INDONESIAN_MONTHS_SHORT[dt.getMonth()]}`;
}

export function formatTimeNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function formatTimestampID(isoString: string): string {
  const dt = new Date(isoString);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${dt.getDate()} ${INDONESIAN_MONTHS_SHORT[dt.getMonth()]} · ${hh}:${mm} WIB`;
}

export function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('62')) {
    return `0${digits.slice(2)}`;
  }
  return digits || raw;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizeWhatsAppNumber(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Opens WhatsApp native picker to send message to a WhatsApp Group (Grup Kelas / Grup Massal)
 */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function renderWhatsAppTemplate(
  template: string,
  params: {
    nama_siswa: string;
    nama_ortu: string;
    kelas: string;
    status: string;
    tanggal: string;
    waktu: string;
    guru: string;
    catatan: string;
    lembaga: string;
  }
): string {
  return template
    .replace(/\{nama_siswa\}/g, params.nama_siswa)
    .replace(/\{nama_ortu\}/g, params.nama_ortu)
    .replace(/\{kelas\}/g, params.kelas)
    .replace(/\{status\}/g, params.status)
    .replace(/\{tanggal\}/g, params.tanggal)
    .replace(/\{waktu\}/g, params.waktu)
    .replace(/\{guru\}/g, params.guru)
    .replace(/\{catatan\}/g, params.catatan || 'Tidak ada catatan tambahan.')
    .replace(/\{lembaga\}/g, params.lembaga);
}

const GROUP_ATTENDANCE_FOOTER = '_Mohon Bapak/Ibu wali murid, wali kelas, dan seluruh pihak yang terlibat untuk menindaklanjuti dan mengonfirmasi ketidakhadiran siswa, terutama yang tercatat alfa (tanpa keterangan)._';

export function buildClassGroupAttendanceReport(params: {
  classroom: Classroom;
  date: string;
  subject: TkaSubject;
  teacherName: string;
  students: Student[];
  records: AttendanceRecord[];
  journal?: TeacherJournal;
  institutionName: string;
  includePresentList: boolean;
}): string {
  const {
    classroom,
    date,
    subject,
    teacherName,
    students,
    records,
    journal,
    institutionName,
    includePresentList,
  } = params;

  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));

  const hadirList: Student[] = [];
  const izinList: { s: Student; note?: string }[] = [];
  const sakitList: { s: Student; note?: string }[] = [];
  const alphaList: { s: Student; note?: string }[] = [];
  const belumList: Student[] = [];

  sorted.forEach((s) => {
    const rec = byStudent.get(s.id);
    if (!rec) belumList.push(s);
    else if (rec.status === 'hadir') hadirList.push(s);
    else if (rec.status === 'izin') izinList.push({ s, note: rec.note });
    else if (rec.status === 'sakit') sakitList.push({ s, note: rec.note });
    else alphaList.push({ s, note: rec.note });
  });

  const total = sorted.length;
  const pct = total > 0 ? Math.round((hadirList.length / total) * 100) : 0;

  const lines: string[] = [
    `*LAPORAN KEHADIRAN BIMBEL TKA — ${classroom.name.toUpperCase()}*`,
    `${institutionName}`,
    `Hari/Tanggal: ${formatDateLongID(date)}`,
    `Mapel TKA: *${SUBJECT_META[subject].full}*`,
    `Guru Pengajar: ${journal?.teacherName || teacherName}`,
    '',
    `*Rekapitulasi (${pct}% Hadir):*`,
    `• Hadir: ${hadirList.length} / ${total} siswa`,
    `• Izin: ${izinList.length} | Sakit: ${sakitList.length} | Alpha: ${alphaList.length}`,
  ];

  if (journal?.topic) {
    lines.push(`• Materi: ${journal.topic}`);
  }

  if (alphaList.length > 0) {
    lines.push('', '*Tanpa Keterangan (Alpha):*');
    alphaList.forEach(({ s, note }, i) => {
      lines.push(`${i + 1}. ${s.name}${note ? ` (${note})` : ''}`);
    });
  }

  if (sakitList.length > 0) {
    lines.push('', '*Sakit:*');
    sakitList.forEach(({ s, note }, i) => {
      lines.push(`${i + 1}. ${s.name}${note ? ` (${note})` : ''}`);
    });
  }

  if (izinList.length > 0) {
    lines.push('', '*Izin:*');
    izinList.forEach(({ s, note }, i) => {
      lines.push(`${i + 1}. ${s.name}${note ? ` (${note})` : ''}`);
    });
  }

  if (alphaList.length === 0 && sakitList.length === 0 && izinList.length === 0 && belumList.length === 0) {
    lines.push('', 'Alhamdulillah seluruh siswa hadir lengkap 100%.');
  }

  if (includePresentList && hadirList.length > 0) {
    lines.push('', '*Daftar Siswa Hadir:*');
    hadirList.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.name}`);
    });
  }

  if (belumList.length > 0) {
    lines.push('', `_Belum tercatat: ${belumList.length} siswa_`);
  }

  lines.push('', GROUP_ATTENDANCE_FOOTER, '_Dikirim melalui HadirTKA · SMP Negeri 1 Genteng_');
  return lines.join('\n');
}

export function buildMassAllClassesAttendanceReport(params: {
  date: string;
  subjectFilter: 'all' | TkaSubject;
  classrooms: Classroom[];
  students: Student[];
  attendance: AttendanceRecord[];
  journals: TeacherJournal[];
  institutionName: string;
}): string {
  const { date, subjectFilter, classrooms, students, attendance, journals, institutionName } = params;

  const dayAtt = attendance.filter(
    (r) => r.date === date && (subjectFilter === 'all' || r.subject === subjectFilter)
  );
  const dayJournals = journals.filter(
    (j) => j.date === date && (subjectFilter === 'all' || j.subject === subjectFilter)
  );

  const subjectLabel =
    subjectFilter === 'all'
      ? 'Gabungan (Matematika & Bahasa Indonesia)'
      : SUBJECT_META[subjectFilter].full;

  const lines: string[] = [
    `*REKAP MASSAL KEHADIRAN BIMBEL TKA KELAS 9*`,
    `${institutionName}`,
    `Hari/Tanggal: ${formatDateLongID(date)}`,
    `Mapel TKA: *${subjectLabel}*`,
    '--------------------------------',
  ];

  let grandTotalSlots = 0;
  let grandHadir = 0;
  let grandIzin = 0;
  let grandSakit = 0;
  let grandAlpha = 0;

  classrooms.forEach((cls) => {
    const clsStudents = students.filter((s) => s.classId === cls.id);
    const clsRecs = dayAtt.filter((r) => r.classId === cls.id);
    const clsJournals = dayJournals.filter((j) => j.classId === cls.id);

    // If 'all' subjects selected, deduplicate per student prioritizing non-hadir if multiple sessions exist,
    // or show per-session breakdown concisely
    const hadir = clsRecs.filter((r) => r.status === 'hadir').length;
    const izin = clsRecs.filter((r) => r.status === 'izin').length;
    const sakit = clsRecs.filter((r) => r.status === 'sakit').length;
    const alpha = clsRecs.filter((r) => r.status === 'alpha').length;
    const recorded = clsRecs.length;
    const base = recorded > 0 ? recorded : clsStudents.length;
    const pct = base > 0 && recorded > 0 ? Math.round((hadir / base) * 100) : 0;

    grandTotalSlots += recorded;
    grandHadir += hadir;
    grandIzin += izin;
    grandSakit += sakit;
    grandAlpha += alpha;

    const teacherInfo =
      clsJournals.length > 0
        ? clsJournals.map((j) => `${SUBJECT_META[j.subject].short}: ${j.teacherName}`).join(' | ')
        : 'Belum ada jurnal sesi';

    lines.push(
      `*${cls.name}* — ${recorded > 0 ? `${pct}% Hadir (H:${hadir} I:${izin} S:${sakit} A:${alpha})` : 'Belum diabsen'}`
    );
    lines.push(`Guru: ${teacherInfo}`);

    const nonPresent = clsRecs.filter((r) => r.status !== 'hadir');
    if (nonPresent.length > 0) {
      const stuMap = new Map(clsStudents.map((s) => [s.id, s.name]));
      const names = nonPresent.map((r) => {
        const nm = stuMap.get(r.studentId) || r.studentId;
        return `${nm} (${STATUS_META[r.status].short}-${SUBJECT_META[r.subject].short})`;
      });
      lines.push(`Tidak hadir: ${names.join(', ')}`);
    }
    lines.push('');
  });

  const overallPct = grandTotalSlots > 0 ? Math.round((grandHadir / grandTotalSlots) * 100) : 0;
  lines.push(
    '--------------------------------',
    `*TOTAL KESELURUHAN KELAS 9:*`,
    `• Tingkat Kehadiran: *${overallPct}%*`,
    `• Hadir: ${grandHadir} | Izin: ${grandIzin} | Sakit: ${grandSakit} | Alpha: ${grandAlpha}`,
    '',
    GROUP_ATTENDANCE_FOOTER,
    '_HadirTKA · SMP Negeri 1 Genteng_'
  );

  return lines.join('\n');
}

export const STATUS_META: Record<
  AttendanceStatus,
  {
    label: string;
    short: string;
    textClass: string;
    activeBg: string;
    softBg: string;
    borderClass: string;
    hex: string;
  }
> = {
  hadir: {
    label: 'Hadir',
    short: 'H',
    textClass: 'text-emerald-700',
    activeBg: 'bg-emerald-700 text-white border-emerald-700',
    softBg: 'bg-emerald-50 text-emerald-800',
    borderClass: 'border-emerald-200',
    hex: '#15803D',
  },
  izin: {
    label: 'Izin',
    short: 'I',
    textClass: 'text-sky-700',
    activeBg: 'bg-sky-700 text-white border-sky-700',
    softBg: 'bg-sky-50 text-sky-800',
    borderClass: 'border-sky-200',
    hex: '#0369A1',
  },
  sakit: {
    label: 'Sakit',
    short: 'S',
    textClass: 'text-amber-700',
    activeBg: 'bg-amber-600 text-white border-amber-600',
    softBg: 'bg-amber-50 text-amber-800',
    borderClass: 'border-amber-200',
    hex: '#B45309',
  },
  alpha: {
    label: 'Alpha',
    short: 'A',
    textClass: 'text-rose-700',
    activeBg: 'bg-rose-700 text-white border-rose-700',
    softBg: 'bg-rose-50 text-rose-800',
    borderClass: 'border-rose-200',
    hex: '#B91C1C',
  },
};

export const COMPREHENSION_LABEL: Record<ComprehensionLevel, string> = {
  sangat_baik: 'Sangat Baik',
  baik: 'Baik',
  cukup: 'Cukup',
  perlu_bimbingan: 'Perlu Bimbingan',
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getWeekRangeISO(referenceISO: string): { start: string; end: string } {
  const dt = parseISODate(referenceISO);
  const day = dt.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: toISODate(monday),
    end: toISODate(sunday),
  };
}

export function getMonthRangeISO(year: number, monthIndex: number): { start: string; end: string } {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  return {
    start: toISODate(first),
    end: toISODate(last),
  };
}
