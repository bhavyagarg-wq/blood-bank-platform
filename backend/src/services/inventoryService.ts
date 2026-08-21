import { BloodUnit, BloodUnitStatus, InventoryAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { realtime } from '../realtime/bus';
import { EVENT } from '../realtime/events';

const ACTION_FOR_STATUS: Record<BloodUnitStatus, InventoryAction> = {
  available: InventoryAction.released,
  reserved: InventoryAction.reserved,
  transfused: InventoryAction.transfused,
  expired: InventoryAction.expired,
  quarantined: InventoryAction.quarantined,
};

async function recomputeUtilization(bloodBankId: string, client: Prisma.TransactionClient = prisma): Promise<void> {
  const currentUtilization = await client.bloodUnit.count({
    where: { bloodBankId, status: { in: [BloodUnitStatus.available, BloodUnitStatus.reserved] } },
  });
  await client.bloodBank.update({ where: { id: bloodBankId }, data: { currentUtilization } });
}

export async function registerBloodUnit(
  data: Prisma.BloodUnitUncheckedCreateInput,
  performedBy: string,
): Promise<BloodUnit> {
  const unit = await prisma.$transaction(async (tx) => {
    const created = await tx.bloodUnit.create({ data });
    await tx.inventoryLog.create({
      data: {
        bloodBankId: created.bloodBankId,
        bloodUnitId: created.id,
        action: InventoryAction.added,
        newStatus: created.status,
        performedBy,
      },
    });
    await recomputeUtilization(created.bloodBankId, tx);
    return created;
  });

  realtime.toBloodBank(unit.bloodBankId, EVENT.inventoryUpdated, { unitId: unit.id, status: unit.status });
  realtime.toAdmins(EVENT.inventoryUpdated, { bloodBankId: unit.bloodBankId, unitId: unit.id });
  return unit;
}

export async function changeUnitStatus(
  unitId: string,
  status: BloodUnitStatus,
  performedBy: string,
  options: { emergencyRequestId?: string | null; notes?: string } = {},
): Promise<BloodUnit> {
  const existing = await prisma.bloodUnit.findUnique({ where: { id: unitId } });
  if (!existing) throw notFound('Blood unit not found');

  const unit = await prisma.$transaction(async (tx) => {
    const updated = await tx.bloodUnit.update({
      where: { id: unitId },
      data: {
        status,
        emergencyRequestId:
          options.emergencyRequestId === undefined ? existing.emergencyRequestId : options.emergencyRequestId,
      },
    });
    await tx.inventoryLog.create({
      data: {
        bloodBankId: updated.bloodBankId,
        bloodUnitId: updated.id,
        action: ACTION_FOR_STATUS[status],
        previousStatus: existing.status,
        newStatus: status,
        performedBy,
        notes: options.notes,
      },
    });
    await recomputeUtilization(updated.bloodBankId, tx);
    return updated;
  });

  realtime.toBloodBank(unit.bloodBankId, EVENT.inventoryUpdated, { unitId: unit.id, status: unit.status });
  realtime.toAdmins(EVENT.inventoryUpdated, { bloodBankId: unit.bloodBankId, unitId: unit.id, status });
  return unit;
}

/** Marks every past-expiry unit as expired. Intended to run on a schedule. */
export async function expireStaleUnits(performedBy = 'system'): Promise<number> {
  const stale = await prisma.bloodUnit.findMany({
    where: {
      expiryDate: { lt: new Date() },
      status: { in: [BloodUnitStatus.available, BloodUnitStatus.reserved] },
    },
    select: { id: true },
  });

  for (const unit of stale) {
    await changeUnitStatus(unit.id, BloodUnitStatus.expired, performedBy, { notes: 'Automatic expiry sweep' });
  }
  return stale.length;
}

export interface InventorySummaryRow {
  bloodType: string;
  rhFactor: string;
  available: number;
  reserved: number;
  expiringWithin7Days: number;
}

export async function inventorySummary(bloodBankId?: string): Promise<InventorySummaryRow[]> {
  const where = bloodBankId ? { bloodBankId } : {};
  const units = await prisma.bloodUnit.findMany({
    where: { ...where, status: { in: [BloodUnitStatus.available, BloodUnitStatus.reserved] } },
    select: { bloodType: true, rhFactor: true, status: true, expiryDate: true },
  });

  const sevenDaysOut = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const rows = new Map<string, InventorySummaryRow>();

  for (const unit of units) {
    const key = `${unit.bloodType}${unit.rhFactor}`;
    const row =
      rows.get(key) ??
      { bloodType: unit.bloodType, rhFactor: unit.rhFactor, available: 0, reserved: 0, expiringWithin7Days: 0 };

    if (unit.status === BloodUnitStatus.available) row.available += 1;
    if (unit.status === BloodUnitStatus.reserved) row.reserved += 1;
    if (unit.expiryDate.getTime() <= sevenDaysOut) row.expiringWithin7Days += 1;

    rows.set(key, row);
  }

  return [...rows.values()].sort((a, b) => `${a.bloodType}${a.rhFactor}`.localeCompare(`${b.bloodType}${b.rhFactor}`));
}
