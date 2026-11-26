import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { accountRequest, LoginTeacher } from '../utils/accounts';
import { SUBJECT_META, addDaysISO, formatDateShortID } from '../utils/formatters';

const statuses = {
  hadir: ['Masuk', 'bg-green-600'],
  tidak_masuk: ['Tidak masuk', 'bg-red-600'],
  digantikan: ['Digantikan', 'bg-yellow-400'],
  kosong: ['Belum tercatat', 'bg-slate-200'],
} as const;

const PAGE_DAYS = 31;

export function TeacherAttendanceTable({start, end}: {start: string; end: string}) {
  const { data } = useApp();
  const [page, setPage] = useState({start, end, offset: 0});
  const offset = page.start === start && page.end === end ? page.offset : 0;
  const dates: string[] = [];
  for (let day = addDaysISO(start, offset); dates.length < PAGE_DAYS && day <= end; day = addDaysISO(day, 1)) dates.push(day);
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
      <ul aria-label="Legenda kehadiran" className="flex flex-wrap gap-3 text-xs">
        {Object.values(statuses).map(([label,color]) => <li key={label} className="flex items-center gap-1">
          <span aria-hidden="true" className={'size-3 rounded-sm ' + color} />{label}
        </li>)}
      </ul>
    </div>
    {error && <p role="alert" className="py-2 text-red-700">{error}</p>}
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th className="sticky left-0 bg-slate-50 p-2">Guru</th>{dates.map(day =>
        <th key={day} scope="col" className="min-w-9 bg-slate-50 p-1 text-center text-xs" title={formatDateShortID(day)}><time dateTime={day}>{day.slice(8)}<small className="block font-normal">{formatDateShortID(day).split(' ')[1]}</small></time></th>)}</tr></thead>
      <tbody>{rows.map(([key,row]) => <tr key={key} className="border-t border-slate-100">
        <th scope="row" className="sticky left-0 min-w-28 bg-white p-2 font-medium">{row.name}</th>
        {dates.map(day => {
          const sessions = row.days.get(day) || [{status: statuses.kosong, detail: ''}];
          return <td key={day} className="p-0.5">
            <div className="flex min-h-7 overflow-hidden rounded">
              {sessions.map(({status,detail},i) => {
                const label = [row.name, formatDateShortID(day), status[0], detail].filter(Boolean).join(' · ');
                return <span key={i} role="img" aria-label={label} title={label} className={'min-w-1 flex-1 ' + status[1]} />;
              })}
            </div>
          </td>;
        })}
      </tr>)}</tbody>
    </table></div>
    {(offset > 0 || dates.at(-1)! < end) && <div className="mt-2 flex justify-end gap-3 text-sm">
      <button disabled={!offset} className="min-h-11 disabled:opacity-40" onClick={() => setPage({start, end, offset: offset - PAGE_DAYS})}>Tanggal sebelumnya</button>
      <button disabled={dates.at(-1) === end} className="min-h-11 disabled:opacity-40" onClick={() => setPage({start, end, offset: offset + PAGE_DAYS})}>Tanggal berikutnya</button>
    </div>}
    {!rows.length && !error && <p className="p-2 text-sm">{loaded ? 'Belum ada data guru.' : 'Memuat daftar guru…'}</p>}
  </section>;
}
