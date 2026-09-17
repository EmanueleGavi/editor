import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { ApiError } from '../lib/api';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      await register(email, password);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError('Email già registrata');
      else if (err instanceof ApiError && err.status === 400) setError('Password minimo 12 caratteri');
      else setError('Errore, riprova');
    } finally { setLoading(false); }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h1>Crea account</h1>
      {error && <div className="error">{error}</div>}
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Password (min. 12 caratteri)
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} autoComplete="new-password" />
      </label>
      <button disabled={loading}>{loading ? 'Creazione…' : 'Crea account'}</button>
      <p>Hai già un account? <Link to="/login">Accedi</Link></p>
    </form>
  );
}