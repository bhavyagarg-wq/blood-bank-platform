import { FormEvent, useState } from 'react';
import { useAuth } from '../auth';
import { Card, ErrorBanner, Field } from '../components';

const DEMO_ACCOUNTS = [
  ['Hospital', 'hospital@citygeneral.example'],
  ['Blood bank', 'bank@central.example'],
  ['Donor', 'asha.rao@example.com'],
  ['Admin', 'admin@bloodbank.example'],
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('hospital@citygeneral.example');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 style={{ color: 'var(--red)', textAlign: 'center' }}>Blood Bank Platform</h1>
        <Card>
          <ErrorBanner error={error} />
          <form onSubmit={submit} className="grid">
            <Field label="Email">
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </Field>
            <Field label="Password">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
              />
            </Field>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </Card>
        <Card title="Demo accounts">
          <p className="muted" style={{ marginTop: 0 }}>
            All seeded accounts use the password <code>Password123!</code>
          </p>
          <table>
            <tbody>
              {DEMO_ACCOUNTS.map(([role, account]) => (
                <tr key={account}>
                  <td>{role}</td>
                  <td>
                    <button type="button" onClick={() => setEmail(account)}>
                      {account}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
