import { useEffect, useState } from 'react';
import { accountRequest, LoginTeacher } from '../utils/accounts';
import { useApp } from '../context/AppContext';
import { BottomSheet } from './BottomSheet';
import { TkaSubject } from '../types';

interface ManagedTeacher extends LoginTeacher {
  active: boolean;
  revision: number;
  teacherSubject: TkaSubject;
  classId: string;
}

export function TeacherAccounts() {
  const {data} = useApp();
  const [teachers, setTeachers] = useState<ManagedTeacher[]>([]);
  const [deleting, setDeleting] = useState<ManagedTeacher | null>(null);
  const [editing, setEditing] = useState<ManagedTeacher | 'new' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const teacher = editing && editing !== 'new' ? editing : null;
  const refresh = () => accountRequest<ManagedTeacher[]>('teachers').then(setTeachers);
  useEffect(() => { refresh().catch(e => setMessage(e.message)); },[]);
  function open(target: ManagedTeacher | 'new') {
    setError('');
    setMessage('');
    setEditing(target);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      await accountRequest('teachers',{
        ...Object.fromEntries(fields), id:teacher?.id, revision:teacher?.revision,
        active:fields.has('active'), visible:fields.has('visible'),
      });
      setEditing(null);
      setMessage(teacher ? 'Perubahan akun tersimpan.' : 'Akun guru ditambahkan.');
      await refresh().catch(e => setMessage(e.message));
    } catch (e) {
      setError((e as Error).message);
      await refresh().catch(() => {});
    } finally { setSaving(false); }
  }
  async function removeTeacher() {
    if (!deleting || saving) return;
    setSaving(true);
    try {
      await accountRequest('teachers/delete', {id:deleting.id, revision:deleting.revision});
      setTeachers(rows => rows.filter(row => row.id !== deleting.id));
      setMessage(`Akun ${deleting.name} dihapus.`);
    } catch (err) {
      setMessage((err as Error).message);
      await refresh().catch(() => {});
    } finally {
      setDeleting(null);
      setSaving(false);
    }
  }
  const inputClass = 'mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3';
  return <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h1 className="text-xl font-bold">Kelola akun guru</h1>
    <button onClick={() => open('new')} className="my-3 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white">Tambah guru</button>
    <ul className="divide-y divide-slate-100">{teachers.map(t =>
      <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
        <div className="min-w-0"><p className="break-words font-semibold">{t.name}</p>
          <p className="break-words text-xs text-slate-600">@{t.username} · {t.active ? (t.visible ? 'Tampil di login' : 'Login manual') : 'Nonaktif'}</p></div>
        <div className="flex shrink-0 items-center">
        <button onClick={() => open(t)} aria-label={'Ubah akun '+t.name} className="min-h-11 rounded-xl px-3 font-semibold text-blue-700">Ubah</button>
        <button onClick={() => setDeleting(t)} aria-label={'Hapus akun '+t.name} className="min-h-11 rounded-xl px-2 text-rose-700">Hapus</button>
        </div>
      </li>)}</ul>
    <p role="status" className="text-sm">{message}</p>
    <BottomSheet open={editing !== null} onClose={() => {if (!saving) setEditing(null);}} title={teacher ? 'Ubah akun guru' : 'Tambah akun guru'}>
      <form key={teacher?.id || 'new'} onSubmit={save} className="space-y-3 text-sm">
        <label className="block">Nama lengkap<input required name="name" maxLength={120} defaultValue={teacher?.name} className={inputClass}/></label>
        <label className="block">Username<input required name="username" pattern="[a-zA-Z0-9._\-]{3,64}" title="3–64 huruf, angka, titik, garis bawah atau tanda hubung" autoCapitalize="none" defaultValue={teacher?.username} className={inputClass}/></label>
        <label className="block">Jabatan<input required name="title" maxLength={160} defaultValue={teacher?.title || 'Guru Pembimbing TKA'} className={inputClass}/></label>
        <label className="block">Mata pelajaran<select name="teacherSubject" defaultValue={teacher?.teacherSubject} className={inputClass}>
          <option value="matematika">Matematika</option><option value="bahasa_indonesia">Bahasa Indonesia</option></select></label>
        <label className="block">Kelas awal<select required name="classId" defaultValue={teacher?.classId || data.classrooms[0]?.id} className={inputClass}>
          {teacher && !data.classrooms.some(c=>c.id===teacher.classId) && <option value={teacher.classId}>{teacher.classId}</option>}
          {data.classrooms.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block">{teacher ? 'Kata sandi baru (opsional)' : 'Kata sandi awal'}<input required={!teacher} name="password" minLength={8} type="password" autoComplete="new-password" placeholder="Minimal 8 karakter" className={inputClass}/></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={teacher?.active ?? true}/>Akun aktif</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="visible" defaultChecked={teacher?.visible ?? true}/>Tampilkan di halaman login</label>
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        <button disabled={saving} className="min-h-11 w-full rounded-xl bg-blue-700 text-white">Simpan akun</button>
      </form>
    </BottomSheet>
    <BottomSheet open={!!deleting} onClose={() => {if (!saving) setDeleting(null);}} title="Hapus akun guru?">
      <p className="text-sm">Akun <strong>{deleting?.name} (@{deleting?.username})</strong> akan dihapus permanen. Guru akan kehilangan akses. Riwayat mengajar tetap tersimpan.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button disabled={saving} onClick={() => setDeleting(null)} className="min-h-11 rounded-xl border px-4">Batal</button>
        <button disabled={saving} onClick={removeTeacher} className="min-h-11 rounded-xl bg-rose-700 px-4 font-semibold text-white">Hapus akun</button>
      </div>
    </BottomSheet>
  </section>;
}

export function PasswordForm() {
  const [message,setMessage] = useState('');
  const [saving,setSaving] = useState(false);
  return <form className="mt-5 space-y-3 border-t border-slate-200 pt-4" onSubmit={async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const values=new FormData(form);
    if(values.get('newPassword')!==values.get('confirm')) {setMessage('Konfirmasi kata sandi belum cocok.');return;}
    setSaving(true);
    try {
      await accountRequest('password',{oldPassword:values.get('oldPassword'),newPassword:values.get('newPassword')});
      form.reset();setMessage('Kata sandi berhasil diganti.');
    } catch(err) {setMessage((err as Error).message);}
    finally {setSaving(false);}
  }}>
    <h3 className="font-semibold">Ganti kata sandi</h3>
    {([['oldPassword','Kata sandi lama'],['newPassword','Kata sandi baru (minimal 8 karakter)'],['confirm','Konfirmasi kata sandi baru']] as const).map(([name,label])=>
      <label key={name} className="block text-sm">{label}<input type="password" name={name} required minLength={name==='oldPassword'?1:8} autoComplete={name==='oldPassword'?'current-password':'new-password'} className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5"/></label>)}
    <button disabled={saving} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white">Simpan kata sandi</button>
    <p role="status" className="text-sm">{message}</p>
  </form>;
}
