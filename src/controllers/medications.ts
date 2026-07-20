import { db } from "@/db/db";
import { Request, Response } from "express";
import { TypedRequestBody } from "@/types";

type MedicationBody = {
  name: string;
  form?: string | null;
  stock?: number | null;
  supplierId?: string | null;
  hospitalId?: string | null;
};

/**
 * Crée un nouveau médicament (aligné sur le schéma Prisma actuel)
 */
export async function createMedication(
  req: TypedRequestBody<MedicationBody>,
  res: Response
) {
  try {
    const data = req.body;

    if (!data.name?.trim()) {
      return res.status(400).json({
        data: null,
        error: "Le nom du médicament est requis",
      });
    }

    const existingMedication = await db.medication.findFirst({
      where: {
        name: data.name,
        form: data.form ?? undefined,
      },
    });

    if (existingMedication) {
      return res.status(400).json({
        data: null,
        error: "Un médicament avec ce nom et cette forme existe déjà",
      });
    }

    const newMedication = await db.medication.create({
      data: {
        name: data.name.trim(),
        form: data.form || null,
        stock: data.stock ?? 0,
        supplierId: data.supplierId || null,
        hospitalId: data.hospitalId || null,
      },
      include: {
        supplier: true,
        hospital: true,
      },
    });

    return res.status(201).json({
      data: newMedication,
      error: null,
    });
  } catch (error) {
    console.error("Error creating medication:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la création du médicament",
    });
  }
}

/**
 * Récupère tous les médicaments avec filtres optionnels
 */
export async function getMedications(req: Request, res: Response) {
  try {
    const {
      search,
      inStock,
      sort = "name",
      order = "asc",
      page = 1,
      limit = 100,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: search as string, mode: "insensitive" };
    }

    if (inStock === "true") {
      where.stock = { gt: 0 };
    }

    const allowedSort = ["name", "stock", "id"];
    const sortField = allowedSort.includes(String(sort)) ? String(sort) : "name";
    const sortOrder = order === "desc" ? "desc" : "asc";

    const medications = await db.medication.findMany({
      where,
      include: {
        supplier: true,
        hospital: true,
      },
      orderBy: { [sortField]: sortOrder },
      skip,
      take: Number(limit),
    });

    const total = await db.medication.count({ where });

    return res.status(200).json({
      data: {
        medications,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("Error fetching medications:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la récupération des médicaments",
    });
  }
}

/**
 * Récupère un médicament par son ID
 */
export async function getMedicationById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const medication = await db.medication.findUnique({
      where: { id },
      include: {
        supplier: true,
        hospital: true,
        prescriptionMedications: true,
        administrations: true,
      },
    });

    if (!medication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé",
      });
    }

    return res.status(200).json({
      data: medication,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching medication:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la récupération du médicament",
    });
  }
}

/**
 * Met à jour un médicament
 */
export async function updateMedication(
  req: TypedRequestBody<Partial<MedicationBody>>,
  res: Response
) {
  try {
    const { id } = req.params;
    const data = req.body;

    const existingMedication = await db.medication.findUnique({
      where: { id },
    });

    if (!existingMedication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé",
      });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.form !== undefined) updateData.form = data.form;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.hospitalId !== undefined) updateData.hospitalId = data.hospitalId;

    const updatedMedication = await db.medication.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        hospital: true,
      },
    });

    return res.status(200).json({
      data: updatedMedication,
      error: null,
    });
  } catch (error) {
    console.error("Error updating medication:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la mise à jour du médicament",
    });
  }
}

/**
 * Supprime un médicament
 */
export async function deleteMedication(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const medication = await db.medication.findUnique({
      where: { id },
      include: {
        prescriptionMedications: true,
        administrations: true,
      },
    });

    if (!medication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé",
      });
    }

    if (
      medication.prescriptionMedications.length > 0 ||
      medication.administrations.length > 0
    ) {
      return res.status(400).json({
        data: null,
        error:
          "Impossible de supprimer ce médicament car il est utilisé dans des prescriptions ou administrations",
      });
    }

    await db.medication.delete({
      where: { id },
    });

    return res.status(200).json({
      data: "Médicament supprimé avec succès",
      error: null,
    });
  } catch (error) {
    console.error("Error deleting medication:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la suppression du médicament",
    });
  }
}

/**
 * Ajuste le stock d'un médicament
 */
export async function adjustMedicationStock(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { adjustment } = req.body;

    const medication = await db.medication.findUnique({
      where: { id },
    });

    if (!medication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé",
      });
    }

    const updatedMedication = await db.medication.update({
      where: { id },
      data: {
        stock: {
          increment: Number(adjustment) || 0,
        },
      },
    });

    return res.status(200).json({
      data: updatedMedication,
      error: null,
    });
  } catch (error) {
    console.error("Error adjusting medication stock:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de l'ajustement du stock",
    });
  }
}
