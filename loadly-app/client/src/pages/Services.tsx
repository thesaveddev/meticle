import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Service {
  id: string; name: string; slug: string; description: string;
  short_description: string; base_price: number; price_unit: string;
  features: string; coming_soon: number;
}

export default function Services({ apiBase }: { apiBase: string }) {
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => { fetch(`${apiBase}/api/services`).then(r => r.json()).then(setServices).catch(() => {}); }, [apiBase]);
  const active = services.filter(s => !s.coming_soon);
  const coming = services.filter(s => s.coming_soon);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 md:py-16">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-14">
        <div className="md:col-span-6">
          <p className="section-eyebrow mb-3">Services</p>
          <h1 className="font-display font-800 text-3xl md:text-4xl tracking-tight leading-tight" style={{ color: '#1C2541' }}>
            What we do
          </h1>
        </div>
        <div className="md:col-span-4 md:col-start-8 flex items-end">
          <p className="text-sm leading-relaxed" style={{ color: '#9BA8B8' }}>
            Six active cleaning services. Three more on the way. Every job is insured, eco-friendly, and backed by our guarantee.
          </p>
        </div>
      </div>

      <div className="mb-14">
        {active.map((s, i) => {
          const features: string[] = JSON.parse(s.features || '[]');
          return (
            <div key={s.id} className="grid grid-cols-1 md:grid-cols-12 gap-5 py-7"
              style={{ borderBottom: '1px solid #E0E4EA' }}>
              <div className="md:col-span-5">
                <h2 className="font-display font-700 text-lg tracking-tight mb-1.5" style={{ color: '#1C2541' }}>{s.name}</h2>
                <p className="text-sm leading-relaxed" style={{ color: '#7B9AB8' }}>{s.description}</p>
              </div>
              <div className="md:col-span-3">
                {s.base_price > 0 && (
                  <p className="font-display font-700 text-lg mb-2" style={{ color: '#1C2541' }}>
                    £{s.base_price}
                    <span className="text-xs font-sans font-normal ml-1" style={{ color: '#C4CCD8' }}>{s.price_unit}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {features.map((f, j) => (
                    <span key={j} className="text-xs px-2 py-0.5" style={{ background: '#E8ECF0', color: '#5C7A99', borderRadius: '2px' }}>{f}</span>
                  ))}
                </div>
              </div>
              <div className="md:col-span-4 flex items-center">
                <Link to="/quote" className="btn-ghost text-sm !px-0">Get a quote →</Link>
              </div>
            </div>
          );
        })}
      </div>

      {coming.length > 0 && (
        <div className="mb-14">
          <p className="section-eyebrow mb-5">On The Way</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {coming.map(s => (
              <div key={s.id} className="p-5" style={{ border: '1px solid #E0E4EA', opacity: 0.6 }}>
                <h3 className="font-display font-700 tracking-tight mb-1.5" style={{ color: '#1C2541' }}>{s.name}</h3>
                <p className="text-sm" style={{ color: '#9BA8B8' }}>{s.short_description}</p>
                <span className="badge badge-coming-soon mt-2">Coming Soon</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-8 text-center" style={{ background: '#1C2541', color: '#F8F9FA' }}>
        <h3 className="font-display font-700 text-xl tracking-tight mb-2">Not sure what you need?</h3>
        <p className="text-sm mb-5" style={{ color: '#7B9AB8' }}>Tell us about your space. We will recommend the right service and give you a price.</p>
        <Link to="/quote" className="btn-mint">Launch Quote Engine →</Link>
      </div>
    </div>
  );
}
