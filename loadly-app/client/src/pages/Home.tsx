import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface Service {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  base_price: number;
  price_unit: string;
  coming_soon: number;
}

export default function Home({ apiBase }: { apiBase: string }) {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    fetch(`${apiBase}/api/services`).then(r => r.json()).then(setServices).catch(() => {});
  }, [apiBase]);

  const active = services.filter(s => !s.coming_soon);
  const coming = services.filter(s => s.coming_soon);

  return (
    <>
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden" style={{ minHeight: '88vh' }}>
        {/* Background: subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `linear-gradient(#1C2541 1px, transparent 1px), linear-gradient(90deg, #1C2541 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />

        <div className="max-w-6xl mx-auto px-5 pt-12 md:pt-20 pb-16 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left — the headline is the thesis */}
            <div className="lg:col-span-6 pt-8 md:pt-16">
              <p className="section-eyebrow mb-5">Cardiff &amp; South Wales</p>

              <h1 className="font-display font-900 leading-[1.05] tracking-tight mb-6" style={{ fontSize: 'clamp(2.8rem, 6.5vw, 5.5rem)', color: '#1C2541' }}>
                Clean is a
                <br />
                <span style={{ color: '#5BC0BE' }}>feeling.</span>
              </h1>

              <p className="text-lg leading-relaxed max-w-md mb-8" style={{ color: '#5C7A99' }}>
                You walk in and something shifts. The air is different. The surfaces are right. That is what we do — we make spaces feel the way they should.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <Link to="/quote" className="btn-primary">
                  Get a free quote
                  <span>→</span>
                </Link>
                <a href="tel:07586215433" className="btn-secondary">
                  07586 215433
                </a>
              </div>

              {/* Trust tags — mono, minimal */}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {['Fully insured', 'DBS-checked team', 'Eco products', 'Same-day response'].map(tag => (
                  <span key={tag} className="font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#9BA8B8' }}>
                    <span className="w-1 h-1 rounded-full" style={{ background: '#5BC0BE' }}></span>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — the signature visual: abstract cleaning texture */}
            <div className="lg:col-span-6 hidden lg:flex items-center justify-center relative" style={{ minHeight: '460px' }}>
              <div className="relative w-full max-w-md" style={{ aspectRatio: '4/5' }}>
                {/* Large abstract shape — evokes a clean surface / sparkle */}
                <svg viewBox="0 0 400 500" className="w-full h-full">
                  {/* Background panel */}
                  <rect x="40" y="30" width="320" height="440" fill="#1C2541" rx="2" />

                  {/* Inner clean surface */}
                  <rect x="60" y="50" width="280" height="400" fill="#F8F9FA" rx="1" />

                  {/* Window — source of light/cleanliness */}
                  <rect x="100" y="80" width="200" height="160" fill="none" stroke="#C4CCD8" strokeWidth="1" />
                  <line x1="200" y1="80" x2="200" y2="240" stroke="#C4CCD8" strokeWidth="0.5" />
                  <line x1="100" y1="160" x2="300" y2="160" stroke="#C4CCD8" strokeWidth="0.5" />

                  {/* Light rays from window */}
                  <polygon points="100,240 200,240 150,400" fill="#5BC0BE" opacity="0.04" />
                  <polygon points="200,240 300,240 250,400" fill="#5BC0BE" opacity="0.03" />

                  {/* Furniture silhouettes */}
                  <rect x="80" y="360" width="120" height="60" fill="none" stroke="#C4CCD8" strokeWidth="0.8" rx="1" />
                  <rect x="240" y="340" width="80" height="3" fill="#C4CCD8" opacity="0.5" />
                  <line x1="250" y1="343" x2="250" y2="420" stroke="#C4CCD8" strokeWidth="0.5" opacity="0.4" />
                  <line x1="310" y1="343" x2="310" y2="420" stroke="#C4CCD8" strokeWidth="0.5" opacity="0.4" />

                  {/* Plant */}
                  <line x1="280" y1="335" x2="280" y2="315" stroke="#5BC0BE" strokeWidth="1.2" opacity="0.3" />
                  <circle cx="280" cy="310" r="10" fill="none" stroke="#5BC0BE" strokeWidth="0.8" opacity="0.25" />
                  <circle cx="272" cy="306" r="6" fill="none" stroke="#5BC0BE" strokeWidth="0.6" opacity="0.2" />

                  {/* Sparkle marks — the signature: cleaning sparkle */}
                  <g opacity="0.6">
                    <line x1="130" y1="290" x2="142" y2="290" stroke="#5BC0BE" strokeWidth="1.2" />
                    <line x1="136" y1="284" x2="136" y2="296" stroke="#5BC0BE" strokeWidth="1.2" />
                    <line x1="132" y1="286" x2="140" y2="294" stroke="#5BC0BE" strokeWidth="0.6" />
                    <line x1="140" y1="286" x2="132" y2="294" stroke="#5BC0BE" strokeWidth="0.6" />
                  </g>
                  <g opacity="0.4">
                    <line x1="320" y1="120" x2="328" y2="120" stroke="#5BC0BE" strokeWidth="1" />
                    <line x1="324" y1="116" x2="324" y2="124" stroke="#5BC0BE" strokeWidth="1" />
                  </g>
                  <g opacity="0.5">
                    <line x1="170" y1="410" x2="176" y2="410" stroke="#5BC0BE" strokeWidth="1" />
                    <line x1="173" y1="407" x2="173" y2="413" stroke="#5BC0BE" strokeWidth="1" />
                  </g>

                  {/* Status badge */}
                  <rect x="250" y="38" width="100" height="18" fill="#5BC0BE" rx="1" />
                  <text x="300" y="51" textAnchor="middle" fill="#1C2541" fontSize="7" fontWeight="600" fontFamily="JetBrains Mono" letterSpacing="0.12em">WE'RE READY</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DARK STATEMENT ═══ */}
      <section style={{ background: '#1C2541', color: '#F8F9FA' }}>
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-8">
              <p className="section-eyebrow mb-6" style={{ color: '#5BC0BE' }}>Why It Matters</p>
              <h2 className="font-display font-800 leading-[1.1] tracking-tight" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.5rem)' }}>
                When your space is clean,
                <br />you think differently.
              </h2>
            </div>
            <div className="md:col-span-4 flex items-end">
              <p className="text-sm leading-relaxed" style={{ color: '#7B9AB8' }}>
                It changes how you start your morning. How your team works. How your clients feel when they walk through the door. We understand that — it is why we do what we do.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SERVICES ═══ */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-3">
            <p className="section-eyebrow mb-3">What We Do</p>
            <h2 className="font-display font-800 text-2xl tracking-tight" style={{ color: '#1C2541' }}>
              Services
            </h2>
            <p className="text-sm mt-3 leading-relaxed" style={{ color: '#9BA8B8' }}>
              Cleaning done properly. Every surface, every time.
            </p>
          </div>

          <div className="md:col-span-9">
            {active.map((s, i) => (
              <Link
                key={s.id}
                to="/quote"
                className="group grid grid-cols-12 gap-4 items-baseline py-5 transition-colors"
                style={{ borderBottom: '1px solid #E0E4EA' }}
                onMouseEnter={e => (e.currentTarget.style.borderBottomColor = '#5BC0BE')}
                onMouseLeave={e => (e.currentTarget.style.borderBottomColor = '#E0E4EA')}
              >
                <div className="col-span-12 sm:col-span-6">
                  <h3 className="font-display font-700 text-lg tracking-tight group-hover:text-[#5BC0BE] transition-colors" style={{ color: '#1C2541' }}>
                    {s.name}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: '#9BA8B8' }}>{s.short_description}</p>
                </div>
                <div className="col-span-6 sm:col-span-3 sm:text-right">
                  {s.base_price > 0 && (
                    <span className="text-sm font-semibold" style={{ color: '#1C2541' }}>
                      From £{s.base_price}
                    </span>
                  )}
                </div>
                <div className="col-span-6 sm:col-span-3 sm:text-right">
                  <span className="text-sm transition-transform group-hover:translate-x-1 inline-block" style={{ color: '#5BC0BE' }}>→</span>
                </div>
              </Link>
            ))}

            {coming.length > 0 && (
              <div className="mt-8">
                <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: '#C4CCD8' }}>Coming Soon</p>
                <div className="flex flex-wrap gap-2">
                  {coming.map(s => (
                    <span key={s.id} className="badge badge-coming-soon">{s.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ TRANSFORMATION (the signature section) ═══ */}
      <section style={{ background: '#E8ECF0' }}>
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0" style={{ border: '1px solid #C4CCD8' }}>
            {/* Before */}
            <div className="p-8 md:p-12" style={{ background: '#F8F9FA' }}>
              <p className="font-mono text-[9px] uppercase tracking-widest mb-4" style={{ color: '#9BA8B8' }}>Before</p>
              <div className="space-y-3">
                {['Stained carpets', 'Greasy kitchen surfaces', 'Dusty skirting boards', 'Limescale in bathrooms', 'Grubby oven interior'].map(item => (
                  <div key={item} className="flex items-center gap-3 text-sm" style={{ color: '#7B9AB8' }}>
                    <span className="w-1.5 h-1.5 flex-shrink-0" style={{ background: '#C4CCD8' }}></span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* After */}
            <div className="p-8 md:p-12" style={{ background: '#1C2541', color: '#F8F9FA' }}>
              <p className="font-mono text-[9px] uppercase tracking-widest mb-4" style={{ color: '#5BC0BE' }}>After</p>
              <div className="space-y-3">
                {['Fresh, stain-free carpets', 'Polished, sanitised surfaces', 'Detailed woodwork', 'Bright, scale-free bathrooms', 'Oven restored to near-new'].map(item => (
                  <div key={item} className="flex items-center gap-3 text-sm" style={{ color: '#C4CCD8' }}>
                    <span className="w-1.5 h-1.5 flex-shrink-0" style={{ background: '#5BC0BE' }}></span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-3">
            <p className="section-eyebrow mb-3">Process</p>
            <h2 className="font-display font-800 text-2xl tracking-tight" style={{ color: '#1C2541' }}>
              How it works
            </h2>
          </div>
          <div className="md:col-span-9">
            <div className="space-y-0">
              {[
                { title: 'You describe it', desc: 'Tell us what needs cleaning, where it is, and any specifics. Our quote engine works out a fair price in seconds — no waiting for callbacks.' },
                { title: 'We confirm it', desc: 'You get a clear, itemised quote with no hidden fees. If anything changes, we tell you before it costs you anything.' },
                { title: 'We do it', desc: 'Our insured, vetted team arrives on time, works thoroughly, and leaves your space exactly as it should be.' },
              ].map((item, i) => (
                <div
                  key={item.title}
                  className="py-6"
                  style={{ borderBottom: i < 2 ? '1px solid #E0E4EA' : 'none' }}
                >
                  <h3 className="font-display font-700 text-lg tracking-tight mb-2" style={{ color: '#1C2541' }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed max-w-lg" style={{ color: '#7B9AB8' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ QUOTE CTA ═══ */}
      <section style={{ background: '#1C2541', color: '#F8F9FA' }}>
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
            <div className="md:col-span-7">
              <p className="section-eyebrow mb-4" style={{ color: '#5BC0BE' }}>Try It</p>
              <h2 className="font-display font-800 leading-[1.1] tracking-tight mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
                See what it costs.
              </h2>
              <p className="text-sm leading-relaxed max-w-md mb-8" style={{ color: '#7B9AB8' }}>
                Our quote engine asks the right questions and gives you an instant price. No sales calls. No pressure. Just a number.
              </p>
              <Link to="/quote" className="btn-mint">
                Launch Quote Engine
                <span>→</span>
              </Link>
            </div>
            <div className="md:col-span-5 hidden md:block">
              <div className="p-6" style={{ background: '#243154', border: '1px solid #2D3D67' }}>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: '#5BC0BE' }}>Example</p>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: '#9BA8B8' }}>
                  "2-bed flat in Cardiff Bay, moving out — need end of tenancy clean"
                </p>
                <div className="space-y-2 text-sm" style={{ borderTop: '1px solid #2D3D67', paddingTop: '12px' }}>
                  <div className="flex justify-between"><span style={{ color: '#7B9AB8' }}>Base rate</span><span style={{ color: '#C4CCD8' }}>£120</span></div>
                  <div className="flex justify-between"><span style={{ color: '#7B9AB8' }}>2 bedrooms</span><span style={{ color: '#C4CCD8' }}>£50</span></div>
                  <div className="flex justify-between"><span style={{ color: '#7B9AB8' }}>1 bathroom</span><span style={{ color: '#C4CCD8' }}>£20</span></div>
                  <div className="flex justify-between pt-3 font-semibold" style={{ borderTop: '1px solid #2D3D67' }}>
                    <span style={{ color: '#F8F9FA' }}>Total</span>
                    <span style={{ color: '#5BC0BE' }}>£190</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-24 text-center">
        <h2 className="font-display font-800 text-3xl md:text-4xl tracking-tight mb-4" style={{ color: '#1C2541' }}>
          Ready to get started?
        </h2>
        <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: '#9BA8B8' }}>
          Tell us what you need. We will give you a price and a date.
        </p>
        <Link to="/quote" className="btn-primary">
          Get Your Quote
          <span>→</span>
        </Link>
      </section>
    </>
  );
}
