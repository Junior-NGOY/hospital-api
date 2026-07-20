import { db } from "@/db/db";
import { Request, Response } from "express";

type EquipmentBody = {
  hospitalId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  roomId?: string | null;
  name: string;
  model?: string | null;
  brand?: string | null;
  type?: string | null;
  serialNumber?: string | null;
  status?: string | null;
  purchaseDate?: string | Date | null;
  warrantyEndDate?: string | Date | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  location?: string | null;
  department?: string | null;
  departmentName?: string | null;
  description?: string | null;
  specifications?: string | null;
  responsibleUserId?: string | null;
  responsiblePersonId?: string | null;
  lastMaintenanceDate?: string | Date | null;
  nextMaintenanceDate?: string | Date | null;
  notes?: string | null;
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapEquipment(eq: any) {
  return {
    ...eq,
    department: eq.departmentName ?? eq.department?.name ?? null,
    responsiblePersonId: eq.responsibleUserId ?? null,
  };
}

export async function createEquipment(req: Request, res: Response) {
  try {
    const data = req.body as EquipmentBody;

    if (!data.name?.trim()) {
      return res.status(400).json({ data: null, error: "Le nom de l'équipement est requis" });
    }

    const created = await db.equipment.create({
      data: {
        name: data.name.trim(),
        hospitalId: data.hospitalId || null,
        branchId: data.branchId || null,
        departmentId: data.departmentId || null,
        roomId: data.roomId || null,
        model: data.model || null,
        brand: data.brand || null,
        type: data.type || null,
        serialNumber: data.serialNumber || null,
        status: data.status || "OPERATIONAL",
        purchaseDate: toDate(data.purchaseDate),
        warrantyEndDate: toDate(data.warrantyEndDate),
        purchasePrice: data.purchasePrice ?? null,
        currentValue: data.currentValue ?? data.purchasePrice ?? null,
        location: data.location || null,
        departmentName: data.departmentName || data.department || null,
        description: data.description || null,
        specifications: data.specifications || null,
        responsibleUserId: data.responsibleUserId || data.responsiblePersonId || null,
        lastMaintenanceDate: toDate(data.lastMaintenanceDate),
        nextMaintenanceDate: toDate(data.nextMaintenanceDate),
        notes: data.notes || null,
      },
      include: {
        department: true,
        hospital: true,
        branch: true,
      },
    });

    return res.status(201).json({ data: mapEquipment(created), error: null });
  } catch (error) {
    console.error("createEquipment error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la création de l'équipement" });
  }
}

export async function getEquipment(req: Request, res: Response) {
  try {
    const {
      hospitalId,
      branchId,
      departmentId,
      type,
      status,
      location,
      search,
      page = "1",
      limit = "50",
    } = req.query;

    const where: Record<string, unknown> = {};
    if (hospitalId) where.hospitalId = String(hospitalId);
    if (branchId) where.branchId = String(branchId);
    if (departmentId) where.departmentId = String(departmentId);
    if (type) where.type = String(type);
    if (status) where.status = String(status);
    if (location) where.location = String(location);
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { model: { contains: String(search), mode: "insensitive" } },
        { brand: { contains: String(search), mode: "insensitive" } },
        { serialNumber: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      db.equipment.findMany({
        where,
        include: { department: true, hospital: true, branch: true },
        orderBy: { updatedAt: "desc" },
        skip,
        take: Number(limit),
      }),
      db.equipment.count({ where }),
    ]);

    return res.status(200).json({
      data: {
        equipment: items.map(mapEquipment),
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
    console.error("getEquipment error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la récupération des équipements" });
  }
}

export async function getEquipmentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const item = await db.equipment.findUnique({
      where: { id },
      include: {
        department: true,
        hospital: true,
        branch: true,
        maintenanceRecords: { orderBy: { scheduledDate: "desc" }, take: 20 },
      },
    });

    if (!item) {
      return res.status(404).json({ data: null, error: "Équipement introuvable" });
    }

    return res.status(200).json({ data: mapEquipment(item), error: null });
  } catch (error) {
    console.error("getEquipmentById error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la récupération de l'équipement" });
  }
}

