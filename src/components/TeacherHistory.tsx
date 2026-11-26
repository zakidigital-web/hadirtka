import { useApp } from '../context/AppContext';
import { formatDateLongID, SUBJECT_META } from '../utils/formatters';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function TeacherHistory() {
  const {data, currentUser} = useApp();
  if (!currentUser) return null;
  const rows = data.journals.filter(journal => {
    if (journal.teacherStatus === 'tidak_masuk') return false;
    if (journal.teacherId) return journal.teacherId === currentUser.id;
    const name = journal.substituteTeacher || journal.teacherName.replace(/ \(Pengganti\)$/, '');
    return [currentUser.name, currentUser.accountName].includes(name);
  }).sort((a,b) => b.date.localeCompare(a.date) || a.checkInTime.localeCompare(b.checkInTime))
    .map(journal => [
      formatDateLongID(journal.date),
      data.classrooms.find(c => c.id === journal.classId)?.name || journal.classId,
      SUBJECT_META[journal.subject].label,
      journal.checkInTime + '–' + journal.checkOutTime,
      journal.topic,
    ]);
  function download() {
    const pdf = new jsPDF();
    pdf.text('Riwayat mengajar', 14, 18);
    pdf.setFontSize(11);
    pdf.text(currentUser!.name, 14, 26);
    autoTable(pdf,{startY:32,head:[['Tanggal','Kelas','Mapel','Jam WIB','Materi']],body:rows});
    pdf.save('riwayat-mengajar.pdf');
  }
  return <section className="space-y-4 rounded-2xl bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold">Riwayat mengajar saya</h1>
      <button disabled={!rows.length} onClick={download} className="rounded-xl bg-blue-700 px-4 py-3 text-sm text-white disabled:opacity-50">Unduh PDF</button>
    </div>
    {rows.length === 0 && <p>Belum ada jurnal mengajar untuk akun ini.</p>}
    <ul className="divide-y divide-slate-200">{rows.map(([date,kelas,mapel,jam,topic],i) =>
      <li key={i} className="space-y-1 py-3 text-sm"><strong>{kelas} · {mapel}</strong><p>{date} · {jam} WIB</p><p>{topic}</p></li>)}</ul>
  </section>;
}
