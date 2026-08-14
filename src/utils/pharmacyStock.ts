import { Prisma, StockMovementType } from "@prisma/client";

const medicationInclude = {
  supplier: true,
  hospital: { select: { id: true, name: true } },
} satisfies Prisma.MedicationInclude;

export const stockMovementInclude = {
  medication: { select: { id: true, name: true, form: true, stock: true } },
  supplier: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  inventory: { select: { id: true, expiryDate: true, quantity: true } },
} satisfies Prisma.StockMovementInclude;

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export async function consumeLots(
  tx: Prisma.TransactionClient,
  medicationId: string,
  hospitalId: string,
  qty: number
): Promise<string | null> {
  const lots = await tx.inventory.findMany({
    where: { medicationId, hospitalId, quantity: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
  });
  let left = qty;
  let firstId: string | null = null;
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(lot.quantity, left);
    await tx.inventory.update({
      where: { id: lot.id },
      data: { quantity: lot.quantity - take },
    });
    firstId = firstId ?? lot.id;
    left -= take;
  }
  return firstId;
}

export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  params: {
    hospitalId: string;
    medicationId: string;
    delta: number;
    type: StockMovementType;
    reason?: string | null;
    expiryDate?: Date | null;
    supplierId?: string | null;
    prescriptionId?: string | null;
    dispensingId?: string | null;
    createdById?: string | null;
    unit?: string | null;
    notes?: string | null;
    createLot?: boolean;
  }
) {
  const medication = await tx.medication.findFirst({
    where: { id: params.medicationId, hospitalId: params.hospitalId },
  });
  if (!medication) {
    return { error: "Médicament non trouvé", status: 404 as const };
  }

  const current = medication.stock ?? 0;
  const next = current + params.delta;
  if (next < 0) {
    return {
      error: `Stock insuffisant (${current} disponible)`,
      status: 400 as const,
    };
  }

  let inventoryId: string | null = null;
  if (params.createLot && params.delta > 0) {
    const lot = await tx.inventory.create({
      data: {
        hospitalId: params.hospitalId,
        medicationId: params.medicationId,
        supplierId: params.supplierId || null,
        quantity: params.delta,
        unit: params.unit?.trim() || "unité",
        expiryDate: params.expiryDate,
        notes: params.notes || params.reason || null,
      },
    });
    inventoryId = lot.id;
  } else if (params.delta < 0) {
    inventoryId = await consumeLots(
      tx,
      params.medicationId,
      params.hospitalId,
      Math.abs(params.delta)
    );
  }

  const updated = await tx.medication.update({
    where: { id: params.medicationId },
    data: { stock: next },
    include: medicationInclude,
  });

  const movement = await tx.stockMovement.create({
    data: {
      hospitalId: params.hospitalId,
      medicationId: params.medicationId,
      inventoryId,
      supplierId: params.supplierId || null,
      prescriptionId: params.prescriptionId || null,
      dispensingId: params.dispensingId || null,
      type: params.type,
      quantity: params.delta,
      reason: params.reason || null,
      expiryDate: params.expiryDate,
      createdById: params.createdById || null,
    },
    include: stockMovementInclude,
  });

  return { medication: updated, movement, error: null, status: 200 as const };
}
