import { db } from "@/db/db";
import { Request, Response } from "express";
import { MedicationCreateProps, MedicationUpdateProps, TypedRequestBody } from "@/types";
//import slugify from "slugify";

/**
 * Crée un nouveau médicament
 */
export async function createMedication(
  req: TypedRequestBody<MedicationCreateProps>,
  res: Response
) {
  try {
    const data = req.body;

    // Vérifier si le médicament existe déjà
    const existingMedication = await db.medication.findFirst({
      where: {
        name: data.name,
        form: data.form
      }
    });

    if (existingMedication) {
      return res.status(400).json({
        data: null,
        error: "Un médicament avec ce nom et cette forme existe déjà"
      });
    }

    // Calculer le prix de vente si non fourni
    if (!data.sellingPrice && data.purchasePrice && data.markupPercentage) {
      data.sellingPrice = data.purchasePrice * (1 + data.markupPercentage / 100);
    }

    // Préparer les données pour la création
    const createData = {
      name: data.name,
      genericName: data.genericName,
      form: data.form,
      strength: data.strength,
      manufacturer: data.manufacturer,
      description: data.description,
      sideEffects: data.sideEffects,
      contraindications: data.contraindications,
      stock: data.stock,
      unitPrice: data.unitPrice,
      purchasePrice: data.purchasePrice,
      markupPercentage: data.markupPercentage,
      sellingPrice: data.sellingPrice,
      discountable: data.discountable,
      taxable: data.taxable,
      taxRate: data.taxRate || 0,
      ...(data.categoryId && {
        category: {
          connect: { id: data.categoryId }
        }
      })
    };    const newMedication = await db.medication.create({
      data: createData,
      include: {
        supplier: true,
        hospital: true
      }
    });

    return res.status(201).json({
      data: newMedication,
      error: null
    });

  } catch (error) {
    console.error("Error creating medication:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la création du médicament"
    });
  }
}

/**
 * Récupère tous les médicaments avec filtres optionnels
 */
export async function getMedications(req: Request, res: Response) {
  try {
    const { 
      category,
      search,
      inStock,
      sort = "name",
      order = "asc",
      page = 1,
      limit = 10
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Construction du filtre
    let where = {};
    
    if (category) {
      where = { ...where, categoryId: category };
    }

    if (search) {
      where = {
        ...where,
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { genericName: { contains: search as string, mode: 'insensitive' } }
        ]
      };
    }

    if (inStock === 'true') {
      where = { ...where, stock: { gt: 0 } };
    }

    const medications = await db.medication.findMany({
      where,
      include: {
       // category: true,
        supplier: true
      },
      orderBy: { [sort as string]: order },
      skip,
      take: Number(limit)
    });

    const total = await db.medication.count({ where });

    return res.status(200).json({
      data: {
        medications,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      },
      error: null
    });

  } catch (error) {
    console.error("Error fetching medications:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la récupération des médicaments"
    });
  }
}

/**
 * Récupère un médicament par son ID
 */
export async function getMedicationById(req: Request, res: Response) {
  try {
    const { id } = req.params;    const medication = await db.medication.findUnique({
      where: { id },
      include: {
        supplier: true,
        hospital: true,
        prescriptionMedications: {
          include: {
            prescription: {
              include: {
                patient: true,
                doctor: true
              }
            }
          }
        }
      }
    });

    if (!medication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé"
      });
    }

    return res.status(200).json({
      data: medication,
      error: null
    });

  } catch (error) {
    console.error("Error fetching medication:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la récupération du médicament"
    });
  }
}

/**
 * Met à jour un médicament
 */
export async function updateMedication(
  req: TypedRequestBody<MedicationUpdateProps>,
  res: Response
) {
  try {
    const { id } = req.params;
    const data = req.body;

    // Vérifier si le médicament existe
    const existingMedication = await db.medication.findUnique({
      where: { id }
    });

    if (!existingMedication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé"
      });
    }

    // Recalculer le prix de vente si nécessaire
    if (data.purchasePrice && data.markupPercentage) {
      data.sellingPrice = data.purchasePrice * (1 + data.markupPercentage / 100);
    }    const updatedMedication = await db.medication.update({
      where: { id },
      data,
      include: {
        supplier: true,
        hospital: true
      }
    });

    return res.status(200).json({
      data: updatedMedication,
      error: null
    });

  } catch (error) {
    console.error("Error updating medication:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la mise à jour du médicament"
    });
  }
}

/**
 * Supprime un médicament
 */
export async function deleteMedication(req: Request, res: Response) {
  try {
    const { id } = req.params;    // Vérifier si le médicament existe
    const medication = await db.medication.findUnique({
      where: { id },
      include: {
        prescriptionMedications: true,
        administrations: true
      }
    });

    if (!medication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé"
      });
    }

    // Vérifier si le médicament est utilisé
    if (medication.prescriptionMedications.length > 0 || medication.administrations.length > 0) {
      return res.status(400).json({
        data: null,
        error: "Impossible de supprimer ce médicament car il est utilisé dans des prescriptions ou administrations"
      });
    }

    await db.medication.delete({
      where: { id }
    });

    return res.status(200).json({
      data: "Médicament supprimé avec succès",
      error: null
    });

  } catch (error) {
    console.error("Error deleting medication:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de la suppression du médicament"
    });
  }
}

/**
 * Ajuste le stock d'un médicament
 */
export async function adjustMedicationStock(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    const medication = await db.medication.findUnique({
      where: { id }
    });

    if (!medication) {
      return res.status(404).json({
        data: null,
        error: "Médicament non trouvé"
      });
    }

    const updatedMedication = await db.medication.update({
      where: { id },
      data: {
        stock: {
          increment: adjustment
        }
      }
    });

    // Ici vous pourriez aussi enregistrer l'ajustement dans un historique

    return res.status(200).json({
      data: updatedMedication,
      error: null
    });

  } catch (error) {
    console.error("Error adjusting medication stock:", error);
    return res.status(500).json({
      data: null,
      error: "Erreur lors de l'ajustement du stock"
    });
  }
}
