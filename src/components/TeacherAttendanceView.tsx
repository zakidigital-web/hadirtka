import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  MessageCircle,
  Search,
  Send,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AttendanceStatus, ComprehensionLevel, Student, TkaSubject } from '../types';
import {
  addDaysISO,
  buildClassGroupAttendanceReport,
  buildMassAllClassesAttendanceReport,
  buildWhatsAppShareUrl,
  buildWhatsAppUrl,
  COMPREHENSION_LABEL,
  formatDateDayShortID,
  formatDateLongID,
  formatPhoneDisplay,
  renderWhatsAppTemplate,
  STATUS_META,
  SUBJECT_META,
} from '../utils/formatters';
import { BottomSheet } from './BottomSheet';

const STATUS_ORDER: AttendanceStatus[] = ['hadir', 'izin', 'sakit', 'alpha'];

export const TeacherAttendanceView: React.FC = () => {
  const {
    data,
    currentUser, role,
    selectedDate,
    setSelectedDate,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    markAttendance,
    markStudentsPresent,
    setActiveTab,
    createManualWhatsAppLog,
    pushToast,
  } = useApp();

  const canAdmin = currentUser?.role === 'admin' && role === 'admin';
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'belum'>('all');

  const [presentSelection, setPresentSelection] = useState<Set<string> | null>(null);

  // Student Detail Bottom Sheet
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [detailStatus, setDetailStatus] = useState<AttendanceStatus>('hadir');
  const [detailComp, setDetailComp] = useState<ComprehensionLevel>('baik');
  const [detailNote, setDetailNote] = useState('');

  // WhatsApp Group Broadcast Bottom Sheet (Grup Kelas & Grup Massal)
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [groupScope, setGroupScope] = useState<'kelas' | 'massal'>('kelas');
  const [includePresentList, setIncludePresentList] = useState(false);
  const [massSubjectFilter, setMassSubjectFilter] = useState<'all' | TkaSubject>('all');
  const [copiedGroupReport, setCopiedGroupReport] = useState(false);

  const activeClass = useMemo(
    () => data.classrooms.find((c) => c.id === selectedClassId) || data.classrooms[0],
    [data.classrooms, selectedClassId]
  );

  // Quick completion badge per rombel for today + selected subject so rotating teachers see which class is done
  const classProgressMap = useMemo(() => {
    const map = new Map<string, { recorded: number; total: number; alpha: number }>();
    data.classrooms.forEach((cls) => {
      const total = data.students.filter((s) => s.classId === cls.id).length;
      const recs = data.attendance.filter(
        (a) => a.date === selectedDate && a.subject === selectedSubject && a.classId === cls.id
      );
      const alpha = recs.filter((a) => a.status === 'alpha').length;
      map.set(cls.id, { recorded: recs.length, total, alpha });
    });
    return map;
  }, [data.classrooms, data.students, data.attendance, selectedDate, selectedSubject]);

  const classStudents = useMemo(
    () =>
      data.students
        .filter((s) => s.classId === activeClass?.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.students, activeClass?.id]
  );

  const classSessionRecords = useMemo(
    () =>
      data.attendance.filter(
        (rec) =>
          rec.date === selectedDate &&
          rec.subject === selectedSubject &&
          rec.classId === activeClass?.id
      ),
    [data.attendance, selectedDate, selectedSubject, activeClass?.id]
  );

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, (typeof data.attendance)[number]>();
    classSessionRecords.forEach((rec) => map.set(rec.studentId, rec));
    return map;
  }, [classSessionRecords]);

  const stats = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpha = 0;
    let belum = 0;

    classStudents.forEach((s) => {
      const rec = attendanceByStudent.get(s.id);
      if (!rec) belum += 1;
      else if (rec.status === 'hadir') hadir += 1;
      else if (rec.status === 'izin') izin += 1;
      else if (rec.status === 'sakit') sakit += 1;
      else alpha += 1;
    });

    const total = classStudents.length;
    const recorded = total - belum;
    const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;

    return { hadir, izin, sakit, alpha, belum, total, recorded, pct };
  }, [classStudents, attendanceByStudent]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return classStudents.filter((s) => {
      const rec = attendanceByStudent.get(s.id);
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q);
      if (!matchesQuery) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'belum') return !rec;
      return rec?.status === statusFilter;
    });
  }, [classStudents, attendanceByStudent, searchQuery, statusFilter]);

  const todayJournal = useMemo(
    () =>
      data.journals.find(
        (j) =>
          j.date === selectedDate &&
          j.subject === selectedSubject &&
          j.classId === activeClass?.id
      ),
    [data.journals, selectedDate, selectedSubject, activeClass?.id]
  );

  const pendingWaCount = useMemo(
    () =>
      data.whatsappLogs.filter(
        (l) => l.date === selectedDate && l.classId === activeClass?.id && l.deliveryStatus === 'siap_kirim'
      ).length,
    [data.whatsappLogs, selectedDate, activeClass?.id]
  );

  // Live generated WhatsApp Group Report text
  const groupReportText = useMemo(() => {
    if (groupScope === 'kelas' && activeClass) {
      return buildClassGroupAttendanceReport({
        classroom: activeClass,
        date: selectedDate,
        subject: selectedSubject,
        teacherName: currentUser?.name || activeClass.teacherName,
        students: classStudents,
        records: classSessionRecords,
        journal: todayJournal,
        institutionName: data.whatsappSettings.institutionName,
        includePresentList,
      });
    }

    return buildMassAllClassesAttendanceReport({
      date: selectedDate,
      subjectFilter: massSubjectFilter,
      classrooms: data.classrooms,
      students: data.students,
      attendance: data.attendance,
      journals: data.journals,
      institutionName: data.whatsappSettings.institutionName,
    });
  }, [
    groupScope,
    activeClass,
    selectedDate,
    selectedSubject,
    currentUser?.name,
    classStudents,
    classSessionRecords,
    todayJournal,
    data,
    includePresentList,
    massSubjectFilter,
  ]);

  const openStudentSheet = (student: Student) => {
    const existing = attendanceByStudent.get(student.id);
    setActiveStudent(student);
    setDetailStatus(existing?.status || 'hadir');
    setDetailComp(existing?.comprehension || 'baik');
    setDetailNote(existing?.note || '');
  };

  const handleSaveStudentDetail = () => {
    if (!activeStudent || !activeClass) return;
    markAttendance({
      studentId: activeStudent.id,
      classId: activeClass.id,
      date: selectedDate,
      subject: selectedSubject,
      status: detailStatus,
      comprehension: detailStatus === 'hadir' ? detailComp : undefined,
      note: detailNote.trim(),
      triggerAutoWhatsApp: true,
    });
    pushToast({
      title: `Catatan ${activeStudent.name} disimpan`,
      subtitle: `${SUBJECT_META[selectedSubject].label} · Status ${STATUS_META[detailStatus].label}`,
      tone: 'success',
    });
    setActiveStudent(null);
  };

  const handleCopyGroupReport = async () => {
    try {
      await navigator.clipboard.writeText(groupReportText);
      setCopiedGroupReport(true);
      pushToast({
        title:
          groupScope === 'kelas'
            ? `Laporan Grup ${activeClass?.name} disalin`
            : 'Laporan Grup Massal Kelas 9 disalin',
        subtitle: 'Siap ditempel langsung ke grup WhatsApp.',
        tone: 'success',
      });
      window.setTimeout(() => setCopiedGroupReport(false), 2000);
    } catch {
      pushToast({
        title: 'Gagal menyalin otomatis',
        subtitle: 'Gunakan tombol Buka WhatsApp langsung.',
        tone: 'warning',
      });
    }
  };

  const detailWaUrl = useMemo(() => {
    if (!activeStudent || !activeClass) return '#';
    const msg = renderWhatsAppTemplate(data.whatsappSettings.templates[detailStatus], {
      nama_siswa: activeStudent.name,
      nama_ortu: activeStudent.parentName,
      kelas: `${activeClass.name} (${SUBJECT_META[selectedSubject].full})`,
      status: STATUS_META[detailStatus].label,
      tanggal: formatDateLongID(selectedDate),
      waktu: attendanceByStudent.get(activeStudent.id)?.checkInTime || '14:00',
      guru: currentUser?.name || activeClass.teacherName,
      catatan: detailNote.trim(),
      lembaga: data.whatsappSettings.institutionName,
    });
    return buildWhatsAppUrl(activeStudent.parentWhatsapp, msg);
  }, [
    activeStudent,
    activeClass,
    detailStatus,
    detailNote,
    selectedDate,
    selectedSubject,
    currentUser?.name,
    data.whatsappSettings,
    attendanceByStudent,
  ]);

  return (
    <div className="space-y-3 lg:space-y-5">
      {/* Ultra-Compact Control Dock (Designed for Fast One-Handed Mobile Class Switching) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        {/* Row 1: Mapel TKA Selector (Matematika / B. Indonesia) + Compact Date Stepper */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* 2 Core TKA Subjects */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {(['matematika', 'bahasa_indonesia'] as TkaSubject[]).map((subj) => {
              const active = selectedSubject === subj;
              return (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSelectedSubject(subj)}
                  className={`min-h-[36px] whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors sm:px-3.5 ${
                    active
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {SUBJECT_META[subj].label}
                </button>
              );
            })}
          </div>

          {/* Compact Date Stepper (< Sel, 24 Nov >) */}
          <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/70 p-0.5">
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysISO(selectedDate, -1))}
              aria-label="Hari sebelumnya"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <label className="relative flex h-8 cursor-pointer items-center gap-1.5 px-1.5 text-xs font-semibold text-slate-800 whitespace-nowrap">
              <Calendar className="hidden h-3.5 w-3.5 text-blue-700 sm:block" />
              <span>{formatDateDayShortID(selectedDate)}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                aria-label="Pilih tanggal absensi"
                className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0"
              />
            </label>

            <button
              type="button"
              onClick={() => setSelectedDate(addDaysISO(selectedDate, 1))}
              aria-label="Hari berikutnya"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Rotating Rombel Kelas 9 Selector (1-Tap Switching Across 9A, 9B, 9C, 9D) */}
        <div className="no-scrollbar mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {data.classrooms.map((cls) => {
            const isActive = cls.id === activeClass?.id;
            const prog = classProgressMap.get(cls.id);
            const isComplete = prog && prog.total > 0 && prog.recorded === prog.total;

            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => setSelectedClassId(cls.id)}
                className={`flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold transition-all ${
                  isActive
                    ? 'border-blue-700 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{cls.name}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    isComplete ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {prog?.recorded ?? 0}/{prog?.total ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Inline Live Summary + Fast Thumb Actions (All Present, Kirim WA Grup, Search) */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          {/* Compact Inline Counters (Zero wasted vertical space!) */}
          <div className="flex items-center gap-2.5 font-mono text-xs tabular-nums">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'hadir' ? 'all' : 'hadir')}
              className={`font-semibold ${
                statusFilter === 'hadir' ? 'underline text-emerald-800' : 'text-emerald-700'
              }`}
            >
              H:{stats.hadir}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'izin' ? 'all' : 'izin')}
              className={`font-semibold ${
                statusFilter === 'izin' ? 'underline text-sky-800' : 'text-sky-700'
              }`}
            >
              I:{stats.izin}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'sakit' ? 'all' : 'sakit')}
              className={`font-semibold ${
                statusFilter === 'sakit' ? 'underline text-amber-800' : 'text-amber-700'
              }`}
            >
              S:{stats.sakit}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'alpha' ? 'all' : 'alpha')}
              className={`font-semibold ${
                statusFilter === 'alpha' ? 'underline text-rose-800' : 'text-rose-700'
              }`}
            >
              A:{stats.alpha}
            </button>
            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="font-sans text-[11px] font-medium text-slate-500 underline"
              >
                Reset
              </button>
            )}
          </div>

          {/* Compact Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Cari siswa"
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                searchOpen || searchQuery
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setPresentSelection(new Set())}
              disabled={classStudents.length === 0}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tandai hadir
            </button>

            {canAdmin && (<button
              type="button"
              onClick={() => {
                setGroupScope('kelas');
                setGroupSheetOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 active:scale-[0.98]"
            >
              <Send className="h-3.5 w-3.5" />
              WA Grup
            </button>)}
          </div>
        </div>

        {/* Expandable Search Input (only takes vertical space when toggled on mobile) */}
        {searchOpen && (
          <div className="relative mt-2.5">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari siswa di ${activeClass?.name}...`}
              className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-9 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </section>

      <BottomSheet
        open={presentSelection !== null}
        onClose={() => setPresentSelection(null)}
        title="Tandai hadir"
        subtitle={`${activeClass?.name} · ${SUBJECT_META[selectedSubject].label} · ${formatDateDayShortID(selectedDate)}`}
        footer={
          <button
            type="button"
            disabled={!presentSelection?.size}
            onClick={() => {
              if (!activeClass || !presentSelection?.size) return;
              markStudentsPresent(activeClass.id, selectedDate, selectedSubject, presentSelection);
              setPresentSelection(null);
            }}
            className="min-h-11 w-full rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Simpan hadir ({presentSelection?.size ?? 0})
          </button>
        }
      >
        <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-900">
          <input
            type="checkbox"
            checked={classStudents.length > 0 && presentSelection?.size === classStudents.length}
            ref={(input) => {
              if (input) input.indeterminate = !!presentSelection?.size && presentSelection.size < classStudents.length;
            }}
            onChange={(event) => setPresentSelection(new Set(event.target.checked ? classStudents.map(s => s.id) : []))}
            className="size-5 accent-blue-700"
          />
          Pilih semua siswa ({classStudents.length})
        </label>
        {classStudents.map(student => {
          const record = attendanceByStudent.get(student.id);
          return (
            <label key={student.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={presentSelection?.has(student.id) ?? false}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setPresentSelection(previous => {
                    const next = new Set(previous);
                    if (checked) next.add(student.id);
                    else next.delete(student.id);
                    return next;
                  });
                }}
                className="size-5 shrink-0 accent-blue-700"
              />
              <span className="flex-1">{student.name}</span>
              <span className="text-xs text-slate-600">{record ? STATUS_META[record.status].label : 'Belum absen'}</span>
            </label>
          );
        })}
      </BottomSheet>

      {/* Main Content Split (Ultra-fast single-row mobile list + Desktop side panel) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-5">
        {/* Student Attendance List */}
        <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-8">
          {/* Compact Class Context Header inside List */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5 sm:px-4">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">
                {activeClass?.name} · {SUBJECT_META[selectedSubject].full}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                Pengajar: {todayJournal?.teacherName || currentUser?.name || activeClass?.teacherName}
              </p>
            </div>
            <span className="shrink-0 font-mono text-xs font-bold text-blue-800 tabular-nums">
              {stats.pct}% ({stats.hadir}/{stats.total})
            </span>
          </div>

          {/* Ultra-Efficient Compact Student Rows (~56px each on mobile!) */}
          <div className="divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Tidak ada siswa yang sesuai filter.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('kelas')}
                  className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Lihat Siswa {activeClass?.name}
                </button>
              </div>
            ) : (
              filteredStudents.map((student, idx) => {
                const rec = attendanceByStudent.get(student.id);
                const currentStatus = rec?.status;

                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
                  >
                    {/* Left: Student Name & compact subline (tappable for details) */}
                    <button
                      type="button"
                      onClick={() => openStudentSheet(student)}
                      className="group flex min-h-[42px] min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className="w-5 shrink-0 font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-900 group-hover:text-blue-800 sm:text-sm">
                          {student.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {currentStatus ? (
                            <span className={`font-semibold ${STATUS_META[currentStatus].textClass}`}>
                              {STATUS_META[currentStatus].label}
                            </span>
                          ) : (
                            <span>Belum absen</span>
                          )}
                          {' · '}
                          <span>{student.parentName}</span>
                          {rec?.note ? ` · ${rec.note}` : ''}
                        </p>
                      </div>
                    </button>

                    {/* Right: Compact H / I / S / A tactile buttons (Mobile: 1-letter compact, Tablet/Desktop: full label) */}
                    <div className="grid shrink-0 grid-cols-4 gap-1 sm:w-[256px] sm:gap-1.5">
                      {STATUS_ORDER.map((statusKey) => {
                        const meta = STATUS_META[statusKey];
                        const isSelected = currentStatus === statusKey;
                        return (
                          <button
                            key={statusKey}
                            type="button"
                            aria-label={`${meta.label} untuk ${student.name}`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              activeClass &&
                              markAttendance({
                                studentId: student.id,
                                classId: activeClass.id,
                                date: selectedDate,
                                subject: selectedSubject,
                                status: statusKey,
                              })
                            }
                            className={`flex h-10 w-9 items-center justify-center rounded-xl border text-xs font-bold transition-all active:scale-95 sm:h-10 sm:w-auto sm:font-semibold ${
                              isSelected
                                ? meta.activeBg
                                : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <span className="sm:hidden">{meta.short}</span>
                            <span className="hidden sm:inline">{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Mobile Bottom Quick Footer inside Attendance Card: Send to Group / Open Journal */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:flex sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('jurnal')}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-700" />
              {todayJournal ? 'Edit Jurnal Sesi' : 'Isi Jurnal Sesi'}
            </button>

            {canAdmin && (<button
              type="button"
              onClick={() => {
                setGroupScope('massal');
                setGroupSheetOpen(true);
              }}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <Users className="h-3.5 w-3.5" />
              WA Grup Massal 9A–9D
            </button>)}
          </div>
        </div>

        {/* Desktop Right Context Sidebar (Jurnal + WA Grup Shortcuts) */}
        <aside className="hidden space-y-4 lg:col-span-4 lg:block">
          {/* Quick Group WA Broadcast Card */}
          {canAdmin && (<div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Kirim Rekap Kehadiran</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  Laporan Grup WhatsApp
                </h2>
              </div>
              <Send className="h-4.5 w-4.5 shrink-0 text-emerald-700" />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Bagikan laporan kehadiran sesi {SUBJECT_META[selectedSubject].full} ke grup WA {activeClass?.name} atau kirim rekap massal seluruh Kelas 9 sekaligus.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setGroupScope('kelas');
                  setGroupSheetOpen(true);
                }}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <Send className="h-3.5 w-3.5" />
                Kirim ke Grup {activeClass?.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGroupScope('massal');
                  setGroupSheetOpen(true);
                }}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <Users className="h-3.5 w-3.5" />
                Kirim Rekap Massal Semua Kelas 9
              </button>
            </div>
          </div>)}
          {/* Jurnal Kehadiran Guru Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Jurnal {SUBJECT_META[selectedSubject].full} · {activeClass?.name}
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  {todayJournal ? todayJournal.topic : 'Jurnal Sesi Belum Diisi'}
                </h2>
              </div>
              <BookOpen className="h-4.5 w-4.5 shrink-0 text-blue-700" />
            </div>

            {todayJournal ? (
              <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                <p>
                  {todayJournal.teacherName} ·{' '}
                  <span className="font-mono tabular-nums">
                    {todayJournal.checkInTime}–{todayJournal.checkOutTime} WIB
                  </span>
                </p>
                <p className="line-clamp-3 leading-relaxed">{todayJournal.summary}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Catat materi {SUBJECT_META[selectedSubject].label} yang Anda ajarkan di {activeClass?.name} hari ini.
              </p>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('jurnal')}
              className="mt-4 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 hover:bg-slate-100"
            >
              {todayJournal ? 'Perbarui Jurnal Sesi' : 'Isi Jurnal Sesi'}
            </button>
          </div>

          {/* Individual Parent WA Queue Link */}
          {canAdmin && pendingWaCount > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-rose-700 tabular-nums">
                  {pendingWaCount} notifikasi WA pribadi orang tua menunggu
                </p>
                <MessageCircle className="h-4 w-4 text-rose-600" />
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('whatsapp')}
                className="mt-3 text-xs font-semibold text-blue-800 hover:underline"
              >
                Buka Antrean WA Orang Tua →
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* WhatsApp Group Report Bottom Sheet (Grup Kelas & Grup Massal Seluruh Kelas) */}
      <BottomSheet
        open={canAdmin && groupSheetOpen}
        onClose={() => setGroupSheetOpen(false)}
        title="Kirim Laporan Kehadiran ke Grup WA"
        subtitle={`${formatDateLongID(selectedDate)} · SMP Negeri 1 Genteng`}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCopyGroupReport}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              {copiedGroupReport ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  Tersalin
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Salin Teks
                </>
              )}
            </button>
            <a
              href={buildWhatsAppShareUrl(groupReportText)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                pushToast({
                  title:
                    groupScope === 'kelas'
                      ? `Membuka WhatsApp untuk Grup ${activeClass?.name}`
                      : 'Membuka WhatsApp untuk Grup Massal Kelas 9',
                  subtitle: 'Pilih grup WhatsApp tujuan lalu tekan kirim.',
                  tone: 'success',
                });
              }}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              <ExternalLink className="h-4 w-4" />
              {groupScope === 'kelas'
                ? `Kirim ke Grup ${activeClass?.name}`
                : 'Kirim ke Grup Massal Kelas 9'}
            </a>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Scope Switcher: Grup Kelas vs Grup Massal Seluruh Kelas */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setGroupScope('kelas')}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                groupScope === 'kelas'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grup {activeClass?.name}
            </button>
            <button
              type="button"
              onClick={() => setGroupScope('massal')}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                groupScope === 'massal'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grup Massal (Semua 9A–9D)
            </button>
          </div>

          {groupScope === 'kelas' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <div className="text-xs">
                <p className="font-semibold text-slate-900">
                  {activeClass?.groupWaName || `Grup WA ${activeClass?.name}`}
                </p>
                <p className="text-[11px] text-slate-500">
                  Mapel: {SUBJECT_META[selectedSubject].full}
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={includePresentList}
                  onChange={(e) => setIncludePresentList(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-700"
                />
                Sertakan daftar hadir
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Cakupan Mapel TKA untuk {data.whatsappSettings.massGroupName || 'Grup Massal Kelas 9'}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'all', label: 'Gabungan' },
                    { id: 'matematika', label: 'Matematika' },
                    { id: 'bahasa_indonesia', label: 'B. Indonesia' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMassSubjectFilter(opt.id)}
                    className={`min-h-[38px] rounded-xl border text-xs font-semibold ${
                      massSubjectFilter === opt.id
                        ? 'border-blue-700 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Message Preview */}
          <div>
            <p className="text-xs font-semibold text-slate-700">Pratinjau Pesan WhatsApp</p>
            <pre className="mt-1.5 max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-sans text-xs leading-relaxed text-slate-800">
              {groupReportText}
            </pre>
          </div>
        </div>
      </BottomSheet>

      {/* Student Monitoring Detail Bottom Sheet */}
      <BottomSheet
        open={Boolean(activeStudent)}
        onClose={() => setActiveStudent(null)}
        title={activeStudent?.name || ''}
        subtitle={
          activeStudent
            ? `${activeStudent.nis} · ${SUBJECT_META[selectedSubject].full} · Wali: ${activeStudent.parentName}`
            : ''
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {canAdmin && activeStudent && (
              <a
                href={detailWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  createManualWhatsAppLog(
                    activeStudent.id,
                    selectedDate,
                    selectedSubject,
                    detailStatus,
                    detailNote
                  )
                }
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4" />
                Kirim WA Orang Tua
              </a>
            )}
            <button
              type="button"
              onClick={handleSaveStudentDetail}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Check className="h-4 w-4" />
              Simpan Monitoring
            </button>
          </div>
        }
      >
        {activeStudent && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-700">
                Status Kehadiran ({formatDateLongID(selectedDate)})
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {STATUS_ORDER.map((st) => {
                  const meta = STATUS_META[st];
                  const active = detailStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDetailStatus(st)}
                      className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
                        active
                          ? meta.activeBg
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {detailStatus === 'hadir' && (
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Pemahaman {SUBJECT_META[selectedSubject].full}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(Object.keys(COMPREHENSION_LABEL) as ComprehensionLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDetailComp(lvl)}
                      className={`min-h-[42px] rounded-xl border px-3 text-xs font-medium transition-colors ${
                        detailComp === lvl
                          ? 'border-blue-700 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {COMPREHENSION_LABEL[lvl]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="student-daily-note" className="block text-xs font-semibold text-slate-700">
                Catatan Perkembangan / Alasan Ketidakhadiran
              </label>
              <textarea
                id="student-daily-note"
                rows={3}
                value={detailNote}
                onChange={(e) => setDetailNote(e.target.value)}
                placeholder="Tulis catatan belajar, skor latihan singkat, atau keterangan izin/sakit..."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Kontak Orang Tua / Wali</p>
              <p className="mt-1">
                {activeStudent.parentName} ·{' '}
                <span className="font-mono">{formatPhoneDisplay(activeStudent.parentWhatsapp)}</span>
              </p>
              {activeStudent.notes && (
                <p className="mt-1.5 text-slate-500">Catatan profil: {activeStudent.notes}</p>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
