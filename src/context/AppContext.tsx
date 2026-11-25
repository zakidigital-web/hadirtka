import { accountRequest } from '../utils/accounts';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createSeedData } from '../data/seedData';
import {
  AppData,
  AttendanceRecord,
  AttendanceStatus,
  AuthUser,
  Classroom,
  ComprehensionLevel,
  ExcelImportRow,
  NavTab,
  RoleMode,
  ScheduledReportConfig,
  Student,
  TeacherJournal,
  TkaSubject,
  ToastNotice,
  WhatsAppDeliveryStatus,
  WhatsAppLog,
  WhatsAppSettings,
} from '../types';
import {
  buildWhatsAppUrl,
  formatDateLongID,
  formatTimeNow,
  getTodayISO,
  renderWhatsAppTemplate,
  STATUS_META,
  SUBJECT_META,
} from '../utils/formatters';
import {
  applyProfileOverride,
  ProfileOverride,

} from '../utils/profileStorage';

const STORAGE_KEY = 'hadirtka_smpn1genteng_v3';


const DEFAULT_REPORT_SCHEDULE: ScheduledReportConfig = {
  frequency: 'mingguan',
  dayOfWeek: 'Jumat',
  dayOfMonth: 28,
  timeWib: '17:00',
  includeJournalDetails: true,
  includeAttendanceSummary: true,
};

