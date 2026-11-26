import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { accountRequest, LoginTeacher } from '../utils/accounts';
import { SUBJECT_META, getTodayISO } from '../utils/formatters';

const statuses = {
  hadir: ['Masuk', 'bg-green-100 text-green-900'],
  tidak_masuk: ['Tidak masuk', 'bg-red-100 text-red-900'],
  digantikan: ['Digantikan', 'bg-yellow-100 text-yellow-900'],
  kosong: ['Belum tercatat', 'bg-slate-100 text-slate-700'],
} as const;

export function TeacherAttendanceTable() {
  const { data } = useApp();
  const [date, setDate] = useState(getTodayISO);
  const [teachers, setTeachers] = useState<LoginTeacher[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    accountRequest<LoginTeacher[]>('teachers')
      .then(result => { if (active) { setTeachers(result); setLoaded(true); } })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);

  const recorded = new Set<string>();
  const rows: {key: string; name: string; session: string; status: readonly [string, string]; substitute: string}[] = [];
  for (const j of data.journals.filter(j => j.date === date)) {
    const classroom = data.classrooms.find(c => c.id === j.classId);
    const replaced = j.teacherStatus === 'digantikan';
    const name = replaced ? j.scheduledTeacherName || classroom?.teacherName || 'Guru kelas' : j.teacherName;
    const id = replaced ? j.scheduledTeacherId : j.teacherId;
    const teacher = id ? teachers.find(t => t.id === id) : teachers.find(t => t.name === name);
    if (teacher) recorded.add(teacher.id);
    const session = (classroom?.name || j.classId) + ' · ' + SUBJECT_META[j.subject].label;
    if (replaced && j.substituteTeacher) {
      const sub = teachers.find(t => t.name.trim().toLowerCase() === j.substituteTeacher!.trim().toLowerCase());
      if (sub) recorded.add(sub.id);
      rows.push({ key: j.id + '-sub', name: sub?.name || j.substituteTeacher, session, status: statuses.hadir, substitute: '—' });
    }
    rows.push({ key: j.id, name: teacher?.name || name, session,
      status: statuses[j.teacherStatus], substitute: replaced ? j.substituteTeacher || '—' : '—' });
  }
  for (const t of teachers) {
    if (!recorded.has(t.id)) rows.push({ key: t.id, name: t.name, session: '—', status: statuses.kosong, substitute: '—' });
  }
  rows.sort((a,b) => a.name.localeCompare(b.name, 'id') || a.session.localeCompare(b.session, 'id'));

  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold text-slate-900">Daftar hadir guru</h2>
      <label className="flex items-center gap-2 text-sm">Tanggal
        <input type="date" className="min-h-11 rounded-xl border border-slate-200 px-2" value={date}
          onChange={e => e.target.value && setDate(e.target.value)} />
      </label>
    </div>
    {error && <p role="alert" className="py-2 text-red-700">{error}</p>}
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="bg-slate-50"><tr>{['Guru','Kelas dan mapel','Status','Guru pengganti'].map(h => <th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.key} className="border-t border-slate-100">
        <th scope="row" className="p-2 font-medium">{row.name}</th><td className="p-2">{row.session}</td>
        <td className="p-2"><span className={'inline-block whitespace-nowrap rounded-lg px-2 py-1 ' + row.status[1]}>{row.status[0]}</span></td>
        <td className="p-2">{row.substitute}</td>
      </tr>)}</tbody>
    </table></div>
    {!rows.length && !error && <p className="p-2 text-sm">{loaded ? 'Belum ada data guru.' : 'Memuat daftar guru…'}</p>}
  </section>;
}
