import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Classroom, ExcelImportRow, Student } from '../types';
import {
  downloadExcelTemplate,
  exportStudentsToExcel,
  parseExcelFile,
} from '../utils/excelImport';
import { formatPhoneDisplay, getInitials } from '../utils/formatters';
import { BottomSheet } from './BottomSheet';

const STUDENTS_PER_PAGE = 10;

export const ClassManagementView: React.FC = () => {
  const {
    data, currentUser, role,
    addStudent,
    bulkImportStudents,
    updateStudent,
    deleteStudent,
    addClassroom,
    updateClassroom, deleteClassroom,
    resetDemoData,
    pushToast,
  } = useApp();

  const canAdmin = currentUser?.role === 'admin' && role === 'admin';
  const [classFilter, updateClassFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const setClassFilter = (id: string) => {
    updateClassFilter(id);
    setPage(1);
  };

  // Student sheet state
  const [studentSheetOpen, setStudentSheetOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [stuName, setStuName] = useState('');
  const [stuNis, setStuNis] = useState('');
  const [stuClassId, setStuClassId] = useState(data.classrooms[0]?.id || 'cls-9a');
  const [stuParentName, setStuParentName] = useState('');
  const [stuParentWa, setStuParentWa] = useState('');
  const [stuSchool, setStuSchool] = useState('');
  const [stuNotes, setStuNotes] = useState('');

  // Class & Teacher sheet state
  const [classSheetOpen, setClassSheetOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Classroom | null>(null);
  const [clsName, setClsName] = useState('');
  const [clsProgram, setClsProgram] = useState('');
  const [clsTeacher, setClsTeacher] = useState('');
  const [clsPhone, setClsPhone] = useState('');
  const [clsSchedule, setClsSchedule] = useState('');
  const [clsRoom, setClsRoom] = useState('');
  const [clsGroupWa, setClsGroupWa] = useState('');

  // Excel import sheet state
  const [excelSheetOpen, setExcelSheetOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ExcelImportRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [excelError, setExcelError] = useState('');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Confirm delete / reset
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<Student | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const classMap = useMemo(
    () => new Map<string, Classroom>(data.classrooms.map((c) => [c.id, c])),
    [data.classrooms]
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.students
      .filter((s) => {
        if (classFilter !== 'all' && s.classId !== classFilter) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          s.parentName.toLowerCase().includes(q) ||
          s.parentWhatsapp.includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.students, classFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
  const visibleStudents = filteredStudents.slice(startIndex, startIndex + STUDENTS_PER_PAGE);

  const validImportRows = useMemo(() => parsedRows.filter((r) => r.valid), [parsedRows]);
  const invalidImportRows = useMemo(() => parsedRows.filter((r) => !r.valid), [parsedRows]);

  const openAddStudent = () => {
    setEditingStudent(null);
    const nextNum = 2801 + data.students.length;
    setStuName('');
    setStuNis(`0091${nextNum}`);
    setStuClassId(classFilter !== 'all' ? classFilter : data.classrooms[0]?.id || 'cls-9a');
    setStuParentName('');
    setStuParentWa('08');
    setStuSchool('SMPN 1 Genteng');
    setStuNotes('');
    setStudentSheetOpen(true);
  };

  const openEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStuName(student.name);
    setStuNis(student.nis);
    setStuClassId(student.classId);
    setStuParentName(student.parentName);
    setStuParentWa(student.parentWhatsapp);
    setStuSchool(student.schoolOrigin);
    setStuNotes(student.notes || '');
    setStudentSheetOpen(true);
  };

  const openAddClass = () => {
    setEditingClass(null);
    setClsName('');
    setClsProgram('Bimbel TKA Kelas 9 — Matematika & Bahasa Indonesia');
    setClsTeacher('');
    setClsPhone('0812');
    setClsSchedule('Senin – Jumat · 13:30–14:30 WIB');
    setClsRoom('');
    setClsGroupWa('');
    setClassSheetOpen(true);
  };

  const openEditClass = (cls: Classroom) => {
    setEditingClass(cls);
    setClsName(cls.name);
    setClsProgram(cls.program);
    setClsTeacher(cls.teacherName);
    setClsPhone(cls.teacherPhone);
    setClsSchedule(cls.schedule);
    setClsRoom(cls.room);
    setClsGroupWa(cls.groupWaName || `Grup WA TKA ${cls.name} SMPN 1 Genteng`);
    setClassSheetOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuName.trim()) return;

    const payload = {
      nis: stuNis.trim() || `0091${Date.now().toString().slice(-4)}`,
      name: stuName.trim(),
      classId: stuClassId,
      parentName: stuParentName.trim(),
      parentWhatsapp: stuParentWa.trim(),
      schoolOrigin: stuSchool.trim() || 'SMPN 1 Genteng',
      notes: stuNotes.trim() || undefined,
    };

    if (editingStudent) {
      updateStudent({ ...payload, id: editingStudent.id });
    } else {
      addStudent(payload);
    }
    setStudentSheetOpen(false);
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clsName.trim() || !clsTeacher.trim()) return;

    const payload = {
      name: clsName.trim(),
      program: clsProgram.trim() || 'Bimbel TKA Kelas 9 — Matematika & Bahasa Indonesia',
      teacherName: clsTeacher.trim(),
      teacherPhone: clsPhone.trim() || '',
      schedule: clsSchedule.trim() || 'Senin – Jumat · 13:30–14:30 WIB',
      room: clsRoom.trim() || `Ruang ${clsName.trim()}`,
      groupWaName: clsGroupWa.trim() || `Grup WA TKA ${clsName.trim()} SMPN 1 Genteng`,
    };

    if (editingClass) {
      updateClassroom({ ...payload, id: editingClass.id });
    } else {
      addClassroom(payload);
    }

    setClassSheetOpen(false);
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate(data.classrooms);
    pushToast({
      title: 'Template Excel diunduh',
      subtitle: 'Isi sheet Data_Siswa lalu unggah kembali melalui menu Import Excel.',
      tone: 'success',
    });
  };

  const handleExportExcel = () => {
    exportStudentsToExcel(data.students, data.classrooms);
    pushToast({
      title: 'Data siswa diekspor ke Excel',
      subtitle: `${data.students.length} data siswa tersimpan dalam format .xlsx.`,
      tone: 'success',
    });
  };

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelError('');
    setIsParsingExcel(true);
    setUploadedFileName(file.name);

    try {
      const rows = await parseExcelFile(file, data.classrooms, data.students);
      setParsedRows(rows);
    } catch (err) {
      setParsedRows([]);
      setExcelError(err instanceof Error ? err.message : 'Gagal membaca file Excel.');
    } finally {
      setIsParsingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCommitExcelImport = () => {
    if (validImportRows.length === 0) return;
    bulkImportStudents(validImportRows);
    setParsedRows([]);
    setUploadedFileName('');
    setExcelError('');
    setExcelSheetOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              SMP Negeri 1 Genteng · Master Rombel Kelas 9, Data Guru & Kontak WA Orang Tua
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Data Rombel Kelas 9 & Guru TKA
            </h1>
          </div>

          {canAdmin && (<div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-emerald-700" />
              Template Excel
            </button>
            <button
              type="button"
              onClick={() => {
                setExcelError('');
                setParsedRows([]);
                setUploadedFileName('');
                setExcelSheetOpen(true);
              }}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </button>
            <button
              type="button"
              onClick={openAddClass}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Rombel 9 Baru
            </button>
            <button
              type="button"
              onClick={openAddStudent}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <UserPlus className="h-4 w-4" />
              Tambah Siswa
            </button>
          </div>)}
        </div>
      </section>

      {/* Class & Teacher Overview Grid (with Edit Guru & Rombel button) */}
      <details className="rounded-2xl border border-slate-200 bg-white px-4">
        <summary className="cursor-pointer py-3 text-sm font-semibold text-blue-800">
          Data kelas ({data.classrooms.length})
        </summary>
        <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.classrooms.map((cls) => {
          const count = data.students.filter((s) => s.classId === cls.id).length;
          const active = classFilter === cls.id;
          return (
            <div
              key={cls.id}
              className={`rounded-2xl border p-4 transition-colors ${
                active
                  ? 'border-blue-700 bg-blue-50/40'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setClassFilter(active ? 'all' : cls.id)}
                className="block w-full text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">{cls.name}</h2>
                  <span className="font-mono text-xs font-semibold text-blue-800 tabular-nums">
                    {count} siswa
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">{cls.program}</p>
                <p className="mt-2.5 text-xs font-semibold text-slate-800">{cls.teacherName}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {cls.room} · {cls.schedule}
                </p>
                {cls.groupWaName && (
                  <p className="mt-1 truncate text-[11px] font-medium text-emerald-700">
                    {cls.groupWaName}
                  </p>
                )}
              </button>
              <div className="mt-3 border-t border-slate-100 pt-2.5 flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-slate-500">
                  WA {formatPhoneDisplay(cls.teacherPhone)}
                </span>
                {canAdmin && (<button
                  type="button"
                  onClick={() => openEditClass(cls)}
                  className="inline-flex items-center gap-1 font-semibold text-blue-800 hover:underline"
                >
                  <Pencil className="h-3 w-3" />
                  Edit kelas
                </button>)}
                {canAdmin && <button type="button" className="min-h-11 font-semibold text-rose-700"
                  onClick={() => {
                    if (window.confirm(`Hapus kelas ${cls.name}?`)) {
                      deleteClassroom(cls.id);
                      if (classFilter === cls.id) setClassFilter('all');
                    }
                  }}>Hapus kelas</button>}
              </div>
            </div>
          );
        })}
        </div>
      </details>

      {/* Student Directory */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Cari siswa, orang tua, atau nomor WA..."
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-3 pl-10 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {classFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setClassFilter('all')}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Semua Kelas
              </button>
            )}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
              Ekspor Excel
            </button>
            {canAdmin && (<button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Data
            </button>)}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredStudents.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              Tidak ada siswa ditemukan.
            </p>
          ) : (
            visibleStudents.map((stu) => {
              const cls = classMap.get(stu.classId);
              return (
                <div
                  key={stu.id}
                  className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                      {getInitials(stu.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{stu.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        <span className="font-mono">{stu.nis}</span> · {cls?.name || '-'} ·{' '}
                        {stu.schoolOrigin}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        Wali: {stu.parentName || '—'} · WA{' '}
                        <span className="font-mono">{formatPhoneDisplay(stu.parentWhatsapp)}</span>
                      </p>
                    </div>
                  </div>

                  {canAdmin && (<div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditStudent(stu)}
                      aria-label={`Edit ${stu.name}`}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteStudent(stu)}
                      aria-label={`Hapus ${stu.name}`}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50/50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100/70"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>)}
                </div>
              );
            })
          )}
        </div>
        {totalPages > 1 && (
          <nav aria-label="Halaman data siswa" className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
            <span aria-live="polite" className="text-slate-600">
              {startIndex + 1}–{startIndex + visibleStudents.length} dari {filteredStudents.length} siswa
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}
                className="min-h-11 rounded-xl border border-blue-200 px-3 font-semibold text-blue-800 disabled:opacity-40">Sebelumnya</button>
              <span className="tabular-nums">{currentPage} / {totalPages}</span>
              <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}
                className="min-h-11 rounded-xl border border-blue-200 px-3 font-semibold text-blue-800 disabled:opacity-40">Berikutnya</button>
            </div>
          </nav>
        )}
      </section>

      {/* Excel Import Bottom Sheet */}
      <BottomSheet
        open={excelSheetOpen}
        onClose={() => setExcelSheetOpen(false)}
        title="Import Data Siswa dari Excel"
        subtitle="Mendukung file .xlsx, .xls, dan .csv dengan validasi otomatis nomor WA orang tua."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 tabular-nums">
              {parsedRows.length > 0
                ? `${validImportRows.length} siap impor · ${invalidImportRows.length} perlu perbaikan`
                : 'Belum ada file dipilih'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExcelSheetOpen(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 sm:flex-initial"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={validImportRows.length === 0}
                onClick={handleCommitExcelImport}
                className="min-h-[44px] flex-1 rounded-xl bg-blue-700 px-5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
              >
                Impor {validImportRows.length} Siswa
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Step 1: Download Template */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900">1. Unduh Template Excel Resmi</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Sudah dilengkapi format kolom NIS, Nama Siswa, Kelas, Orang Tua, dan No WA beserta contoh pengisian.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-emerald-200 bg-white px-3.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <Download className="h-4 w-4" />
              Unduh Template .xlsx
            </button>
          </div>

          {/* Step 2: Upload Excel */}
          <div>
            <p className="text-xs font-semibold text-slate-900">2. Unggah File Excel / CSV</p>
            <label className="mt-2 flex min-h-[112px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-5 text-center transition-colors hover:border-blue-600 hover:bg-blue-50/30">
              <FileSpreadsheet className="h-7 w-7 text-blue-700" />
              <p className="mt-2 text-xs font-semibold text-slate-800">
                {isParsingExcel
                  ? 'Membaca isi file Excel...'
                  : uploadedFileName
                  ? `File dipilih: ${uploadedFileName}`
                  : 'Ketuk untuk memilih file Excel (.xlsx, .xls, .csv)'}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Kolom otomatis dikenali · Kelas baru akan dibuat otomatis jika belum terdaftar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelFileSelect}
                className="sr-only"
              />
            </label>
          </div>

          {excelError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{excelError}</span>
            </div>
          )}

          {/* Step 3: Validation Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900">
                  3. Pratinjau & Validasi ({parsedRows.length} baris)
                </span>
                <span className="text-emerald-700 font-semibold tabular-nums">
                  {validImportRows.length} valid
                </span>
              </div>

              <div className="max-h-[240px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {parsedRows.map((row) => (
                  <div
                    key={`${row.rowNumber}-${row.nis}`}
                    className={`flex items-start justify-between gap-3 px-3.5 py-2.5 text-xs ${
                      row.valid ? 'bg-white' : 'bg-rose-50/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        Baris {row.rowNumber}: {row.name || '(Nama kosong)'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        <span className="font-mono">{row.nis}</span> · {row.className}
                        {row.willCreateClass ? ' (kelas baru)' : ''} · Wali: {row.parentName || '-'} ·{' '}
                        <span className="font-mono">{row.parentWhatsapp || '-'}</span>
                      </p>
                      {row.error && (
                        <p className="mt-1 font-medium text-rose-700">{row.error}</p>
                      )}
                    </div>
                    {row.valid ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Add / Edit Student Bottom Sheet */}
      <BottomSheet
        open={studentSheetOpen}
        onClose={() => setStudentSheetOpen(false)}
        title={editingStudent ? 'Ubah Data Siswa' : 'Tambah Siswa Baru'}
        subtitle="Pastikan nomor WhatsApp orang tua aktif agar notifikasi real-time terkirim tepat."
      >
        <form onSubmit={handleSaveStudent} className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="stu-name" className="block text-xs font-semibold text-slate-700">
                Nama Lengkap Siswa *
              </label>
              <input
                id="stu-name"
                type="text"
                required
                value={stuName}
                onChange={(e) => setStuName(e.target.value)}
                placeholder="Contoh: Siswa Contoh"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="stu-nis" className="block text-xs font-semibold text-slate-700">
                Nomor Induk (NIS)
              </label>
              <input
                id="stu-nis"
                type="text"
                value={stuNis}
                onChange={(e) => setStuNis(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="stu-class" className="block text-xs font-semibold text-slate-700">
                Kelas Bimbel TKA *
              </label>
              <select
                id="stu-class"
                value={stuClassId}
                onChange={(e) => setStuClassId(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                {data.classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="stu-school" className="block text-xs font-semibold text-slate-700">
                No. Absen / Keterangan Rombel
              </label>
              <input
                id="stu-school"
                type="text"
                value={stuSchool}
                onChange={(e) => setStuSchool(e.target.value)}
                placeholder="Contoh: Absen 07 · SMPN 1 Genteng"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="stu-parent" className="block text-xs font-semibold text-slate-700">
                Nama Orang Tua / Wali (opsional)
              </label>
              <input
                id="stu-parent"
                type="text"
                value={stuParentName}
                onChange={(e) => setStuParentName(e.target.value)}
                placeholder="Contoh: Wali Contoh"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="stu-wa" className="block text-xs font-semibold text-slate-700">
                Nomor WhatsApp Orang Tua (opsional)
              </label>
              <input
                id="stu-wa"
                type="tel"
                value={stuParentWa}
                onChange={(e) => setStuParentWa(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="stu-notes" className="block text-xs font-semibold text-slate-700">
              Catatan Khusus Belajar (Opsional)
            </label>
            <textarea
              id="stu-notes"
              rows={2}
              value={stuNotes}
              onChange={(e) => setStuNotes(e.target.value)}
              placeholder="Fokus materi atau catatan kondisi siswa..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStudentSheetOpen(false)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              {editingStudent ? 'Simpan Perubahan' : 'Daftarkan Siswa'}
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Add / Edit Classroom & Teacher Bottom Sheet */}
      <BottomSheet
        open={classSheetOpen}
        onClose={() => setClassSheetOpen(false)}
        title={editingClass ? `Ubah Rombel & Guru (${editingClass.name})` : 'Buat Rombel Kelas 9 Baru'}
        subtitle="Atur nama rombel Kelas 9, guru pembimbing TKA, kontak WA guru, dan jadwal sesi."
      >
        <form onSubmit={handleSaveClass} className="space-y-3.5">
          <div>
            <label htmlFor="cls-name" className="block text-xs font-semibold text-slate-700">
              Nama Rombel Kelas 9 *
            </label>
            <input
              id="cls-name"
              type="text"
              required
              value={clsName}
              onChange={(e) => setClsName(e.target.value)}
              placeholder="Contoh: Kelas 9E"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="cls-program" className="block text-xs font-semibold text-slate-700">
              Program Bimbingan TKA
            </label>
            <input
              id="cls-program"
              type="text"
              value={clsProgram}
              onChange={(e) => setClsProgram(e.target.value)}
              placeholder="Bimbel TKA Kelas 9 — Matematika & Bahasa Indonesia"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cls-teacher" className="block text-xs font-semibold text-slate-700">
                Guru Pembimbing TKA *
              </label>
              <input
                id="cls-teacher"
                type="text"
                required
                value={clsTeacher}
                onChange={(e) => setClsTeacher(e.target.value)}
                placeholder="Contoh: Guru Contoh A"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="cls-room" className="block text-xs font-semibold text-slate-700">
                Ruang Kelas
              </label>
              <input
                id="cls-room"
                type="text"
                value={clsRoom}
                onChange={(e) => setClsRoom(e.target.value)}
                placeholder="Contoh: Ruang Kelas 9E"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cls-schedule" className="block text-xs font-semibold text-slate-700">
                Jadwal Bimbel
              </label>
              <input
                id="cls-schedule"
                type="text"
                value={clsSchedule}
                onChange={(e) => setClsSchedule(e.target.value)}
                placeholder="Senin – Jumat · 13:30–14:30 WIB"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="cls-phone" className="block text-xs font-semibold text-slate-700">
                Nomor WA Koordinator
              </label>
              <input
                id="cls-phone"
                type="tel"
                value={clsPhone}
                onChange={(e) => setClsPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="cls-group-wa" className="block text-xs font-semibold text-slate-700">
              Nama Grup WhatsApp Rombel
            </label>
            <input
              id="cls-group-wa"
              type="text"
              value={clsGroupWa}
              onChange={(e) => setClsGroupWa(e.target.value)}
              placeholder="Contoh: Grup WA TKA Kelas 9E SMPN 1 Genteng"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setClassSheetOpen(false)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              {editingClass ? 'Simpan Data Guru & Rombel' : 'Simpan Rombel'}
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Delete Student Confirmation */}
      <BottomSheet
        open={Boolean(confirmDeleteStudent)}
        onClose={() => setConfirmDeleteStudent(null)}
        title="Hapus Data Siswa?"
        subtitle={confirmDeleteStudent?.name}
      >
        <p className="text-sm text-slate-600">
          Menghapus <strong>{confirmDeleteStudent?.name}</strong> akan menghilangkan siswa ini dari daftar kelas serta seluruh riwayat absensinya.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmDeleteStudent(null)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDeleteStudent) deleteStudent(confirmDeleteStudent.id);
              setConfirmDeleteStudent(null);
            }}
            className="min-h-[44px] rounded-xl bg-rose-700 px-5 text-xs font-semibold text-white hover:bg-rose-800"
          >
            Ya, Hapus Siswa
          </button>
        </div>
      </BottomSheet>

      {/* Reset Demo Data Confirmation */}
      <BottomSheet
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset Data ke Contoh Awal?"
      >
        <p className="text-sm text-slate-600">
          Data kelas, siswa, absensi, jurnal, dan log WA pada server bersama akan diganti dengan data contoh. Perubahan berlaku untuk semua perangkat.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmResetOpen(false)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              resetDemoData();
              setConfirmResetOpen(false);
            }}
            className="min-h-[44px] rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Reset Sekarang
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
