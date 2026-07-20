import { db } from "@/db/db";
import { Request, Response } from "express";

type VehicleBody = {
  hospitalId?: string | null;
  branchId?: string | null;
  name: string;
  type: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  licensePlate: string;
  vin?: string | null;
  fuelType?: string | null;
  capacity?: number | null;
  mileage?: number | null;
  lastServiceDate?: string | Date | null;
  nextServiceDate?: string | Date | null;
  insuranceExpiry?: string | Date | null;
  registrationExpiry?: string | Date | null;
  status?: string | null;
  location?: string | null;
  assignedDriverId?: string | null;
  purchaseDate?: string | Date | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createVehicle(req: Request, res: Response) {
  try {
    const data = req.body as VehicleBody;
    if (!data.name?.trim() || !data.licensePlate?.trim() || !data.type) {
      return res.status(400).json({
        data: null,
        error: "name, type et licensePlate sont requis",
      });
    }

    const created = await db.vehicle.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        licensePlate: data.licensePlate.trim(),
        hospitalId: data.hospitalId || null,
        branchId: data.branchId || null,
        brand: data.brand || null,
        model: data.model || null,
        year: data.year ?? null,
        vin: data.vin || null,
        fuelType: data.fuelType || null,
        capacity: data.capacity ?? null,
        mileage: data.mileage ?? null,
        lastServiceDate: toDate(data.lastServiceDate),
        nextServiceDate: toDate(data.nextServiceDate),
        insuranceExpiry: toDate(data.insuranceExpiry),
        registrationExpiry: toDate(data.registrationExpiry),
        status: data.status || "AVAILABLE",
        location: data.location || null,
        assignedDriverId: data.assignedDriverId || null,
        purchaseDate: toDate(data.purchaseDate),
        purchasePrice: data.purchasePrice ?? null,
        currentValue: data.currentValue ?? data.purchasePrice ?? null,
      },
    });

    return res.status(201).json({ data: created, error: null });
  } catch (error) {
    console.error("createVehicle error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la création du véhicule" });
  }
}

export async function getVehicles(req: Request, res: Response) {
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
        { licensePlate: { contains: String(search), mode: "insensitive" } },
        { brand: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [vehicles, total] = await Promise.all([
      db.vehicle.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: Number(limit),
      }),
      db.vehicle.count({ where }),
    ]);

    return res.status(200).json({
      data: {
        vehicles,
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
    console.error("getVehicles error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la récupération des véhicules" });
  }
}

export async function getVehicleById(req: Request, res: Response) {
  try {
    const vehicle = await db.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) {
      return res.status(404).json({ data: null, error: "Véhicule introuvable" });
    }
    return res.status(200).json({ data: vehicle, error: null });
  } catch (error) {
    console.error("getVehicleById error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la récupération du véhicule" });
  }
}

export async function updateVehicle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = req.body as Partial<VehicleBody>;
    const existing = await db.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Véhicule introuvable" });
    }

    const updated = await db.vehicle.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        type: data.type !== undefined ? data.type : undefined,
        licensePlate: data.licensePlate !== undefined ? data.licensePlate.trim() : undefined,
        hospitalId: data.hospitalId !== undefined ? data.hospitalId || null : undefined,
        branchId: data.branchId !== undefined ? data.branchId || null : undefined,
        brand: data.brand !== undefined ? data.brand || null : undefined,
        model: data.model !== undefined ? data.model || null : undefined,
        year: data.year !== undefined ? data.year : undefined,
        vin: data.vin !== undefined ? data.vin || null : undefined,
        fuelType: data.fuelType !== undefined ? data.fuelType || null : undefined,
        capacity: data.capacity !== undefined ? data.capacity : undefined,
        mileage: data.mileage !== undefined ? data.mileage : undefined,
        lastServiceDate: data.lastServiceDate !== undefined ? toDate(data.lastServiceDate) : undefined,
        nextServiceDate: data.nextServiceDate !== undefined ? toDate(data.nextServiceDate) : undefined,
        insuranceExpiry: data.insuranceExpiry !== undefined ? toDate(data.insuranceExpiry) : undefined,
        registrationExpiry:
          data.registrationExpiry !== undefined ? toDate(data.registrationExpiry) : undefined,
        status: data.status !== undefined ? data.status || null : undefined,
        location: data.location !== undefined ? data.location || null : undefined,
        assignedDriverId:
          data.assignedDriverId !== undefined ? data.assignedDriverId || null : undefined,
        purchaseDate: data.purchaseDate !== undefined ? toDate(data.purchaseDate) : undefined,
        purchasePrice: data.purchasePrice !== undefined ? data.purchasePrice : undefined,
        currentValue: data.currentValue !== undefined ? data.currentValue : undefined,
      },
    });

    return res.status(200).json({ data: updated, error: null });
  } catch (error) {
    console.error("updateVehicle error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la mise à jour du véhicule" });
  }
}

export async function deleteVehicle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await db.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Véhicule introuvable" });
    }
    await db.vehicle.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteVehicle error:", error);
    return res.status(500).json({ data: null, error: "Erreur lors de la suppression du véhicule" });
  }
}
