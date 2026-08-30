import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Stats {
  totalEnquiries: number; newEnquiries: number; quoted: number; booked: number;
  completed: number; activeCleaners: number; activeDrivers: number; totalStaff: number;
  thisWeek: number; revenue: number; upcomingJobs: number;
}

export default function DashboardHome({ apiBase }: { apiBase: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { fetch(`${apiBase}/api/dashboard/stats`).then(r => r.json()).then(setStats).catch(() => {}); }, [apiBase]);
  if (!stats) return <div className="text-sm" style={{ color: '#C4CCD8' }}>Loading...</div>;

  const cards = [
    { label: 'Total Enquiries', value: stats.totalEnquiries },
    { label: 'New', value: stats.newEnquiries },
    { label: 'Quoted', value: stats.quoted },
    { label: 'Booked', value: stats.booked },
    { label: 'Completed', value: stats.completed },
    { label: 'This Week', value: stats.thisWeek },
    { label: 'Revenue', value: `£${stats.revenue.toLocaleString()}` },
    { label: 'Upcoming Jobs', value: stats.upcomingJobs },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="section-eyebrow mb-1">Overview</p>
          <h1 className="font-display font-800 text-2xl tracking-tight" style={{ color: '#1C2541' }}>Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/enquiries" className="btn-primary text-xs !px-3 !py-1.5">Enquiries</Link>
          <Link to="/admin/schedule" className="btn-secondary text-xs !px-3 !py-1.5">Schedule</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-6" style={{ background: '#E0E4EA', border: '1px solid #E0E4EA' }}>
        {cards.map((card, i) => (
          <div key={card.label} className="p-4" style={{ background: 'white' }}>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: '#C4CCD8' }}>{card.label}</p>
            <p className="font-display font-800 text-xl tracking-tight" style={{ color: '#1C2541' }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-5" style={{ border: '1px solid #E0E4EA' }}>
          <p className="section-eyebrow mb-2">Team</p>
          <div className="flex items-center gap-6 text-sm">
            <div><p className="text-xs" style={{ color: '#C4CCD8' }}>Cleaners</p><p className="font-display font-800 text-lg" style={{ color: '#1C2541' }}>{stats.activeCleaners}</p></div>
            <div><p className="text-xs" style={{ color: '#C4CCD8' }}>Drivers</p><p className="font-display font-800 text-lg" style={{ color: '#1C2541' }}>{stats.activeDrivers}</p></div>
            <div><p className="text-xs" style={{ color: '#C4CCD8' }}>Total</p><p className="font-display font-800 text-lg" style={{ color: '#1C2541' }}>{stats.totalStaff}</p></div>
          </div>
        </div>
        <div className="p-5" style={{ border: '1px solid #E0E4EA' }}>
          <p className="section-eyebrow mb-2">Quick Actions</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/enquiries" className="btn-ghost text-xs">Enquiries →</Link>
            <Link to="/admin/staff" className="btn-ghost text-xs">Staff →</Link>
            <Link to="/admin/schedule" className="btn-ghost text-xs">Schedule →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
