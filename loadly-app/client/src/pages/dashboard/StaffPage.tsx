import { useEffect, useState } from 'react';

interface Staff {
  id: string; name: string; role: string; email: string; phone: string;
  hourly_rate: number; status: string; skills: string; notes: string;
}

const ROLES = ['cleaner', 'driver', 'admin'];

export default function StaffPage({ apiBase }: { apiBase: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState<Partial<Staff> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchStaff = () => {
    const params = roleFilter !== 'all' ? `?role=${roleFilter}` : '';
    fetch(`${apiBase}/api/staff${params}`).then(r => r.json()).then(setStaff).catch(() => {});
  };
  useEffect(() => { fetchStaff(); }, [roleFilter, apiBase]);

  const saveStaff = async () => {
    if (!editing?.name || !editing.role) return;
    if (isCreating) await fetch(`${apiBase}/api/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    else if (editing.id) await fetch(`${apiBase}/api/staff/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    setEditing(null); setIsCreating(false); fetchStaff();
  };

  const deleteStaff = async (id: string) => { if (!confirm('Delete?')) return; await fetch(`${apiBase}/api/staff/${id}`, { method: 'DELETE' }); fetchStaff(); };
  const toggleStatus = async (s: Staff) => {
    await fetch(`${apiBase}/api/staff/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s.status === 'active' ? 'inactive' : 'active' }) });
    fetchStaff();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="section-eyebrow mb-1">Manage</p>
          <h1 className="font-display font-800 text-xl tracking-tight" style={{ color: '#1C2541' }}>Staff</h1>
        </div>
        <button onClick={() => { setEditing({ role: 'cleaner' }); setIsCreating(true); }} className="btn-primary text-xs !px-3 !py-1.5">+ Add</button>
      </div>

      <div className="flex gap-1.5 mb-5">
        {['all', ...ROLES].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)} className="text-xs px-2.5 py-1 transition-colors"
            style={{ background: roleFilter === r ? '#1C2541' : 'transparent', color: roleFilter === r ? '#F8F9FA' : '#9BA8B8', border: `1px solid ${roleFilter === r ? '#1C2541' : '#E0E4EA'}`, borderRadius: '2px' }}>
            {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1) + 's'}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {staff.map(s => {
          const skills: string[] = JSON.parse(s.skills || '[]');
          return (
            <div key={s.id} className="p-4" style={{ border: '1px solid #E0E4EA' }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-display font-700 text-sm tracking-tight" style={{ color: '#1C2541' }}>{s.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`badge ${s.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{s.status}</span>
                    <span className="font-mono text-[8px] uppercase" style={{ color: '#C4CCD8' }}>{s.role}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-0.5 text-xs mb-2" style={{ color: '#9BA8B8' }}>
                {s.phone && <p>{s.phone}</p>}
                {s.hourly_rate && <p>£{s.hourly_rate}/hr</p>}
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {skills.map((sk, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5" style={{ background: '#E8ECF0', color: '#5C7A99', borderRadius: '2px' }}>{sk.replace(/-/g, ' ')}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-1 pt-2" style={{ borderTop: '1px solid #E0E4EA' }}>
                <button onClick={() => { setEditing(s); setIsCreating(false); }} className="btn-ghost text-[10px] !px-1.5 !py-0.5">Edit</button>
                <button onClick={() => toggleStatus(s)} className="btn-ghost text-[10px] !px-1.5 !py-0.5">{s.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                <button onClick={() => deleteStaff(s.id)} className="text-[10px] hover:text-red-600 px-1.5 py-0.5" style={{ color: '#C4CCD8' }}>Delete</button>
              </div>
            </div>
          );
        })}
        {staff.length === 0 && <div className="text-center py-10 text-sm" style={{ color: '#C4CCD8' }}>No staff found.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: '#1C254180' }} onClick={() => { setEditing(null); setIsCreating(false); }}>
          <div className="max-w-md w-full p-5" style={{ background: '#F8F9FA', borderRadius: '2px' }} onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-700 text-lg tracking-tight mb-4" style={{ color: '#1C2541' }}>{isCreating ? 'Add Staff' : `Edit ${editing.name}`}</h2>
            <div className="space-y-3">
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest mb-1 block" style={{ color: '#9BA8B8' }}>Name *</label>
                <input type="text" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-widest mb-1 block" style={{ color: '#9BA8B8' }}>Role *</label>
                  <select value={editing.role || 'cleaner'} onChange={e => setEditing(p => ({ ...p!, role: e.target.value }))} className="input-field">
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-widest mb-1 block" style={{ color: '#9BA8B8' }}>Rate (£/hr)</label>
                  <input type="number" value={editing.hourly_rate || ''} onChange={e => setEditing(p => ({ ...p!, hourly_rate: parseFloat(e.target.value) || 0 }))} className="input-field" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveStaff} className="btn-primary flex-1 justify-center">{isCreating ? 'Add' : 'Save'}</button>
              <button onClick={() => { setEditing(null); setIsCreating(false); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
