import { db } from "@/db/db";
import { Request, Response } from "express";

type MedicalSupplyBody = {
  hospitalId?: string | null;
  branchId?: string | null;
  name: string;
  brand?: string | null;
  type: string;
  category?: string | null;
  description?: string | null;
  unit: string;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  unitPrice?: number;
  expiryDate?: string | Date | null;
  batchNumber?: string | null;
  supplier?: string | null;
  location?: string | null;
  status?: string | null;
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function deriveStatus(currentStock: number, minStock: number, explicit?: string | null) {
  if (explicit) return explicit;
  if (currentStock <= 0) return "OUT_OF_STOCK";
  if (currentStock <= minStock) return "LOW_STOCK";
  return "IN_STOCK";
}

export async function createMedicalSupply(req: Request, res: Response) {
  try {
    const data = req.body as MedicalSupplyBody;
    if (!data.name?.trim() || !data.type || !data.unit) {
      return res.status(400).json({ data: null, error: "name, type et unit sont requis" });
    }

    // Refuse pharma overlap — orienter vers médicaments
    if (String(data.type).toUpperCase() === "PHARMACEUTICAL") {
      return res.status(400).json({
        data: null,
        error: "Les produits pharmaceutiques se gèrent dans /medications",
      });
    }

    const currentStock = data.currentStock ?? 0;
    const minStock = data.minStock ?? 0;

    const created = await db.medicalSupply.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        unit: data.unit,
        hospitalId: data.hospitalId || null,
        branchId: data.branchId || null,
        brand: data.brand || null,
        category: data.category || null,
        description: data.description || null,
        currentStock,
        minStock,
        maxStock: data.maxStock ?? 0,
        unitPrice: data.unitPrice ?? 0,
        expiryDate: toDate(data.expiryDate),
        batchNumber: data.batchNumber || null,
        supplier: data.supplier || null,
        location: data.location || null,
        status: deriveStatus(currentStock, minStock, data.status),
      },
    });

    return res.status(201).json({ data: created, error: null });
  } catch (error) {
    console.error("createMedicalSupply error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la création du consommable" });
  }
}

export async function getMedicalSupplies(req: Request, res: Response) {
  try {
    const { hospitalId, branchId, type, status, search, page = "1", limit = "50" } = req.query;
    const where: Record<string, unknown> = {};
    if (hospitalId) where.hospitalId = String(hospitalId);
    if (branchId) where.branchId = String(branchId);
    if (type) where.type = String(type);
    if (status) where.status = String(status);
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { brand: { contains: String(search), mode: "insensitive" } },
        { location: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [supplies, total] = await Promise.all([
      db.medicalSupply.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: Number(limit),
      }),
      db.medicalSupply.count({ where }),
    ]);

    return res.status(200).json({
      data: {
        supplies,
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
    console.error("getMedicalSupplies error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la récupération des consommables" });
  }
}

export async function getMedicalSupplyById(req: Request, res: Response) {
  try {
    const item = await db.medicalSupply.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ data: null, error: "Consommable introuvable" });
    }
    return res.status(200).json({ data: item, error: null });
  } catch (error) {
    console.error("getMedicalSupplyById error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la récupération du consommable" });
  }
}

export async function updateMedicalSupply(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = req.body as Partial<MedicalSupplyBody>;
    const existing = await db.medicalSupply.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Consommable introuvable" });
    }

    if (data.type && String(data.type).toUpperCase() === "PHARMACEUTICAL") {
      return res.status(400).json({
        data: null,
        error: "Les produits pharmaceutiques se gèrent dans /medications",
      });
    }

    const currentStock = data.currentStock !== undefined ? data.currentStock : existing.currentStock;
    const minStock = data.minStock !== undefined ? data.minStock : existing.minStock;

    const updated = await db.medicalSupply.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        brand: data.brand !== undefined ? data.brand || null : undefined,
        type: data.type !== undefined ? data.type : undefined,
        category: data.category !== undefined ? data.category || null : undefined,
        description: data.description !== undefined ? data.description || null : undefined,
        unit: data.unit !== undefined ? data.unit : undefined,
        currentStock: data.currentStock !== undefined ? data.currentStock : undefined,
        minStock: data.minStock !== undefined ? data.minStock : undefined,
        maxStock: data.maxStock !== undefined ? data.maxStock : undefined,
        unitPrice: data.unitPrice !== undefined ? data.unitPrice : undefined,
        expiryDate: data.expiryDate !== undefined ? toDate(data.expiryDate) : undefined,
        batchNumber: data.batchNumber !== undefined ? data.batchNumber || null : undefined,
        supplier: data.supplier !== undefined ? data.supplier || null : undefined,
        location: data.location !== undefined ? data.location || null : undefined,
        hospitalId: data.hospitalId !== undefined ? data.hospitalId || null : undefined,
        branchId: data.branchId !== undefined ? data.branchId || null : undefined,
        status: deriveStatus(currentStock, minStock, data.status),
      },
    });

    return res.status(200).json({ data: updated, error: null });
  } catch (error) {
    console.error("updateMedicalSupply error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la mise à jour du consommable" });
  }
}

export async function deleteMedicalSupply(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await db.medicalSupply.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Consommable introuvable" });
    }
    await db.medicalSupply.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteMedicalSupply error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la suppression du consommable" });
  }
}
