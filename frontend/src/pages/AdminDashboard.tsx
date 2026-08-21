import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Card, ErrorBanner, LiveFeed, Stat, StatusBadge, bloodGroup, formatDateTime } from '../components';
import { useRealtime } from '../useRealtime';
import type { BloodUnit, EmergencyRequest, InventoryRow, Overview, Paginated } from '../types';

interface MatchPerformance {
  deliveredCount: number;
  averageScore: number;
  averageEstimatedMinutes: number;
  averageActualMinutes: number;
}

export function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [expiring, setExpiring] = useState<BloodUnit[]>([]);
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [performance, setPerformance] = useState<MatchPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [overviewResult, inventoryRows, expiringUnits, requestPage, performanceResult] = await Promise.all([
      api.get<Overview>('/analytics/overview'),
      api.get<InventoryRow[]>('/analytics/inventory-by-blood-type'),
      api.get<BloodUnit[]>('/analytics/expiring-soon'),
      api.get<Paginated<EmergencyRequest>>('/emergency-requests?pageSize=15'),
      api.get<MatchPerformance>('/analytics/match-performance'),
    ]);
    setOverview(overviewResult);
    setInventory(inventoryRows);
    setExpiring(expiringUnits);
    setRequests(requestPage.items);
    setPerformance(performanceResult);
  }, []);

  const { connected, events } = useRealtime(() => {
    void refresh();
  });

  useEffect(() => {
    refresh().catch((loadError) => setError(loadError.message));
  }, [refresh]);

  async function runExpirySweep() {
    setError(null);
    try {
      await api.post('/blood-units/expire-sweep');
      await refresh();
    } catch (sweepError) {
      setError(sweepError instanceof Error ? sweepError.message : 'Sweep failed');
    }
  }

  return (
    <div className="page">
      <ErrorBanner error={error} />

      {overview && (
        <div className="grid cols-4" style={{ marginBottom: 18 }}>
          <Stat label="Hospitals" value={overview.hospitals} />
          <Stat label="Blood banks" value={overview.bloodBanks} />
          <Stat label="Registered donors" value={overview.donors} />
          <Stat label="Units available" value={overview.inventory.availableUnits} />
          <Stat label="Units reserved" value={overview.inventory.reservedUnits} />
          <Stat label="Open requests" value={overview.requests.pending} />
          <Stat label="Match success rate" value={`${overview.matchSuccessRate}%`} />
          <Stat label="Units used before expiry" value={`${overview.inventoryUtilisationRate}%`} />
        </div>
      )}

      <div className="grid cols-2">
        <Card title="Network stock by blood group">
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
              {inventory.map((row) => (
                <tr key={`${row.bloodType}${row.rhFactor}`}>
                  <td>
                    <strong>{bloodGroup(row.bloodType, row.rhFactor)}</strong>
                  </td>
                  <td>{row.available}</td>
                  <td>{row.reserved}</td>
                  <td>{row.expiringWithin7Days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <LiveFeed connected={connected} events={events} />
      </div>

      <Card
        title={`Expiring within 7 days (${expiring.length})`}
        actions={
          <button type="button" onClick={runExpirySweep}>
            Run expiry sweep
          </button>
        }
      >
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Blood bank</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {expiring.map((unit) => (
              <tr key={unit.id}>
                <td>
                  <strong>{bloodGroup(unit.bloodType, unit.rhFactor)}</strong>
                </td>
                <td>{unit.bloodBank?.name ?? unit.bloodBankId}</td>
                <td>{formatDateTime(unit.expiryDate)}</td>
              </tr>
            ))}
            {expiring.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Nothing expiring soon.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {performance && (
        <Card title="Delivery performance">
          <div className="grid cols-4">
            <Stat label="Deliveries completed" value={performance.deliveredCount} />
            <Stat label="Average match score" value={performance.averageScore} />
            <Stat label="Average ETA (min)" value={performance.averageEstimatedMinutes} />
            <Stat label="Average actual (min)" value={performance.averageActualMinutes} />
          </div>
        </Card>
      )}

      <Card title="Recent emergency requests">
        <table>
          <thead>
            <tr>
              <th>Hospital</th>
              <th>Group</th>
              <th>Urgency</th>
              <th>Required by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.hospital?.name ?? request.hospitalId}</td>
                <td>{bloodGroup(request.patientBloodType, request.patientRhFactor)}</td>
                <td>L{request.urgencyLevel}</td>
                <td>{formatDateTime(request.requiredBy)}</td>
                <td>
                  <StatusBadge status={request.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
