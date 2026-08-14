import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import {
  jsonError,
  jsonOk,
  requireHospitalForWrite,
  requirePatientInHospital,
  resolveHospitalScope,
} from "@/utils/hospitalScope";
import { applyStockDelta, toPositiveInt } from "@/utils/pharmacyStock";
import { Prisma, StockMovementType } from "@prisma/client";
import { Response } from "express";

const prescriptionInclude = {
  patient: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      fileNumber: true,
    },
  },
  doctor: {
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  },
  medications: {
    include: {
      medication: {
        select: { id: true, name: true, form: true, stock: true, unitPrice: true },
      },
    },
  },
  dispensings: {
    orderBy: { dispensedAt: "desc" as const },
  },
} satisfies Prisma.PrescriptionInclude;

function remainingQty(line: { quantity: number; dispensedQuantity: number }) {
  return Math.max(0, (line.quantity || 1) - (line.dispensedQuantity || 0));
}

export async function getPrescriptions(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);
    const pending = req.query.pending === "true";
    const prescriptions = await db.prescription.findMany({
      where: { hospitalId },
      include: prescriptionInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const mapped = prescriptions.map((p) => ({
      ...p,
      pending: p.medications.some((line) => remainingQty(line) > 0),
    }));
    return jsonOk(
      res,
      pending ? mapped.filter((p) => p.pending) : mapped
    );
  } catch (error) {
    console.error("getPrescriptions", error);
    return jsonError(res, 500, "Impossible de récupérer les ordonnances");
  }
}

export async function getPrescriptionById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonError(res, 403, "Accès refusé");
    const prescription = await db.prescription.findFirst({
      where: { id: req.params.id, hospitalId },
      include: prescriptionInclude,
    });
    if (!prescription) {
      return jsonError(res, 404, "Ordonnance introuvable");
    }
    return jsonOk(res, prescription);
  } catch (error) {
    console.error("getPrescriptionById", error);
    return jsonError(res, 500, "Impossible de récupérer l'ordonnance");
  }
}

export async function createPrescription(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const body = req.body as Record<string, unknown>;
    const patientId = String(body.patientId || "");
    if (!patientId) {
      return jsonError(res, 400, "patientId est requis");
    }
    const scoped = await requirePatientInHospital(req, res, patientId);
    if (!scoped) return;

    const rawItems = Array.isArray(body.medications) ? body.medications : [];
    if (rawItems.length === 0) {
      return jsonError(res, 400, "Au moins un médicament est requis");
    }

    const items: Array<{
      medicationId: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string | null;
      quantity: number;
    }> = [];

    for (const row of rawItems) {
      if (!row || typeof row !== "object") {
        return jsonError(res, 400, "Ligne d'ordonnance invalide");
      }
      const item = row as Record<string, unknown>;
      const medicationId = String(item.medicationId || "");
      const quantity = toPositiveInt(item.quantity) ?? 1;
      if (!medicationId) {
        return jsonError(res, 400, "medicationId est requis sur chaque ligne");
      }
      const med = await db.medication.findFirst({
        where: { id: medicationId, hospitalId: scope.hospitalId },
      });
      if (!med) {
        return jsonError(res, 400, "Médicament introuvable dans cet hôpital");
      }
      items.push({
        medicationId,
        dosage: String(item.dosage || "selon posologie").trim(),
        frequency: String(item.frequency || "selon posologie").trim(),
        duration: String(item.duration || "selon posologie").trim(),
        instructions: item.instructions ? String(item.instructions) : null,
        quantity,
      });
    }

    let doctorId: string | null = null;
    if (body.doctorId) {
      const doctor = await db.doctor.findUnique({
        where: { id: String(body.doctorId) },
        select: { id: true },
      });
      doctorId = doctor?.id ?? null;
    }

    const created = await db.prescription.create({
      data: {
        patientId,
        hospitalId: scope.hospitalId,
        doctorId,
        notes: body.notes ? String(body.notes) : null,
        medications: {
          create: items,
        },
      },
      include: prescriptionInclude,
    });
    return jsonOk(res, created, 201);
  } catch (error) {
    console.error("createPrescription", error);
    return jsonError(res, 500, "Erreur lors de la création de l'ordonnance");
  }
}

