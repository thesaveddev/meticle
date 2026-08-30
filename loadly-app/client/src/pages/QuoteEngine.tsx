import { useState, useRef, useEffect } from 'react';

interface QuoteMessage {
  role: 'user' | 'assistant';
  content: string;
  estimatedPrice?: number | null;
  breakdown?: { label: string; amount: number }[];
}

const SUGGESTIONS = [
  '2-bed flat, moving out, Cardiff Bay — full end of tenancy clean',
  'Weekly office cleaning for a small workspace in the city centre',
  'Deep clean for a 3-bed house, we\'re moving out next week',
  'Carpet cleaning for 4 rooms in Penarth',
];

export default function QuoteEngine({ apiBase }: { apiBase: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<QuoteMessage[]>([{
    role: 'assistant',
    content: "What needs cleaning? Describe your space, what needs doing, and where you are. I will work out a fair price.",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookingMode, setBookingMode] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name: '', phone: '', email: '' });
  const [booked, setBooked] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: text.trim() }]);
    setInput('');
    setLoading(true);
    try {
      const endpoint = sessionId ? '/api/quote/continue' : '/api/quote/start';
      const body = sessionId ? { sessionId, message: text.trim() } : { message: text.trim() };
      const res = await fetch(`${apiBase}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!sessionId && data.sessionId) setSessionId(data.sessionId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, estimatedPrice: data.estimatedPrice, breakdown: data.breakdown }]);
      if (data.isComplete && data.estimatedPrice) setBookingMode(true);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Call us on 07586 215433.' }]);
    } finally { setLoading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  const handleBooking = async () => {
    if (!bookingForm.name || !bookingForm.phone) return;
    setLoading(true);
    try {
      if (sessionId) {
        await fetch(`${apiBase}/api/quote/convert`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, name: bookingForm.name, phone: bookingForm.phone, email: bookingForm.email }),
        });
      }
      setBooked(true);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Done, ${bookingForm.name}. We have your details. Our team will contact you on ${bookingForm.phone}.\n\nWhatsApp us on 07586 215433 if you prefer.`,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not save your booking. Call 07586 215433.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-10 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left — context */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20">
            <p className="section-eyebrow mb-3">Quote Engine</p>
            <h1 className="font-display font-800 text-3xl tracking-tight leading-tight mb-3" style={{ color: '#1C2541' }}>
              What do you need?
            </h1>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#9BA8B8' }}>
              Describe your property and what needs doing. The system works out a fair price and asks a few questions if needed.
            </p>
            <div className="hidden lg:block">
              <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: '#5BC0BE' }}>Try saying</p>
              <ul className="space-y-2">
                {SUGGESTIONS.map((s, i) => (
                  <li key={i}>
                    <button onClick={() => sendMessage(s)} className="text-left text-sm transition-colors hover:text-[#5BC0BE]" style={{ color: '#9BA8B8' }}>
                      "{s}"
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right — chat */}
        <div className="lg:col-span-8">
          <div style={{ border: '1px solid #E0E4EA', background: 'white' }}>
            <div className="h-[420px] overflow-y-auto p-5 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] px-5 py-3.5 text-sm leading-relaxed"
                    style={{
                      background: msg.role === 'user' ? '#1C2541' : '#F8F9FA',
                      color: msg.role === 'user' ? '#F8F9FA' : '#1C2541',
                      borderRadius: '2px',
                    }}
                  >
                    <p className="whitespace-pre-line">{msg.content}</p>

                    {msg.breakdown && msg.breakdown.length > 0 && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E0E4EA' }}>
                        <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#5BC0BE' }}>Breakdown</p>
                        {msg.breakdown.map((item, j) => (
                          <div key={j} className="flex justify-between text-xs py-0.5">
                            <span style={{ color: '#9BA8B8' }}>{item.label}</span>
                            <span className="font-semibold">£{item.amount}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold mt-2 pt-2" style={{ borderTop: '1px solid #E0E4EA' }}>
                          <span>Total</span>
                          <span style={{ color: '#5BC0BE' }}>£{msg.estimatedPrice}</span>
                        </div>
                      </div>
                    )}

                    {i === messages.length - 1 && msg.estimatedPrice && !booked && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={`https://wa.me/447586215433?text=Hi%20Loadly%2C%20I%27d%20like%20to%20book.%20Estimated%3A%20%C2%A3${msg.estimatedPrice}.`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
                          style={{ background: '#5BC0BE', color: '#1C2541' }}>
                          WhatsApp Us
                        </a>
                        <a href="tel:07586215433" className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
                          style={{ background: '#E8ECF0', color: '#1C2541' }}>
                          Call Now
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderRadius: '2px' }}>
                    <div className="flex gap-1.5">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#5BC0BE', animationDelay: `${d}ms` }}></span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>

            {bookingMode && !booked && (
              <div className="px-5 py-4" style={{ background: '#F8F9FA', borderTop: '1px solid #E0E4EA' }}>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: '#5BC0BE' }}>Book this</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <input type="text" placeholder="Your name *" value={bookingForm.name} onChange={e => setBookingForm(p => ({ ...p, name: e.target.value }))} className="input-field text-sm" />
                  <input type="tel" placeholder="Phone *" value={bookingForm.phone} onChange={e => setBookingForm(p => ({ ...p, phone: e.target.value }))} className="input-field text-sm" />
                  <input type="email" placeholder="Email (optional)" value={bookingForm.email} onChange={e => setBookingForm(p => ({ ...p, email: e.target.value }))} className="input-field text-sm" />
                </div>
                <button onClick={handleBooking} disabled={!bookingForm.name || !bookingForm.phone || loading} className="btn-primary text-sm !py-2 disabled:opacity-30">
                  Confirm Booking
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex" style={{ borderTop: '1px solid #E0E4EA' }}>
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder={messages.length === 1 ? 'Describe what needs cleaning...' : 'Type your answer...'}
                className="flex-1 input-field !border-0 text-sm" style={{ borderRight: '1px solid #E0E4EA' }}
                disabled={loading} autoFocus />
              <button type="submit" disabled={!input.trim() || loading}
                className="px-5 text-sm font-semibold transition-colors disabled:opacity-30"
                style={{ background: '#5BC0BE', color: '#1C2541' }}>
                {loading ? '...' : 'Send'}
              </button>
            </form>
          </div>

          <div className="lg:hidden mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} className="text-xs px-3 py-1.5"
                style={{ background: '#E8ECF0', color: '#5C7A99', borderRadius: '2px' }}>
                {s.length > 35 ? s.slice(0, 35) + '...' : s}
              </button>
            ))}
          </div>

          <p className="text-xs mt-3" style={{ color: '#C4CCD8' }}>
            Estimates are indicative. Final prices confirmed after assessment. Call <a href="tel:07586215433" style={{ color: '#5BC0BE' }}>07586 215433</a> for help.
          </p>
        </div>
      </div>
    </div>
  );
}
