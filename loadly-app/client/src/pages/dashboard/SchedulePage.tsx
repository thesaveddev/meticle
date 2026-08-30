import { useEffect, useState } from 'react';

interface Job {
  id: string; enquiry_id: string; staff_id: string; service: string; postcode: string;
  scheduled_date: string; scheduled_time: string; duration_hours: number; status: string;
  price: number; notes: string; client_name: string; client_phone: string; staff_name: string;
}
interface Staff { id: string; name: string; role: string; }

const STATUS_COLORS: Record<string, string> = { booked: '#1C2541', 'in-progress': '#5BC0BE', completed: '#3A506B', cancelled: '#C4CCD8' };

function getWeekDates(offset: number): string[] {
  const now = new Date(); const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d.toISOString().split('T')[0]; });
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SchedulePage({ apiBase }: { apiBase: string }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];

  useEffect(() => {
    fetch(`${apiBase}/api/jobs?week=${weekStart}`).then(r => r.json()).then(setJobs).catch(() => {});
    fetch(`${apiBase}/api/staff`).then(r => r.json()).then(setStaff).catch(() => {});
  }, [weekStart, apiBase]);

  const assignStaff = async (jobId: string, staffId: string) => {
    await fetch(`${apiBase}/api/jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: staffId }) });
    fetch(`${apiBase}/api/jobs?week=${weekStart}`).then(r => r.json()).then(setJobs); setSelectedJob(null);
  };
  const updateJobStatus = async (jobId: string, status: string) => {
    await fetch(`${apiBase}/api/jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    fetch(`${apiBase}/api/jobs?week=${weekStart}`).then(r => r.json()).then(setJobs); setSelectedJob(null);
  };

  const weekLabel = `${new Date(weekDates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${new Date(weekDates[6]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="section-eyebrow mb-1">Planning</p>
          <h1 className="font-display font-800 text-xl tracking-tight" style={{ color: '#1C2541' }}>Schedule</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C4CCD8' }}>{weekLabel}</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setWeekOffset(w => w - 1)} className="btn-secondary text-xs !px-2.5 !py-1">← Prev</button>
          <button onClick={() => setWeekOffset(0)} className="btn-secondary text-xs !px-2.5 !py-1">Today</button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="btn-secondary text-xs !px-2.5 !py-1">Next →</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px mb-5" style={{ background: '#E0E4EA', border: '1px solid #E0E4EA' }}>
        {weekDates.map((date, i) => {
          const dayJobs = jobs.filter(j => j.scheduled_date === date);
          const isToday = date === new Date().toISOString().split('T')[0];
          return (
            <div key={date} style={{ background: 'white', minHeight: '140px' }}>
              <div className="px-1.5 py-1.5 text-center" style={{ borderBottom: '1px solid #E0E4EA' }}>
                <p className="font-mono text-[8px] uppercase" style={{ color: '#C4CCD8' }}>{DAYS[i]}</p>
                <p className="font-display font-700 text-sm" style={{ color: isToday ? '#5BC0BE' : '#1C2541' }}>{new Date(date).getDate()}</p>
              </div>
              <div className="p-1 space-y-0.5">
                {dayJobs.map(job => (
                  <button key={job.id} onClick={() => setSelectedJob(job)}
                    className="w-full text-left p-1.5 text-[10px] transition-colors hover:bg-[#F0F2F5]"
                    style={{ borderLeft: `2px solid ${STATUS_COLORS[job.status] || '#E0E4EA'}` }}>
                    <p className="font-semibold truncate" style={{ color: '#1C2541' }}>{job.client_name || 'Walk-in'}</p>
                    <p className="truncate" style={{ color: '#9BA8B8' }}>{job.service}</p>
                    {job.scheduled_time && <p className="font-medium" style={{ color: '#5BC0BE' }}>{job.scheduled_time}</p>}
                  </button>
                ))}
                {dayJobs.length === 0 && <p className="text-[10px] text-center py-2" style={{ color: '#E0E4EA' }}>—</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3" style={{ border: '1px solid #E0E4EA' }}>
        <p className="font-mono text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#C4CCD8' }}>Team</p>
        <div className="flex flex-wrap gap-3">
          {staff.filter(s => s.role === 'cleaner').map((s, i) => {
            const colors = ['#1C2541', '#5BC0BE', '#3A506B', '#7B9AB8'];
            return (
              <span key={s.id} className="flex items-center gap-1 text-[10px]" style={{ color: '#7B9AB8' }}>
                <span className="w-1.5 h-1.5" style={{ background: colors[i % colors.length] }}></span>{s.name}
              </span>
            );
          })}
        </div>
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: '#1C254180' }} onClick={() => setSelectedJob(null)}>
          <div className="max-w-md w-full p-5" style={{ background: '#F8F9FA', borderRadius: '2px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-display font-700 text-lg tracking-tight" style={{ color: '#1C2541' }}>{selectedJob.client_name || 'Walk-in'}</h2>
                <p className="text-xs" style={{ color: '#9BA8B8' }}>{selectedJob.service}</p>
              </div>
              <button onClick={() => setSelectedJob(null)} className="text-xl" style={{ color: '#C4CCD8' }}>&times;</button>
            </div>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between"><span style={{ color: '#C4CCD8' }}>Date</span><span>{selectedJob.scheduled_date} {selectedJob.scheduled_time || ''}</span></div>
              {selectedJob.client_phone && <div className="flex justify-between"><span style={{ color: '#C4CCD8' }}>Phone</span><a href={`tel:${selectedJob.client_phone}`} style={{ color: '#5BC0BE' }}>{selectedJob.client_phone}</a></div>}
              {selectedJob.price && <div className="flex justify-between"><span style={{ color: '#C4CCD8' }}>Price</span><span className="font-semibold" style={{ color: '#5BC0BE' }}>£{selectedJob.price}</span></div>}
            </div>
            <div className="mb-3">
              <p className="section-eyebrow mb-1.5">Assign</p>
              <div className="flex flex-wrap gap-1.5">
                {staff.filter(s => s.role === 'cleaner').map(s => (
                  <button key={s.id} onClick={() => assignStaff(selectedJob.id, s.id)} className="text-[10px] px-2 py-1 transition-colors"
                    style={{ background: selectedJob.staff_name === s.name ? '#1C2541' : 'transparent', color: selectedJob.staff_name === s.name ? '#F8F9FA' : '#9BA8B8', border: `1px solid ${selectedJob.staff_name === s.name ? '#1C2541' : '#E0E4EA'}`, borderRadius: '2px' }}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="section-eyebrow mb-1.5">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {['booked', 'in-progress', 'completed', 'cancelled'].map(s => (
                  <button key={s} onClick={() => updateJobStatus(selectedJob.id, s)} className="text-[10px] px-2 py-1 transition-colors"
                    style={{ background: selectedJob.status === s ? '#1C2541' : 'transparent', color: selectedJob.status === s ? '#F8F9FA' : '#9BA8B8', border: `1px solid ${selectedJob.status === s ? '#1C2541' : '#E0E4EA'}`, borderRadius: '2px' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
