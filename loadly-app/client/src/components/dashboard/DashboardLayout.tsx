import { Outlet, Link, useLocation } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', path: '/admin', icon: '◆' },
  { label: 'Enquiries', path: '/admin/enquiries', icon: '◇' },
  { label: 'Staff', path: '/admin/staff', icon: '△' },
  { label: 'Schedule', path: '/admin/schedule', icon: '○' },
];

export default function DashboardLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen" style={{ background: '#F8F9FA' }}>
      <aside className="w-52 flex-shrink-0 flex flex-col" style={{ background: '#1C2541', color: '#F8F9FA' }}>
        <div className="px-4 py-4" style={{ borderBottom: '1px solid #2D3D67' }}>
          <Link to="/" className="flex items-baseline gap-1">
            <span className="font-display text-base font-800 tracking-tight">Loadly</span>
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: '#5BC0BE' }}>Admin</span>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className="flex items-center gap-2.5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest font-medium transition-colors"
                style={{
                  color: isActive ? '#5BC0BE' : '#5C7A99',
                  background: isActive ? '#5BC0BE10' : 'transparent',
                }}>
                <span className="text-[10px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3" style={{ borderTop: '1px solid #2D3D67' }}>
          <p className="font-mono text-[8px] uppercase tracking-widest" style={{ color: '#3A506B' }}>Loadly Group Ltd</p>
          <p className="font-mono text-[8px]" style={{ color: '#2D3D67' }}>Company No. 17122922</p>
        </div>
      </aside>

      <main className="flex-1 p-5 md:p-7 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
