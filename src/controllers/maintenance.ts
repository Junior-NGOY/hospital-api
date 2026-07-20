import { db } from "@/db/db";
import { Request, Response } from "express";

type MaintenanceBody = {
  equipmentId: string;
  type: string;
  priority?: string;
  description: string;
  scheduledDate: string | Date;
  completedDate?: string | Date | null;
  performedBy?: string | null;
  cost?: number | null;
  notes?: string | null;
  status?: string | null;
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createMaintenance(req: Request, res: Response) {
  try {
    const data = req.body as MaintenanceBody;

    if (!data.equipmentId || !data.description?.trim() || !data.type || !data.scheduledDate) {
      return res.status(400).json({
        data: null,
        error: "equipmentId, type, description et scheduledDate sont requis",
      });
    }

    const equipment = await db.equipment.findUnique({ where: { id: data.equipmentId } });
    if (!equipment) {
      return res.status(404).json({ data: null, error: "Équipement introuvable" });
    }

    const scheduledDate = toDate(data.scheduledDate);
    if (!scheduledDate) {
      return res.status(400).json({ data: null, error: "Date planifiée invalide" });
    }

    const created = await db.maintenanceRecord.create({
      data: {
        equipmentId: data.equipmentId,
        type: data.type,
        priority: data.priority || "MEDIUM",
        description: data.description.trim(),
        scheduledDate,
        performedBy: data.performedBy || null,
        cost: data.cost ?? null,
        notes: data.notes || null,
        status: data.status || "SCHEDULED",
      },
      include: { equipment: true },
    });

    // Met à jour le prochain entretien et éventuellement le statut
    await db.equipment.update({
      where: { id: data.equipmentId },
      data: {
        nextMaintenanceDate: scheduledDate,
        status: data.type === "EMERGENCY" || data.type === "CORRECTIVE" ? "MAINTENANCE" : equipment.status,
      },
    });

    return res.status(201).json({ data: created, error: null });
  } catch (error) {
    console.error("createMaintenance error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la création de la maintenance" });
  }
}

export async function getMaintenance(req: Request, res: Response) {
  try {
    const { equipmentId, status, type, hospitalId, page = "1", limit = "50" } = req.query;
    const where: Record<string, unknown> = {};

    if (equipmentId) where.equipmentId = String(equipmentId);
    if (status) where.status = String(status);
    if (type) where.type = String(type);
    if (hospitalId) {
      where.equipment = { hospitalId: String(hospitalId) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      db.maintenanceRecord.findMany({
        where,
        include: { equipment: true },
        orderBy: { scheduledDate: "desc" },
        skip,
        take: Number(limit),
      }),
      db.maintenanceRecord.count({ where }),
    ]);

    return res.status(200).json({
      data: {
        records,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)) || 1,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("getMaintenance error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la récupération des maintenances" });
  }
}

export async function getMaintenanceById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const record = await db.maintenanceRecord.findUnique({
      where: { id },
      include: { equipment: true },
    });

    if (!record) {
      return res.status(404).json({ data: null, error: "Maintenance introuvable" });
    }

    return res.status(200).json({ data: record, error: null });
  } catch (error) {
    console.error("getMaintenanceById error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la récupération de la maintenance" });
  }
}

export async function updateMaintenance(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = req.body as Partial<MaintenanceBody>;

    const existing = await db.maintenanceRecord.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Maintenance introuvable" });
    }

    const updated = await db.maintenanceRecord.update({
      where: { id },
      data: {
        type: data.type !== undefined ? data.type : undefined,
        priority: data.priority !== undefined ? data.priority : undefined,
        description: data.description !== undefined ? data.description.trim() : undefined,
        scheduledDate: data.scheduledDate !== undefined ? toDate(data.scheduledDate) ?? undefined : undefined,
        completedDate: data.completedDate !== undefined ? toDate(data.completedDate) : undefined,
        performedBy: data.performedBy !== undefined ? data.performedBy || null : undefined,
        cost: data.cost !== undefined ? data.cost : undefined,
        notes: data.notes !== undefined ? data.notes || null : undefined,
        status: data.status !== undefined ? data.status || undefined : undefined,
      },
      include: { equipment: true },
    });

    return res.status(200).json({ data: updated, error: null });
  } catch (error) {
    console.error("updateMaintenance error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la mise à jour de la maintenance" });
  }
}

export async function completeMaintenance(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { notes, cost, performedBy } = req.body as {
      notes?: string;
      cost?: number;
      performedBy?: string;
    };

    const existing = await db.maintenanceRecord.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Maintenance introuvable" });
    }

    const completedDate = new Date();
    const updated = await db.maintenanceRecord.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedDate,
        notes: notes !== undefined ? notes : existing.notes,
        cost: cost !== undefined ? cost : existing.cost,
        performedBy: performedBy !== undefined ? performedBy : existing.performedBy,
      },
      include: { equipment: true },
    });

    await db.equipment.update({
      where: { id: existing.equipmentId },
      data: {
        lastMaintenanceDate: completedDate,
        status: "OPERATIONAL",
      },
    });

    return res.status(200).json({ data: updated, error: null });
  } catch (error) {
    console.error("completeMaintenance error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la clôture de la maintenance" });
  }
}

export async function deleteMaintenance(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await db.maintenanceRecord.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Maintenance introuvable" });
    }

    await db.maintenanceRecord.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteMaintenance error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la suppression de la maintenance" });
  }
}
