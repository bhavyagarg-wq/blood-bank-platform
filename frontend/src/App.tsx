import { useAuth } from './auth';
import { Login } from './pages/Login';
import { HospitalDashboard } from './pages/HospitalDashboard';
import { BloodBankDashboard } from './pages/BloodBankDashboard';
import { DonorPortal } from './pages/DonorPortal';
import { AdminDashboard } from './pages/AdminDashboard';

const ROLE_LABEL: Record<string, string> = {
  hospital_admin: 'Hospital dashboard',
  blood_bank_admin: 'Blood bank dashboard',
  donor: 'Donor portal',
  system_admin: 'Admin dashboard',
};

export function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="login-shell">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <>
      <header className="topbar">
        <h1>Blood Bank Platform</h1>
        <span className="badge">{ROLE_LABEL[user.role]}</span>
        <nav>
          <span className="muted">{user.name}</span>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </nav>
      </header>

      {user.role === 'hospital_admin' && <HospitalDashboard />}
      {user.role === 'blood_bank_admin' && <BloodBankDashboard />}
      {user.role === 'donor' && <DonorPortal />}
      {user.role === 'system_admin' && <AdminDashboard />}
    </>
  );
}
