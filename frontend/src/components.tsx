import { useEffect, useRef, type ReactNode } from 'react';
import type { RealtimeEvent } from './useRealtime';

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          {title && <h2 style={{ margin: 0 }}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label>{label}</label>
      {children}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending: 'warn',
  proposed: 'warn',
  partial: 'warn',
  scheduled: 'warn',
  available: 'ok',
  accepted: 'ok',
  delivered: 'ok',
  fulfilled: 'ok',
  complete: 'ok',
  completed: 'ok',
  cancelled: 'critical',
  rejected: 'critical',
  expired: 'critical',
  quarantined: 'critical',
  failed: 'critical',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_TONE[status] ?? ''}`}>{status.replace(/_/g, ' ')}</span>;
}

/** Last 6 characters of a UUID — enough to tell otherwise identical rows apart. */
export function shortId(id: string): string {
  return id.slice(-6);
}

export function bloodGroup(bloodType: string, rhFactor: string): string {
  return `${bloodType}${rhFactor === 'positive' ? '+' : '-'}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Scrolls itself into view so a rejected submit below the fold is never silent. */
export function ErrorBanner({ error }: { error: string | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  if (!error) return null;
  return (
    <div className="error" ref={ref} role="alert">
      {error}
    </div>
  );
}

export function LiveFeed({ connected, events }: { connected: boolean; events: RealtimeEvent[] }) {
  return (
    <Card
      title="Live activity"
      actions={
        <span className="row" style={{ gap: 6 }}>
          <span className={`dot ${connected ? 'live' : ''}`} />
          <span className="muted">{connected ? 'connected' : 'offline'}</span>
        </span>
      }
    >
      {events.length === 0 ? (
        <p className="muted">No events yet. Updates appear here in real time.</p>
      ) : (
        <div className="feed">
          <ul>
            {events.map((event, index) => (
              <li key={`${event.receivedAt}-${index}`}>
                <strong>{event.event.replace(/_/g, ' ')}</strong>{' '}
                <span className="muted">{new Date(event.receivedAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
