import { TeacherAttendanceTable } from './TeacherAttendanceTable';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Database,
  Download,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DATABASE_SCHEMA_TABLES, DATABASE_SQL_DDL } from '../data/databaseSchema';
import {
  addDaysISO,
  buildWhatsAppUrl,
  formatDateCompactID,
  formatPhoneDisplay,
  getMonthRangeISO,
  getTodayISO,
  INDONESIAN_MONTHS,
  STATUS_META,
  SUBJECT_META,
} from '../utils/formatters';
import { computeSessionMinutes, downloadMonthlyReportPDF } from '../utils/pdfGenerator';

type PeriodKey = '7d' | '14d' | '30d' | 'bulan_ini' | 'custom';
type AdminSubTab = 'analitik' | 'skema';

export const AdminDashboardView: React.FC = () => {
  const { data, pushToast, setActiveTab } = useApp();
  const [adminTab, setAdminTab] = useState<AdminSubTab>('analitik');
  const [period, setPeriod] = useState<PeriodKey>('14d');
  const [copiedSql, setCopiedSql] = useState(false);

  const todayISO = getTodayISO();
  const nowDate = new Date();
  const [month, setMonth] = useState(todayISO.slice(0, 7));
  const [customStart, setCustomStart] = useState(addDaysISO(todayISO, -6));
  const [customEnd, setCustomEnd] = useState(todayISO);

  const dateBounds = useMemo(() => {
    if (period === '7d') return { start: addDaysISO(todayISO, -6), end: todayISO, label: '7 Hari Terakhir' };
    if (period === '14d') return { start: addDaysISO(todayISO, -13), end: todayISO, label: '14 Hari Terakhir' };
    if (period === '30d') return { start: addDaysISO(todayISO, -29), end: todayISO, label: '30 Hari Terakhir' };
    if (period === 'custom') return { start: customStart, end: customEnd, label: customStart + ' – ' + customEnd };
    const [year, monthNumber] = month.split('-').map(Number);
    const monthRange = getMonthRangeISO(year, monthNumber - 1);
    return {
      start: monthRange.start,
      end: monthRange.end,
      label: `${INDONESIAN_MONTHS[monthNumber - 1]} ${year}`,
    };
  }, [period, todayISO, month, customStart, customEnd]);

  const periodAttendance = useMemo(
    () =>
      data.attendance.filter(
        (rec) => rec.date >= dateBounds.start && rec.date <= dateBounds.end
      ),
    [data.attendance, dateBounds]
  );

  const periodJournals = useMemo(
    () =>
      data.journals.filter(
        (j) => j.date >= dateBounds.start && j.date <= dateBounds.end
      ),
    [data.journals, dateBounds]
  );

  const periodWaLogs = useMemo(
    () =>
      data.whatsappLogs.filter(
        (l) => l.date >= dateBounds.start && l.date <= dateBounds.end
      ),
    [data.whatsappLogs, dateBounds]
  );

  const uniqueActiveDays = useMemo(
    () => new Set(periodAttendance.map((r) => r.date)).size,
    [periodAttendance]
  );

  // KPI Metrics
  const kpis = useMemo(() => {
    const total = periodAttendance.length;
    const hadir = periodAttendance.filter((r) => r.status === 'hadir').length;
    const izin = periodAttendance.filter((r) => r.status === 'izin').length;
    const sakit = periodAttendance.filter((r) => r.status === 'sakit').length;
    const alpha = periodAttendance.filter((r) => r.status === 'alpha').length;
    const rate = total > 0 ? Math.round((hadir / total) * 1000) / 10 : 0;

    const expectedJournals = uniqueActiveDays * data.classrooms.length;
    const journalRate =
      expectedJournals > 0
        ? Math.min(100, Math.round((periodJournals.length / expectedJournals) * 100))
        : 0;

    const waSent = periodWaLogs.filter((l) => l.deliveryStatus === 'terkirim').length;

    return {
      total,
      hadir,
      izin,
      sakit,
      alpha,
      rate,
      journalCount: periodJournals.length,
      journalRate,
      waTotal: periodWaLogs.length,
      waSent,
    };
  }, [periodAttendance, periodJournals, periodWaLogs, data.classrooms.length, uniqueActiveDays]);

  // Daily Attendance Trend Data
  const dailyTrend = useMemo(() => {
    const byDate = new Map<string, { hadir: number; total: number; alpha: number }>();
    periodAttendance.forEach((rec) => {
      const curr = byDate.get(rec.date) || { hadir: 0, total: 0, alpha: 0 };
      curr.total += 1;
      if (rec.status === 'hadir') curr.hadir += 1;
      if (rec.status === 'alpha') curr.alpha += 1;
      byDate.set(rec.date, curr);
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date,
        label: formatDateCompactID(date),
        persentase: vals.total > 0 ? Math.round((vals.hadir / vals.total) * 100) : 0,
        hadir: vals.hadir,
        alpha: vals.alpha,
      }));
  }, [periodAttendance]);

  // Class & Teacher Performance Analytics
  const teacherPerformance = useMemo(() => {
    return data.classrooms.map((cls) => {
      const recs = periodAttendance.filter((r) => r.classId === cls.id);
      const hadir = recs.filter((r) => r.status === 'hadir').length;
      const studentRate = recs.length > 0 ? Math.round((hadir / recs.length) * 100) : 0;

      const clsJournals = periodJournals.filter((j) => j.classId === cls.id);
      const presentSessions = clsJournals.filter((j) => j.teacherStatus === 'hadir').length;
      const verifiedSessions = clsJournals.filter((j) => j.verified).length;
      const totalMinutes = clsJournals.reduce(
        (acc, j) => acc + computeSessionMinutes(j.checkInTime, j.checkOutTime),
        0
      );
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

      const journalCompliance =
        uniqueActiveDays > 0
          ? Math.min(100, Math.round((clsJournals.length / uniqueActiveDays) * 100))
          : 0;
      const teacherAttendancePct =
        clsJournals.length > 0
          ? Math.round((presentSessions / clsJournals.length) * 100)
          : 0;

      return {
        id: cls.id,
        className: cls.name,
        shortName: cls.name,
        teacherName: cls.teacherName,
        teacherShort: cls.teacherName.split(',')[0],
        studentCount: data.students.filter((s) => s.classId === cls.id).length,
        sessions: clsJournals.length,
        verifiedSessions,
        totalHours,
        teacherAttendancePct,
        journalCompliance,
        studentRate,
      };
    });
  }, [data.classrooms, data.students, periodAttendance, periodJournals, uniqueActiveDays]);

  // Rotating Teacher Performance Scorecard (grouped by actual teacherName across Kelas 9A-9D)
  const rotatingTeacherSummary = useMemo(() => {
    const classMap = new Map(data.classrooms.map((c) => [c.id, c.name]));
    const byTeacher = new Map<
      string,
      {
        teacherName: string;
        subjects: Set<string>;
        rooms: Set<string>;
        sessions: number;
        presentSessions: number;
        verifiedSessions: number;
        totalMinutes: number;
      }
    >();

    periodJournals.forEach((j) => {
      const existing = byTeacher.get(j.teacherName) || {
        teacherName: j.teacherName,
        subjects: new Set<string>(),
        rooms: new Set<string>(),
        sessions: 0,
        presentSessions: 0,
        verifiedSessions: 0,
        totalMinutes: 0,
      };
      existing.subjects.add(SUBJECT_META[j.subject]?.short || 'TKA');
      existing.rooms.add(classMap.get(j.classId) || j.classId);
      existing.sessions += 1;
      if (j.teacherStatus === 'hadir') existing.presentSessions += 1;
      if (j.verified) existing.verifiedSessions += 1;
      existing.totalMinutes += computeSessionMinutes(j.checkInTime, j.checkOutTime);
      byTeacher.set(j.teacherName, existing);
    });

    return Array.from(byTeacher.values())
      .map((item) => ({
        teacherName: item.teacherName,
        subjectsLabel: Array.from(item.subjects).join(', '),
        roomsLabel: Array.from(item.rooms).sort().join(', '),
        sessions: item.sessions,
        verifiedSessions: item.verifiedSessions,
        totalHours: Math.round((item.totalMinutes / 60) * 10) / 10,
        attendancePct:
          item.sessions > 0 ? Math.round((item.presentSessions / item.sessions) * 100) : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [data.classrooms, periodJournals]);

  // Status Distribution Pie Data
  const statusPie = useMemo(
    () => [
      { name: 'Hadir', value: kpis.hadir, color: STATUS_META.hadir.hex },
      { name: 'Izin', value: kpis.izin, color: STATUS_META.izin.hex },
      { name: 'Sakit', value: kpis.sakit, color: STATUS_META.sakit.hex },
      { name: 'Alpha', value: kpis.alpha, color: STATUS_META.alpha.hex },
    ],
    [kpis]
  );

  // At-Risk / Attention Students
  const attentionStudents = useMemo(() => {
    const classMap = new Map(data.classrooms.map((c) => [c.id, c.name]));
    return data.students
      .map((student) => {
        const recs = periodAttendance.filter((r) => r.studentId === student.id);
        const hadir = recs.filter((r) => r.status === 'hadir').length;
        const alpha = recs.filter((r) => r.status === 'alpha').length;
        const pct = recs.length > 0 ? Math.round((hadir / recs.length) * 100) : 100;
        return {
          student,
          className: classMap.get(student.classId) || '-',
          total: recs.length,
          hadir,
          alpha,
          pct,
        };
      })
      .filter((item) => item.total > 0 && (item.pct < 85 || item.alpha >= 2))
      .sort((a, b) => a.pct - b.pct || b.alpha - a.alpha);
  }, [data.students, data.classrooms, periodAttendance]);

  // Live row counts for Database Schema Inspector
  const liveTableCounts: Record<string, number> = useMemo(
    () => ({
      users: data.classrooms.length + 1,
      classrooms: data.classrooms.length,
      students: data.students.length,
      attendance_records: data.attendance.length,
      teacher_journals: data.journals.length,
      whatsapp_notifications: data.whatsappLogs.length,
    }),
    [data]
  );

  const handleQuickMonthlyPDF = () => {
    downloadMonthlyReportPDF({
      signatures: data.reportSchedule?.signatures,
      year: nowDate.getFullYear(),
      monthIndex: nowDate.getMonth(),
      classId: 'all',
      classrooms: data.classrooms,
      students: data.students,
      attendance: data.attendance,
      journals: data.journals,
      institutionName: data.whatsappSettings.institutionName,
    });
    pushToast({
      title: 'Laporan Bulanan PDF diunduh',
      subtitle: `Rekap lengkap ${INDONESIAN_MONTHS[nowDate.getMonth()]} ${nowDate.getFullYear()} (Semua Rombel Kelas 9).`,
      tone: 'success',
    });
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(DATABASE_SQL_DDL);
      setCopiedSql(true);
      pushToast({
        title: 'Skema SQL DDL disalin',
        subtitle: 'Siap dijalankan pada PostgreSQL atau MySQL.',
        tone: 'default',
      });
      window.setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      pushToast({
        title: 'Gagal menyalin SQL',
        subtitle: 'Silakan blok dan salin teks skema secara manual.',
        tone: 'warning',
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Admin Sub-Navigation */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              SMP Negeri 1 Genteng · Analitik TKA Kelas 9 · {dateBounds.label}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {adminTab === 'analitik'
                ? 'Performa Kehadiran Siswa & Guru Kelas 9'
                : 'Skema Database & Arsitektur Data'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => setActiveTab('cadangan')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 px-3 text-sm font-semibold text-blue-700">
              <Database className="h-4 w-4" /> Cadangan database
            </button>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setAdminTab('analitik')}
                className={`inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                  adminTab === 'analitik'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analitik Performa
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('skema')}
                className={`inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                  adminTab === 'skema'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                Skema Database
              </button>
            </div>

            {adminTab === 'analitik' && (
              <button
                type="button"
                onClick={handleQuickMonthlyPDF}
                className="inline-flex min-h-[42px] items-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800"
              >
                <Download className="h-4 w-4" />
                Unduh PDF Bulan Ini
              </button>
            )}
          </div>
        </div>

        {adminTab === 'analitik' && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3.5">
            {(
              [
                { id: '7d', label: '7 Hari' },
                { id: '14d', label: '2 Minggu' },
                { id: '30d', label: '30 Hari' },
                { id: 'bulan_ini', label: 'Bulanan' },
                { id: 'custom', label: 'Kustom' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={period === item.id}
                onClick={() => setPeriod(item.id)}
                className={`min-h-[36px] whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${
                  period === item.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
            {period === 'bulan_ini' && <label className="flex items-center gap-2 text-sm">Bulan
              <input type="month" className="min-h-11 rounded-lg border px-2" value={month}
                onChange={e => e.target.value && setMonth(e.target.value)} />
            </label>}
            {period === 'custom' && <div className="flex w-full flex-wrap gap-3 text-sm">
              <label>Dari <input type="date" className="min-h-11 rounded-lg border px-2" value={customStart}
                onChange={e => {
                  const day = e.target.value;
                  if (!day) return;
                  setCustomStart(day);
                  if (day > customEnd) setCustomEnd(day);
                }} /></label>
              <label>Sampai <input type="date" className="min-h-11 rounded-lg border px-2" value={customEnd} min={customStart}
                onChange={e => e.target.value >= customStart && setCustomEnd(e.target.value)} /></label>
            </div>}
          </div>
        )}
      </section>

      {adminTab === 'analitik' ? (
        <>
          <TeacherAttendanceTable start={dateBounds.start} end={dateBounds.end} />
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500">Kehadiran Siswa</p>
              <p className="mt-2 font-mono text-2xl font-bold text-blue-800 tabular-nums sm:text-3xl">
                {kpis.rate}%
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {kpis.hadir} hadir dari {kpis.total} sesi
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500">Kepatuhan Jurnal Guru</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums sm:text-3xl">
                {kpis.journalRate}%
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {kpis.journalCount} jurnal sesi terisi
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500">Total Siswa Aktif</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums sm:text-3xl">
                {data.students.length}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                Tersebar di {data.classrooms.length} kelas aktif
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500">Notifikasi WA Orang Tua</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums sm:text-3xl">
                {kpis.waSent}
                <span className="ml-1 text-sm font-normal text-slate-400">/{kpis.waTotal}</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {kpis.alpha} kasus Alpha tercatat
              </p>
            </div>
          </section>

          {/* Charts Row 1: Trend + Status Donut */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Tren Persentase Kehadiran Siswa Harian
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Persentase siswa hadir terhadap total peserta bimbel per hari aktif
                  </p>
                </div>
                <TrendingUp className="h-4 w-4 text-blue-700" />
              </div>

              <div className="mt-4 h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrend} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tealFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [`${value}%`, 'Kehadiran']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="persentase"
                      stroke="#1D4ED8"
                      strokeWidth={2.5}
                      fill="url(#tealFill)"
                      activeDot={{ r: 5, fill: '#1D4ED8' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Distribution Donut */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4">
              <h2 className="text-sm font-semibold text-slate-900">Komposisi Status Kehadiran</h2>
              <p className="mt-0.5 text-xs text-slate-500">Distribusi total sesi pada periode terpilih</p>

              <div className="mt-2 h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={2}
                    >
                      {statusPie.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} sesi`, String(name)]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs">
                {statusPie.map((item) => {
                  const pct = kpis.total > 0 ? Math.round((item.value / kpis.total) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {item.value} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Row 2: Teacher & Class Performance Comparison + Attention Students */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Performa Kehadiran Guru vs Kelas */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-7">
              <h2 className="text-sm font-semibold text-slate-900">
                Visualisasi Performa Kehadiran Guru & Siswa per Kelas
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Perbandingan kepatuhan jurnal guru (%) dan rata-rata kehadiran siswa (%)
              </p>

              <div className="mt-4 h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={teacherPerformance}
                    margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="shortName"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => [`${value}%`, String(name)]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar
                      dataKey="studentRate"
                      name="Kehadiran Siswa"
                      fill="#1D4ED8"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="journalCompliance"
                      name="Kepatuhan Jurnal Guru"
                      fill="#0369A1"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Rotating Teacher Performance Scorecard */}
              <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {rotatingTeacherSummary.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">
                    Belum ada sesi guru tercatat pada periode ini.
                  </p>
                ) : (
                  rotatingTeacherSummary.map((tp) => (
                    <div
                      key={tp.teacherName}
                      className="flex flex-col gap-1.5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {tp.teacherName} ·{' '}
                          <span className="text-blue-800">{tp.subjectsLabel}</span>
                        </p>
                        <p className="mt-0.5 text-slate-500 tabular-nums">
                          {tp.sessions} sesi ({tp.totalHours} jam) · {tp.verifiedSessions} terverifikasi ·{' '}
                          Rotasi: {tp.roomsLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 font-mono tabular-nums">
                        <span className="font-semibold text-sky-700">
                          Kehadiran Guru {tp.attendancePct}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Siswa Perlu Perhatian */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Siswa Perlu Perhatian ({attentionStudents.length})
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Kehadiran &lt; 85% atau Alpha minimal 2x pada periode ini
                  </p>
                </div>
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              </div>

              {attentionStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-emerald-700">
                    Seluruh siswa memiliki performa kehadiran sangat baik.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Tidak ada siswa dengan kehadiran di bawah ambang 85%.
                  </p>
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {attentionStudents.map((item) => {
                    const followUpMsg = `Assalamualaikum Bapak/Ibu ${item.student.parentName}. Kami dari ${data.whatsappSettings.institutionName} ingin berkoordinasi mengenai kehadiran ananda ${item.student.name} (${item.className}) yang tercatat ${item.pct}% (${item.alpha}x Alpha) pada periode ${dateBounds.label}. Mohon informasinya agar kami dapat mendampingi persiapan TKA ananda dengan optimal.`;
                    const waHref = buildWhatsAppUrl(item.student.parentWhatsapp, followUpMsg);

                    return (
                      <div
                        key={item.student.id}
                        className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.student.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.className} · {item.student.parentName} (
                            <span className="font-mono">
                              {formatPhoneDisplay(item.student.parentWhatsapp)}
                            </span>
                            )
                          </p>
                          <p className="mt-1 text-xs font-medium text-rose-700 tabular-nums">
                            Kehadiran {item.pct}% · Alpha {item.alpha}x dari {item.total} sesi
                          </p>
                        </div>

                        {item.student.parentWhatsapp && <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Hubungi WA
                        </a>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('laporan')}
                  className="text-xs font-semibold text-blue-800 hover:underline"
                >
                  Buka Laporan Jurnal Kelas & Bulanan PDF →
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Database Schema & Architecture Blueprint Tab */
        <div className="space-y-5">
          {/* Schema Tables Grid */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {DATABASE_SCHEMA_TABLES.map((table) => (
              <article
                key={table.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-blue-800">{table.tableName}</p>
                    <h2 className="mt-0.5 text-xs font-semibold text-slate-900">{table.title}</h2>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                    {liveTableCounts[table.id] ?? 0} rekaman aktif
                  </span>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{table.purpose}</p>

                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50">
                  {table.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-start justify-between gap-3 px-3 py-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-slate-900">{col.name}</span>
                        <span className="ml-2 text-slate-500">{col.description}</span>
                      </div>
                      <div className="shrink-0 text-right font-mono">
                        <span className="text-blue-800">{col.type}</span>
                        <span className="block text-[10px] text-slate-400">{col.constraint}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[11px] text-slate-500">
                  Relasi: {table.relations.join(' · ')}
                </p>
              </article>
            ))}
          </section>

          {/* Copyable SQL DDL Block */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Definisi Skema SQL (PostgreSQL / MySQL)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Struktur lengkap tabel, foreign key, dan indeks untuk integrasi database server produksi.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                {copiedSql ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    SQL Disalin
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Salin SQL DDL
                  </>
                )}
              </button>
            </div>

            <pre className="mt-3 max-h-[340px] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-100">
              {DATABASE_SQL_DDL}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
};
