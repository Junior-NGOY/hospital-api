import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import {
  jsonError,
  jsonOk,
  requireHospitalForWrite,
  resolveHospitalScope,
} from "@/utils/hospitalScope";
import { applyStockDelta, toDate, toPositiveInt } from "@/utils/pharmacyStock";
import { Prisma, StockMovementType } from "@prisma/client";
import { Response } from "express";

const medicationInclude = {
  supplier: true,
  hospital: { select: { id: true, name: true } },
} satisfies Prisma.MedicationInclude;

function parseUnitPrice(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

async function medicationInHospital(
  id: string,
  hospitalId: string
) {
  return db.medication.findFirst({
    where: { id, hospitalId },
    include: medicationInclude,
  });
}

export async function createMedication(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;

    const data = req.body as Record<string, unknown>;
    const name = String(data.name || "").trim();
    if (!name) {
      return jsonError(res, 400, "Le nom du médicament est requis");
    }

    const form = data.form ? String(data.form).trim() : null;
    const existing = await db.medication.findFirst({
      where: { hospitalId: scope.hospitalId, name, form: form ?? undefined },
    });
    if (existing) {
      return jsonError(
        res,
        400,
        "Un médicament avec ce nom et cette forme existe déjà"
      );
    }

    const initialStock = Math.max(0, Number(data.stock) || 0);
    const minStock = Math.max(0, Number(data.minStock) || 10);
    const unitPrice = parseUnitPrice(data.unitPrice);
    const supplierId = data.supplierId ? String(data.supplierId) : null;

    if (supplierId) {
      const supplier = await db.supplier.findFirst({
        where: { id: supplierId, hospitalId: scope.hospitalId },
      });
      if (!supplier) {
        return jsonError(res, 400, "Fournisseur introuvable");
      }
    }

    const created = await db.$transaction(async (tx) => {
      const medication = await tx.medication.create({
        data: {
          name,
          form,
          genericName: data.genericName ? String(data.genericName).trim() : null,
          strength: data.strength ? String(data.strength).trim() : null,
          stock: 0,
          minStock,
          unitPrice: unitPrice ?? null,
          supplierId,
          hospitalId: scope.hospitalId,
        },
        include: medicationInclude,
      });

      if (initialStock > 0) {
        const result = await applyStockDelta(tx, {
          hospitalId: scope.hospitalId,
          medicationId: medication.id,
          delta: initialStock,
          type: StockMovementType.IN,
          reason: "Stock initial",
          createdById: scope.userId || null,
          createLot: true,
          unit: "unité",
        });
        if (result.error) {
          throw new Error(result.error);
        }
        return result.medication;
      }
      return medication;
    });

    return jsonOk(res, created, 201);
  } catch (error) {
    console.error("createMedication", error);
    return jsonError(res, 500, "Erreur lors de la création du médicament");
  }
}

export async function getMedications(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonOk(res, {
        medications: [],
        pagination: { total: 0, page: 1, limit: 100, totalPages: 0 },
      });
    }

    const {
      search,
      inStock,
      sort = "name",
      order = "asc",
      page = 1,
      limit = 100,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where: Prisma.MedicationWhereInput = { hospitalId };

    if (search) {
      where.name = { contains: String(search), mode: "insensitive" };
    }
    if (inStock === "true") {
      where.stock = { gt: 0 };
    }

    const allowedSort = ["name", "stock", "id"];
    const sortField = allowedSort.includes(String(sort)) ? String(sort) : "name";
    const sortOrder = order === "desc" ? "desc" : "asc";

    const [medications, total] = await Promise.all([
      db.medication.findMany({
        where,
        include: medicationInclude,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: Number(limit),
      }),
      db.medication.count({ where }),
    ]);

    return jsonOk(res, {
      medications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getMedications", error);
    return jsonError(res, 500, "Erreur lors de la récupération des médicaments");
  }
}

export async function getMedicationById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    const { id } = req.params;
    const medication = await db.medication.findFirst({
      where: { id, hospitalId },
      include: {
        ...medicationInclude,
        inventories: { orderBy: { receivedAt: "desc" }, take: 50 },
        prescriptionMedications: true,
        administrations: true,
      },
    });
    if (!medication) {
      return jsonError(res, 404, "Médicament non trouvé");
    }
    return jsonOk(res, medication);
  } catch (error) {
    console.error("getMedicationById", error);
    return jsonError(res, 500, "Erreur lors de la récupération du médicament");
  }
}

