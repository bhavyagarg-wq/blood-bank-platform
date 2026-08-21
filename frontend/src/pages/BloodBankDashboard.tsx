import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, ErrorBanner, Field, LiveFeed, StatusBadge, bloodGroup, formatDateTime } from '../components';
import { useRealtime } from '../useRealtime';
import type { BloodType, BloodUnit, Donation, InventoryRow, Match, Paginated, RhFactor } from '../types';

const BLOOD_TYPES: BloodType[] = ['A', 'B', 'AB', 'O'];
const RH_FACTORS: RhFactor[] = ['positive', 'negative'];
const SHELF_LIFE_DAYS = 42;

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function BloodBankDashboard() {
  const { user } = useAuth();
  const bloodBankId = user?.bloodBankId ?? '';

  const [summary, setSummary] = useState<InventoryRow[]>([]);
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [bloodType, setBloodType] = useState<BloodType>('O');
  const [rhFactor, setRhFactor] = useState<RhFactor>('negative');
  const [collectionDate, setCollectionDate] = useState(isoDate(0));

  const refresh = useCallback(async () => {
    if (!bloodBankId) return;
    const [summaryRows, unitPage, matchPage, donationPage] = await Promise.all([
      api.get<InventoryRow[]>(`/blood-units/summary?bloodBankId=${bloodBankId}`),
      api.get<Paginated<BloodUnit>>(`/blood-units?bloodBankId=${bloodBankId}&pageSize=50`),
      api.get<Paginated<Match>>('/matches?pageSize=25'),
      api.get<Paginated<Donation>>('/donations?pageSize=25'),
    ]);
    setSummary(summaryRows);
    setUnits(unitPage.items);
    setMatches(matchPage.items);
    setDonations(donationPage.items);
  }, [bloodBankId]);

  const { connected, events } = useRealtime(() => {
    void refresh();
  });

  useEffect(() => {
    refresh().catch((loadError) => setError(loadError.message));
  }, [refresh]);

  async function addUnit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const collection = new Date(collectionDate);
      await api.post('/blood-units', {
        bloodType,
        rhFactor,
        bloodBankId,
        collectionDate: collection.toISOString(),
        expiryDate: new Date(collection.getTime() + SHELF_LIFE_DAYS * 86_400_000).toISOString(),
      });
      await refresh();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add unit');
    } finally {
      setBusy(false);
    }
  }

  async function clearScreening(unitId: string) {
    setError(null);
    try {
      await api.post(`/blood-units/${unitId}/test-results`, {
        hiv: false,
        hepatitisB: false,
        hepatitisC: false,
        syphilis: false,
      });
      await refresh();
    } catch (screeningError) {
      setError(screeningError instanceof Error ? screeningError.message : 'Could not record results');
    }
  }

  async function respond(matchId: string, action: 'accept' | 'reject') {
    setError(null);
    try {
      await api.post(`/matches/${matchId}/${action}`);
      await refresh();
    } catch (respondError) {
      setError(respondError instanceof Error ? respondError.message : 'Action failed');
    }
  }

  async function moveMatch(matchId: string, status: 'transit' | 'delivered' | 'cancelled') {
    setError(null);
    try {
      await api.patch(`/matches/${matchId}/status`, { status });
      await refresh();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Action failed');
    }
  }

  async function completeDonation(donationId: string) {
    setError(null);
    try {
      await api.post(`/donations/${donationId}/complete`, {});
      await refresh();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'Could not complete donation');
    }
  }

  return (
    <div className="page">
      <ErrorBanner error={error} />

      <div className="grid cols-2">
        <Card title="Stock by blood group">
          <table>
            <thead>
              <tr>
                <th>Group</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Expiring ≤ 7 days</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={`${row.bloodType}${row.rhFactor}`}>
                  <td>
                    <strong>{bloodGroup(row.bloodType, row.rhFactor)}</strong>
                  </td>
                  <td>{row.available}</td>
                  <td>{row.reserved}</td>
                  <td>{row.expiringWithin7Days > 0 ? <span className="badge warn">{row.expiringWithin7Days}</span> : 0}</td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No stock recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <LiveFeed connected={connected} events={events} />
      </div>

      <Card title="Register a new unit">
        <form onSubmit={addUnit} className="grid cols-4" style={{ alignItems: 'end' }}>
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
          <Field label="Collection date">
            <input
              type="date"
              value={collectionDate}
              onChange={(event) => setCollectionDate(event.target.value)}
            />
          </Field>
          <button className="primary" type="submit" disabled={busy}>
            Add unit
          </button>
        </form>
        <p className="muted">Units expire {SHELF_LIFE_DAYS} days after collection and stay unmatched until screened.</p>
      </Card>

      <Card title="Match requests">
        <table>
          <thead>
            <tr>
              <th>Score</th>
              <th>Hospital</th>
              <th>Group</th>
              <th>Needed by</th>
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
                <td>{match.hospital?.name ?? match.hospitalId}</td>
                <td>
                  {match.bloodUnit ? bloodGroup(match.bloodUnit.bloodType, match.bloodUnit.rhFactor) : '—'}
                </td>
                <td>{formatDateTime(match.emergencyRequest?.requiredBy)}</td>
                <td>{match.estimatedTime} min</td>
                <td>
                  <StatusBadge status={match.status} />
                </td>
                <td>
                  <span className="row">
                    {match.status === 'proposed' && (
                      <>
                        <button className="primary" type="button" onClick={() => respond(match.id, 'accept')}>
                          Accept
                        </button>
                        <button type="button" onClick={() => respond(match.id, 'reject')}>
                          Reject
                        </button>
                      </>
                    )}
                    {match.status === 'accepted' && (
                      <button type="button" onClick={() => moveMatch(match.id, 'transit')}>
                        Mark in transit
                      </button>
                    )}
                    {match.status === 'transit' && (
                      <button className="primary" type="button" onClick={() => moveMatch(match.id, 'delivered')}>
                        Mark delivered
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No match requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Scheduled donations">
        <table>
          <thead>
            <tr>
              <th>Donor</th>
              <th>Group</th>
              <th>Date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {donations.map((donation) => (
              <tr key={donation.id}>
                <td>
                  {donation.donor ? `${donation.donor.firstName} ${donation.donor.lastName}` : donation.donorId}
                </td>
                <td>{donation.donor ? bloodGroup(donation.donor.bloodType, donation.donor.rhFactor) : '—'}</td>
                <td>{formatDateTime(donation.donationDate)}</td>
                <td>
                  <StatusBadge status={donation.status} />
                </td>
                <td>
                  {donation.status === 'scheduled' && (
                    <button type="button" onClick={() => completeDonation(donation.id)}>
                      Complete and stock
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {donations.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No donations scheduled.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Inventory">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Collected</th>
              <th>Expires</th>
              <th>Screening</th>
              <th>Status</th>
              <th>Location</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id}>
                <td>
                  <strong>{bloodGroup(unit.bloodType, unit.rhFactor)}</strong>
                </td>
                <td>{formatDateTime(unit.collectionDate)}</td>
                <td>{formatDateTime(unit.expiryDate)}</td>
                <td>
                  <StatusBadge status={unit.testingStatus} />
                </td>
                <td>
                  <StatusBadge status={unit.status} />
                </td>
                <td className="muted">
                  {unit.refrigerator}/{unit.shelf}
                </td>
                <td>
                  {unit.testingStatus === 'pending' && (
                    <button type="button" onClick={() => clearScreening(unit.id)}>
                      Record clear screening
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No units in stock.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
