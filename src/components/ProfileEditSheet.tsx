import { PasswordForm } from './AccountSettings';
import React, { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Trash2, Upload } from 'lucide-react';
import { AuthUser, TkaSubject } from '../types';
import { compressAvatarFile } from '../utils/profileStorage';
import { BottomSheet } from './BottomSheet';

const DEFAULT_AVATARS = [
  {
    label: 'Foto Guru',
    url: '/src/assets/images/guru.svg',
  },
  {
    label: 'Foto Koordinator',
    url: '/src/assets/images/admin.svg',
  },
];

interface ProfileEditSheetProps {
  open: boolean;
  onClose: () => void;
  user: AuthUser;
  onSave: (updates: {
    name: string;
    title: string;
    nip?: string;
    phone?: string;
    teacherSubject?: TkaSubject;
    avatarUrl: string;
  }) => Promise<void>;
}

export const ProfileEditSheet: React.FC<ProfileEditSheetProps> = ({
  open,
  onClose,
  user,
  onSave,
}) => {
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title);
  const [nip, setNip] = useState(user.nip || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [teacherSubject, setTeacherSubject] = useState<TkaSubject>(
    user.teacherSubject || 'matematika'
  );
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [avatarError, setAvatarError] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setTitle(user.title);
      setNip(user.nip || '');
      setPhone(user.phone || '');
      setTeacherSubject(user.teacherSubject || 'matematika');
      setAvatarUrl(user.avatarUrl);
      setAvatarError('');
    }
  }, [open, user]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase() || 'U';

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressAvatarFile(file);
      setAvatarUrl(compressed);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Gagal memproses foto.');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await onSave({
      name: name.trim(),
      title:
        title.trim() ||
        (user.role === 'admin'
          ? 'Koordinator TKA Kelas 9 · Admin'
          : 'Guru Pembimbing TKA Kelas 9'),
      nip: nip.trim() || undefined,
      phone: phone.trim() || undefined,
      teacherSubject: user.role === 'guru' ? teacherSubject : undefined,
      avatarUrl,
    });
      onClose();
    } catch (error) {
      setAvatarError((error as Error).message);
    }
  };

  const defaultRoleAvatar =
    user.role === 'admin' ? DEFAULT_AVATARS[1].url : DEFAULT_AVATARS[0].url;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Edit Profil & Identitas"
      subtitle={`Akun @${user.username} · ${user.role === 'admin' ? 'Admin Sekolah' : 'Guru Kelas 9'}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Profile Photo Picker */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name || user.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarUrl('')}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-blue-700/20"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-700 text-lg font-bold text-white">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Unggah foto profil"
              className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-700 text-white shadow-sm hover:bg-blue-800"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-semibold text-slate-900">Foto Profil</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Pilih dari galeri atau kamera (otomatis dipotong persegi & dikompresi).
            </p>

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <button
                type="button"
                disabled={isProcessingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {isProcessingPhoto ? 'Memproses...' : 'Unggah Foto'}
              </button>

              <button
                type="button"
                onClick={() => setAvatarUrl(defaultRoleAvatar)}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Default
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Inisial
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="sr-only"
            />
          </div>
        </div>

        {avatarError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {avatarError}
          </p>
        )}

        {/* Nama Lengkap */}
        <div>
          <label htmlFor="profile-name" className="block text-xs font-semibold text-slate-700">
            Nama Lengkap & Gelar *
          </label>
          <input
            id="profile-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Guru Contoh A"
            className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Jabatan / Identitas */}
        <div>
          <label htmlFor="profile-title" className="block text-xs font-semibold text-slate-700">
            Jabatan / Identitas Tugas
          </label>
          <input
            id="profile-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              user.role === 'admin'
                ? 'Koordinator TKA Kelas 9 · Admin'
                : 'Guru Matematika TKA · Rotasi Kelas 9A–9D'
            }
            className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>

        {/* NIP & Nomor WA */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-nip" className="block text-xs font-semibold text-slate-700">
              NIP / NUPTK (Opsional)
            </label>
            <input
              id="profile-nip"
              type="text"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="Contoh: NIP guru"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="profile-phone" className="block text-xs font-semibold text-slate-700">
              Nomor WhatsApp (Opsional)
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812xxxxxxxx"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Mapel Utama TKA (Khusus Guru) */}
        {user.role === 'guru' && (
          <div>
            <p className="block text-xs font-semibold text-slate-700">Mapel Utama TKA Kelas 9</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTeacherSubject('matematika')}
                className={`min-h-[42px] rounded-xl border text-xs font-semibold transition-colors ${
                  teacherSubject === 'matematika'
                    ? 'border-blue-700 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Matematika TKA
              </button>
              <button
                type="button"
                onClick={() => setTeacherSubject('bahasa_indonesia')}
                className={`min-h-[42px] rounded-xl border text-xs font-semibold transition-colors ${
                  teacherSubject === 'bahasa_indonesia'
                    ? 'border-blue-700 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Bahasa Indonesia TKA
              </button>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isProcessingPhoto || !name.trim()}
            className="min-h-[44px] rounded-xl bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Simpan Profil
          </button>
        </div>
      </form>
      {user.role === 'guru' && <PasswordForm />}
    </BottomSheet>
  );
};