export async function updateMedication(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const { id } = req.params;
    const data = req.body as Record<string, unknown>;

    const existing = await medicationInHospital(id, scope.hospitalId);
    if (!existing) {
      return jsonError(res, 404, "Médicament non trouvé");
    }

    const updateData: Prisma.MedicationUpdateInput = {};
    if (data.name !== undefined) updateData.name = String(data.name).trim();
    if (data.form !== undefined) updateData.form = data.form ? String(data.form) : null;
    if (data.genericName !== undefined) {
      updateData.genericName = data.genericName ? String(data.genericName) : null;
    }
    if (data.strength !== undefined) {
      updateData.strength = data.strength ? String(data.strength) : null;
    }
    if (data.minStock !== undefined) {
      updateData.minStock = Math.max(0, Number(data.minStock) || 0);
    }
    if (data.unitPrice !== undefined) {
      const price = parseUnitPrice(data.unitPrice);
      if (price === undefined) {
        return jsonError(res, 400, "Prix unitaire invalide (CDF)");
      }
      updateData.unitPrice = price;
    }
    if (data.supplierId !== undefined) {
      const supplierId = data.supplierId ? String(data.supplierId) : null;
      if (supplierId) {
        const supplier = await db.supplier.findFirst({
          where: { id: supplierId, hospitalId: scope.hospitalId },
        });
        if (!supplier) {
          return jsonError(res, 400, "Fournisseur introuvable");
        }
        updateData.supplier = { connect: { id: supplierId } };
      } else {
        updateData.supplier = { disconnect: true };
      }
    }

    const updated = await db.medication.update({
      where: { id },
      data: updateData,
      include: medicationInclude,
    });
    return jsonOk(res, updated);
  } catch (error) {
    console.error("updateMedication", error);
    return jsonError(res, 500, "Erreur lors de la mise à jour du médicament");
  }
}

export async function deleteMedication(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const { id } = req.params;
    const medication = await db.medication.findFirst({
      where: { id, hospitalId: scope.hospitalId },
      include: {
        prescriptionMedications: true,
        administrations: true,
      },
    });
    if (!medication) {
      return jsonError(res, 404, "Médicament non trouvé");
    }
    if (
      medication.prescriptionMedications.length > 0 ||
      medication.administrations.length > 0
    ) {
      return jsonError(
        res,
        400,
        "Impossible de supprimer ce médicament car il est utilisé dans des prescriptions ou administrations"
      );
    }
    await db.medication.delete({ where: { id } });
    return jsonOk(res, "Médicament supprimé avec succès");
  } catch (error) {
    console.error("deleteMedication", error);
    return jsonError(res, 500, "Erreur lors de la suppression du médicament");
  }
}

/**
 * Ajuste le stock (entrée / sortie / ajustement) et enregistre un mouvement.
 */
export async function adjustMedicationStock(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const adjustment = Number(body.adjustment);
    if (!Number.isFinite(adjustment) || adjustment === 0) {
      return jsonError(res, 400, "Ajustement invalide");
    }
    const reason = String(body.reason || "").trim();
    if (reason.length < 3) {
      return jsonError(res, 400, "La raison doit contenir au moins 3 caractères");
    }

    const typeRaw = String(body.type || "").toUpperCase();
    let type: StockMovementType;
    if (typeRaw === "IN") type = StockMovementType.IN;
    else if (typeRaw === "OUT") type = StockMovementType.OUT;
    else if (typeRaw === "ADJUSTMENT") type = StockMovementType.ADJUSTMENT;
    else type = adjustment > 0 ? StockMovementType.IN : StockMovementType.OUT;

    const expiryDate = toDate(body.expiryDate);
    const supplierId = body.supplierId ? String(body.supplierId) : null;
    const createLot = type === StockMovementType.IN && adjustment > 0;

    const result = await db.$transaction((tx) =>
      applyStockDelta(tx, {
        hospitalId: scope.hospitalId,
        medicationId: id,
        delta: Math.trunc(adjustment),
        type,
        reason,
        expiryDate,
        supplierId,
        createdById: scope.userId || null,
        createLot,
        unit: body.unit ? String(body.unit) : "unité",
        notes: body.notes ? String(body.notes) : null,
      })
    );

    if (result.error) {
      return jsonError(res, result.status, result.error);
    }
    return jsonOk(res, {
      ...result.medication,
      movement: result.movement,
    });
  } catch (error) {
    console.error("adjustMedicationStock", error);
    return jsonError(res, 500, "Erreur lors de l'ajustement du stock");
  }
}

