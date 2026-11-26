import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { accountRequest, LoginTeacher } from '../utils/accounts';
import { SUBJECT_META, getTodayISO, addDaysISO, formatDateShortID } from '../utils/formatters';

const statuses = {
  hadir: ['Masuk', 'bg-green-100 text-green-900'],
  tidak_masuk: ['Tidak masuk', 'bg-red-100 text-red-900'],
  digantikan: ['Digantikan', 'bg-yellow-100 text-yellow-900'],
  kosong: ['Belum tercatat', 'bg-slate-100 text-slate-700'],
} as const;

export function TeacherAttendanceTable() {
  const { data } = useApp();
  const [start, setStart] = useState(() => addDaysISO(getTodayISO(), -6));
  const [end, setEnd] = useState(getTodayISO);
  const [offset, setOffset] = useState(0);
  const dates: string[] = [];
  for (let day = addDaysISO(start, offset); dates.length < 14 && day <= end; day = addDaysISO(day, 1)) dates.push(day);
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

  type Session = {status: readonly [string,string]; detail: string};
  const roster = new Map<string, {name: string; days: Map<string, Session[]>}>();
  for (const teacher of teachers) roster.set(teacher.id, {name: teacher.name, days: new Map()});
  function record(id: string | undefined, name: string, day: string, session: Session) {
    const key = id || 'name:' + name;
    const row = roster.get(key) || {name, days: new Map<string, Session[]>()};
    row.days.set(day, [...(row.days.get(day) || []), session]);
    roster.set(key, row);
  }
  for (const j of data.journals.filter(j => dates.includes(j.date))) {
    const classroom = data.classrooms.find(c => c.id === j.classId);
    const replaced = j.teacherStatus === 'digantikan';
    const name = replaced ? j.scheduledTeacherName || classroom?.teacherName || 'Guru kelas' : j.teacherName;
    const id = replaced ? j.scheduledTeacherId : j.teacherId;
    const teacher = id ? teachers.find(t => t.id === id) : teachers.find(t => t.name === name);

    const session = (classroom?.name || j.classId) + ' · ' + SUBJECT_META[j.subject].label;
    if (replaced && j.substituteTeacher) {
      const sub = teachers.find(t => t.name.trim().toLowerCase() === j.substituteTeacher!.trim().toLowerCase());
      record(sub?.id, sub?.name || j.substituteTeacher, j.date, {status: statuses.hadir, detail: session});
    }
    record(teacher?.id || id, teacher?.name || name, j.date, {
      status: statuses[j.teacherStatus], detail: replaced && j.substituteTeacher ? session + ' · Pengganti: ' + j.substituteTeacher : session,
    });
  }
  const rows = [...roster].sort(([,a],[,b]) => a.name.localeCompare(b.name, 'id'));
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold text-slate-900">Daftar hadir guru</h2>
      <div className="flex flex-wrap gap-3 text-sm">
        <label>Dari <input type="date" value={start} className="min-h-11 rounded border px-2" onChange={e => {
          if (!e.target.value) return;
          setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); setOffset(0);
        }} /></label>
        <label>Sampai <input type="date" min={start} value={end} className="min-h-11 rounded border px-2" onChange={e => {
          if (e.target.value >= start) { setEnd(e.target.value); setOffset(0); }
        }} /></label>
      </div>
    </div>
    {error && <p role="alert" className="py-2 text-red-700">{error}</p>}
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th className="sticky left-0 bg-slate-50 p-2">Guru</th>{dates.map(day =>
        <th key={day} scope="col" className="min-w-32 bg-slate-50 p-2">{formatDateShortID(day)}</th>)}</tr></thead>
      <tbody>{rows.map(([key,row]) => <tr key={key} className="border-t border-slate-100">
        <th scope="row" className="sticky left-0 min-w-28 bg-white p-2 font-medium">{row.name}</th>
        {dates.map(day => <td key={day} className="p-2 align-top">{row.days.get(day)?.map((s,i) =>
          <div key={i} className="mb-1"><span className={'rounded px-2 py-0.5 ' + s.status[1]}>{s.status[0]}</span>
            <small className="block">{s.detail}</small></div>) || <span className="text-xs text-slate-500">Belum tercatat</span>}</td>)}
      </tr>)}</tbody>
    </table></div>
    {(offset > 0 || dates.at(-1)! < end) && <div className="mt-2 flex justify-end gap-3 text-sm">
      <button disabled={!offset} className="min-h-11 disabled:opacity-40" onClick={() => setOffset(offset-14)}>Tanggal sebelumnya</button>
      <button disabled={dates.at(-1) === end} className="min-h-11 disabled:opacity-40" onClick={() => setOffset(offset+14)}>Tanggal berikutnya</button>
    </div>}
    {!rows.length && !error && <p className="p-2 text-sm">{loaded ? 'Belum ada data guru.' : 'Memuat daftar guru…'}</p>}
  </section>;
}
