import defaults from '../../shared/defaults.json';
import {
  AppData,
  AttendanceRecord,
  AttendanceStatus,
  Classroom,
  ComprehensionLevel,
  Student,
  TeacherJournal,
  TkaSubject,
  WhatsAppLog,
  WhatsAppSettings,
} from '../types';
import {
  addDaysISO,
  formatDateLongID,
  getTodayISO,
  parseISODate,
  renderWhatsAppTemplate,
  STATUS_META,
} from '../utils/formatters';

export const DEFAULT_WA_SETTINGS: WhatsAppSettings = defaults.whatsappSettings;
const SEED_CLASSROOMS: Classroom[] = defaults.classrooms;

// Subject-based teachers rotating across Kelas 9A-9D each day
const ROTATING_TEACHERS: Record<TkaSubject, string[]> = {
  matematika: ['Guru Contoh A', 'Guru Contoh B'],
  bahasa_indonesia: ['Guru Contoh C', 'Guru Contoh D'],
};

const SEED_STUDENTS: Student[] = SEED_CLASSROOMS.flatMap((classroom) =>
  Array.from({ length: 6 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    const label = classroom.id.slice(4);
    return {
      id: `stu-${label}-${number}`,
      nis: `DEMO-${label}-${number}`,
      name: `Siswa Contoh ${label.toUpperCase()}-${number}`,
      classId: classroom.id,
      parentName: `Wali Contoh ${label.toUpperCase()}-${number}`,
      parentWhatsapp: '',
      schoolOrigin: 'Sekolah contoh',
    };
  })
);

const TOPICS_BY_SUBJECT: Record<TkaSubject, string[]> = {
  matematika: [
    'Matematika TKA: Sistem Persamaan Linear Dua Variabel & Pemodelan',
    'Matematika TKA: Kesebangunan, Kekongruenan & Teorema Pythagoras',
    'Matematika TKA: Statistika Penyajian Data, Rata-Rata Gabungan & Peluang',
    'Matematika TKA: Bangun Ruang Sisi Lengkung (Tabung, Kerucut, Bola)',
    'Matematika TKA: Fungsi Kuadrat, Grafik & Soal Cerita Optimasi',
  ],
  bahasa_indonesia: [
    'Bahasa Indonesia TKA: Menentukan Gagasan Utama & Simpulan Teks Informasi',
    'Bahasa Indonesia TKA: Evaluasi Struktur & Kebahasaan Teks Argumentasi',
    'Bahasa Indonesia TKA: Analisis Infografis & Makna Kosakata Kontekstual',
    'Bahasa Indonesia TKA: Menilai Pernyataan Benar/Salah Berbasis Teks Panjang',
    'Bahasa Indonesia TKA: Ringkasan, Paraphrase & Koherensi Paragraf',
  ],
};

function deterministicHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 100);
}

