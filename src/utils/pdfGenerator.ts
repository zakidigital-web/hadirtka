import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AttendanceRecord,
  Classroom,
  Student,
  TeacherJournal,
} from '../types';
import {
  formatDateLongID,
  formatDateShortID,
  INDONESIAN_MONTHS,
  SUBJECT_META,
} from './formatters';

export interface ReportStudentRow {
  student: Student;
  className: string;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  total: number;
  percentage: number;
}

export interface ComputedReport {
  title: string;
  periodLabel: string;
  classLabel: string;
  institutionName: string;
  totalSessions: number;
  totalHadir: number;
  totalIzin: number;
  totalSakit: number;
  totalAlpha: number;
  attendanceRate: number;
  studentRows: ReportStudentRow[];
  classGroups: ReportStudentRow[][];
  journals: (TeacherJournal & { className: string })[];
}

export function computeReportData(params: {
  title: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  classId: string; // 'all' or specific classroom ID
  classrooms: Classroom[];
  students: Student[];
  attendance: AttendanceRecord[];
  journals: TeacherJournal[];
  institutionName: string;
}): ComputedReport {
  const {
    title,
    periodLabel,
    startDate,
    endDate,
    classId,
    classrooms,
    students,
    attendance,
    journals,
    institutionName,
  } = params;

  const classMap = new Map(classrooms.map((c) => [c.id, c]));
  const filteredStudents =
    classId === 'all'
      ? students
      : students.filter((s) => s.classId === classId);

  const filteredAttendance = attendance.filter(
    (rec) =>
      rec.date >= startDate &&
      rec.date <= endDate &&
      (classId === 'all' || rec.classId === classId)
  );

  const filteredJournals = journals
    .filter(
      (j) =>
        j.date >= startDate &&
        j.date <= endDate &&
        (classId === 'all' || j.classId === classId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((j) => ({
      ...j,
      className: classMap.get(j.classId)?.name || j.classId,
    }));

  const studentRows: ReportStudentRow[] = filteredStudents.map((student) => {
    const records = filteredAttendance.filter((r) => r.studentId === student.id);
    const hadir = records.filter((r) => r.status === 'hadir').length;
    const izin = records.filter((r) => r.status === 'izin').length;
    const sakit = records.filter((r) => r.status === 'sakit').length;
    const alpha = records.filter((r) => r.status === 'alpha').length;
    const total = records.length;
    const percentage = total > 0 ? Math.round((hadir / total) * 100) : 0;

    return {
      student,
      className: classMap.get(student.classId)?.name || '-',
      hadir,
      izin,
      sakit,
      alpha,
      total,
      percentage,
    };
  });

  const groups = new Map<string, ReportStudentRow[]>();
  for (const row of studentRows) {
    if (!groups.has(row.student.classId)) groups.set(row.student.classId, []);
    groups.get(row.student.classId)!.push(row);
  }
  const classGroups = [...groups.values()].sort((a,b) => a[0].className.localeCompare(b[0].className, 'id', {numeric: true}));
  const totalHadir = filteredAttendance.filter((r) => r.status === 'hadir').length;
  const totalIzin = filteredAttendance.filter((r) => r.status === 'izin').length;
  const totalSakit = filteredAttendance.filter((r) => r.status === 'sakit').length;
  const totalAlpha = filteredAttendance.filter((r) => r.status === 'alpha').length;
  const totalSessions = filteredAttendance.length;
  const attendanceRate =
    totalSessions > 0 ? Math.round((totalHadir / totalSessions) * 1000) / 10 : 0;

  const selectedClass = classMap.get(classId);
  const classLabel = selectedClass ? selectedClass.name : 'Semua Rombel Kelas 9';

  return {
    title,
    periodLabel,
    classLabel,
    institutionName,
    totalSessions,
    totalHadir,
    totalIzin,
    totalSakit,
    totalAlpha,
    attendanceRate,
    studentRows,
    classGroups,
    journals: filteredJournals,
  };
}

export function generateReportPDF(report: ComputedReport, fileName: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const teal: [number, number, number] = [13, 110, 110];
  const slateDark: [number, number, number] = [15, 23, 42];
  const slateMuted: [number, number, number] = [100, 116, 139];

  // Header band
  doc.setFillColor(...teal);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(report.institutionName.toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(report.title, 14, 19);

  doc.setFontSize(8.5);
  doc.text(`Dicetak: ${formatDateLongID(new Date().toISOString().slice(0, 10))}`, pageWidth - 14, 12, {
    align: 'right',
  });
  doc.text(`Kelas: ${report.classLabel}`, pageWidth - 14, 19, { align: 'right' });

  // Period metadata line
  doc.setTextColor(...slateDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`Periode Laporan: ${report.periodLabel}`, 14, 37);

  // Summary metric boxes (4 clean bordered cells)
  const boxY = 42;
  const boxW = (pageWidth - 28 - 9) / 4;
  const summaryCards = [
    { label: 'Tingkat Kehadiran', value: `${report.attendanceRate}%` },
    { label: 'Total Hadir', value: `${report.totalHadir} sesi` },
    { label: 'Izin / Sakit', value: `${report.totalIzin} / ${report.totalSakit}` },
    { label: 'Tanpa Ket. (Alpha)', value: `${report.totalAlpha} sesi` },
  ];

  summaryCards.forEach((item, idx) => {
    const x = 14 + idx * (boxW + 3);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, boxY, boxW, 17, 2, 2, 'FD');

    doc.setTextColor(...slateMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(item.label, x + 3.5, boxY + 6);

    doc.setTextColor(...slateDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(item.value, x + 3.5, boxY + 13);
  });

  const studentsByClass = new Map(report.classGroups.map(group => [group[0].student.classId, group]));
  const classIds = new Set([...studentsByClass.keys(), ...report.journals.map(j => j.classId)]);
  if (!classIds.size) doc.text('Belum ada data pada periode ini.', 14, 68);
  let first = true;
  for (const id of classIds) {
    const students = studentsByClass.get(id) || [];
    const journals = report.journals.filter(j => j.classId === id);
    const name = students[0]?.className || journals[0].className;
    if (!first) doc.addPage();
    autoTable(doc, {
      startY: first ? 64 : 14,
      rowPageBreak: 'avoid',
      head: [[{content: 'Rekapitulasi Kehadiran Siswa · ' + name, colSpan: 9}], ['No', 'NIS', 'Nama Siswa', 'Kelas', 'H', 'I', 'S', 'A', 'Kehadiran']],
      body: students.map((row, index) => [
        String(index + 1),
        row.student.nis,
        row.student.name,
        row.className,
        String(row.hadir),
        String(row.izin),
        String(row.sakit),
        String(row.alpha),
        `${row.percentage}%`,
      ]),
      styles: {
        fontSize: 8.5,
        cellPadding: {top: 1, bottom: 1, left: 2, right: 2},
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: teal,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 9 },
        1: { cellWidth: 22 },
        4: { halign: 'center', cellWidth: 10 },
        5: { halign: 'center', cellWidth: 10 },
        6: { halign: 'center', cellWidth: 10 },
        7: { halign: 'center', cellWidth: 10 },
        8: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    first = false;
    if (!journals.length) continue;
    const lastY = (doc as unknown as {lastAutoTable: {finalY: number}}).lastAutoTable.finalY;
    const newPage = lastY + 28 > doc.internal.pageSize.getHeight() - 14;
    if (newPage) doc.addPage();
    autoTable(doc, {
      startY: newPage ? 14 : lastY + 4,
      rowPageBreak: 'avoid',
      head: [[{content: 'Jurnal Kehadiran & Pengajaran Guru · ' + name, colSpan: 5}],
        ['Tanggal', 'Kelas & Guru', 'Jam', 'Materi TKA', 'Ringkasan / Kendala']],
      body: journals.map((j) => [
              formatDateShortID(j.date),
              `${j.className} (${SUBJECT_META[j.subject]?.short || 'TKA'})\n${j.teacherName}`,
              `${j.checkInTime}-${j.checkOutTime}`,
              `${j.topic}\n(${j.moduleRef})`,
              j.summary,
            ]),
      styles: {
        fontSize: 8,
        cellPadding: {top: 1, bottom: 1, left: 2, right: 2},
        textColor: [30, 41, 59],
        valign: 'top',
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 23 },
        1: { cellWidth: 34 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 44 },
      },
      margin: { left: 14, right: 14 },
    });

  }

  // Signature block on final page
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 200;
  let sigY = finalY + 16;
  if (sigY > 255) {
    doc.addPage();
    sigY = 28;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...slateDark);

  doc.text('Mengetahui,', 14, sigY);
  doc.text('Koordinator TKA Kelas 9 / Waka Kurikulum', 14, sigY + 5);
  doc.text('Koordinator Contoh', 14, sigY + 24);
  doc.setDrawColor(148, 163, 184);
  doc.line(14, sigY + 25.5, 76, sigY + 25.5);

  doc.text('Dilaporkan oleh,', pageWidth - 70, sigY);
  doc.text('Perwakilan Guru Pembimbing Kelas 9', pageWidth - 70, sigY + 5);
  doc.text('Guru Contoh A', pageWidth - 70, sigY + 24);
  doc.line(pageWidth - 70, sigY + 25.5, pageWidth - 14, sigY + 25.5);

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...slateMuted);
    doc.text(
      `${report.institutionName} · HadirTKA · Halaman ${p} dari ${totalPages}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  doc.save(fileName);
}

export function downloadMonthlyReportPDF(params: {
  year: number;
  monthIndex: number;
  classId: string;
  classrooms: Classroom[];
  students: Student[];
  attendance: AttendanceRecord[];
  journals: TeacherJournal[];
  institutionName: string;
}): void {
  const monthName = INDONESIAN_MONTHS[params.monthIndex];
  const startDate = `${params.year}-${String(params.monthIndex + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(params.year, params.monthIndex + 1, 0).getDate();
  const endDate = `${params.year}-${String(params.monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const report = computeReportData({
    title: `Laporan Kehadiran & Jurnal Bulanan — ${monthName} ${params.year}`,
    periodLabel: `${monthName} ${params.year} (${formatDateShortID(startDate)} – ${formatDateShortID(endDate)})`,
    startDate,
    endDate,
    classId: params.classId,
    classrooms: params.classrooms,
    students: params.students,
    attendance: params.attendance,
    journals: params.journals,
    institutionName: params.institutionName,
  });

  const slug = `Laporan-Bulanan-TKA-${monthName}-${params.year}.pdf`;
  generateReportPDF(report, slug);
}

export function downloadPeriodReportPDF(params: {
  label: string;
  startDate: string;
  endDate: string;
  classId: string;
  classrooms: Classroom[];
  students: Student[];
  attendance: AttendanceRecord[];
  journals: TeacherJournal[];
  institutionName: string;
}): void {
  const report = computeReportData({
    title: `Laporan Monitoring ${params.label}`,
    periodLabel: `${formatDateShortID(params.startDate)} – ${formatDateShortID(params.endDate)}`,
    startDate: params.startDate,
    endDate: params.endDate,
    classId: params.classId,
    classrooms: params.classrooms,
    students: params.students,
    attendance: params.attendance,
    journals: params.journals,
    institutionName: params.institutionName,
  });

  const slug = `Laporan-TKA-${params.startDate}_sd_${params.endDate}.pdf`;
  generateReportPDF(report, slug);
}

export function downloadAttendanceCSV(report: ComputedReport, fileName: string): void {
  const headers = ['No', 'NIS', 'Nama Siswa', 'Kelas', 'Orang Tua', 'WhatsApp', 'Hadir', 'Izin', 'Sakit', 'Alpha', 'Persentase'];
  const rows = report.classGroups.flatMap(group => group.map((r,index) => [
    index + 1,
    r.student.nis,
    `"${r.student.name}"`,
    `"${r.className}"`,
    `"${r.student.parentName}"`,
    r.student.parentWhatsapp,
    r.hadir,
    r.izin,
    r.sakit,
    r.alpha,
    `${r.percentage}%`,
  ]));
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildWhatsAppSummaryText(report: ComputedReport): string {
  const lines = [
    `*${report.title}*`,
    `Lembaga: ${report.institutionName}`,
    `Kelas: ${report.classLabel}`,
    `Periode: ${report.periodLabel}`,
    '',
    `*Ringkasan Kehadiran:*`,
    `• Tingkat Kehadiran: *${report.attendanceRate}%*`,
    `• Hadir: ${report.totalHadir} sesi`,
    `• Izin: ${report.totalIzin} sesi | Sakit: ${report.totalSakit} sesi | Alpha: ${report.totalAlpha} sesi`,
    `• Jurnal Guru Tercatat: ${report.journals.length} sesi`,
  ];

  const needAttention = report.studentRows.filter((r) => r.total > 0 && (r.alpha > 0 || r.percentage < 80));
  if (needAttention.length > 0) {
    lines.push('', '*Siswa Perlu Perhatian:*');
    needAttention.slice(0, 6).forEach((r) => {
      lines.push(`• ${r.student.name} (${r.className}) — Hadir ${r.percentage}%, Alpha ${r.alpha}x`);
    });
  }

  lines.push('', '_Dibuat otomatis melalui HadirTKA_');
  return lines.join('\n');
}

export function computeSessionMinutes(checkIn: string, checkOut: string): number {
  const [h1, m1] = checkIn.split(':').map(Number);
  const [h2, m2] = checkOut.split(':').map(Number);
  if ([h1, m1, h2, m2].some((v) => Number.isNaN(v))) return 120;
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  return diff > 0 ? diff : 120;
}

export interface JournalPDFRow {
  journal: TeacherJournal;
  className: string;
  presentCount: number;
  absentCount: number;
  durationMinutes: number;
}

export function buildJournalReportRows(params: {
  startDate: string;
  endDate: string;
  classId: string;
  classrooms: Classroom[];
  attendance: AttendanceRecord[];
  journals: TeacherJournal[];
}): JournalPDFRow[] {
  const classMap = new Map(params.classrooms.map((c) => [c.id, c.name]));

  return params.journals
    .filter(
      (j) =>
        j.date >= params.startDate &&
        j.date <= params.endDate &&
        (params.classId === 'all' || j.classId === params.classId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((journal) => {
      const sessionAtt = params.attendance.filter(
        (a) =>
          a.date === journal.date &&
          a.classId === journal.classId &&
          a.subject === journal.subject
      );
      const presentCount = sessionAtt.filter((a) => a.status === 'hadir').length;
      const absentCount = sessionAtt.filter((a) => a.status !== 'hadir').length;

      return {
        journal,
        className: classMap.get(journal.classId) || journal.classId,
        presentCount,
        absentCount,
        durationMinutes: computeSessionMinutes(journal.checkInTime, journal.checkOutTime),
      };
    });
}

export function generateClassJournalPDF(params: {
  periodTitle: string;
  startDate: string;
  endDate: string;
  classId: string;
  classrooms: Classroom[];
  attendance: AttendanceRecord[];
  journals: TeacherJournal[];
  institutionName: string;
}): void {
  const rows = buildJournalReportRows(params);
  const selectedClass = params.classrooms.find((c) => c.id === params.classId);
  const classLabel = selectedClass ? selectedClass.name : 'Semua Rombel Kelas 9';

  const totalSessions = rows.length;
  const totalMinutes = rows.reduce((acc, r) => acc + r.durationMinutes, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const verifiedCount = rows.filter((r) => r.journal.verified).length;
  const verifiedRate = totalSessions > 0 ? Math.round((verifiedCount / totalSessions) * 100) : 0;
  const totalPresent = rows.reduce((acc, r) => acc + r.presentCount, 0);
  const totalTracked = rows.reduce((acc, r) => acc + r.presentCount + r.absentCount, 0);
  const avgStudentRate = totalTracked > 0 ? Math.round((totalPresent / totalTracked) * 100) : 0;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const teal: [number, number, number] = [13, 110, 110];
  const slateDark: [number, number, number] = [15, 23, 42];
  const slateMuted: [number, number, number] = [100, 116, 139];

  // Header band
  doc.setFillColor(...teal);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`${params.institutionName.toUpperCase()} — LAPORAN JURNAL KELAS BERKALA`, 14, 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Periode: ${params.periodTitle} (${formatDateShortID(params.startDate)} s.d. ${formatDateShortID(params.endDate)})`,
    14,
    19
  );
  doc.text(`Kelas: ${classLabel}`, pageWidth - 14, 11.5, { align: 'right' });
  doc.text(`Tanggal Cetak: ${formatDateLongID(new Date().toISOString().slice(0, 10))}`, pageWidth - 14, 19, {
    align: 'right',
  });

  // 4 Summary Cards
  const boxY = 32;
  const boxW = (pageWidth - 28 - 9) / 4;
  const cards = [
    { label: 'Total Sesi Mengajar', value: `${totalSessions} sesi` },
    { label: 'Akumulasi Jam Mengajar', value: `${totalHours} jam` },
    { label: 'Jurnal Terverifikasi', value: `${verifiedCount}/${totalSessions} (${verifiedRate}%)` },
    { label: 'Rata-rata Kehadiran Siswa', value: `${avgStudentRate}%` },
  ];

  cards.forEach((card, i) => {
    const x = 14 + i * (boxW + 3);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, boxY, boxW, 16, 2, 2, 'FD');
    doc.setTextColor(...slateMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(card.label, x + 4, boxY + 5.5);
    doc.setTextColor(...slateDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(card.value, x + 4, boxY + 12.5);
  });

  const journalGroups = new Map<string, typeof rows>();
  for (const row of rows) {
    const id = row.journal.classId;
    if (!journalGroups.has(id)) journalGroups.set(id, []);
    journalGroups.get(id)!.push(row);
  }
  const groups = journalGroups.size ? [...journalGroups.values()] : [[]];
  groups.forEach((group, index) => {
    if (index) doc.addPage();
    // Detailed Journal Table
    autoTable(doc, {
      startY: index === 0 ? 54 : 14,
      rowPageBreak: 'avoid',
      head: [
        [{content: group[0]?.className || classLabel, colSpan: 9}],
        [
          'No',
          'Tanggal',
          'Kelas & Guru',
          'Jam Sesi',
          'Siswa (H/Abs)',
          'Materi TKA & Modul',
          'Ringkasan Perkembangan Kelas',
          'Kendala & Tindak Lanjut',
          'Status',
        ],
      ],
      body:
        group.length > 0
          ? group.map((row, idx) => [
              String(idx + 1),
              formatDateShortID(row.journal.date),
              `${row.className} · ${SUBJECT_META[row.journal.subject]?.short || 'TKA'}\n${row.journal.teacherName}`,
              `${row.journal.checkInTime}–${row.journal.checkOutTime}\n(${Math.round(row.durationMinutes / 60 * 10) / 10}j)`,
              `${row.presentCount} H / ${row.absentCount} Abs`,
              `${row.journal.topic}\n[${row.journal.moduleRef}]`,
              row.journal.summary,
              row.journal.obstacles,
              row.journal.verified ? 'Terverifikasi' : 'Draf',
            ])
          : [['-', '-', '-', '-', '-', 'Belum ada data jurnal kelas pada periode ini.', '-', '-', '-']],
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
        textColor: [30, 41, 59],
        valign: 'top',
      },
      headStyles: {
        fillColor: teal,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 24 },
        2: { cellWidth: 34 },
        3: { cellWidth: 23, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 46 },
        6: { cellWidth: 54 },
        7: { cellWidth: 38 },
        8: { cellWidth: 19, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

  });

  // Footer & Signatures
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;
  let sigY = lastY + 12;
  if (sigY > 175) {
    doc.addPage();
    sigY = 24;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateDark);
  doc.text('Disetujui oleh, Koordinator TKA Kelas 9', 14, sigY);
  doc.text('Koordinator Contoh', 14, sigY + 18);
  doc.setDrawColor(148, 163, 184);
  doc.line(14, sigY + 19.5, 76, sigY + 19.5);

  doc.text('Dilaporkan oleh, Guru Pembimbing', pageWidth - 74, sigY);
  doc.text(selectedClass?.teacherName || 'Guru Contoh A', pageWidth - 74, sigY + 18);
  doc.line(pageWidth - 74, sigY + 19.5, pageWidth - 14, sigY + 19.5);

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...slateMuted);
    doc.text(
      `${params.institutionName} · Laporan Jurnal Kelas Berkala · Halaman ${p} dari ${pageCount}`,
      pageWidth / 2,
      203,
      { align: 'center' }
    );
  }

  const fileName = `Jurnal-Kelas-TKA-${params.startDate}_sd_${params.endDate}.pdf`;
  doc.save(fileName);
}
