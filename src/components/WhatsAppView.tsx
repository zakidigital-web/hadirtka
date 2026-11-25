import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  MessageCircle,
  Send,
  Settings2,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AttendanceStatus, TkaSubject, WhatsAppSettings } from '../types';
import {
  buildClassGroupAttendanceReport,
  buildMassAllClassesAttendanceReport,
  buildWhatsAppShareUrl,
  buildWhatsAppUrl,
  formatDateLongID,
  formatPhoneDisplay,
  formatTimestampID,
  STATUS_META,
  SUBJECT_META,
} from '../utils/formatters';

export const WhatsAppView: React.FC = () => {
  const {
    data,
    currentUser,
    selectedDate,
    setSelectedDate,
    selectedClassId,
    setSelectedClassId,
    selectedSubject,
    setSelectedSubject,
    updateWhatsAppLogStatus,
    updateWhatsAppSettings,
    pushToast,
  } = useApp();

  const [subTab, setSubTab] = useState<'grup' | 'log' | 'pengaturan'>(currentUser?.role === 'admin' ? 'log' : 'grup');
  const [filterStatus, setFilterStatus] = useState<'all' | 'siap_kirim' | 'terkirim'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Group broadcast state
  const [includePresentList, setIncludePresentList] = useState(false);
  const [massSubjectFilter, setMassSubjectFilter] = useState<'all' | TkaSubject>('all');

  const [draftSettings, setDraftSettings] = useState<WhatsAppSettings>(data.whatsappSettings);
  const [activeTemplateKey, setActiveTemplateKey] = useState<AttendanceStatus>('alpha');

  const activeClass = useMemo(
    () => data.classrooms.find((c) => c.id === selectedClassId) || data.classrooms[0],
    [data.classrooms, selectedClassId]
  );

  const classGroupReportText = useMemo(() => {
    if (!activeClass) return '';
    const students = data.students.filter((s) => s.classId === activeClass.id);
    const records = data.attendance.filter(
      (a) =>
        a.date === selectedDate &&
        a.subject === selectedSubject &&
        a.classId === activeClass.id
    );
    const journal = data.journals.find(
      (j) =>
        j.date === selectedDate &&
        j.subject === selectedSubject &&
        j.classId === activeClass.id
    );
    return buildClassGroupAttendanceReport({
      classroom: activeClass,
      date: selectedDate,
      subject: selectedSubject,
      teacherName: currentUser?.name || activeClass.teacherName,
      students,
      records,
      journal,
      institutionName: data.whatsappSettings.institutionName,
      includePresentList,
    });
  }, [activeClass, data, selectedDate, selectedSubject, currentUser?.name, includePresentList]);

  const massGroupReportText = useMemo(
    () =>
      buildMassAllClassesAttendanceReport({
        date: selectedDate,
        subjectFilter: massSubjectFilter,
        classrooms: data.classrooms,
        students: data.students,
        attendance: data.attendance,
        journals: data.journals,
        institutionName: data.whatsappSettings.institutionName,
      }),
    [selectedDate, massSubjectFilter, data]
  );

  const filteredLogs = useMemo(() => {
    return data.whatsappLogs.filter((log) => {
      if (filterStatus === 'all') return true;
      return log.deliveryStatus === filterStatus;
    });
  }, [data.whatsappLogs, filterStatus]);

  const counts = useMemo(() => {
    const siap = data.whatsappLogs.filter((l) => l.deliveryStatus === 'siap_kirim').length;
    const terkirim = data.whatsappLogs.filter((l) => l.deliveryStatus === 'terkirim').length;
    return { total: data.whatsappLogs.length, siap, terkirim };
  }, [data.whatsappLogs]);

  const handleCopyMessage = async (id: string, text: string, label = 'Pesan WA disalin') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      pushToast({
        title: label,
        subtitle: 'Teks laporan siap ditempel langsung ke WhatsApp.',
        tone: 'default',
      });
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      pushToast({
        title: 'Gagal menyalin pesan',
        subtitle: 'Gunakan tombol Buka WhatsApp langsung.',
        tone: 'warning',
      });
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateWhatsAppSettings(draftSettings);
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="hidden text-xs font-medium text-slate-500 sm:block">
              Pusat Pengiriman WhatsApp Grup Kelas, Grup Massal & Orang Tua
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Notifikasi & Laporan Grup WA
            </h1>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              {counts.siap} WA pribadi menunggu · {counts.terkirim} terkirim
            </p>
          </div>

          <div className="no-scrollbar flex overflow-x-auto rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSubTab('grup')}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                subTab === 'grup'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              Laporan Grup WA
            </button>
            <button
              type="button"
              onClick={() => setSubTab('log')}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                subTab === 'log'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WA Ortu ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('pengaturan')}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                subTab === 'pengaturan'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Template
            </button>
          </div>
        </div>
      </section>

      {subTab === 'grup' ? (
        /* Dedicated Group WA Broadcast Tab: Grup Kelas + Grup Massal Seluruh Kelas 9 */
        <div className="space-y-4">
          {/* Date Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-800">
              Tanggal Laporan: <span className="text-blue-800">{formatDateLongID(selectedDate)}</span>
            </p>
            <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                aria-label="Pilih tanggal laporan grup WA"
                className="w-[112px] cursor-pointer bg-transparent font-mono text-xs text-slate-800 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Card 1: Kirim Laporan ke Grup WA Kelas (per rombel 9A/9B/9C/9D) */}
            <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div>
                  <p className="text-xs font-medium text-slate-500">Laporan Per Rombel Kelas 9</p>
                  <h2 className="mt-0.5 text-base font-bold text-slate-900">
                    Kirim ke Grup WA Kelas
                  </h2>
                </div>
                <Send className="h-4.5 w-4.5 shrink-0 text-emerald-700" />
              </div>

              <div className="mt-3.5 space-y-3">
                {/* Rombel & Mapel selectors */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Pilih rombel kelas 9"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {data.classrooms.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.groupWaName || `Grup ${cls.name}`})
                      </option>
                    ))}
                  </select>

                  <div className="inline-flex rounded-xl bg-slate-100 p-1">
                    {(['matematika', 'bahasa_indonesia'] as TkaSubject[]).map((subj) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setSelectedSubject(subj)}
                        className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold ${
                          selectedSubject === subj
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        {SUBJECT_META[subj].label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={includePresentList}
                    onChange={(e) => setIncludePresentList(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-700"
                  />
                  Sertakan daftar lengkap nama siswa yang hadir
                </label>

                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={buildWhatsAppShareUrl(classGroupReportText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Kirim ke Grup {activeClass?.name}
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyMessage(
                        'grp-kelas',
                        classGroupReportText,
                        `Laporan Grup ${activeClass?.name} disalin`
                      )
                    }
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedId === 'grp-kelas' ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" />
                        Disalin
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Salin
                      </>
                    )}
                  </button>
                </div>

                <pre className="max-h-[260px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-sans text-xs leading-relaxed text-slate-800">
                  {classGroupReportText}
                </pre>
              </div>
            </section>

            {/* Card 2: Kirim Laporan Massal Seluruh Kelas 9 */}
            <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Rekap Gabungan Semua Rombel ({data.classrooms.map((c) => c.name.replace('Kelas ', '')).join(', ')})
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-slate-900">
                    Kirim ke Grup Massal Seluruh Kelas
                  </h2>
                </div>
                <Users className="h-4.5 w-4.5 shrink-0 text-blue-700" />
              </div>

              <div className="mt-3.5 space-y-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'Semua Mapel' },
                      { id: 'matematika', label: 'Matematika' },
                      { id: 'bahasa_indonesia', label: 'B. Indonesia' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMassSubjectFilter(opt.id)}
                      className={`min-h-[38px] rounded-xl border text-xs font-semibold transition-colors ${
                        massSubjectFilter === opt.id
                          ? 'border-blue-700 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-slate-500">
                  Target: <strong className="text-slate-700">{data.whatsappSettings.massGroupName || 'Grup Koordinasi TKA Kelas 9 SMPN 1 Genteng'}</strong>
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={buildWhatsAppShareUrl(massGroupReportText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Kirim ke Grup Massal Kelas 9
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyMessage(
                        'grp-massal',
                        massGroupReportText,
                        'Laporan Massal Seluruh Kelas 9 disalin'
                      )
                    }
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedId === 'grp-massal' ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" />
                        Disalin
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Salin
                      </>
                    )}
                  </button>
                </div>

                <pre className="max-h-[260px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-sans text-xs leading-relaxed text-slate-800">
                  {massGroupReportText}
                </pre>
              </div>
            </section>
          </div>
        </div>
      ) : subTab === 'log' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          {/* Filter controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2 sm:pb-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `Semua (${counts.total})` },
                  { id: 'siap_kirim', label: `Siap Kirim (${counts.siap})` },
                  { id: 'terkirim', label: `Terkirim (${counts.terkirim})` },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilterStatus(item.id)}
                  className={`min-h-[38px] whitespace-nowrap rounded-lg px-2 sm:px-3.5 text-xs font-medium transition-colors ${
                    filterStatus === item.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="hidden text-xs text-slate-500 sm:block">
              Pesan pribadi real-time otomatis ke kontak WA orang tua saat siswa tidak hadir.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Belum ada log notifikasi pada filter ini.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Notifikasi akan otomatis masuk saat guru menandai siswa Alpha, Sakit, atau Izin.
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const statusMeta = STATUS_META[log.triggerStatus];
                const waUrl = buildWhatsAppUrl(log.parentWhatsapp, log.message);

                return (
                  <article key={log.id} className="py-4 first:pt-4 last:pb-1">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {log.studentName}{' '}
                          <span className="font-normal text-slate-500">
                            → {log.parentName} ({formatPhoneDisplay(log.parentWhatsapp)})
                          </span>
                        </h3>

                        {currentUser?.role === 'admin' && (
                          <a
                            href={buildWhatsAppShareUrl(log.message)}
                            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 sm:w-auto"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Kirim ke grup WA
                          </a>
                        )}

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span className={`font-semibold ${statusMeta.textClass}`}>
                            Status: {statusMeta.label}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{log.className}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatTimestampID(log.timestamp)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              log.deliveryStatus === 'terkirim'
                                ? 'font-medium text-emerald-700'
                                : 'font-medium text-amber-700'
                            }
                          >
                            {log.deliveryStatus === 'terkirim'
                              ? 'Terkirim ke Orang Tua'
                              : 'Menunggu Kirim WA'}
                          </span>
                        </div>

                        <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                          {log.message}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:w-[180px] lg:flex-col lg:items-stretch">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => updateWhatsAppLogStatus(log.id, 'terkirim')}
                          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {log.deliveryStatus === 'terkirim' ? 'Kirim Ulang WA' : 'Kirim via WA'}
                        </a>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(log.id, log.message)}
                            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {copiedId === log.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                Disalin
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Salin
                              </>
                            )}
                          </button>

                          {log.deliveryStatus !== 'terkirim' && (
                            <button
                              type="button"
                              onClick={() => updateWhatsAppLogStatus(log.id, 'terkirim')}
                              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <CheckCheck className="h-3.5 w-3.5 text-blue-700" />
                              Selesai
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      ) : (
        <form
          onSubmit={handleSaveSettings}
          className="grid grid-cols-1 gap-5 lg:grid-cols-12"
        >
          {/* Auto-trigger toggles & Group Name */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Pemicu Otomatis & Nama Grup</h2>
              <p className="mt-1 text-xs text-slate-500">
                Sesuaikan identitas sekolah, nama grup massal, dan status pemicu notifikasi WA orang tua.
              </p>
            </div>

            <div>
              <label htmlFor="nama-lembaga" className="block text-xs font-semibold text-slate-700">
                Nama Sekolah / Program
              </label>
              <input
                id="nama-lembaga"
                type="text"
                value={draftSettings.institutionName}
                onChange={(e) =>
                  setDraftSettings((prev) => ({ ...prev, institutionName: e.target.value }))
                }
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="nama-grup-massal" className="block text-xs font-semibold text-slate-700">
                Nama Grup WA Massal Seluruh Kelas 9
              </label>
              <input
                id="nama-grup-massal"
                type="text"
                value={draftSettings.massGroupName || ''}
                onChange={(e) =>
                  setDraftSettings((prev) => ({ ...prev, massGroupName: e.target.value }))
                }
                placeholder="Grup Koordinasi TKA Kelas 9 SMPN 1 Genteng"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="divide-y divide-slate-100">
              {(
                [
                  {
                    key: 'autoNotifyAlpha',
                    title: 'Otomatis saat Siswa Alpha',
                    desc: 'Langsung buat pesan peringatan real-time ke nomor WA orang tua.',
                  },
                  {
                    key: 'autoNotifySakit',
                    title: 'Otomatis saat Siswa Sakit',
                    desc: 'Kirim pesan konfirmasi penerimaan kabar sakit.',
                  },
                  {
                    key: 'autoNotifyIzin',
                    title: 'Otomatis saat Siswa Izin',
                    desc: 'Konfirmasi izin siswa beserta info materi TKA.',
                  },
                  {
                    key: 'autoNotifyHadir',
                    title: 'Otomatis saat Siswa Hadir (Check-in)',
                    desc: 'Opsional: kirim laporan kedatangan setiap kali siswa hadir.',
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-start justify-between gap-4 py-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draftSettings[item.key]}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-blue-700"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Template editor */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Template Pesan WA Orang Tua</h2>
              <p className="mt-1 text-xs text-slate-500">
                Variabel: <code className="font-mono text-blue-800">{'{nama_siswa}'}</code>,{' '}
                <code className="font-mono text-blue-800">{'{nama_ortu}'}</code>,{' '}
                <code className="font-mono text-blue-800">{'{kelas}'}</code>,{' '}
                <code className="font-mono text-blue-800">{'{tanggal}'}</code>,{' '}
                <code className="font-mono text-blue-800">{'{waktu}'}</code>,{' '}
                <code className="font-mono text-blue-800">{'{guru}'}</code>,{' '}
                <code className="font-mono text-blue-800">{'{catatan}'}</code>.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(['alpha', 'sakit', 'izin', 'hadir'] as AttendanceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setActiveTemplateKey(st)}
                  className={`min-h-[42px] rounded-xl border text-xs font-semibold transition-colors ${
                    activeTemplateKey === st
                      ? STATUS_META[st].activeBg
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {STATUS_META[st].label}
                </button>
              ))}
            </div>

            <textarea
              rows={7}
              value={draftSettings.templates[activeTemplateKey]}
              onChange={(e) =>
                setDraftSettings((prev) => ({
                  ...prev,
                  templates: {
                    ...prev.templates,
                    [activeTemplateKey]: e.target.value,
                  },
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm leading-relaxed text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-700 px-6 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Simpan Pengaturan & Template
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