export async function updateEquipment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = req.body as EquipmentBody;

    const existing = await db.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Équipement introuvable" });
    }

    const updated = await db.equipment.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        hospitalId: data.hospitalId !== undefined ? data.hospitalId || null : undefined,
        branchId: data.branchId !== undefined ? data.branchId || null : undefined,
        departmentId: data.departmentId !== undefined ? data.departmentId || null : undefined,
        roomId: data.roomId !== undefined ? data.roomId || null : undefined,
        model: data.model !== undefined ? data.model || null : undefined,
        brand: data.brand !== undefined ? data.brand || null : undefined,
        type: data.type !== undefined ? data.type || null : undefined,
        serialNumber: data.serialNumber !== undefined ? data.serialNumber || null : undefined,
        status: data.status !== undefined ? data.status || null : undefined,
        purchaseDate: data.purchaseDate !== undefined ? toDate(data.purchaseDate) : undefined,
        warrantyEndDate: data.warrantyEndDate !== undefined ? toDate(data.warrantyEndDate) : undefined,
        purchasePrice: data.purchasePrice !== undefined ? data.purchasePrice : undefined,
        currentValue: data.currentValue !== undefined ? data.currentValue : undefined,
        location: data.location !== undefined ? data.location || null : undefined,
        departmentName:
          data.departmentName !== undefined || data.department !== undefined
            ? data.departmentName || data.department || null
            : undefined,
        description: data.description !== undefined ? data.description || null : undefined,
        specifications: data.specifications !== undefined ? data.specifications || null : undefined,
        responsibleUserId:
          data.responsibleUserId !== undefined || data.responsiblePersonId !== undefined
            ? data.responsibleUserId || data.responsiblePersonId || null
            : undefined,
        lastMaintenanceDate:
          data.lastMaintenanceDate !== undefined ? toDate(data.lastMaintenanceDate) : undefined,
        nextMaintenanceDate:
          data.nextMaintenanceDate !== undefined ? toDate(data.nextMaintenanceDate) : undefined,
        notes: data.notes !== undefined ? data.notes || null : undefined,
      },
      include: { department: true, hospital: true, branch: true },
    });

    return res.status(200).json({ data: mapEquipment(updated), error: null });
  } catch (error) {
    console.error("updateEquipment error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la mise à jour de l'équipement" });
  }
}

export async function deleteEquipment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await db.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Équipement introuvable" });
    }

    await db.equipment.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteEquipment error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la suppression de l'équipement" });
  }
}

export async function updateEquipmentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body as { status?: string; notes?: string };

    if (!status) {
      return res.status(400).json({ data: null, error: "Le statut est requis" });
    }

    const existing = await db.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Équipement introuvable" });
    }

    const updated = await db.equipment.update({
      where: { id },
      data: {
        status,
        notes: notes !== undefined ? notes : undefined,
      },
      include: { department: true, hospital: true, branch: true },
    });

    return res.status(200).json({ data: mapEquipment(updated), error: null });
  } catch (error) {
    console.error("updateEquipmentStatus error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la mise à jour du statut" });
  }
}

export async function getEquipmentSummary(req: Request, res: Response) {
  try {
    const { hospitalId, branchId } = req.query;
    const where: Record<string, unknown> = {};
    if (hospitalId) where.hospitalId = String(hospitalId);
    if (branchId) where.branchId = String(branchId);

    const items = await db.equipment.findMany({ where });
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const byTypeMap = new Map<string, { count: number; operationalCount: number }>();
    const byDeptMap = new Map<string, { count: number; operationalCount: number }>();

    for (const eq of items) {
      const type = eq.type || "OTHER";
      const dept = eq.departmentName || "OTHER";
      const t = byTypeMap.get(type) || { count: 0, operationalCount: 0 };
      t.count += 1;
      if (eq.status === "OPERATIONAL") t.operationalCount += 1;
      byTypeMap.set(type, t);

      const d = byDeptMap.get(dept) || { count: 0, operationalCount: 0 };
      d.count += 1;
      if (eq.status === "OPERATIONAL") d.operationalCount += 1;
      byDeptMap.set(dept, d);
    }

    const summary = {
      totalEquipment: items.length,
      operationalCount: items.filter((e) => e.status === "OPERATIONAL").length,
      maintenanceCount: items.filter((e) => e.status === "MAINTENANCE").length,
      outOfOrderCount: items.filter((e) => e.status === "OUT_OF_ORDER").length,
      retiredCount: items.filter((e) => e.status === "RETIRED").length,
      upcomingMaintenanceCount: items.filter(
        (e) => e.nextMaintenanceDate && e.nextMaintenanceDate >= now && e.nextMaintenanceDate <= in30Days
      ).length,
      expiredWarrantyCount: items.filter(
        (e) => e.warrantyEndDate && e.warrantyEndDate < now
      ).length,
      totalValue: items.reduce((sum, e) => sum + (e.currentValue ?? e.purchasePrice ?? 0), 0),
      byType: Array.from(byTypeMap.entries()).map(([type, v]) => ({
        type,
        count: v.count,
        operationalCount: v.operationalCount,
      })),
      byDepartment: Array.from(byDeptMap.entries()).map(([department, v]) => ({
        department,
        count: v.count,
        operationalRate: v.count > 0 ? Math.round((v.operationalCount / v.count) * 100) : 0,
      })),
    };

    return res.status(200).json({ data: summary, error: null });
  } catch (error) {
    console.error("getEquipmentSummary error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors du calcul du résumé" });
  }
}
