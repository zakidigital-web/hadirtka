import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, FileCheck2, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TeacherJournal, TkaSubject } from '../types';
import { formatDateLongID, formatDateShortID, SUBJECT_META } from '../utils/formatters';

export const TeacherJournalView: React.FC = () => {
  const {
    data,
    currentUser,
    selectedDate,
    setSelectedDate,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    saveTeacherJournal,
  } = useApp();

  const activeClass = useMemo(
    () => data.classrooms.find((c) => c.id === selectedClassId) || data.classrooms[0],
    [data.classrooms, selectedClassId]
  );

  const existingJournal = useMemo(
    () =>
      data.journals.find(
        (j) =>
          j.date === selectedDate &&
          j.subject === selectedSubject &&
          j.classId === activeClass?.id
      ),
    [data.journals, selectedDate, selectedSubject, activeClass?.id]
  );

  const [teacherStatus, setTeacherStatus] = useState<TeacherJournal['teacherStatus']>('hadir');
  const [substituteTeacher, setSubstituteTeacher] = useState('');
  const [checkInTime, setCheckInTime] = useState('13:30');
  const [checkOutTime, setCheckOutTime] = useState('14:30');
  const [topic, setTopic] = useState('');
  const [moduleRef, setModuleRef] = useState('');
  const [summary, setSummary] = useState('');
  const [obstacles, setObstacles] = useState('');
  const [verified, setVerified] = useState(true);

  useEffect(() => {
    if (existingJournal) {
      setTeacherStatus(existingJournal.teacherStatus);
      setSubstituteTeacher(existingJournal.substituteTeacher || '');
      setCheckInTime(existingJournal.checkInTime);
      setCheckOutTime(existingJournal.checkOutTime);
      setTopic(existingJournal.topic);
      setModuleRef(existingJournal.moduleRef);
      setSummary(existingJournal.summary);
      setObstacles(existingJournal.obstacles);
      setVerified(existingJournal.verified);
    } else {
      setTeacherStatus('hadir');
      setSubstituteTeacher('');
      setCheckInTime('13:30');
      setCheckOutTime('14:30');
      setTopic('');
      setModuleRef('');
      setSummary('');
      setObstacles('');
      setVerified(true);
    }
  }, [existingJournal, selectedDate, selectedSubject, activeClass?.id]);

  const classJournals = useMemo(
    () =>
      data.journals
        .filter((j) => j.classId === activeClass?.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.journals, activeClass?.id]
  );

  const sessionAttendanceStats = useMemo(() => {
    const records = data.attendance.filter(
      (a) =>
        a.date === selectedDate &&
        a.subject === selectedSubject &&
        a.classId === activeClass?.id
    );
    const hadir = records.filter((r) => r.status === 'hadir').length;
    const total = data.students.filter((s) => s.classId === activeClass?.id).length;
    return { hadir, total };
  }, [data.attendance, data.students, selectedDate, selectedSubject, activeClass?.id]);

  const activeTeacherName = currentUser?.name || activeClass?.teacherName || 'Guru TKA';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass || (teacherStatus !== 'tidak_masuk' && !topic.trim())) return;

    saveTeacherJournal({
      date: selectedDate,
      subject: selectedSubject,
      classId: activeClass.id,
      scheduledTeacherId: currentUser?.role === 'guru' ? currentUser.id : undefined,
      scheduledTeacherName: currentUser?.role === 'guru' ? activeTeacherName : activeClass.teacherName,
      teacherId: teacherStatus !== 'digantikan' ? currentUser?.id : undefined,
      teacherName:
        teacherStatus === 'digantikan' && substituteTeacher.trim()
          ? `${substituteTeacher.trim()} (Pengganti)`
          : activeTeacherName,
      teacherStatus,
      substituteTeacher: teacherStatus === 'digantikan' ? substituteTeacher.trim() : undefined,
      checkInTime: teacherStatus === 'tidak_masuk' ? '' : checkInTime,
      checkOutTime: teacherStatus === 'tidak_masuk' ? '' : checkOutTime,
      topic: teacherStatus === 'tidak_masuk' ? 'Tidak masuk' : topic.trim(),
      moduleRef:
        moduleRef.trim() || `Modul ${SUBJECT_META[selectedSubject].full} Kelas 9`,
      summary: teacherStatus === 'tidak_masuk' ? 'Guru tidak masuk.' : summary.trim() || 'Pembelajaran terlaksana sesuai rencana harian.',
      obstacles: obstacles.trim() || 'Tidak ada kendala berarti.',
      verified,
    });
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Compact Header & Rotating Class + Subject Selector */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Jurnal Pengajar Rotasi · {formatDateLongID(selectedDate)}
            </p>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">
              {activeClass?.name} · {SUBJECT_META[selectedSubject].full}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
              Guru Pengajar: {activeTeacherName} · Hadir Sesi Ini: {sessionAttendanceStats.hadir}/
              {sessionAttendanceStats.total}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Subject Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {(['matematika', 'bahasa_indonesia'] as TkaSubject[]).map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSelectedSubject(subj)}
                  className={`min-h-[38px] whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${
                    selectedSubject === subj
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {SUBJECT_META[subj].label}
                </button>
              ))}
            </div>

            <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                aria-label="Pilih tanggal jurnal"
                className="w-[112px] cursor-pointer bg-transparent font-mono text-xs text-slate-800 focus:outline-none"
              />
            </label>
          </div>
        </div>

        {/* Rombel 9A-9D pills */}
        <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto pt-1">
          {data.classrooms.map((cls) => (
            <button
              key={cls.id}
              type="button"
              onClick={() => setSelectedClassId(cls.id)}
              className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                cls.id === activeClass?.id
                  ? 'border-blue-700 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        {/* Form Jurnal */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-7"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                {existingJournal ? 'Perbarui Jurnal Sesi' : 'Catat Jurnal Sesi Baru'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Otomatis terhubung ke Laporan PDF & Rekap Grup WhatsApp.
              </p>
            </div>
            {existingJournal?.verified && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Terverifikasi
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Status Kehadiran Guru
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTeacherStatus('hadir')}
                  className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
                    teacherStatus === 'hadir'
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Hadir Mengajar
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherStatus('digantikan')}
                  className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
                    teacherStatus === 'digantikan'
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Guru Pengganti
                </button>
                <button type="button" onClick={() => setTeacherStatus('tidak_masuk')}
                  className={`min-h-11 rounded-xl border text-xs font-semibold ${teacherStatus === 'tidak_masuk' ? 'bg-red-700 text-white' : 'bg-white text-slate-600'}`}>
                  Tidak masuk
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="jam-masuk" className="block text-xs font-semibold text-slate-700">
                  Jam Masuk
                </label>
                <input
                  id="jam-masuk"
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="jam-keluar" className="block text-xs font-semibold text-slate-700">
                  Jam Selesai
                </label>
                <input
                  id="jam-keluar"
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {teacherStatus === 'digantikan' && (
            <div>
              <label htmlFor="guru-pengganti" className="block text-xs font-semibold text-slate-700">
                Nama Guru Pengganti
              </label>
              <input
                id="guru-pengganti"
                type="text"
                value={substituteTeacher}
                onChange={(e) => setSubstituteTeacher(e.target.value)}
                placeholder="Contoh: Guru Contoh B"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="materi-tka" className="block text-xs font-semibold text-slate-700">
                Materi {SUBJECT_META[selectedSubject].full} *
              </label>
              <input
                id="materi-tka"
                type="text"
                required={teacherStatus !== 'tidak_masuk'}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  selectedSubject === 'matematika'
                    ? 'Contoh: Persamaan Linear & Pythagoras'
                    : 'Contoh: Simpulan Teks Informasi & Argumentasi'
                }
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="modul-ref" className="block text-xs font-semibold text-slate-700">
                Referensi Modul / Paket Soal
              </label>
              <input
                id="modul-ref"
                type="text"
                value={moduleRef}
                onChange={(e) => setModuleRef(e.target.value)}
                placeholder={`Modul ${SUBJECT_META[selectedSubject].label} TKA Kls 9 · Paket 3`}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ringkasan-kelas" className="block text-xs font-semibold text-slate-700">
              Ringkasan Perkembangan Kelas
            </label>
            <textarea
              id="ringkasan-kelas"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Deskripsikan antusiasme siswa, pencapaian latihan soal, dan aktivitas kelas hari ini..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="kendala-kelas" className="block text-xs font-semibold text-slate-700">
              Kendala & Tindak Lanjut
            </label>
            <textarea
              id="kendala-kelas"
              rows={2}
              value={obstacles}
              onChange={(e) => setObstacles(e.target.value)}
              placeholder="Catat materi yang perlu diulang atau siswa yang membutuhkan pendampingan ekstra..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-blue-700"
            />
            <span className="text-xs font-medium text-slate-700">
              Konfirmasi jurnal kehadiran guru sudah benar dan siap dimasukkan ke laporan
            </span>
          </label>

          <button
            type="submit"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 active:scale-[0.99]"
          >
            <Save className="h-4 w-4" />
            Simpan Jurnal {SUBJECT_META[selectedSubject].label}
          </button>
        </form>

        {/* Riwayat Jurnal Kelas */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <h2 className="text-base font-semibold text-slate-900">
              Riwayat Jurnal {activeClass?.name} ({classJournals.length})
            </h2>
            <FileCheck2 className="h-4 w-4 text-slate-400" />
          </div>

          <div className="mt-2 divide-y divide-slate-100">
            {classJournals.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                Belum ada riwayat jurnal untuk rombel ini.
              </p>
            ) : (
              classJournals.slice(0, 12).map((item) => {
                const isSelected =
                  item.date === selectedDate && item.subject === selectedSubject;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedDate(item.date);
                      setSelectedSubject(item.subject);
                    }}
                    className={`block w-full py-3.5 text-left transition-colors ${
                      isSelected
                        ? '-mx-2.5 rounded-xl bg-blue-50/50 px-2.5'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-blue-800">
                        {formatDateShortID(item.date)} · {SUBJECT_META[item.subject].label}
                      </p>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 tabular-nums">
                        <Clock className="h-3 w-3" />
                        {item.checkInTime}–{item.checkOutTime}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{item.topic}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.teacherName} · {item.moduleRef}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {item.summary}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