export function createSeedData(): AppData {
  const todayISO = getTodayISO();
  const attendance: AttendanceRecord[] = [];
  const journals: TeacherJournal[] = [];
  const whatsappLogs: WhatsAppLog[] = [];

  for (let offset = 24; offset >= 0; offset--) {
    const dateISO = addDaysISO(todayISO, -offset);
    const dt = parseISODate(dateISO);
    const dayOfWeek = dt.getDay();
    if (dayOfWeek === 0 || (dayOfWeek === 6 && offset > 0)) continue;

    const isToday = offset === 0;

    SEED_CLASSROOMS.forEach((cls, clsIdx) => {
      const classStudents = SEED_STUDENTS.filter((s) => s.classId === cls.id);

      // Rotating subject schedule: classes alternate Matematika & Bahasa Indonesia across days
      // On today, 9A & 9B get Matematika, 9C & 9D get Bahasa Indonesia (plus teachers can switch freely!)
      const activeSubjects: TkaSubject[] = isToday
        ? clsIdx < 2
          ? ['matematika']
          : ['bahasa_indonesia']
        : [(offset + clsIdx) % 2 === 0 ? 'matematika' : 'bahasa_indonesia'];

      activeSubjects.forEach((subject) => {
        const teacherPool = ROTATING_TEACHERS[subject];
        const rotatingTeacher = teacherPool[(clsIdx + offset) % teacherPool.length];

        classStudents.forEach((student, stuIdx) => {
          const roll = deterministicHash(`${dateISO}-${subject}-${student.id}`);
          let status: AttendanceStatus = 'hadir';

          if (
            student.id === 'stu-9a-04' ||
            student.id === 'stu-9b-04' ||
            student.id === 'stu-9c-03'
          ) {
            if (roll < 18) status = 'alpha';
            else if (roll < 28) status = 'izin';
            else if (roll < 34) status = 'sakit';
          } else {
            if (roll < 3) status = 'alpha';
            else if (roll < 8) status = 'sakit';
            else if (roll < 13) status = 'izin';
          }

          if (isToday) {
            if (student.id === 'stu-9a-04') status = 'alpha';
            else if (student.id === 'stu-9a-06') status = 'sakit';
            else if (student.id === 'stu-9b-04') status = 'izin';
            else if (student.id === 'stu-9c-03') status = 'alpha';
            else status = 'hadir';
          }

          const compOptions: ComprehensionLevel[] = ['sangat_baik', 'baik', 'baik', 'cukup'];
          const comprehension: ComprehensionLevel | undefined =
            status === 'hadir'
              ? compOptions[(stuIdx + offset) % compOptions.length]
              : undefined;

          const arrivalMin = (stuIdx * 2 + clsIdx + offset) % 10;
          const checkInTime = `14:${String(arrivalMin).padStart(2, '0')}`;

          const note =
            status === 'alpha'
              ? 'Belum hadir hingga 15 menit setelah sesi Bimbel TKA dimulai.'
              : status === 'sakit'
              ? 'Orang tua mengabari kondisi kurang sehat kepada wali kelas.'
              : status === 'izin'
              ? 'Izin kegiatan keluarga / dispensasi sekolah.'
              : stuIdx % 3 === 0
              ? 'Menyelesaikan latihan soal TKA Kelas 9 dengan baik.'
              : '';

          attendance.push({
            id: `${dateISO}_${subject}_${student.id}`,
            date: dateISO,
            subject,
            classId: cls.id,
            studentId: student.id,
            status,
            checkInTime,
            comprehension,
            note,
            recordedBy: rotatingTeacher,
            updatedAt: `${dateISO}T${checkInTime}:00.000Z`,
          });

          if (status !== 'hadir' && offset <= 10) {
            const renderedMsg = renderWhatsAppTemplate(DEFAULT_WA_SETTINGS.templates[status], {
              nama_siswa: student.name,
              nama_ortu: student.parentName,
              kelas: cls.name,
              status: STATUS_META[status].label,
              tanggal: formatDateLongID(dateISO),
              waktu: checkInTime,
              guru: rotatingTeacher,
              catatan: note,
              lembaga: DEFAULT_WA_SETTINGS.institutionName,
            });

            whatsappLogs.push({
              id: `wa-${dateISO}-${subject}-${student.id}`,
              timestamp: `${dateISO}T${checkInTime}:15.000Z`,
              date: dateISO,
              subject,
              studentId: student.id,
              studentName: student.name,
              classId: cls.id,
              className: cls.name,
              parentName: student.parentName,
              parentWhatsapp: student.parentWhatsapp,
              triggerStatus: status,
              message: renderedMsg,
              deliveryStatus: isToday && status === 'alpha' ? 'siap_kirim' : 'terkirim',
              autoTriggered: true,
            });
          }
        });

        const topics = TOPICS_BY_SUBJECT[subject];
        const topic = topics[(offset + clsIdx) % topics.length];

        if (!(isToday && cls.id === 'cls-9d')) {
          journals.push({
            id: `${dateISO}_${subject}_${cls.id}`,
            date: dateISO,
            subject,
            classId: cls.id,
            teacherName: rotatingTeacher,
            teacherStatus: offset === 4 && cls.id === 'cls-9b' ? 'digantikan' : 'hadir',
            substituteTeacher:
              offset === 4 && cls.id === 'cls-9b' ? 'Guru Contoh B' : undefined,
            checkInTime: '13:30',
            checkOutTime: '14:30',
            topic,
            moduleRef: `Modul ${subject === 'matematika' ? 'Matematika' : 'B. Indonesia'} TKA Kls 9 · Paket ${(offset % 5) + 1}`,
            summary: `Pembelajaran ${topic} berlangsung aktif bersama ${rotatingTeacher}. Siswa mengerjakan 15 butir soal latihan berbasis kisi-kisi TKA SMP dan membahas strategi pengerjaan cepat.`,
            obstacles:
              offset % 4 === 0
                ? 'Sebagian siswa masih perlu latihan ketelitian membaca grafik dan soal cerita bertingkat.'
                : 'Seluruh siswa mengikuti sesi dengan tertib dan kondusif.',
            verified: !isToday || cls.id === 'cls-9a' || cls.id === 'cls-9c',
            updatedAt: `${dateISO}T15:35:00.000Z`,
          });
        }
      });
    });
  }

  whatsappLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  journals.sort((a, b) => b.date.localeCompare(a.date));

  return {
    classrooms: SEED_CLASSROOMS,
    students: SEED_STUDENTS,
    attendance,
    journals,
    whatsappLogs,
    whatsappSettings: DEFAULT_WA_SETTINGS,
  };
}
