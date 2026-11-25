import { useState } from 'react';
import { accountRequest } from '../utils/accounts';

interface Job {
  id: string;
  bytes: number;
  partSize: number;
}
interface Summary {
  created: string;
  accounts: number;
  students: number;
  attendance: number;
  journals: number;
}
const button =
  'min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50';
const field = 'mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3';
const card = 'space-y-3 rounded-2xl border border-slate-200 bg-white p-5';
const close = (id: string) => accountRequest('backup/close', { id }).catch(() => {});

export function BackupView({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [review, setReview] = useState<{ id: string; password: string; summary: Summary } | null>(null);
  const [confirmation, setConfirmation] = useState('');

  async function download(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      fields = new FormData(form);
    if (fields.get('password') !== fields.get('repeat')) {
      setStatus('Kedua kata sandi cadangan harus sama.');
      return;
    }
    setBusy(true);
    setStatus('Menyiapkan cadangan…');
    let job: Job | undefined;
    try {
      job = await accountRequest<Job>('backup/export', { password: fields.get('password') });
      const chunks: ArrayBuffer[] = [];
      const total = Math.ceil(job.bytes / job.partSize);
      for (let part = 0; part < total; part++) {
        setStatus(`Mengunduh bagian ${part + 1} dari ${total}…`);
        const encoded = await accountRequest<string>(`backup/download?id=${job.id}&part=${part}`);
        chunks.push(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)).buffer);
      }
      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      if (blob.size !== job.bytes) throw new Error('Unduhan belum lengkap. Ulangi pencadangan.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'HadirTKA-' + new Date().toISOString().replace(/[:.]/g, '-') + '.htbackup';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      setStatus('Cadangan siap. Simpan file dan kata sandinya di tempat yang terpisah.');
      form.reset();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      if (job) await close(job.id);
      setBusy(false);
    }
  }

  async function preview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const file = fields.get('file'),
      password = String(fields.get('password'));
    if (!(file instanceof File) || !file.size) return;
    setBusy(true);
    setStatus('Memeriksa cadangan…');
    let job: Job | undefined;
    try {
      job = await accountRequest<Job>('backup/start', { bytes: file.size });
      const total = Math.ceil(job.bytes / job.partSize);
      for (let part = 0; part < total; part++) {
        setStatus(`Mengunggah bagian ${part + 1} dari ${total}…`);
        const data = await file.slice(part * job.partSize, (part + 1) * job.partSize).arrayBuffer();
        // FileReader encodes the bytes without spreading a large array onto the call stack.
        const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('File gagal dibaca.'));
          reader.readAsDataURL(new Blob([data]));
        });
        await accountRequest('backup/upload', { id: job.id, part, data: encoded });
      }
      const summary = await accountRequest<Summary>('backup/preview', { id: job.id, password });
      setReview({ id: job.id, password, summary });
      setConfirmation('');
      setStatus('');
    } catch (e) {
      if (job) await close(job.id);
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!review || confirmation !== 'PULIHKAN') return;
    setBusy(true);
    setStatus('Memulihkan database…');
    try {
      await accountRequest('backup/restore', {
        id: review.id,
        password: review.password,
        confirm: confirmation,
      });
      window.location.reload();
    } catch (e) {
      setStatus((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <button
        disabled={busy}
        onClick={() => {
          if (review) void close(review.id);
          onBack();
        }}
        className="text-sm font-semibold text-blue-700"
      >
        ← Analitik Admin
      </button>
      <h1 className="text-xl font-bold">Cadangan database</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={download} className={card}>
          <h2 className="font-semibold">Unduh cadangan</h2>
          <p className="text-sm">
            File terenkripsi berisi akun, kelas, siswa, absensi, jurnal, log WA dan pengaturan. Kata
            sandi ini diperlukan untuk memulihkan file.
          </p>
          <label className="block text-sm">
            Kata sandi cadangan (minimal 12 karakter)
            <input
              className={field}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
            />
          </label>
          <label className="block text-sm">
            Ulangi kata sandi cadangan
            <input
              className={field}
              name="repeat"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <button disabled={busy || !!review} className={button}>
            Unduh cadangan
          </button>
        </form>
        {review ? (
          <div className={card}>
            <h2 className="font-semibold">Konfirmasi pemulihan</h2>
            <p className="text-sm">
              Cadangan dibuat {new Date(review.summary.created).toLocaleString('id-ID')}. Isinya{' '}
              {review.summary.accounts} akun, {review.summary.students} siswa,{' '}
              {review.summary.attendance} catatan absensi dan {review.summary.journals} jurnal.
            </p>
            <p className="text-sm font-semibold text-rose-800">
              Pemulihan mengganti seluruh data aktif dan mengakhiri semua sesi. Setelah selesai, masuk
              dengan akun dari cadangan.
            </p>
            <label className="block text-sm">
              Ketik PULIHKAN untuk melanjutkan
              <input
                className={field}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                className="min-h-11 rounded-xl border px-4"
                onClick={() => {
                  void close(review.id);
                  setReview(null);
                  setStatus('Pemulihan dibatalkan.');
                }}
              >
                Batal
              </button>
              <button
                disabled={busy || confirmation !== 'PULIHKAN'}
                onClick={restore}
                className={button + ' bg-rose-700'}
              >
                Pulihkan database
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={preview} className={card}>
            <h2 className="font-semibold">Pulihkan cadangan</h2>
            <label className="block text-sm">
              File HadirTKA (.htbackup, maksimal 64 MiB)
              <input className="mt-2 block w-full" type="file" name="file" accept=".htbackup" required />
            </label>
            <label className="block text-sm">
              Kata sandi file
              <input className={field} name="password" type="password" autoComplete="off" required />
            </label>
            <button disabled={busy} className={button}>
              Periksa cadangan
            </button>
          </form>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-sm font-medium">
        {status}
      </p>
    </section>
  );
}