export async function dispensePrescription(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const prescription = await db.prescription.findFirst({
      where: { id: req.params.id, hospitalId: scope.hospitalId },
      include: { medications: true },
    });
    if (!prescription) {
      return jsonError(res, 404, "Ordonnance introuvable");
    }

    const body = req.body as Record<string, unknown>;
    const rawItems = Array.isArray(body.items) ? body.items : null;
    const notes = body.notes ? String(body.notes) : null;

    type DispenseLine = { medicationId: string; quantity: number };
    const requested: DispenseLine[] = [];

    if (rawItems && rawItems.length > 0) {
      for (const row of rawItems) {
        if (!row || typeof row !== "object") {
          return jsonError(res, 400, "Ligne de délivrance invalide");
        }
        const item = row as Record<string, unknown>;
        const medicationId = String(item.medicationId || "");
        const quantity = toPositiveInt(item.quantity);
        if (!medicationId || !quantity) {
          return jsonError(res, 400, "medicationId et quantity (> 0) sont requis");
        }
        requested.push({ medicationId, quantity });
      }
    } else {
      for (const line of prescription.medications) {
        const left = remainingQty(line);
        if (left > 0) {
          requested.push({ medicationId: line.medicationId, quantity: left });
        }
      }
    }

    if (requested.length === 0) {
      return jsonError(res, 400, "Rien à délivrer sur cette ordonnance");
    }

    const result = await db.$transaction(async (tx) => {
      const dispensings = [];
      for (const reqLine of requested) {
        const line = prescription.medications.find(
          (m) => m.medicationId === reqLine.medicationId
        );
        if (!line) {
          throw Object.assign(new Error("Médicament absent de l'ordonnance"), {
            status: 400,
          });
        }
        const left = remainingQty(line);
        if (reqLine.quantity > left) {
          throw Object.assign(
            new Error(
              `Quantité trop élevée pour ce médicament (reste ${left})`
            ),
            { status: 400 }
          );
        }

        const dispensing = await tx.dispensing.create({
          data: {
            hospitalId: scope.hospitalId,
            prescriptionId: prescription.id,
            medicationId: reqLine.medicationId,
            quantity: reqLine.quantity,
            notes,
            dispensedById: scope.userId || null,
          },
        });

        const stock = await applyStockDelta(tx, {
          hospitalId: scope.hospitalId,
          medicationId: reqLine.medicationId,
          delta: -reqLine.quantity,
          type: StockMovementType.DISPENSE,
          reason: notes || "Délivrance d'ordonnance",
          prescriptionId: prescription.id,
          dispensingId: dispensing.id,
          createdById: scope.userId || null,
        });
        if (stock.error) {
          throw Object.assign(new Error(stock.error), { status: stock.status });
        }

        const newDispensed = (line.dispensedQuantity || 0) + reqLine.quantity;
        await tx.prescriptionMedication.update({
          where: { id: line.id },
          data: {
            dispensedQuantity: newDispensed,
            dispensedAt: new Date(),
          },
        });
        line.dispensedQuantity = newDispensed;
        dispensings.push(dispensing);
      }
      return dispensings;
    });

    const updated = await db.prescription.findFirst({
      where: { id: prescription.id },
      include: prescriptionInclude,
    });
    return jsonOk(res, { prescription: updated, dispensings: result });
  } catch (error) {
    const err = error as Error & { status?: number };
    console.error("dispensePrescription", error);
    if (err.status) {
      return jsonError(res, err.status, err.message);
    }
    return jsonError(res, 500, "Erreur lors de la délivrance");
  }
}
