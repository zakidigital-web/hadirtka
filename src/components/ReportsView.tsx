import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ScheduledReportConfig } from '../types';
import {
  addDaysISO,
  buildWhatsAppShareUrl,
  formatDateLongID,
  formatDateShortID,
  formatTimestampID,
  getMonthRangeISO,
  getTodayISO,
  getWeekRangeISO,
  INDONESIAN_MONTHS,
  SUBJECT_META,
} from '../utils/formatters';
import {
  buildJournalReportRows,
  buildWhatsAppSummaryText,
  computeReportData,
  downloadAttendanceCSV,
  downloadMonthlyReportPDF,
  generateReportPDF,
  defaultSignatures,
  generateTeacherAttendancePDF,
  generateClassJournalPDF,
} from '../utils/pdfGenerator';

type ReportMode = 'mingguan' | 'bulanan' | 'jurnal_pdf';
type PeriodPreset = 'harian' | 'minggu_ini' | '7_hari' | 'minggu_lalu' | 'kustom';

export const ReportsView: React.FC = () => {
  const { data, updateReportSchedule, pushToast } = useApp();
  const todayISO = getTodayISO();
  const nowDate = new Date();

  const [mode, setMode] = useState<ReportMode>('mingguan');
  const [classId, setClassId] = useState<string>('all');

  // Weekly / On-demand state
  const [preset, setPreset] = useState<PeriodPreset>('harian');
  const [reportDate, setReportDate] = useState(todayISO);
  const currentWeek = useMemo(() => getWeekRangeISO(todayISO), [todayISO]);
  const [customStart, setCustomStart] = useState(addDaysISO(todayISO, -6));
  const [customEnd, setCustomEnd] = useState(todayISO);

  // Monthly PDF state
  const [selectedMonth, setSelectedMonth] = useState<number>(nowDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(nowDate.getFullYear());
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Periodic journal schedule state
  const [scheduleDraft, setScheduleDraft] = useState<ScheduledReportConfig>(
    data.reportSchedule || {
      frequency: 'mingguan',
      dayOfWeek: 'Jumat',
      dayOfMonth: 28,
      timeWib: '17:00',
      includeJournalDetails: true,
      includeAttendanceSummary: true,
    }
  );

  const signatures = data.reportSchedule?.signatures || defaultSignatures;
  const [signatureDraft, setSignatureDraft] = useState(signatures);
  const periodRange = useMemo(() => {
    if (mode === 'bulanan') {
      const range = getMonthRangeISO(selectedYear, selectedMonth);
      return {
        start: range.start,
        end: range.end,
        title: `Laporan Bulanan ${INDONESIAN_MONTHS[selectedMonth]} ${selectedYear}`,
        periodLabel: `${INDONESIAN_MONTHS[selectedMonth]} ${selectedYear} (${formatDateShortID(range.start)} – ${formatDateShortID(range.end)})`,
      };
    }

    if (preset === 'harian') {
      return {
        start: reportDate,
        end: reportDate,
        title: mode === 'jurnal_pdf' ? 'Laporan Jurnal Kelas Harian' : 'Laporan Kehadiran Harian',
        periodLabel: formatDateLongID(reportDate),
      };
    }

    if (preset === 'minggu_ini') {
      return {
        start: currentWeek.start,
        end: currentWeek.end,
        title:
          mode === 'jurnal_pdf'
            ? 'Laporan Jurnal Kelas — Minggu Ini'
            : 'Laporan Mingguan Bimbel TKA (Minggu Ini)',
        periodLabel: `${formatDateShortID(currentWeek.start)} – ${formatDateShortID(currentWeek.end)}`,
      };
    }
    if (preset === '7_hari') {
      const start = addDaysISO(todayISO, -6);
      return {
        start,
        end: todayISO,
        title:
          mode === 'jurnal_pdf'
            ? 'Laporan Jurnal Kelas — 7 Hari Terakhir'
            : 'Laporan 7 Hari Terakhir Bimbel TKA',
        periodLabel: `${formatDateShortID(start)} – ${formatDateShortID(todayISO)}`,
      };
    }
    if (preset === 'minggu_lalu') {
      const prevStart = addDaysISO(currentWeek.start, -7);
      const prevEnd = addDaysISO(currentWeek.end, -7);
      return {
        start: prevStart,
        end: prevEnd,
        title:
          mode === 'jurnal_pdf'
            ? 'Laporan Jurnal Kelas — Minggu Lalu'
            : 'Laporan Mingguan Bimbel TKA (Minggu Lalu)',
        periodLabel: `${formatDateShortID(prevStart)} – ${formatDateShortID(prevEnd)}`,
      };
    }

    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return {
      start,
      end,
      title:
        mode === 'jurnal_pdf'
          ? 'Laporan Jurnal Kelas — Periode Kustom'
          : 'Laporan Monitoring Periode Kustom',
      periodLabel: `${formatDateShortID(start)} – ${formatDateShortID(end)}`,
    };
  }, [mode, preset, reportDate, currentWeek, todayISO, customStart, customEnd, selectedMonth, selectedYear]);

  const report = useMemo(
    () =>
      computeReportData({
        title: periodRange.title,
        periodLabel: periodRange.periodLabel,
        startDate: periodRange.start,
        endDate: periodRange.end,
        classId,
        classrooms: data.classrooms,
        students: data.students,
        attendance: data.attendance,
        journals: data.journals,
        institutionName: data.whatsappSettings.institutionName,
      }),
    [periodRange, classId, data]
  );

  const journalRows = useMemo(
    () =>
      buildJournalReportRows({
        startDate: periodRange.start,
        endDate: periodRange.end,
        classId,
        classrooms: data.classrooms,
        attendance: data.attendance,
        journals: data.journals,
      }),
    [periodRange, classId, data]
  );

  const journalSummaryStats = useMemo(() => {
    const totalSessions = journalRows.length;
    const totalHours =
      Math.round((journalRows.reduce((acc, r) => acc + r.durationMinutes, 0) / 60) * 10) / 10;
    const verified = journalRows.filter((r) => r.journal.verified).length;
    return { totalSessions, totalHours, verified };
  }, [journalRows]);

  const handleDownloadPDF = () => {
    if (mode === 'jurnal_pdf') {
      generateClassJournalPDF({
        signatures,
        periodTitle: periodRange.title,
        startDate: periodRange.start,
        endDate: periodRange.end,
        classId,
        classrooms: data.classrooms,
        attendance: data.attendance,
        journals: data.journals,
        institutionName: data.whatsappSettings.institutionName,
      });
      updateReportSchedule({
        ...scheduleDraft,
        signatures,
        lastGeneratedAt: new Date().toISOString(),
      });
      return;
    }

    if (mode === 'bulanan') {
      downloadMonthlyReportPDF({
        signatures,
        year: selectedYear,
        monthIndex: selectedMonth,
        classId,
        classrooms: data.classrooms,
        students: data.students,
        attendance: data.attendance,
        journals: data.journals,
        institutionName: data.whatsappSettings.institutionName,
      });
      pushToast({
        title: 'Laporan Bulanan PDF diunduh',
        subtitle: `${INDONESIAN_MONTHS[selectedMonth]} ${selectedYear} · ${report.classLabel}`,
        tone: 'success',
      });
    } else {
      generateReportPDF(report, `Laporan-TKA-${preset === 'harian' ? reportDate : periodRange.start + '_sd_' + periodRange.end}.pdf`, signatures);
      pushToast({
        title: 'Laporan PDF berhasil diunduh',
        subtitle: `${periodRange.periodLabel} · ${report.classLabel}`,
        tone: 'success',
      });
    }
  };

  const handleDownloadCSV = () => {
    downloadAttendanceCSV(
      report,
      `Rekap-Kehadiran-TKA-${periodRange.start}_sd_${periodRange.end}.csv`
    );
    pushToast({
      title: 'File CSV diunduh',
      subtitle: 'Rekap kehadiran siswa siap dibuka di Excel atau Google Sheets.',
      tone: 'success',
    });
  };

  const handleCopySummary = async () => {
    const text = buildWhatsAppSummaryText(report);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      pushToast({
        title: 'Ringkasan laporan disalin',
        subtitle: 'Siap dibagikan ke grup WhatsApp guru atau orang tua.',
        tone: 'default',
      });
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      pushToast({
        title: 'Tidak dapat menyalin otomatis',
        subtitle: 'Silakan unduh file PDF langsung.',
        tone: 'warning',
      });
    }
  };

  const availableYears = [
    nowDate.getFullYear() - 1,
    nowDate.getFullYear(),
    nowDate.getFullYear() + 1,
  ];

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Laporan Absensi Siswa & Konversi Jurnal Kelas ke PDF Berkala
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Laporan Kehadiran dan Jurnal
            </h1>
          </div>

          <div className="no-scrollbar flex overflow-x-auto rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('mingguan')}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                mode === 'mingguan'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kehadiran
            </button>
            <button
              type="button"
              onClick={() => setMode('jurnal_pdf')}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                mode === 'jurnal_pdf'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jurnal Kelas PDF
            </button>
            <button
              type="button"
              onClick={() => setMode('bulanan')}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                mode === 'bulanan'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulanan PDF
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            {mode !== 'bulanan' ? (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Rentang Waktu
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'harian', label: 'Harian' },
                        { id: 'minggu_ini', label: 'Minggu Ini' },
                        { id: '7_hari', label: '7 Hari Terakhir' },
                        { id: 'minggu_lalu', label: 'Minggu Lalu' },
                        { id: 'kustom', label: 'Rentang Kustom' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPreset(p.id)}
                        className={`min-h-[40px] whitespace-nowrap rounded-xl border px-3 text-xs font-medium transition-colors ${
                          preset === p.id
                            ? 'border-blue-700 bg-blue-50 text-blue-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {preset === 'harian' && (
                  <label className="block text-xs font-semibold text-slate-600">
                    Tanggal laporan
                    <input id="report-date" type="date" value={reportDate}
                      onChange={e => { if (e.target.value && e.target.validity.valid) setReportDate(e.target.value); }}
                      className="mt-1.5 block min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900" />
                  </label>
                )}
                {preset === 'kustom' && (
                  <div className="flex items-center gap-2">
                    <div>
                      <label htmlFor="start-date" className="block text-[11px] font-semibold text-slate-500">
                        Dari
                      </label>
                      <input
                        id="start-date"
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="mt-1.5 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="end-date" className="block text-[11px] font-semibold text-slate-500">
                        Sampai
                      </label>
                      <input
                        id="end-date"
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="mt-1.5 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="select-month" className="block text-[11px] font-semibold text-slate-500">
                    Bulan Laporan
                  </label>
                  <select
                    id="select-month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="mt-1.5 min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {INDONESIAN_MONTHS.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="select-year" className="block text-[11px] font-semibold text-slate-500">
                    Tahun
                  </label>
                  <select
                    id="select-year"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="mt-1.5 min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="select-class-report" className="block text-[11px] font-semibold text-slate-500">
                Filter Rombel Kelas 9
              </label>
              <select
                id="select-class-report"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="mt-1.5 min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">Semua Rombel Kelas 9 (SMPN 1 Genteng)</option>
                {data.classrooms.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {mode !== 'jurnal_pdf' && (
              <>
                <button type="button"
                  onClick={() => window.location.assign(buildWhatsAppShareUrl(buildWhatsAppSummaryText(report)))}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-auto">
                  <Send className="h-4 w-4" />
                  Kirim ke grup WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Salin ringkasan
                    </>
                  )}
                </button>

                <button type="button" className="min-h-11 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white"
                  onClick={() => generateReportPDF({...report, title: 'Daftar Hadir Siswa', journals: []},
                    `Daftar-Hadir-Siswa-${periodRange.start}_sd_${periodRange.end}.pdf`, signatures)}>PDF daftar hadir siswa</button>
                <button type="button" className="min-h-11 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white"
                  onClick={() => generateTeacherAttendancePDF(report,
                    `Daftar-Hadir-Guru-${periodRange.start}_sd_${periodRange.end}.pdf`, signatures)}>PDF daftar hadir guru pembimbing</button>
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  CSV
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800 active:scale-[0.99]"
            >
              <Download className="h-4 w-4" />
              {mode === 'jurnal_pdf'
                ? 'Konversi Jurnal ke PDF (Landscape)'
                : mode === 'bulanan'
                ? 'PDF gabungan bulanan'
                : 'PDF gabungan'}
            </button>
          </div>
        </div>
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-semibold">Pengaturan tanda tangan PDF</summary>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => {
          e.preventDefault();
          updateReportSchedule({...data.reportSchedule || scheduleDraft, signatures: signatureDraft});
        }}>
          {([['approverRole','Jabatan yang mengetahui'],['approverName','Nama yang mengetahui'],
             ['reporterRole','Jabatan pelapor'],['reporterName','Nama pelapor']] as const).map(([key,label]) =>
            <label key={key} className="text-sm">{label}
              <input maxLength={100} className="mt-1 block min-h-11 w-full rounded-xl border px-3" value={signatureDraft[key]}
                onChange={e => setSignatureDraft({...signatureDraft, [key]: e.target.value})} />
            </label>)}
          <button className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">Simpan tanda tangan</button>
        </form>
      </details>

      {mode === 'jurnal_pdf' ? (
        /* Dedicated Classroom Journal Periodic PDF Converter */
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-8">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-800">
                  Konversi Otomatis Jurnal Kelas → Dokumen PDF Siap Cetak
                </p>
                <h2 className="mt-0.5 text-base font-bold text-slate-900">{periodRange.title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {periodRange.periodLabel} · {report.classLabel}
                </p>
              </div>
              <BookOpen className="h-5 w-5 shrink-0 text-blue-700" />
            </div>

            {/* 3 Journal Summary Metrics */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[11px] font-medium text-slate-500">Total Sesi</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {journalSummaryStats.totalSessions}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[11px] font-medium text-slate-500">Total Jam Mengajar</p>
                <p className="mt-1 font-mono text-xl font-bold text-blue-800 tabular-nums">
                  {journalSummaryStats.totalHours}j
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[11px] font-medium text-slate-500">Terverifikasi</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
                  {journalSummaryStats.verified}/{journalSummaryStats.totalSessions}
                </p>
              </div>
            </div>

            {/* Responsive Preview List of Journals */}
            <div className="mt-4 divide-y divide-slate-100">
              {journalRows.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">
                  Belum ada jurnal kelas pada periode ini.
                </p>
              ) : (
                journalRows.map((row) => (
                  <article key={row.journal.id} className="py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        <strong className="text-blue-800">{formatDateShortID(row.journal.date)}</strong>
                        {' · '}
                        {row.className} · {SUBJECT_META[row.journal.subject]?.short || 'TKA'} · {row.journal.teacherName}
                      </span>
                      <span className="font-mono tabular-nums">
                        {row.journal.checkInTime}–{row.journal.checkOutTime} WIB · Siswa {row.presentCount}H/{row.absentCount}Abs
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900">
                      {row.journal.topic}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">{row.journal.moduleRef}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {row.journal.summary}
                    </p>
                    {row.journal.obstacles && (
                      <p className="mt-1 text-xs text-amber-800">
                        Kendala: {row.journal.obstacles}
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Periodic PDF Schedule Configuration */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Jadwal Unduh Berkala</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Atur siklus penerbitan PDF jurnal kelas rutin untuk arsip admin.
                </p>
              </div>
              <CalendarClock className="h-5 w-5 shrink-0 text-blue-700" />
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Siklus Laporan</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setScheduleDraft((prev) => ({ ...prev, frequency: 'mingguan' }))
                    }
                    className={`min-h-[42px] rounded-xl border text-xs font-semibold ${
                      scheduleDraft.frequency === 'mingguan'
                        ? 'border-blue-700 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Setiap Minggu
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setScheduleDraft((prev) => ({ ...prev, frequency: 'bulanan' }))
                    }
                    className={`min-h-[42px] rounded-xl border text-xs font-semibold ${
                      scheduleDraft.frequency === 'bulanan'
                        ? 'border-blue-700 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Setiap Bulan
                  </button>
                </div>
              </div>

              {scheduleDraft.frequency === 'mingguan' ? (
                <div>
                  <label htmlFor="sched-day" className="block text-xs font-semibold text-slate-700">
                    Hari Penerbitan
                  </label>
                  <select
                    id="sched-day"
                    value={scheduleDraft.dayOfWeek}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, dayOfWeek: e.target.value }))
                    }
                    className="mt-1.5 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900"
                  >
                    {['Jumat', 'Sabtu', 'Minggu', 'Senin'].map((d) => (
                      <option key={d} value={d}>
                        Setiap Hari {d}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="sched-date" className="block text-xs font-semibold text-slate-700">
                    Tanggal Cetak Bulanan
                  </label>
                  <input
                    id="sched-date"
                    type="number"
                    min={1}
                    max={28}
                    value={scheduleDraft.dayOfMonth}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({
                        ...prev,
                        dayOfMonth: Math.min(28, Math.max(1, Number(e.target.value) || 28)),
                      }))
                    }
                    className="mt-1.5 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
              )}

              <div>
                <label htmlFor="sched-time" className="block text-xs font-semibold text-slate-700">
                  Jam Pengingat (WIB)
                </label>
                <input
                  id="sched-time"
                  type="time"
                  value={scheduleDraft.timeWib}
                  onChange={(e) =>
                    setScheduleDraft((prev) => ({ ...prev, timeWib: e.target.value }))
                  }
                  className="mt-1.5 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={() => updateReportSchedule({...scheduleDraft, signatures})}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Simpan Jadwal Berkala
              </button>

              {data.reportSchedule?.lastGeneratedAt && (
                <p className="text-[11px] text-slate-500">
                  Terakhir dikonversi PDF:{' '}
                  <span className="font-mono text-slate-700">
                    {formatTimestampID(data.reportSchedule.lastGeneratedAt)}
                  </span>
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* Weekly / Monthly Full Document Sheet Preview */
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-800">{report.institutionName}</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{report.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Periode: {report.periodLabel} · {report.classLabel}
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Printer className="h-4 w-4" />
              Pratinjau Dokumen Siap Cetak
            </div>
          </div>

          {/* 4 Summary Metrics */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Persentase Kehadiran</p>
              <p className="mt-1 font-mono text-2xl font-bold text-blue-800 tabular-nums">
                {report.attendanceRate}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Total Sesi Hadir</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {report.totalHadir}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Izin / Sakit / Alpha</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {report.totalIzin} / {report.totalSakit} /{' '}
                <span className="text-rose-700">{report.totalAlpha}</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Jurnal Guru Tercatat</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {report.journals.length}
                <span className="ml-1 text-xs font-normal text-slate-500">sesi</span>
              </p>
            </div>
          </div>

          {/* Section 1: Student Attendance (Mobile Native Cards + Desktop Table) */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">
              1. Rekapitulasi Kehadiran Siswa ({report.studentRows.length} siswa)
            </h3>

            {report.classGroups.map(group => <section key={group[0].student.classId} className="mt-4">
            <h4 className="rounded-lg bg-blue-50 p-2 font-semibold text-blue-900">{group[0].className}</h4>
            <div className="mt-3 divide-y divide-slate-100 md:hidden">
              {group.map((row, index) => (
                <div key={row.student.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {index + 1}. {row.student.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.className} · H:{row.hadir} I:{row.izin} S:{row.sakit} A:{row.alpha}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                      row.total === 0
                        ? 'text-slate-400'
                        : row.percentage >= 85
                        ? 'text-emerald-700'
                        : row.percentage >= 75
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {row.total > 0 ? `${row.percentage}%` : '—'}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 font-semibold">NIS</th>
                    <th className="py-2.5 pr-3 font-semibold">Nama Siswa</th>
                    <th className="py-2.5 pr-3 font-semibold">Kelas</th>
                    <th className="py-2.5 px-2 text-right font-semibold">Hadir</th>
                    <th className="py-2.5 px-2 text-right font-semibold">Izin</th>
                    <th className="py-2.5 px-2 text-right font-semibold">Sakit</th>
                    <th className="py-2.5 px-2 text-right font-semibold">Alpha</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.map((row, index) => (
                    <tr key={row.student.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 pr-3 font-mono text-slate-500">{row.student.nis}</td>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{index + 1}. {row.student.name}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{row.className}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-medium text-emerald-700 tabular-nums">
                        {row.hadir}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-sky-700 tabular-nums">
                        {row.izin}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-amber-700 tabular-nums">
                        {row.sakit}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-medium text-rose-700 tabular-nums">
                        {row.alpha}
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-right font-mono font-semibold tabular-nums ${
                          row.total === 0
                            ? 'text-slate-400'
                            : row.percentage >= 85
                            ? 'text-emerald-700'
                            : row.percentage >= 75
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {row.total > 0 ? `${row.percentage}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </section>)}
          </div>

          {/* Section 2: Teacher Journals Included in Report */}
          <div className="mt-7 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                2. Lampiran Jurnal Kehadiran & Materi Guru ({report.journals.length} sesi)
              </h3>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>

            {report.journals.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Belum ada jurnal guru tercatat pada rentang tanggal yang dipilih.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {report.journals.map((j) => (
                  <div
                    key={j.id}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">
                        <span className="font-semibold text-blue-800">
                          {formatDateShortID(j.date)}
                        </span>
                        {' · '}
                        {j.className}
                        {' · '}
                        {SUBJECT_META[j.subject]?.short || 'TKA'}
                        {' · '}
                        {j.teacherName}
                        {' · '}
                        <span className="font-mono tabular-nums">
                          {j.checkInTime}–{j.checkOutTime} WIB
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">{j.topic}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{j.summary}</p>
                    </div>
                    <p className="shrink-0 text-xs font-medium text-slate-500">{j.moduleRef}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
