import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  ShieldCheck,
  User,
  UserCheck,
} from 'lucide-react';
import { AuthUser, RoleMode } from '../types';
import { accountRequest, LoginTeacher } from '../utils/accounts';

interface LoginScreenProps {
  institutionName: string;
  onLogin: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ institutionName, onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<RoleMode>('guru');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  const handleRoleSwitch = (role: RoleMode) => {
    setSelectedRole(role);
    setError('');
    setUsername('');
    setPassword('');
  };

  const [quickTeachers, setQuickTeachers] = useState<LoginTeacher[]>([]);
  useEffect(() => {
    const refresh = () => accountRequest<LoginTeacher[]>('teachers').then(setQuickTeachers).catch(() => setQuickTeachers([]));
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await accountRequest<AuthUser>('login', { username: username.trim(), password, role: selectedRole, rememberMe });
      onLogin(user);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-blue-50/60 md:grid md:grid-cols-12">
      {/* Left Desktop Editorial Context Panel */}
      <div className="hidden md:col-span-6 md:flex md:flex-col md:justify-between md:bg-blue-900 md:p-7 lg:p-12 md:text-white xl:col-span-7 xl:p-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">HadirTKA · SMPN 1 Genteng</span>
        </div>

        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-wide text-blue-200">
            {institutionName}
          </p>
          <h1
            className="mt-3 text-4xl leading-tight font-bold tracking-tight text-white"
            style={{ textWrap: 'balance' }}
          >
            Monitoring harian Bimbel TKA Kelas 9 SMP Negeri 1 Genteng.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-blue-100/85">
            Catat absensi siswa kelas 9A–9D dan jurnal guru pembimbing langsung dari perangkat mobile, kirim laporan ke grup WhatsApp kelas maupun grup massal, serta unduh laporan PDF berkala bagi koordinator sekolah.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-8">
            <div>
              <p className="font-mono text-2xl font-bold text-white tabular-nums">Kelas 9A–9D</p>
              <p className="mt-1 text-xs text-blue-200">Fokus persiapan TKA Matematika & B. Indonesia</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-white tabular-nums">WA Real-Time</p>
              <p className="mt-1 text-xs text-blue-200">Laporan grup kelas, massal & orang tua</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-white tabular-nums">PDF & Excel</p>
              <p className="mt-1 text-xs text-blue-200">Import Excel rombel & ekspor jurnal PDF</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-blue-200/80">
          SMP Negeri 1 Genteng · Banyuwangi, Jawa Timur
        </p>
      </div>

      {/* Right / Mobile Fullscreen Android-Native Login Surface */}
      <div className="flex flex-1 flex-col justify-between bg-white px-5 pt-10 pb-8 sm:mx-auto sm:my-auto sm:w-full sm:max-w-md sm:flex-initial sm:rounded-3xl sm:border sm:border-slate-200 sm:p-8 md:col-span-6 md:border-0 md:bg-transparent md:p-6 lg:p-10 xl:col-span-5">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile Brand Header */}
          <div className="flex flex-col items-start md:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-sm">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              HadirTKA Kelas 9
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              SMP Negeri 1 Genteng · Masuk dengan username guru atau admin.
            </p>
          </div>

          {/* Desktop Form Header */}
          <div className="hidden md:block">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Masuk ke Akun Sekolah
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Gunakan username Guru Pembimbing Kelas 9 atau Admin Koordinator TKA.
            </p>
          </div>

          {/* Role Switcher Segmented Control */}
          <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => handleRoleSwitch('guru')}
              className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all ${
                selectedRole === 'guru'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              Guru Kelas 9
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('admin')}
              className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all ${
                selectedRole === 'admin'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin Sekolah
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700">
                Username {selectedRole === 'admin' ? 'Admin' : 'Guru Pembimbing'}
              </label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={selectedRole === 'admin' ? 'Masukkan username admin' : 'Contoh: guru.a'}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 pr-4 pl-10 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                Kata Sandi
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 pr-12 pl-10 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-blue-700"
              />
              <span className="text-xs text-slate-600">Tetap masuk di perangkat ini</span>
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 text-sm font-semibold text-white transition-all hover:bg-blue-800 active:scale-[0.98]"
            >
              Masuk sebagai {selectedRole === 'admin' ? 'Admin Sekolah' : 'Guru Kelas 9'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Account Switcher for Teachers (Admin requires explicit username & password) */}
          {selectedRole === 'guru' ? quickTeachers.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-500">
                Pilih akun guru
              </p>
              <div className="mt-2.5 space-y-2">
                {quickTeachers.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setUsername(acc.username);
                      setPassword('');
                      document.getElementById('login-password')?.focus();
                    }}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {acc.name}{' '}
                        <span className="font-mono font-normal text-slate-400">
                          @{acc.username}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{acc.title}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-blue-800">Pilih</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-xs leading-relaxed text-slate-500">
                Akses Admin Sekolah dilindungi kredensial khusus koordinator TKA SMP Negeri 1 Genteng. Masukkan username dan kata sandi admin untuk masuk ke dasbor analitik.
              </p>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-400 md:hidden">
          SMP Negeri 1 Genteng · Program TKA Kelas 9
        </p>
      </div>
    </div>
  );
};
