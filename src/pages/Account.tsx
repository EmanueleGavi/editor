import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';

export function Account() {
  const { user, plan, subscription, logout } = useAuth();

  async function openPortal() {
    const { url } = await api<{ url: string | null }>('/billing/portal', { method: 'POST' });
    if (url) window.location.href = url;
  }

  return (
    <div className="account">
      <h1>Il tuo account</h1>
      <p><strong>Email:</strong> {user?.email}</p>
      <p><strong>Piano:</strong> {plan}</p>
      {subscription && (
        <p>
          <strong>Stato:</strong> {subscription.status}
          {subscription.currentPeriodEnd && ` · rinnovo ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
        </p>
      )}
      <button onClick={openPortal}>Gestisci abbonamento</button>
      <button onClick={logout}>Esci</button>
    </div>
  );
}