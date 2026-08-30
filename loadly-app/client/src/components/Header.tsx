import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { label: 'Services', path: '/services' },
  { label: 'Quote', path: '/quote' },
  { label: 'Contact', path: '/contact' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50" style={{ background: '#F8F9FAee', backdropFilter: 'blur(16px)', borderBottom: '1px solid #E0E4EA' }}>
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-xl font-800 tracking-tight" style={{ color: '#1C2541' }}>Loadly</span>
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9BA8B8' }}>Group</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className="font-mono text-[10px] uppercase tracking-widest font-medium transition-colors"
              style={{ color: location.pathname === item.path ? '#5BC0BE' : '#7B9AB8' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-5">
          <a href="tel:07586215433" className="font-mono text-[10px] uppercase tracking-wider" style={{ color: '#9BA8B8' }}>
            07586 215433
          </a>
          <Link to="/quote" className="btn-primary !text-xs !px-4 !py-2">
            Get a Quote
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-1"
          aria-label="Toggle menu"
          style={{ color: '#1C2541' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {open
              ? <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
              : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            }
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden" style={{ borderTop: '1px solid #E0E4EA', background: '#F8F9FA' }}>
          <nav className="flex flex-col p-5 gap-4">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className="font-mono text-[10px] uppercase tracking-widest font-medium"
                style={{ color: location.pathname === item.path ? '#5BC0BE' : '#7B9AB8' }}
              >
                {item.label}
              </Link>
            ))}
            <Link to="/quote" onClick={() => setOpen(false)} className="btn-primary text-xs mt-1 justify-center">
              Get a Quote
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
