import { TeacherAccounts } from './components/AccountSettings';
import { TeacherHistory } from './components/TeacherHistory';
import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ExternalLink,
  FileText,
  GraduationCap,
  LogOut,
  MessageCircle,
  Pencil,
  Users,
  X,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { NavTab } from './types';
import { LoginScreen } from './components/LoginScreen';
import { BottomSheet } from './components/BottomSheet';
import { ProfileEditSheet } from './components/ProfileEditSheet';
import { TeacherAttendanceView } from './components/TeacherAttendanceView';
import { TeacherJournalView } from './components/TeacherJournalView';
import { WhatsAppView } from './components/WhatsAppView';
import { ReportsView } from './components/ReportsView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { ClassManagementView } from './components/ClassManagementView';

interface NavItem {
  id: NavTab;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GURU_NAV: NavItem[] = [
  { id: 'absensi', label: 'Absensi Harian', mobileLabel: 'Absensi', icon: ClipboardCheck },
  { id: 'jurnal', label: 'Jurnal Guru', mobileLabel: 'Jurnal', icon: BookOpen },
  { id: 'laporan', label: 'Riwayat Mengajar', mobileLabel: 'Laporan', icon: FileText },
  { id: 'kelas', label: 'Data Kelas', mobileLabel: 'Kelas', icon: Users },
];

const ADMIN_NAV: NavItem[] = [
  { id: 'analitik', label: 'Analitik Admin', mobileLabel: 'Analitik', icon: BarChart3 },
  { id: 'laporan', label: 'Laporan PDF', mobileLabel: 'Laporan', icon: FileText },
  { id: 'absensi', label: 'Pantau Absensi', mobileLabel: 'Absensi', icon: ClipboardCheck },
  { id: 'whatsapp', label: 'WhatsApp', mobileLabel: 'WA Grup', icon: MessageCircle },
  { id: 'kelas', label: 'Data Kelas', mobileLabel: 'Kelas', icon: Users },
  { id: 'akun_guru', label: 'Akun Guru', mobileLabel: 'Akun Guru', icon: GraduationCap },
];

const TAB_TITLE: Record<NavTab, string> = {
  absensi: 'Absensi Harian',
  jurnal: 'Jurnal Guru',
  whatsapp: 'Notifikasi WA',
  laporan: 'Laporan PDF',
  analitik: 'Analitik Admin',
  akun_guru: 'Kelola Akun Guru',
  kelas: 'Data Kelas',
};

const AvatarImage: React.FC<{ src: string; alt: string; fallback: string; size?: 'sm' | 'md' }> = ({
  src,
  alt,
  fallback,
  size = 'md',
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-xs';

  if (!src || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-blue-700 font-bold text-white ${dim}`}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ring-1 ring-slate-200 ${dim}`}
    />
  );
};

const AppShell: React.FC = () => {
  const {
    data,
    currentUser, authReady, workspaceReady, workspaceError, workspacePending, retryWorkspace,
    login,
    logout,
    updateCurrentUserProfile,
    role,
    setRole,
    activeTab,
    setActiveTab,
    toasts,
    dismissToast,
    updateWhatsAppLogStatus,
  } = useApp();

  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const canAdmin = currentUser?.role === 'admin' && role === 'admin';
  const navItems = canAdmin ? ADMIN_NAV : GURU_NAV;

  const pendingWaCount = useMemo(
    () => data.whatsappLogs.filter((l) => l.deliveryStatus === 'siap_kirim').length,
    [data.whatsappLogs]
  );

  // Entry Gate: Show Android-native Login Form when unauthenticated
  if (!authReady) return <p className="p-5">Memuat akun…</p>;
  if (!currentUser) {
    return (
      <LoginScreen
        institutionName={data.whatsappSettings.institutionName}
        onLogin={login}
      />
    );
  }

  if (!workspaceReady) return <div role="status" className="p-5">
    {workspaceError || 'Memuat data sekolah…'}
    {workspaceError && <button className="ml-3 underline" onClick={retryWorkspace}>Coba lagi</button>}
  </div>;
  const userInitials = currentUser.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const renderContent = () => {
    switch (activeTab) {
      case 'absensi':
        return <TeacherAttendanceView />;
      case 'jurnal':
        return <TeacherJournalView />;
      case 'whatsapp':
        return canAdmin ? <WhatsAppView /> : <TeacherAttendanceView />;
      case 'laporan':
        return canAdmin ? <ReportsView /> : <TeacherHistory />;
      case 'akun_guru':
        return canAdmin ? <TeacherAccounts /> : <TeacherAttendanceView />;
      case 'analitik':
        return canAdmin ? <AdminDashboardView /> : <TeacherAttendanceView />;
      case 'kelas':
        return <ClassManagementView />;
      default:
        return <TeacherAttendanceView />;
    }
  };

  return (
    <div className="min-h-dvh bg-blue-50/60 text-slate-900 xl:flex">
      {/* Desktop Left Sidebar (256px) */}
      <aside className="hidden xl:fixed xl:inset-y-0 xl:left-0 xl:z-30 xl:flex xl:w-64 xl:flex-col xl:border-r xl:border-slate-200 xl:bg-white">
        {/* Wordmark */}
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            HadirTKA
          </span>
        </div>

        {/* Workspace View Switcher inside Sidebar (Admin only) */}
        {currentUser.role === 'admin' && (
          <div className="px-4 pt-4 pb-2">
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setRole('guru')}
                className={`min-h-[36px] whitespace-nowrap rounded-lg text-xs font-semibold transition-colors ${
                  role === 'guru'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Guru Kelas
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`min-h-[36px] whitespace-nowrap rounded-lg text-xs font-semibold transition-colors ${
                  role === 'admin'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin
              </button>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav aria-label="Navigasi utama" className="flex-1 space-y-1 px-3 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-xl px-3.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className={`h-4.5 w-4.5 ${active ? 'text-blue-700' : 'text-slate-400'}`} />
                  {item.label}
                </span>
                {item.id === 'whatsapp' && pendingWaCount > 0 && (
                  <span className="font-mono text-xs font-bold text-rose-700 tabular-nums">
                    {pendingWaCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active User Profile Footer with Edit Profile & Logout */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setProfileSheetOpen(true)}
              title="Ubah profil, nama & foto"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-left transition-colors hover:bg-slate-50"
            >
              <AvatarImage
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                fallback={userInitials}
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900">
                  {currentUser.name}
                </p>
                <p className="truncate text-[11px] text-slate-500">{currentUser.title}</p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setProfileSheetOpen(true)}
                title="Edit profil & foto"
                aria-label="Edit profil & foto"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-700"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={logout}
                title="Keluar dari akun"
                aria-label="Keluar dari akun"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col xl:pl-64">
        {/* Mobile Android Material-3 Compact Top App Bar (54px) */}
        <header className="sticky top-0 z-30 flex h-[54px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md xl:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-900">
                {activeTab === 'laporan' && !canAdmin ? 'Riwayat Mengajar' : TAB_TITLE[activeTab]}
              </p>
              <p className="truncate text-[10px] font-medium text-slate-500">
                HadirTKA · {role === 'admin' ? 'Admin' : 'Guru Kelas'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAccountSheetOpen(true)}
            aria-label="Buka menu akun"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full active:scale-95 transition-transform"
          >
            <AvatarImage
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              fallback={userInitials}
              size="sm"
            />
          </button>
        </header>

        {/* Desktop Workspace Top Bar (56px) */}
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-8 border-b border-slate-200 bg-white/95 px-8 backdrop-blur-md xl:flex">
          <div className="flex items-center gap-2 text-sm text-slate-500 whitespace-nowrap">
            <span>{data.whatsappSettings.institutionName}</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-900">{activeTab === 'laporan' && !canAdmin ? 'Riwayat Mengajar' : TAB_TITLE[activeTab]}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'laporan' ? 'absensi' : 'laporan')}
              className="min-h-[38px] whitespace-nowrap rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800"
            >
              {activeTab === 'laporan' ? 'Kembali ke Absensi' : canAdmin ? 'Buat Laporan PDF' : 'Riwayat Mengajar'}
            </button>
          </div>
        </header>

        {/* Bottom navigation on phones, tab bar on tablets */}
        <nav
          aria-label="Navigasi ruang kerja"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe md:sticky md:inset-x-auto md:top-[54px] md:bottom-auto md:border-t-0 md:border-b md:pb-0 xl:hidden"
        >
          <div className={`mx-auto grid h-[60px] max-w-6xl items-center px-1 md:gap-1 md:px-5 ${canAdmin ? "grid-cols-6" : "grid-cols-4"}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className="relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-center md:flex-row md:gap-1 active:scale-95 transition-transform"
                >
                  <span
                    className={`flex h-7 w-12 md:w-8 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-blue-100 text-blue-800' : 'text-slate-500'
                    }`}
                  >
                    <Icon className="h-[20px] w-[20px]" />
                  </span>
                  <span
                    className={`text-[10px] leading-tight whitespace-nowrap ${
                      active ? 'font-bold text-blue-900' : 'font-medium text-slate-500'
                    }`}
                  >
                    <span className="md:hidden">{item.mobileLabel}</span>
                    <span className="hidden md:inline md:text-xs">{item.label}</span>
                  </span>
                  {item.id === 'whatsapp' && pendingWaCount > 0 && (
                    <span className="absolute top-1 right-2.5 md:right-0 font-mono text-[10px] font-bold text-rose-700 tabular-nums">
                      {pendingWaCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Scrollable Content Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-24 sm:px-6 md:py-6 xl:px-8 xl:py-6">
          {workspaceError && <div role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">{workspaceError} <button className="underline" onClick={retryWorkspace}>Muat ulang</button></div>}
          {workspacePending && <p role="status" className="mb-2 text-sm">Menyimpan ke server…</p>}
          {renderContent()}
        </main>
      </div>

      {/* Mobile Native Account & Role Bottom Sheet */}
      <BottomSheet
        open={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        title="Akun & Pengaturan Akses"
        subtitle={data.whatsappSettings.institutionName}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <AvatarImage
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              fallback={userInitials}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{currentUser.name}</p>
              <p className="truncate text-xs text-slate-600">{currentUser.title}</p>
              <p className="truncate font-mono text-[11px] text-slate-400">
                @{currentUser.username}
                {currentUser.nip ? ` · NIP ${currentUser.nip}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setAccountSheetOpen(false);
              setProfileSheetOpen(true);
            }}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 text-xs font-semibold text-blue-900 hover:bg-blue-100/70"
          >
            <Pencil className="h-4 w-4" />
            Ubah Profil, Identitas & Foto
          </button>

          {currentUser.role === 'admin' && (
            <div>
              <p className="text-xs font-semibold text-slate-700">Ganti Tampilan Ruang Kerja</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRole('guru');
                    setAccountSheetOpen(false);
                  }}
                  className={`min-h-[46px] rounded-xl border text-xs font-semibold ${
                    role === 'guru'
                      ? 'border-blue-700 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Mode Guru Kelas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole('admin');
                    setAccountSheetOpen(false);
                  }}
                  className={`min-h-[46px] rounded-xl border text-xs font-semibold ${
                    role === 'admin'
                      ? 'border-blue-700 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Mode Admin Analitik
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setAccountSheetOpen(false);
              logout();
            }}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <LogOut className="h-4 w-4" />
            Keluar ke Halaman Login
          </button>
        </div>
      </BottomSheet>

      {/* Profile Identity & Photo Editor Sheet (Admin & Guru) */}
      <ProfileEditSheet
        open={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        user={currentUser}
        onSave={updateCurrentUserProfile}
      />

      {/* Real-Time Floating Snackbar Toasts */}
      {toasts.length > 0 && !workspacePending && !workspaceError && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-3 bottom-[72px] z-50 flex flex-col gap-2 sm:left-auto sm:right-6 sm:w-[390px] md:bottom-6"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{toast.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{toast.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Tutup notifikasi"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {canAdmin && toast.whatsappUrl && (
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={toast.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (toast.logId) updateWhatsAppLogStatus(toast.logId, 'terkirim');
                      dismissToast(toast.id);
                    }}
                    className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Kirim WA Sekarang
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('whatsapp');
                      dismissToast(toast.id);
                    }}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-slate-800 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700"
                  >
                    Lihat Log
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
