import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError('Email o password non corretti');
      else setError('Errore di rete, riprova');
    } finally { setLoading(false); }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h1>Accedi</h1>
      {error && <div className="error">{error}</div>}
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      <button disabled={loading}>{loading ? 'Accesso…' : 'Accedi'}</button>
      <p>Non hai un account? <Link to="/register">Registrati</Link></p>
    </form>
  );
}