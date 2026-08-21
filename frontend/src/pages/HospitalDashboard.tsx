import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Card, ErrorBanner, Field, LiveFeed, StatusBadge, bloodGroup, formatDateTime } from '../components';
import { useRealtime } from '../useRealtime';
import type { BloodType, EmergencyRequest, Match, Paginated, RhFactor } from '../types';

const BLOOD_TYPES: BloodType[] = ['A', 'B', 'AB', 'O'];
const RH_FACTORS: RhFactor[] = ['positive', 'negative'];

function defaultRequiredBy(): string {
  const inTwoHours = new Date(Date.now() + 2 * 3600_000);
  inTwoHours.setMinutes(inTwoHours.getMinutes() - inTwoHours.getTimezoneOffset());
  return inTwoHours.toISOString().slice(0, 16);
}

export function HospitalDashboard() {
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [doctorName, setDoctorName] = useState('Dr. Meera Iyer');
  const [department, setDepartment] = useState('Trauma');
  const [contactNumber, setContactNumber] = useState('+91-80-1000-0500');
  const [bloodType, setBloodType] = useState<BloodType>('A');
  const [rhFactor, setRhFactor] = useState<RhFactor>('positive');
  const [quantity, setQuantity] = useState(2);
  const [urgencyLevel, setUrgencyLevel] = useState(1);
  const [requiredBy, setRequiredBy] = useState(defaultRequiredBy);
  const [patientAge, setPatientAge] = useState(35);
  const [diagnosis, setDiagnosis] = useState('Major blood loss');

  const loadRequests = useCallback(async () => {
    const page = await api.get<Paginated<EmergencyRequest>>('/emergency-requests?pageSize=25');
    setRequests(page.items);
    setSelectedId((current) => current ?? page.items[0]?.id ?? null);
  }, []);

  const loadMatches = useCallback(async (requestId: string) => {
    const page = await api.get<Paginated<Match>>(`/matches?emergencyRequestId=${requestId}&pageSize=25`);
    setMatches(page.items);
  }, []);

  const refresh = useCallback(async () => {
    await loadRequests();
    if (selectedId) await loadMatches(selectedId);
  }, [loadRequests, loadMatches, selectedId]);

  const { connected, events } = useRealtime(() => {
    void refresh();
  });

  useEffect(() => {
    loadRequests().catch((loadError) => setError(loadError.message));
  }, [loadRequests]);

  useEffect(() => {
    if (selectedId) loadMatches(selectedId).catch((loadError) => setError(loadError.message));
  }, [selectedId, loadMatches]);

  async function createRequest(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await api.post<{ request: EmergencyRequest; matches: Match[] }>('/emergency-requests', {
        requestedBy: { doctorName, department, contactNumber },
        bloodRequirements: [
          { bloodType, rhFactor, quantity, priority: urgencyLevel <= 2 ? 'critical' : 'urgent' },
        ],
        urgency: { level: urgencyLevel, requiredBy: new Date(requiredBy).toISOString() },
        patientInfo: { age: patientAge, gender: 'other', bloodType, rhFactor, diagnosis },
      });
      setSelectedId(created.request.id);
      await loadRequests();
      setMatches(created.matches);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create request');
    } finally {
      setBusy(false);
    }
  }

  async function act(matchId: string, action: 'accept' | 'reject') {
    setError(null);
    try {
      await api.post(`/matches/${matchId}/${action}`);
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed');
    }
  }

  const selected = requests.find((request) => request.id === selectedId) ?? null;

  return (
    <div className="page">
      <ErrorBanner error={error} />

      <div className="grid cols-2">
        <Card title="Raise an emergency request">
          <form onSubmit={createRequest} className="grid cols-2">
            <Field label="Requesting doctor">
              <input value={doctorName} onChange={(event) => setDoctorName(event.target.value)} required />
            </Field>
            <Field label="Department">
              <input value={department} onChange={(event) => setDepartment(event.target.value)} required />
            </Field>
            <Field label="Contact number">
              <input value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} required />
            </Field>
            <Field label="Patient age">
              <input
                type="number"
                min={0}
                max={130}
                value={patientAge}
                onChange={(event) => setPatientAge(Number(event.target.value))}
              />
            </Field>
            <Field label="Blood type">
              <select value={bloodType} onChange={(event) => setBloodType(event.target.value as BloodType)}>
                {BLOOD_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="Rh factor">
              <select value={rhFactor} onChange={(event) => setRhFactor(event.target.value as RhFactor)}>
                {RH_FACTORS.map((factor) => (
                  <option key={factor}>{factor}</option>
                ))}
              </select>
            </Field>
            <Field label="Units required">
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </Field>
            <Field label="Urgency (1 = most critical)">
              <select value={urgencyLevel} onChange={(event) => setUrgencyLevel(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Required by">
              <input
                type="datetime-local"
                value={requiredBy}
                onChange={(event) => setRequiredBy(event.target.value)}
              />
            </Field>
            <Field label="Diagnosis">
              <input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? 'Matching…' : 'Submit and find matches'}
              </button>
            </div>
          </form>
        </Card>

        <LiveFeed connected={connected} events={events} />
      </div>

      <Card title="My requests">
        <table>
          <thead>
            <tr>
              <th>Required by</th>
              <th>Group</th>
              <th>Units</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Matches</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} style={{ background: request.id === selectedId ? 'var(--bg)' : undefined }}>
                <td>{formatDateTime(request.requiredBy)}</td>
                <td>{bloodGroup(request.patientBloodType, request.patientRhFactor)}</td>
                <td>{request.requirements.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td>
                  <span className={`badge ${request.urgencyLevel <= 2 ? 'critical' : ''}`}>
                    L{request.urgencyLevel}
                  </span>
                </td>
                <td>
                  <StatusBadge status={request.status} />
                </td>
                <td>{request._count?.matches ?? '—'}</td>
                <td>
                  <button type="button" onClick={() => setSelectedId(request.id)}>
                    View matches
                  </button>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card
        title={selected ? `Proposed matches (${matches.length})` : 'Proposed matches'}
        actions={
          selected && (
            <button
              type="button"
              onClick={async () => {
                await api.post(`/emergency-requests/${selected.id}/rematch`);
                await refresh();
              }}
            >
              Re-run matching
            </button>
          )
        }
      >
        <table>
          <thead>
            <tr>
              <th>Score</th>
              <th>Blood bank</th>
              <th>Group</th>
              <th>Compat.</th>
              <th>Distance</th>
              <th>Expiry</th>
              <th>ETA</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id}>
                <td>
                  <strong>{match.score.toFixed(1)}</strong>
                </td>
                <td>{match.bloodBank?.name ?? match.bloodBankId}</td>
                <td>
                  {match.bloodUnit ? bloodGroup(match.bloodUnit.bloodType, match.bloodUnit.rhFactor) : '—'}
                </td>
                <td>{match.compatibilityScore}</td>
                <td>{match.distanceScore.toFixed(0)}</td>
                <td>{match.expiryScore.toFixed(0)}</td>
                <td>{match.estimatedTime} min</td>
                <td>
                  <StatusBadge status={match.status} />
                </td>
                <td>
                  {match.status === 'proposed' && (
                    <span className="row">
                      <button className="primary" type="button" onClick={() => act(match.id, 'accept')}>
                        Accept
                      </button>
                      <button type="button" onClick={() => act(match.id, 'reject')}>
                        Reject
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  No proposals for this request.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
