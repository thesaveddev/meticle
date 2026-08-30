import { useState } from 'react';

export default function Contact({ apiBase }: { apiBase: string }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', service: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.service) return;
    setLoading(true);
    try {
      await fetch(`${apiBase}/api/enquiries`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSubmitted(true);
    } catch {
      alert('Something went wrong. Call 07586 215433.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-14">
        <div className="lg:col-span-7">
          <p className="section-eyebrow mb-3">Contact</p>
          <h1 className="font-display font-800 text-3xl md:text-4xl tracking-tight leading-tight mb-5" style={{ color: '#1C2541' }}>
            Let's talk.
          </h1>
          <p className="text-sm leading-relaxed mb-8 max-w-md" style={{ color: '#9BA8B8' }}>
            Fill in the form. We respond within 24 hours. For faster help, call or WhatsApp us directly.
          </p>

          {submitted ? (
            <div className="p-8 text-center" style={{ background: '#E8ECF0' }}>
              <p className="text-3xl mb-3">✓</p>
              <h3 className="font-display font-700 text-lg mb-1" style={{ color: '#1C2541' }}>Sent.</h3>
              <p className="text-sm" style={{ color: '#7B9AB8' }}>We will be in touch shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-widest mb-1.5 block" style={{ color: '#9BA8B8' }}>Name *</label>
                  <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input-field" placeholder="Full name" />
                </div>
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-widest mb-1.5 block" style={{ color: '#9BA8B8' }}>Phone *</label>
                  <input type="tel" required value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input-field" placeholder="07xxx xxxxxx" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-widest mb-1.5 block" style={{ color: '#9BA8B8' }}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input-field" placeholder="you@email.com" />
                </div>
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-widest mb-1.5 block" style={{ color: '#9BA8B8' }}>Service *</label>
                  <select required value={form.service} onChange={e => setForm(p => ({ ...p, service: e.target.value }))} className="input-field">
                    <option value="">Select</option>
                    <option value="end-of-tenancy">End of Tenancy</option>
                    <option value="regular-cleaning">Regular Cleaning</option>
                    <option value="office-cleaning">Office Cleaning</option>
                    <option value="deep-cleaning">Deep Cleaning</option>
                    <option value="carpet-cleaning">Carpet Cleaning</option>
                    <option value="post-construction">Post-Construction</option>
                    <option value="general">General Enquiry</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest mb-1.5 block" style={{ color: '#9BA8B8' }}>Message</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} className="input-field h-24 resize-none" placeholder="Tell us about your space..." />
              </div>
              <button type="submit" disabled={!form.name || !form.phone || !form.service || loading} className="btn-primary disabled:opacity-30">
                {loading ? 'Sending...' : 'Send Message'} →
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-4 lg:col-start-9">
          <div className="lg:sticky lg:top-20 space-y-7">
            <div>
              <p className="section-eyebrow mb-2">Phone</p>
              <a href="tel:07586215433" className="font-display font-700 text-xl tracking-tight hover:text-[#5BC0BE] transition-colors" style={{ color: '#1C2541' }}>
                07586 215433
              </a>
              <p className="text-xs mt-1" style={{ color: '#C4CCD8' }}>Mon–Sat, 8am–6pm</p>
            </div>
            <div>
              <p className="section-eyebrow mb-2">WhatsApp</p>
              <a href="https://wa.me/447586215433" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:text-[#5BC0BE] transition-colors" style={{ color: '#1C2541' }}>
                Message us →
              </a>
              <p className="text-xs mt-1" style={{ color: '#C4CCD8' }}>Instant response during business hours</p>
            </div>
            <div>
              <p className="section-eyebrow mb-2">Email</p>
              <a href="mailto:bookings@loadlygroup.co.uk" className="text-sm font-semibold hover:text-[#5BC0BE] transition-colors" style={{ color: '#1C2541' }}>
                bookings@loadlygroup.co.uk
              </a>
            </div>
            <div>
              <p className="section-eyebrow mb-2">Areas</p>
              <div className="flex flex-wrap gap-1.5">
                {['Cardiff', 'Cardiff Bay', 'Penarth', 'Barry', 'Caerphilly', 'Newport', 'Cowbridge', 'Llantwit Major'].map(area => (
                  <span key={area} className="text-xs px-2 py-0.5" style={{ background: '#E8ECF0', color: '#5C7A99', borderRadius: '2px' }}>{area}</span>
                ))}
              </div>
            </div>
            <div className="pt-5" style={{ borderTop: '1px solid #E0E4EA' }}>
              <p className="text-xs" style={{ color: '#C4CCD8' }}>Loadly Group Ltd</p>
              <p className="text-xs" style={{ color: '#C4CCD8' }}>Company No. 17122922</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
