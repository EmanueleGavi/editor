import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';
import { PLANS } from '../shared/plans';

const PRICE_IDS: Record<'pro' | 'team', string> = {
  pro: import.meta.env.VITE_STRIPE_PRICE_PRO,
  team: import.meta.env.VITE_STRIPE_PRICE_TEAM,
};

export function Pricing() {
  const { plan: currentPlan, user } = useAuth();

  async function subscribe(planKey: 'pro' | 'team') {
    if (!user) { window.location.href = '/register'; return; }
    const { url } = await api<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId: PRICE_IDS[planKey] }),
    });
    if (url) window.location.href = url;
  }

  const keys = ['free', 'pro', 'team'] as const;

  return (
    <div className="pricing">
      <h1>Scegli il tuo piano</h1>
      <div className="pricing-grid">
        {keys.map((k) => (
          <div key={k} className={`plan-card ${k === currentPlan ? 'current' : ''}`}>
            <h2>{PLANS[k].label}</h2>
            <p className="muted">{k === 'free' ? 'Gratis' : k === 'pro' ? '€19/mese' : '€49/mese'}</p>
            <ul>
              {PLANS[k].features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {k !== 'free' && k !== currentPlan && (
              <button onClick={() => subscribe(k)}>Passa a {PLANS[k].label}</button>
            )}
            {k === currentPlan && <div className="badge">Piano attuale</div>}
          </div>
        ))}
      </div>
    </div>
  );
}