import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{ background: '#1C2541', color: '#C4CCD8' }}>
      <div className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <p className="font-display text-lg font-800 tracking-tight mb-2" style={{ color: '#F8F9FA' }}>Loadly</p>
            <p className="text-sm leading-relaxed" style={{ color: '#7B9AB8' }}>
              Professional cleaning, logistics, and facilities across Cardiff &amp; South Wales.
            </p>
            <p className="font-mono text-[9px] uppercase tracking-widest mt-3" style={{ color: '#3A506B' }}>
              Company No. 17122922
            </p>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: '#5BC0BE' }}>Services</p>
            <ul className="space-y-2 text-sm">
              {['End of Tenancy', 'Regular Cleaning', 'Office Cleaning', 'Deep Cleaning', 'Carpet Cleaning'].map(s => (
                <li key={s}>
                  <Link to="/services" className="transition-colors hover:text-[#5BC0BE]" style={{ color: '#7B9AB8' }}>{s}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: '#5BC0BE' }}>Company</p>
            <ul className="space-y-2 text-sm">
              {[{ label: 'About', path: '/' }, { label: 'Contact', path: '/contact' }, { label: 'Get a Quote', path: '/quote' }].map(item => (
                <li key={item.label}>
                  <Link to={item.path} className="transition-colors hover:text-[#5BC0BE]" style={{ color: '#7B9AB8' }}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: '#5BC0BE' }}>Contact</p>
            <ul className="space-y-2 text-sm">
              <li><a href="tel:07586215433" className="transition-colors hover:text-[#5BC0BE]" style={{ color: '#7B9AB8' }}>07586 215433</a></li>
              <li><a href="https://wa.me/447586215433" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#5BC0BE]" style={{ color: '#7B9AB8' }}>WhatsApp</a></li>
              <li><a href="mailto:bookings@loadlygroup.co.uk" className="transition-colors hover:text-[#5BC0BE]" style={{ color: '#7B9AB8' }}>bookings@loadlygroup.co.uk</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3" style={{ borderTop: '1px solid #2D3D67' }}>
          <p className="text-xs" style={{ color: '#3A506B' }}>&copy; {new Date().getFullYear()} Loadly Group Ltd.</p>
          <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#5BC0BE' }}>● All systems operational</p>
        </div>
      </div>
    </footer>
  );
}
