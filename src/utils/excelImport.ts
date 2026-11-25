import * as XLSX from 'xlsx';
import { Classroom, ExcelImportRow, Student } from '../types';
import { formatPhoneDisplay } from './formatters';

export function downloadExcelTemplate(classrooms: Classroom[]): void {
  const defaultClassA = classrooms[0]?.name || 'Kelas 9A';
  const defaultClassB = classrooms[1]?.name || 'Kelas 9B';
  const defaultClassC = classrooms[2]?.name || 'Kelas 9C';

  const sampleRows = [
    {
      NIS: 'DEMO 1',
      Nama_Siswa: 'Siswa Contoh 1',
      Nama_Kelas: defaultClassA,
      Nama_Orang_Tua: 'Wali Contoh 1',
      No_WA_Orang_Tua: '',
      No_Absen_Keterangan: 'Absen 07 · SMPN 1 Genteng',
      Catatan: 'Fokus latihan Matematika TKA (Persamaan & Geometri)',
    },
    {
      NIS: 'DEMO 2',
      Nama_Siswa: 'Siswa Contoh 2',
      Nama_Kelas: defaultClassB,
      Nama_Orang_Tua: 'Wali Contoh 2',
      No_WA_Orang_Tua: '',
      No_Absen_Keterangan: 'Absen 07 · SMPN 1 Genteng',
      Catatan: 'Aktif pada sesi Bahasa Indonesia TKA',
    },
    {
      NIS: 'DEMO 3',
      Nama_Siswa: 'Siswa Contoh 3',
      Nama_Kelas: defaultClassC,
      Nama_Orang_Tua: 'Wali Contoh 3',
      No_WA_Orang_Tua: '',
      No_Absen_Keterangan: 'Absen 07 · SMPN 1 Genteng',
      Catatan: '',
    },
  ];

  const instructions = [
    { Kolom: 'NIS', Wajib: 'Opsional', Keterangan: 'NIS / NISN siswa SMP Negeri 1 Genteng. Jika kosong dibuat otomatis.' },
    { Kolom: 'Nama_Siswa', Wajib: 'Wajib', Keterangan: 'Nama lengkap siswa Kelas 9 SMP Negeri 1 Genteng.' },
    {
      Kolom: 'Nama_Kelas',
      Wajib: 'Wajib',
      Keterangan: `Rombel Kelas 9 (contoh: ${classrooms.map((c) => c.name).join(', ')}). Jika rombel belum ada (mis. Kelas 9E), otomatis dibuat.`,
    },
    { Kolom: 'Nama_Orang_Tua', Wajib: 'Opsional', Keterangan: 'Nama orang tua/wali penerima notifikasi WA real-time.' },
    {
      Kolom: 'No_WA_Orang_Tua',
      Wajib: 'Opsional',
      Keterangan: 'Nomor WhatsApp aktif format 08xxxx atau 628xxxx (minimal 9 digit).',
    },
    { Kolom: 'No_Absen_Keterangan', Wajib: 'Opsional', Keterangan: 'Nomor absen rombel atau keterangan tambahan siswa.' },
    { Kolom: 'Catatan', Wajib: 'Opsional', Keterangan: 'Catatan khusus belajar persiapan TKA Kelas 9.' },
  ];

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sampleRows);
  wsData['!cols'] = [
    { wch: 13 },
    { wch: 26 },
    { wch: 16 },
    { wch: 24 },
    { wch: 18 },
    { wch: 26 },
    { wch: 36 },
  ];

  const wsGuide = XLSX.utils.json_to_sheet(instructions);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 70 }];

  XLSX.utils.book_append_sheet(wb, wsData, 'Data_Siswa_Kls9');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk_Pengisian');

  XLSX.writeFile(wb, 'Template-Siswa-TKA-Kelas9-SMPN1Genteng.xlsx');
}