export async function receiveInventory(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const body = req.body as Record<string, unknown>;
    const medicationId = String(body.medicationId || "");
    const quantity = toPositiveInt(body.quantity);
    if (!medicationId || !quantity) {
      return jsonError(res, 400, "medicationId et quantity (> 0) sont requis");
    }

    const supplierId = body.supplierId ? String(body.supplierId) : null;
    if (supplierId) {
      const supplier = await db.supplier.findFirst({
        where: { id: supplierId, hospitalId: scope.hospitalId },
      });
      if (!supplier) {
        return jsonError(res, 400, "Fournisseur introuvable");
      }
    }

    const result = await db.$transaction((tx) =>
      applyStockDelta(tx, {
        hospitalId: scope.hospitalId,
        medicationId,
        delta: quantity,
        type: StockMovementType.IN,
        reason: body.reason ? String(body.reason) : "Entrée de stock",
        expiryDate: toDate(body.expiryDate),
        supplierId,
        createdById: scope.userId || null,
        createLot: true,
        unit: body.unit ? String(body.unit) : "unité",
        notes: body.notes ? String(body.notes) : null,
      })
    );

    if (result.error) {
      return jsonError(res, result.status, result.error);
    }
    return jsonOk(
      res,
      { medication: result.medication, movement: result.movement },
      201
    );
  } catch (error) {
    console.error("receiveInventory", error);
    return jsonError(res, 500, "Erreur lors de l'entrée de stock");
  }
}

export async function getInventoryLots(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);
    const medicationId =
      typeof req.query.medicationId === "string"
        ? req.query.medicationId
        : undefined;
    const lots = await db.inventory.findMany({
      where: {
        hospitalId,
        ...(medicationId ? { medicationId } : {}),
      },
      include: {
        medication: { select: { id: true, name: true, form: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 200,
    });
    return jsonOk(res, lots);
  } catch (error) {
    console.error("getInventoryLots", error);
    return jsonError(res, 500, "Erreur lors de la récupération des lots");
  }
}

export async function getStockMovements(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);
    const medicationId =
      typeof req.query.medicationId === "string"
        ? req.query.medicationId
        : undefined;
    const movements = await db.stockMovement.findMany({
      where: {
        hospitalId,
        ...(medicationId ? { medicationId } : {}),
      },
      include: {
        medication: { select: { id: true, name: true, form: true } },
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonOk(res, movements);
  } catch (error) {
    console.error("getStockMovements", error);
    return jsonError(res, 500, "Erreur lors de la récupération des mouvements");
  }
}

export async function getPharmacyAlerts(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonOk(res, { low: [], out: [], expiring: [], expired: [] });
    }

    const medications = await db.medication.findMany({
      where: { hospitalId },
      select: {
        id: true,
        name: true,
        form: true,
        stock: true,
        minStock: true,
      },
    });

    const out = medications
      .filter((m) => (m.stock ?? 0) <= 0)
      .map((m) => ({
        id: `${m.id}-out`,
        type: "out" as const,
        medicationId: m.id,
        medicationName: m.name,
        form: m.form,
        stock: m.stock ?? 0,
        minStock: m.minStock,
        message: "Stock épuisé",
        priority: "high" as const,
      }));

    const low = medications
      .filter((m) => (m.stock ?? 0) > 0 && (m.stock ?? 0) <= m.minStock)
      .map((m) => ({
        id: `${m.id}-low`,
        type: "low" as const,
        medicationId: m.id,
        medicationName: m.name,
        form: m.form,
        stock: m.stock ?? 0,
        minStock: m.minStock,
        message: `Stock faible (${m.stock} ≤ min ${m.minStock})`,
        priority: "medium" as const,
      }));

    const soon = new Date();
    soon.setDate(soon.getDate() + 90);
    const now = new Date();

    const lots = await db.inventory.findMany({
      where: {
        hospitalId,
        quantity: { gt: 0 },
        expiryDate: { not: null, lte: soon },
      },
      include: { medication: { select: { id: true, name: true, form: true } } },
      orderBy: { expiryDate: "asc" },
    });

    const expired = lots
      .filter((lot) => lot.expiryDate && lot.expiryDate < now)
      .map((lot) => ({
        id: `${lot.id}-expired`,
        type: "expired" as const,
        medicationId: lot.medicationId,
        medicationName: lot.medication.name,
        form: lot.medication.form,
        stock: lot.quantity,
        expiryDate: lot.expiryDate,
        message: `Lot périmé (${lot.quantity} unités)`,
        priority: "high" as const,
      }));

    const expiring = lots
      .filter((lot) => lot.expiryDate && lot.expiryDate >= now)
      .map((lot) => ({
        id: `${lot.id}-expiring`,
        type: "expiring" as const,
        medicationId: lot.medicationId,
        medicationName: lot.medication.name,
        form: lot.medication.form,
        stock: lot.quantity,
        expiryDate: lot.expiryDate,
        message: `Péremption le ${lot.expiryDate?.toISOString().slice(0, 10)} (${lot.quantity} unités)`,
        priority: "medium" as const,
      }));

    return jsonOk(res, { low, out, expiring, expired });
  } catch (error) {
    console.error("getPharmacyAlerts", error);
    return jsonError(res, 500, "Erreur lors du calcul des alertes");
  }
}
