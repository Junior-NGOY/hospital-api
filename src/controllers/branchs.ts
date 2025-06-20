import { db } from "@/db/db";
import { Request, Response } from "express";
import { TypedRequestBody } from "@/types";

// ==================== FONCTIONS POUR LES BRANCHES ====================

interface CreateBranchProps {
  hospitalId: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  phone: string;
  email?: string;
  isMainBranch?: boolean;
}

/**
 * Crée une nouvelle branche/antenne d'hôpital
 */
export async function createBranch(
  req: TypedRequestBody<CreateBranchProps>,
  res: Response
) {  const {
    hospitalId,
    name,
    address,
    city,
    state,
    country,
    postalCode,
    phone,
    email,
    isMainBranch
  } = req.body;

  try {
    // Vérifier si l'hôpital existe
    const hospital = await db.hospital.findUnique({
      where: { id: hospitalId }
    });

    if (!hospital) {
      return res.status(404).json({
        data: null,
        error: "Hôpital non trouvé"
      });    }

    // Si cette branche est définie comme principale, mettre à jour les autres branches
    if (isMainBranch) {
      await db.hospitalBranch.updateMany({
        where: {
          hospitalId,
          isMainBranch: true
        },
        data: {
          isMainBranch: false
        }
      });
    }

    // Créer la nouvelle branche
    const newBranch = await db.hospitalBranch.create({
      data: {
        hospitalId,
        name,
        address,
        city,
        state,
        country,
        postalCode,
        phone,
        email,
        isMainBranch: isMainBranch || false
      }
    });

    return res.status(201).json({
      data: newBranch,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la création de la branche"
    });
  }
}

/**
 * Récupère toutes les branches d'un hôpital
 */
export async function getBranchesByHospital(req: Request, res: Response) {
  const { hospitalId } = req.params;

  try {
    // Vérifier si l'hôpital existe
    const hospital = await db.hospital.findUnique({
      where: { id: hospitalId }
    });

    if (!hospital) {
      return res.status(404).json({
        data: null,
        error: "Hôpital non trouvé"
      });
    }

    // Récupérer les branches
    const branches = await db.hospitalBranch.findMany({
      where: { hospitalId },
      orderBy: [
        { isMainBranch: "desc" },
        { name: "asc" }
      ],
      include: {
        _count: {
          select: {
            departments: true,
            users: true
          }
        }
      }
    });

    return res.status(200).json({
      data: branches,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération des branches"
    });
  }
}

/**
 * Récupère une branche par son ID
 */
export async function getBranchById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const branch = await db.hospitalBranch.findUnique({
      where: { id },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        departments: true,
        _count: {
          select: {
            users: true,
            consultations: true,
            appointments: true,
            admissions: true
          }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({
        data: null,
        error: "Branche non trouvée"
      });
    }

    return res.status(200).json({
      data: branch,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération de la branche"
    });
  }
}

/**
 * Met à jour une branche
 */
export async function updateBranch(req: Request, res: Response) {
  const { id } = req.params;
  const {
    name,
    address,
    city,
    state,
    country,
    postalCode,
    phone,
    email,
    isMainBranch
  } = req.body;

  try {
    // Vérifier si la branche existe
    const branch = await db.hospitalBranch.findUnique({
      where: { id }
    });

    if (!branch) {
      return res.status(404).json({
        data: null,
        error: "Branche non trouvée"
      });    }

    // Si cette branche est définie comme principale, mettre à jour les autres branches
    if (isMainBranch) {
      await db.hospitalBranch.updateMany({
        where: {
          hospitalId: branch.hospitalId,
          isMainBranch: true,
          id: { not: id }
        },
        data: {
          isMainBranch: false
        }
      });
    }    // Mettre à jour la branche
    const updatedBranch = await db.hospitalBranch.update({
      where: { id },
      data: {
        name: name || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
        postalCode: postalCode || undefined,
        phone: phone || undefined,
        email: email || undefined,
        isMainBranch: isMainBranch !== undefined ? isMainBranch : undefined
      }
    });

    return res.status(200).json({
      data: updatedBranch,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la mise à jour de la branche"
    });
  }
}

/**
 * Supprime une branche
 */
export async function deleteBranch(req: Request, res: Response) {
  const { id } = req.params;

  try {
    // Vérifier si la branche existe
    const branch = await db.hospitalBranch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            departments: true,
            users: true,
            consultations: true,
            appointments: true,
            admissions: true
          }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({
        data: null,
        error: "Branche non trouvée"
      });
    }

    // Vérifier s'il y a des entités liées
    if (
      branch._count.departments > 0 ||
      branch._count.users > 0 ||
      branch._count.consultations > 0 ||
      branch._count.appointments > 0 ||
      branch._count.admissions > 0
    ) {
      return res.status(400).json({
        data: null,
        error: "Impossible de supprimer cette branche car elle contient des départements, des utilisateurs ou des données médicales"
      });
    }

    // Supprimer la branche
    await db.hospitalBranch.delete({
      where: { id }
    });

    return res.status(200).json({
      data: { id },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la suppression de la branche"
    });
  }
}