export function exportStudentsToExcel(students: Student[], classrooms: Classroom[]): void {
  const classMap = new Map(classrooms.map((c) => [c.id, c.name]));
  const rows = students.map((s) => ({
    NIS: s.nis,
    Nama_Siswa: s.name,
    Nama_Kelas: classMap.get(s.classId) || '-',
    Nama_Orang_Tua: s.parentName,
    No_WA_Orang_Tua: formatPhoneDisplay(s.parentWhatsapp),
    Asal_Sekolah: s.schoolOrigin,
    Catatan: s.notes || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 13 },
    { wch: 26 },
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 22 },
    { wch: 34 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');
  XLSX.writeFile(wb, `Data-Siswa-HadirTKA-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function normalizeHeaderKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[\s\-/.]+/g, '_');
}

function pickField(record: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    if (record[alias] !== undefined && record[alias] !== '') {
      return record[alias].trim();
    }
  }
  return '';
}

function sanitizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return `0${digits.slice(2)}`;
  if (digits.startsWith('8')) return `0${digits}`;
  return digits;
}

export async function parseExcelFile(
  file: File,
  existingClassrooms: Classroom[],
  existingStudents: Student[]
): Promise<ExcelImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase().includes('siswa')) ||
    workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File Excel tidak memiliki lembar kerja (sheet).');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rawObjects.length === 0) {
    throw new Error('Tidak ada baris data ditemukan di dalam file Excel.');
  }

  const classNameSet = new Set(existingClassrooms.map((c) => c.name.trim().toLowerCase()));
  const existingNisSet = new Set(existingStudents.map((s) => s.nis.trim().toLowerCase()));
  const seenNisInFile = new Set<string>();
  const defaultClassName = existingClassrooms[0]?.name || 'Kelas 9A';

  return rawObjects.slice(0, 500).map((raw, idx) => {
    const normalized: Record<string, string> = {};
    Object.entries(raw).forEach(([k, v]) => {
      normalized[normalizeHeaderKey(k)] = String(v ?? '').trim();
    });

    const name = pickField(normalized, ['nama_siswa', 'nama', 'nama_lengkap', 'siswa', 'student_name']);
    const rawNis = pickField(normalized, ['nis', 'nisn', 'nomor_induk', 'id_siswa', 'kode']);
    const className =
      pickField(normalized, ['nama_kelas', 'kelas', 'class', 'rombel']) || defaultClassName;
    const parentName = pickField(normalized, [
      'nama_orang_tua',
      'orang_tua',
      'wali',
      'nama_wali',
      'parent_name',
    ]);
    const rawWa = pickField(normalized, [
      'no_wa_orang_tua',
      'no_wa',
      'whatsapp',
      'wa_orang_tua',
      'no_hp',
      'telepon',
      'hp',
      'parent_whatsapp',
    ]);
    const schoolOrigin =
      pickField(normalized, ['no_absen_keterangan', 'no_absen', 'asal_sekolah', 'sekolah', 'school']) ||
      'SMPN 1 Genteng';
    const notes = pickField(normalized, ['catatan', 'keterangan', 'notes']);

    const nis = rawNis || `0091${2801 + existingStudents.length + idx}`;
    const parentWhatsapp = sanitizePhone(rawWa);

    const errors: string[] = [];
    if (!name || name.length < 2) errors.push('Nama siswa wajib diisi');
    if (rawWa && parentWhatsapp.length < 9) {
      errors.push('Nomor WA minimal 9 digit');
    }

    const nisLower = nis.toLowerCase();
    if (existingNisSet.has(nisLower) || seenNisInFile.has(nisLower)) {
      errors.push(`NIS ${nis} sudah terdaftar`);
    } else if (nisLower) {
      seenNisInFile.add(nisLower);
    }

    const willCreateClass = !classNameSet.has(className.trim().toLowerCase());

    return {
      rowNumber: idx + 2,
      nis: nis.slice(0, 24),
      name: name.slice(0, 80),
      className: className.slice(0, 60),
      parentName: parentName.slice(0, 80),
      parentWhatsapp: parentWhatsapp.slice(0, 18),
      schoolOrigin: schoolOrigin.slice(0, 80),
      notes: notes.slice(0, 200),
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      willCreateClass,
    };
  });
}
