import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, ErrorBanner, Field, StatusBadge, bloodGroup, formatDateTime } from '../components';
import type { BloodBankSummary, Donation, Donor, Eligibility, Paginated } from '../types';

export function DonorPortal() {
  const { user } = useAuth();
  const donorId = user?.donorId ?? '';

  const [donor, setDonor] = useState<Donor | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [bloodBanks, setBloodBanks] = useState<BloodBankSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [bloodBankId, setBloodBankId] = useState('');
  const [donationDate, setDonationDate] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [hemoglobin, setHemoglobin] = useState(13.5);
  const [weight, setWeight] = useState(62);

  const refresh = useCallback(async () => {
    if (!donorId) return;
    const [profile, eligibilityResult, donationPage, bankPage] = await Promise.all([
      api.get<Donor>(`/donors/${donorId}`),
      api.get<Eligibility>(`/donors/${donorId}/eligibility`),
      api.get<Paginated<Donation>>('/donations?pageSize=25'),
      api.get<Paginated<BloodBankSummary>>('/blood-banks?pageSize=50'),
    ]);
    setDonor(profile);
    setEligibility(eligibilityResult);
    setDonations(donationPage.items);
    setBloodBanks(bankPage.items);
    setBloodBankId((current) => current || bankPage.items[0]?.id || '');
    setWeight(profile.weight);
  }, [donorId]);

  useEffect(() => {
    refresh().catch((loadError) => setError(loadError.message));
  }, [refresh]);

  async function schedule(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await api.post('/donations', {
        donorId,
        bloodBankId,
        donationDate: new Date(donationDate).toISOString(),
        healthScreening: {
          hemoglobin,
          systolic: 120,
          diastolic: 80,
          temperature: 36.8,
          weight,
          questionsPassed: true,
        },
      });
      setNotice('Donation scheduled. The blood bank has been notified.');
      await refresh();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : 'Could not schedule donation');
    }
  }

  async function savePreferences(patch: Partial<Donor>) {
    setError(null);
    try {
      await api.patch(`/donors/${donorId}`, patch);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save preferences');
    }
  }

  if (!donor) {
    return (
      <div className="page">
        <ErrorBanner error={error} />
        <p className="muted">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <ErrorBanner error={error} />
      {notice && <div className="card">{notice}</div>}

      <div className="grid cols-2">
        <Card title="My profile">
          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <td>
                  {donor.firstName} {donor.lastName}
                </td>
              </tr>
              <tr>
                <th>Blood group</th>
                <td>
                  <strong>{bloodGroup(donor.bloodType, donor.rhFactor)}</strong>
                </td>
              </tr>
              <tr>
                <th>Total donations</th>
                <td>{donor.totalDonations}</td>
              </tr>
              <tr>
                <th>Last donation</th>
                <td>{formatDateTime(donor.lastDonationDate)}</td>
              </tr>
              <tr>
                <th>Eligibility</th>
                <td>
                  {eligibility?.eligible ? (
                    <span className="badge ok">eligible</span>
                  ) : (
                    <span className="badge critical">deferred</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          {eligibility && !eligibility.eligible && (
            <ul className="muted">
              {eligibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Notification preferences">
          <div className="grid">
            {(['notifyByEmail', 'notifyBySms', 'notifyByPush'] as const).map((key) => (
              <label key={key} className="row">
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={donor[key]}
                  onChange={(event) => savePreferences({ [key]: event.target.checked } as Partial<Donor>)}
                />
                {key.replace('notifyBy', 'Notify by ')}
              </label>
            ))}
            <Field label="Preferred donation frequency">
              <select
                value={donor.donationFrequency}
                onChange={(event) => savePreferences({ donationFrequency: event.target.value })}
              >
                {['weekly', 'biweekly', 'monthly', 'quarterly'].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
          </div>
        </Card>
      </div>

      <Card title="Schedule a donation">
        <form onSubmit={schedule} className="grid cols-4" style={{ alignItems: 'end' }}>
          <Field label="Blood bank">
            <select value={bloodBankId} onChange={(event) => setBloodBankId(event.target.value)}>
              {bloodBanks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={donationDate} onChange={(event) => setDonationDate(event.target.value)} />
          </Field>
          <Field label="Haemoglobin (g/dL)">
            <input
              type="number"
              step="0.1"
              value={hemoglobin}
              onChange={(event) => setHemoglobin(Number(event.target.value))}
            />
          </Field>
          <Field label="Weight (kg)">
            <input type="number" value={weight} onChange={(event) => setWeight(Number(event.target.value))} />
          </Field>
          <button className="primary" type="submit" disabled={!eligibility?.eligible}>
            Schedule
          </button>
        </form>
        {!eligibility?.eligible && <p className="muted">Scheduling is disabled until you are eligible again.</p>}
      </Card>

      <Card title="My donations">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Blood bank</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((donation) => (
              <tr key={donation.id}>
                <td>{formatDateTime(donation.donationDate)}</td>
                <td>{donation.bloodBank?.name ?? donation.bloodBankId}</td>
                <td>{donation.donationType.replace(/_/g, ' ')}</td>
                <td>
                  <StatusBadge status={donation.status} />
                </td>
              </tr>
            ))}
            {donations.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No donations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
