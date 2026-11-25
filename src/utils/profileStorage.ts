import { AuthUser } from '../types';

const PROFILES_STORAGE_KEY = 'hadirtka_smpn1genteng_profiles_v1';

export type ProfileOverride = Partial<
  Pick<AuthUser, 'name' | 'title' | 'nip' | 'phone' | 'teacherSubject' | 'avatarUrl'>
>;

export function loadProfileOverrides(): Record<string, ProfileOverride> {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, ProfileOverride>;
    }
  } catch {
    // Ignore corrupted storage
  }
  return {};
}

export function saveProfileOverride(username: string, override: ProfileOverride): void {
  const key = username.trim().toLowerCase();
  if (!key) return;
  try {
    const all = loadProfileOverrides();
    all[key] = { ...(all[key] || {}), ...override };
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage quota errors
  }
}

export function applyProfileOverride(user: AuthUser): AuthUser {
  const all = loadProfileOverrides();
  const key = user.username.trim().toLowerCase();
  const saved = all[key];
  if (!saved) return user;
  return {
    ...user,
    ...saved,
  };
}

/**
 * Center-crops and compresses an uploaded image file to a lightweight 256x256 JPEG data URL
 * so mobile camera photos store safely inside localStorage without exceeding quota.
 */
export function compressAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar (JPG, PNG, atau WebP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak dapat diproses.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia pada perangkat ini.'));
          return;
        }

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
          resolve(dataUrl);
        } catch {
          reject(new Error('Gagal mengompresi foto profil.'));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