interface AppContextValue {
  authReady: boolean;
  data: AppData;
  currentUser: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  updateCurrentUserProfile: (updates: ProfileOverride) => Promise<void>;
  role: RoleMode;
  setRole: (role: RoleMode) => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedClassId: string;
  setSelectedClassId: (classId: string) => void;
  selectedSubject: TkaSubject;
  setSelectedSubject: (subject: TkaSubject) => void;
  toasts: ToastNotice[];
  dismissToast: (id: string) => void;
  pushToast: (toast: Omit<ToastNotice, 'id'>) => void;
  markAttendance: (params: {
    studentId: string;
    classId: string;
    date: string;
    subject: TkaSubject;
    status: AttendanceStatus;
    comprehension?: ComprehensionLevel;
    note?: string;
    triggerAutoWhatsApp?: boolean;
  }) => void;
  markStudentsPresent: (classId: string, date: string, subject: TkaSubject, studentIds: ReadonlySet<string>) => void;
  saveTeacherJournal: (journal: Omit<TeacherJournal, 'id' | 'updatedAt'>) => void;
  updateWhatsAppLogStatus: (logId: string, status: WhatsAppDeliveryStatus) => void;
  createManualWhatsAppLog: (
    studentId: string,
    date: string,
    subject: TkaSubject,
    status: AttendanceStatus,
    note?: string
  ) => WhatsAppLog | null;
  updateWhatsAppSettings: (settings: WhatsAppSettings) => void;
  updateReportSchedule: (schedule: ScheduledReportConfig) => void;
  addStudent: (student: Omit<Student, 'id'>) => void;
  bulkImportStudents: (rows: ExcelImportRow[]) => { importedCount: number; newClassesCount: number };
  updateStudent: (student: Student) => void;
  deleteStudent: (studentId: string) => void;
  addClassroom: (classroom: Omit<Classroom, 'id'>) => void;
  updateClassroom: (classroom: Classroom) => void;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadInitialData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && Array.isArray(parsed.classrooms) && Array.isArray(parsed.students)) {
        return {
          ...parsed,
          classrooms: parsed.classrooms.map(c => c.schedule === 'Senin – Jumat · 14:00–15:30 WIB'
            ? {...c, schedule:'Senin – Jumat · 13:30–14:30 WIB'} : c),
          reportSchedule: parsed.reportSchedule || DEFAULT_REPORT_SCHEDULE,
        };
      }
    }
  } catch {
    // Fallback to seed data
  }
  return {
    ...createSeedData(),
    reportSchedule: DEFAULT_REPORT_SCHEDULE,
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(() => loadInitialData());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [role, setRoleState] = useState<RoleMode>('guru');
  const [activeTab, setActiveTab] = useState<NavTab>('absensi');
  const [selectedDate, setSelectedDate] = useState(getTodayISO);
  const [selectedClassId, setSelectedClassId] = useState(data.classrooms[0]?.id || 'cls-9a');
  const [selectedSubject, setSelectedSubject] = useState<TkaSubject>('matematika');
  const canAdmin = currentUser?.role === 'admin' && role === 'admin';
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors
    }
  }, [data]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastNotice, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 2));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  }, []);

  const enterSession = useCallback((rawUser: AuthUser) => {
    const user = rawUser.revision ? rawUser : applyProfileOverride(rawUser);
    setCurrentUser(user);
    setRoleState(user.role);
    setActiveTab(user.role === 'admin' ? 'analitik' : 'absensi');
    if (user.classId) setSelectedClassId(user.classId);
    if (user.teacherSubject) setSelectedSubject(user.teacherSubject);
    return user;
  }, []);

  useEffect(() => {
    let active = true;
    accountRequest<AuthUser | null>('me').then(user => {
      if (active && user) enterSession(user);
    }).catch(() => {}).finally(() => {if (active) setAuthReady(true);});
    return () => {active = false;};
  }, [enterSession]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const refresh = () => accountRequest<AuthUser | null>('me').then(user => {
      if (!active) return;
      if (!user || user.id !== currentUser.id) {
        setCurrentUser(null);
        setToasts([]);
      } else if (user.revision !== currentUser.revision) {
        setCurrentUser(user);
      }
    }).catch(() => {});
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => {active=false; window.clearInterval(timer); window.removeEventListener('focus',refresh);};
  }, [currentUser]);

  const login = useCallback(
    (rawUser: AuthUser) => {
      const user = enterSession(rawUser);
      pushToast({
        title: `Selamat datang, ${user.name}`,
        subtitle:
          user.role === 'admin'
            ? 'Masuk sebagai Koordinator Admin SMPN 1 Genteng.'
            : `Mapel aktif: ${SUBJECT_META[user.teacherSubject || 'matematika'].full} — pilih rombel Kelas 9 yang diajar hari ini.`,
        tone: 'success',
      });
    },
    [pushToast, enterSession]
  );

  const updateCurrentUserProfile = useCallback(
    async (updates: ProfileOverride) => {
      const updated = await accountRequest<AuthUser>('profile', {...updates,revision:currentUser?.revision});
      setCurrentUser(updated);
      if (updates.teacherSubject) {
        setSelectedSubject(updates.teacherSubject);
      }
      pushToast({
        title: 'Profil berhasil diperbarui',
        subtitle: `${updates.name || 'Identitas akun'} dan foto profil telah disimpan.`,
        tone: 'success',
      });
    },
    [pushToast, currentUser?.revision]
  );

  const logout = useCallback(async () => {
    try {
      await accountRequest('logout', {});
      setCurrentUser(null);
      setToasts([]);
    } catch (err) {
      pushToast({title:'Gagal keluar',subtitle:(err as Error).message,tone:'warning'});
    }
  }, [pushToast]);

  const setRole = useCallback((nextRole: RoleMode) => {
    if (currentUser?.role !== 'admin') return;
    setRoleState(nextRole);
    setActiveTab(nextRole === 'admin' ? 'analitik' : 'absensi');
  }, [currentUser?.role]);

  const shouldAutoNotify = (status: AttendanceStatus, settings: WhatsAppSettings): boolean => {
    if (status === 'alpha') return settings.autoNotifyAlpha;
    if (status === 'sakit') return settings.autoNotifySakit;
    if (status === 'izin') return settings.autoNotifyIzin;
    return settings.autoNotifyHadir;
  };

  const markAttendance: AppContextValue['markAttendance'] = useCallback(
    ({ studentId, classId, date, subject, status, comprehension, note, triggerAutoWhatsApp = true }) => {
      const nowTime = formatTimeNow();
      const nowISO = new Date().toISOString();
      const recordId = `${date}_${subject}_${studentId}`;

      const student = data.students.find((s) => s.id === studentId);
      const classroom = data.classrooms.find((c) => c.id === classId);
      if (!student || !classroom) return;

      const existing = data.attendance.find((a) => a.id === recordId);
      const statusChanged = !existing || existing.status !== status;
      const teacherActor = currentUser?.name || classroom.teacherName;

      const updatedRecord: AttendanceRecord = {
        id: recordId,
        date,
        subject,
        classId,
        studentId,
        status,
        checkInTime: existing?.checkInTime || nowTime,
        comprehension:
          comprehension ?? existing?.comprehension ?? (status === 'hadir' ? 'baik' : undefined),
        note: note !== undefined ? note : existing?.note || '',
        recordedBy: teacherActor,
        updatedAt: nowISO,
      };

      let createdLog: WhatsAppLog | null = null;
      if (triggerAutoWhatsApp && statusChanged && shouldAutoNotify(status, data.whatsappSettings)) {
        const message = renderWhatsAppTemplate(data.whatsappSettings.templates[status], {
          nama_siswa: student.name,
          nama_ortu: student.parentName,
          kelas: `${classroom.name} (${SUBJECT_META[subject].full})`,
          status: STATUS_META[status].label,
          tanggal: formatDateLongID(date),
          waktu: nowTime,
          guru: teacherActor,
          catatan: updatedRecord.note || '',
          lembaga: data.whatsappSettings.institutionName,
        });

        createdLog = {
          id: `wa-${Date.now()}-${student.id}`,
          timestamp: nowISO,
          date,
          subject,
          studentId: student.id,
          studentName: student.name,
          classId: classroom.id,
          className: `${classroom.name} · ${SUBJECT_META[subject].short}`,
          parentName: student.parentName,
          parentWhatsapp: student.parentWhatsapp,
          triggerStatus: status,
          message,
          deliveryStatus: 'siap_kirim',
          autoTriggered: true,
        };
      }

      setData((prev) => {
        const nextAttendance = [
          ...prev.attendance.filter((a) => a.id !== recordId),
          updatedRecord,
        ];
        const nextLogs = createdLog ? [createdLog, ...prev.whatsappLogs] : prev.whatsappLogs;
        return {
          ...prev,
          attendance: nextAttendance,
          whatsappLogs: nextLogs,
        };
      });

      if (canAdmin && createdLog) {
        const waUrl = buildWhatsAppUrl(createdLog.parentWhatsapp, createdLog.message);
        pushToast({
          title: `WA Real-Time — ${STATUS_META[status].label} (${SUBJECT_META[subject].short})`,
          subtitle: `Siap dikirim ke ${student.parentName} untuk ${student.name}.`,
          whatsappUrl: waUrl,
          logId: createdLog.id,
          tone: status === 'alpha' ? 'danger' : status === 'sakit' ? 'warning' : 'default',
        });
      }
    },
    [canAdmin, data.attendance, data.classrooms, data.students, data.whatsappSettings, currentUser?.name, pushToast]
  );

  const markStudentsPresent = useCallback(
    (classId: string, date: string, subject: TkaSubject, studentIds: ReadonlySet<string>) => {
      const classroom = data.classrooms.find((c) => c.id === classId);
      const classStudents = data.students.filter((s) => s.classId === classId && studentIds.has(s.id));
      if (!classroom || classStudents.length === 0) return;

      const nowTime = formatTimeNow();
      const nowISO = new Date().toISOString();
      const teacherActor = currentUser?.name || classroom.teacherName;

      setData((prev) => {
        const map = new Map(prev.attendance.map((r) => [r.id, r]));
        classStudents.forEach((student) => {
          const id = `${date}_${subject}_${student.id}`;
          const existing = map.get(id);
          if (existing?.status === 'hadir') return;
          map.set(id, {
            id,
            date,
            subject,
            classId,
            studentId: student.id,
            status: 'hadir',
            checkInTime: existing?.checkInTime || nowTime,
            comprehension: existing?.comprehension || 'baik',
            note: existing?.note || '',
            recordedBy: teacherActor,
            updatedAt: nowISO,
          });
        });
        return {
          ...prev,
          attendance: Array.from(map.values()),
        };
      });

      pushToast({
        title: `${classStudents.length} siswa ${classroom.name} ditandai Hadir`,
        subtitle: `${SUBJECT_META[subject].full} · ${formatDateLongID(date)}`,
        tone: 'success',
      });
    },
    [data.classrooms, data.students, currentUser?.name, pushToast]
  );

  const saveTeacherJournal: AppContextValue['saveTeacherJournal'] = useCallback(
    (journal) => {
      const id = `${journal.date}_${journal.subject}_${journal.classId}`;
      const record: TeacherJournal = {
        ...journal,
        id,
        updatedAt: new Date().toISOString(),
      };

      setData((prev) => ({
        ...prev,
        journals: [record, ...prev.journals.filter((j) => j.id !== id)].sort((a, b) =>
          b.date.localeCompare(a.date)
        ),
      }));

      pushToast({
        title: `Jurnal ${SUBJECT_META[journal.subject].label} tersimpan`,
        subtitle: `${journal.topic} · ${journal.checkInTime}–${journal.checkOutTime} WIB`,
        tone: 'success',
      });
    },
    [pushToast]
  );

  const updateWhatsAppLogStatus = useCallback((logId: string, status: WhatsAppDeliveryStatus) => {
      if (!canAdmin) return;
    setData((prev) => ({
      ...prev,
      whatsappLogs: prev.whatsappLogs.map((l) =>
        l.id === logId ? { ...l, deliveryStatus: status } : l
      ),
    }));
  }, [canAdmin]);

  const createManualWhatsAppLog = useCallback(
    (
      studentId: string,
      date: string,
      subject: TkaSubject,
      status: AttendanceStatus,
      note?: string
    ): WhatsAppLog | null => {
      if (!canAdmin) return null;
      const student = data.students.find((s) => s.id === studentId);
      const classroom = student ? data.classrooms.find((c) => c.id === student.classId) : undefined;
      if (!student || !classroom) return null;

      const nowISO = new Date().toISOString();
      const teacherActor = currentUser?.name || classroom.teacherName;
      const message = renderWhatsAppTemplate(data.whatsappSettings.templates[status], {
        nama_siswa: student.name,
        nama_ortu: student.parentName,
        kelas: `${classroom.name} (${SUBJECT_META[subject].full})`,
        status: STATUS_META[status].label,
        tanggal: formatDateLongID(date),
        waktu: formatTimeNow(),
        guru: teacherActor,
        catatan: note || '',
        lembaga: data.whatsappSettings.institutionName,
      });

      const log: WhatsAppLog = {
        id: `wa-${Date.now()}-${student.id}`,
        timestamp: nowISO,
        date,
        subject,
        studentId: student.id,
        studentName: student.name,
        classId: classroom.id,
        className: `${classroom.name} · ${SUBJECT_META[subject].short}`,
        parentName: student.parentName,
        parentWhatsapp: student.parentWhatsapp,
        triggerStatus: status,
        message,
        deliveryStatus: 'terkirim',
        autoTriggered: false,
      };

      setData((prev) => ({
        ...prev,
        whatsappLogs: [log, ...prev.whatsappLogs],
      }));
      return log;
    },
    [canAdmin, data.classrooms, data.students, data.whatsappSettings, currentUser?.name]
  );

  const updateWhatsAppSettings = useCallback(
    (settings: WhatsAppSettings) => {
      if (!canAdmin) return;
      setData((prev) => ({ ...prev, whatsappSettings: settings }));
      pushToast({
        title: 'Pengaturan notifikasi WA disimpan',
        subtitle: 'Template pesan dan pemicu otomatis langsung aktif.',
        tone: 'success',
      });
    },
    [canAdmin, pushToast]
  );

  const updateReportSchedule = useCallback(
    (schedule: ScheduledReportConfig) => {
      if (!canAdmin) return;
      setData((prev) => ({ ...prev, reportSchedule: schedule }));
      pushToast({
        title: 'Jadwal laporan berkala disimpan',
        subtitle:
          schedule.frequency === 'mingguan'
            ? `Pengingat ekspor PDF setiap ${schedule.dayOfWeek} pukul ${schedule.timeWib} WIB.`
            : `Pengingat ekspor PDF setiap tanggal ${schedule.dayOfMonth} pukul ${schedule.timeWib} WIB.`,
        tone: 'success',
      });
    },
    [canAdmin, pushToast]
  );

  const addStudent = useCallback(
    (student: Omit<Student, 'id'>) => {
      if (!canAdmin) return;
      const id = `stu-${Date.now()}`;
      setData((prev) => ({
        ...prev,
        students: [...prev.students, { ...student, id }],
      }));
      pushToast({
        title: 'Siswa baru ditambahkan',
        subtitle: `${student.name} terdaftar dengan kontak WA ${student.parentWhatsapp}.`,
        tone: 'success',
      });
    },
    [canAdmin, pushToast]
  );

  const bulkImportStudents = useCallback(
    (rows: ExcelImportRow[]) => {
      if (!canAdmin) return { importedCount: 0, newClassesCount: 0 };
      const validRows = rows.filter((r) => r.valid);
      if (validRows.length === 0) return { importedCount: 0, newClassesCount: 0 };

      let newClassesCount = 0;

      setData((prev) => {
        const nextClassrooms = [...prev.classrooms];
        const classByName = new Map(
          nextClassrooms.map((c) => [c.name.trim().toLowerCase(), c.id])
        );

        const newStudents: Student[] = [];

        validRows.forEach((row, index) => {
          const normalizedClass = row.className.trim().toLowerCase();
          let classId = classByName.get(normalizedClass);

          if (!classId) {
            classId = `cls-imp-${Date.now()}-${index}`;
            const createdClass: Classroom = {
              id: classId,
              name: row.className.trim(),
              program: 'Bimbel TKA Kelas 9 — Matematika & Bahasa Indonesia',
              teacherName:
                currentUser?.role === 'guru' ? currentUser.name : 'Guru Contoh A',
              teacherPhone: '',
              schedule: 'Senin – Jumat · 13:30–14:30 WIB',
              room: `Ruang ${row.className.trim()}`,
              groupWaName: `Grup WA Wali & Siswa ${row.className.trim()}`,
            };
            nextClassrooms.push(createdClass);
            classByName.set(normalizedClass, classId);
            newClassesCount += 1;
          }

          newStudents.push({
            id: `stu-imp-${Date.now()}-${index}`,
            nis: row.nis,
            name: row.name,
            classId,
            parentName: row.parentName,
            parentWhatsapp: row.parentWhatsapp,
            schoolOrigin: row.schoolOrigin || 'SMPN 1 Genteng',
            notes: row.notes || undefined,
          });
        });

        return {
          ...prev,
          classrooms: nextClassrooms,
          students: [...prev.students, ...newStudents],
        };
      });

      pushToast({
        title: `${validRows.length} siswa berhasil diimpor dari Excel`,
        subtitle:
          newClassesCount > 0
            ? `${newClassesCount} rombel baru juga dibuat otomatis.`
            : 'Seluruh kontak WA orang tua langsung aktif untuk notifikasi.',
        tone: 'success',
      });

      return { importedCount: validRows.length, newClassesCount };
    },
    [canAdmin, currentUser, pushToast]
  );

  const updateStudent = useCallback(
    (student: Student) => {
      if (!canAdmin) return;
      setData((prev) => ({
        ...prev,
        students: prev.students.map((s) => (s.id === student.id ? student : s)),
      }));
      pushToast({
        title: 'Data siswa diperbarui',
        subtitle: `${student.name} telah disimpan.`,
        tone: 'success',
      });
    },
    [canAdmin, pushToast]
  );

  const deleteStudent = useCallback(
    (studentId: string) => {
      if (!canAdmin) return;
      setData((prev) => ({
        ...prev,
        students: prev.students.filter((s) => s.id !== studentId),
        attendance: prev.attendance.filter((a) => a.studentId !== studentId),
      }));
      pushToast({
        title: 'Data siswa dihapus',
        subtitle: 'Daftar rombel dan rekap absensi telah diperbarui.',
        tone: 'default',
      });
    },
    [canAdmin, pushToast]
  );

  const addClassroom = useCallback(
    (classroom: Omit<Classroom, 'id'>) => {
      if (!canAdmin) return;
      const id = `cls-${Date.now()}`;
      setData((prev) => ({
        ...prev,
        classrooms: [...prev.classrooms, { ...classroom, id }],
      }));
      setSelectedClassId(id);
      pushToast({
        title: 'Rombel baru dibuat',
        subtitle: `${classroom.name} · Penanggung jawab: ${classroom.teacherName}`,
        tone: 'success',
      });
    },
    [canAdmin, pushToast]
  );

  const updateClassroom = useCallback(
    (classroom: Classroom) => {
      if (!canAdmin) return;
      setData((prev) => ({
        ...prev,
        classrooms: prev.classrooms.map((c) => (c.id === classroom.id ? classroom : c)),
      }));
      pushToast({
        title: 'Informasi rombel & guru diperbarui',
        subtitle: classroom.name,
        tone: 'success',
      });
    },
    [canAdmin, pushToast]
  );

  const resetDemoData = useCallback(() => {
      if (!canAdmin) return;
    const fresh = {
      ...createSeedData(),
      reportSchedule: DEFAULT_REPORT_SCHEDULE,
    };
    setData(fresh);
    setSelectedClassId(fresh.classrooms[0]?.id || 'cls-9a');
    setSelectedDate(getTodayISO());
    pushToast({
      title: 'Data contoh dimuat ulang',
      subtitle: 'Seluruh data rombel Kelas 9, absensi, jurnal, dan log WA telah direset.',
      tone: 'default',
    });
  }, [canAdmin, pushToast]);

  return (
    <AppContext.Provider
      value={{
        data,
        currentUser, authReady,
        login,
        logout,
        updateCurrentUserProfile,
        role,
        setRole,
        activeTab,
        setActiveTab,
        selectedDate,
        setSelectedDate,
        selectedClassId,
        setSelectedClassId,
        selectedSubject,
        setSelectedSubject,
        toasts,
        dismissToast,
        pushToast,
        markAttendance,
        markStudentsPresent,
        saveTeacherJournal,
        updateWhatsAppLogStatus,
        createManualWhatsAppLog,
        updateWhatsAppSettings,
        updateReportSchedule,
        addStudent,
        bulkImportStudents,
        updateStudent,
        deleteStudent,
        addClassroom,
        updateClassroom,
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
