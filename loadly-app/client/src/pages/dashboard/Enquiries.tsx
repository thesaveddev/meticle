import { useEffect, useState } from 'react';

interface Enquiry {
  id: string; name: string; email: string; phone: string; service: string;
  postcode: string; description: string; preferred_date: string; status: string;
  quoted_price: number; quote_breakdown: string; notes: string; created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', quoted: 'Quoted',
  booked: 'Booked', completed: 'Completed', lost: 'Lost',
};
const STATUS_OPTIONS = ['new', 'contacted', 'quoted', 'booked', 'completed', 'lost'];

export default function Enquiries({ apiBase }: { apiBase: string }) {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Enquiry | null>(null);

  const fetchEnquiries = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    fetch(`${apiBase}/api/enquiries?${params}`).then(r => r.json()).then(setEnquiries).catch(() => {});
  };
  useEffect(() => { fetchEnquiries(); }, [search, statusFilter, apiBase]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${apiBase}/api/enquiries/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    fetchEnquiries();
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const deleteEnquiry = async (id: string) => {
    if (!confirm('Delete?')) return;
    await fetch(`${apiBase}/api/enquiries/${id}`, { method: 'DELETE' });
    fetchEnquiries(); if (selected?.id === id) setSelected(null);
  };

  return (
    <div>
      <div className="mb-5">
        <p className="section-eyebrow mb-1">Manage</p>
        <h1 className="font-display font-800 text-xl tracking-tight" style={{ color: '#1C2541' }}>Enquiries</h1>
        <p className="text-xs mt-0.5" style={{ color: '#C4CCD8' }}>{enquiries.length} total</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input-field text-sm max-w-[240px]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field text-sm max-w-[160px]">
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div style={{ border: '1px solid #E0E4EA', background: 'white', overflow: 'auto' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #E0E4EA' }}>
              {['Name', 'Phone', 'Service', 'Status', 'Price', 'Date', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest" style={{ color: '#C4CCD8' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enquiries.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #F0F2F5' }} className="hover:bg-[#F8F9FA]">
                <td className="px-3 py-2.5 font-semibold" style={{ color: '#1C2541' }}>{e.name}</td>
                <td className="px-3 py-2.5"><a href={`tel:${e.phone}`} className="hover:text-[#5BC0BE]" style={{ color: '#5C7A99' }}>{e.phone}</a></td>
                <td className="px-3 py-2.5" style={{ color: '#7B9AB8' }}>{e.service}</td>
                <td className="px-3 py-2.5"><span className={`badge badge-${e.status}`}>{STATUS_LABELS[e.status]}</span></td>
                <td className="px-3 py-2.5 font-semibold" style={{ color: '#1C2541' }}>{e.quoted_price ? `£${e.quoted_price}` : '—'}</td>
                <td className="px-3 py-2.5 font-mono text-[10px]" style={{ color: '#C4CCD8' }}>{new Date(e.created_at).toLocaleDateString('en-GB')}</td>
                <td className="px-3 py-2.5"><button onClick={() => setSelected(e)} className="btn-ghost text-xs !px-1.5 !py-0.5">View</button></td>
              </tr>
            ))}
            {enquiries.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-sm" style={{ color: '#C4CCD8' }}>No enquiries.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: '#1C254180' }} onClick={() => setSelected(null)}>
          <div className="max-w-lg w-full max-h-[80vh] overflow-y-auto p-5" style={{ background: '#F8F9FA', borderRadius: '2px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display font-700 text-lg tracking-tight" style={{ color: '#1C2541' }}>{selected.name}</h2>
                <p className="text-xs" style={{ color: '#9BA8B8' }}>{selected.service}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-xl" style={{ color: '#C4CCD8' }}>&times;</button>
            </div>
            <div className="space-y-1.5 text-sm mb-5">
              <div className="flex justify-between"><span style={{ color: '#C4CCD8' }}>Phone</span><a href={`tel:${selected.phone}`} style={{ color: '#5BC0BE' }}>{selected.phone}</a></div>
              {selected.email && <div className="flex justify-between"><span style={{ color: '#C4CCD8' }}>Email</span><span>{selected.email}</span></div>}
              {selected.quoted_price && <div className="flex justify-between"><span style={{ color: '#C4CCD8' }}>Price</span><span className="font-semibold" style={{ color: '#5BC0BE' }}>£{selected.quoted_price}</span></div>}
            </div>
            {selected.description && (
              <div className="mb-4">
                <p className="section-eyebrow mb-1.5">Description</p>
                <p className="text-sm p-3" style={{ background: '#E8ECF0', color: '#5C7A99', borderRadius: '2px' }}>{selected.description}</p>
              </div>
            )}
            <div className="mb-4">
              <p className="section-eyebrow mb-1.5">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} className="text-xs px-2.5 py-1 transition-colors"
                    style={{
                      background: selected.status === s ? '#1C2541' : 'transparent',
                      color: selected.status === s ? '#F8F9FA' : '#9BA8B8',
                      border: `1px solid ${selected.status === s ? '#1C2541' : '#E0E4EA'}`,
                      borderRadius: '2px',
                    }}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between pt-3" style={{ borderTop: '1px solid #E0E4EA' }}>
              <a href={`https://wa.me/447586215433?text=Hi%20${encodeURIComponent(selected.name)}`} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold hover:text-[#1C2541] transition-colors" style={{ color: '#5BC0BE' }}>
                WhatsApp →
              </a>
              <button onClick={() => deleteEnquiry(selected.id)} className="text-sm hover:text-red-600" style={{ color: '#C4CCD8' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
