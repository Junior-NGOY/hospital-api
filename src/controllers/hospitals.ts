import { db } from "@/db/db";
import { generateSlug } from "@/utils/generateSlug";
import { Request, Response } from "express";
import { TypedRequestBody } from "@/types";

// Interface pour la création d'un hôpital
interface CreateHospitalProps {
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
}

/**
 * Crée un nouvel hôpital
 */
export async function createHospital(
  req: TypedRequestBody<CreateHospitalProps>,
  res: Response
) {
  const {
    name,
    address,
    phoneNumber,
    email
  } = req.body;

  try {
    // Générer un slug à partir du nom
    const slug = generateSlug(name);

    // Vérifier si un hôpital avec ce slug existe déjà
    const existingHospital = await db.hospital.findUnique({
      where: {
        slug
      }
    });

    if (existingHospital) {
      return res.status(409).json({
        data: null,
        error: "Un hôpital avec ce nom existe déjà"
      });
    }

    // Créer le nouvel hôpital
    const newHospital = await db.hospital.create({
      data: {
        name,
        slug,
        address,
        phoneNumber,
        email
      }
    });

    console.log(
      `Hôpital créé avec succès: ${newHospital.name} (${newHospital.id})`
    );

    return res.status(201).json({
      data: newHospital,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la création de l'hôpital"
    });
  }
}

/**
 * Récupère tous les hôpitaux
 */
export async function getHospitals(req: Request, res: Response) {
  try {
    const hospitals = await db.hospital.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        departments: true,
        branches: true,
        _count: {
          select: {
            users: true,
            departments: true
          }
        }
      }
    });

    return res.status(200).json({
      data: hospitals,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération des hôpitaux"
    });
  }
}

/**
 * Récupère un hôpital par son ID
 */
export async function getHospitalById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const hospital = await db.hospital.findUnique({
      where: {
        id
      },
      include: {
        departments: true,
        branches: true,
        settings: true,
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!hospital) {
      return res.status(404).json({
        data: null,
        error: "Hôpital non trouvé"
      });
    }

    return res.status(200).json({
      data: hospital,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération de l'hôpital"
    });
  }
}

/**
 * Met à jour un hôpital
 */
export async function updateHospital(req: Request, res: Response) {
  const { id } = req.params;
  const {
    name,
    address,
    phoneNumber,
    email
  } = req.body;

  try {
    // Vérifier si l'hôpital existe
    const existingHospital = await db.hospital.findUnique({
      where: {
        id
      }
    });

    if (!existingHospital) {
      return res.status(404).json({
        data: null,
        error: "Hôpital non trouvé"
      });
    }

    // Si le nom est modifié, générer un nouveau slug
    let slug = existingHospital.slug;
    if (name && name !== existingHospital.name) {
      slug = generateSlug(name);
      
      // Vérifier si le nouveau slug existe déjà pour un autre hôpital
      const hospitalWithSlug = await db.hospital.findFirst({
        where: {
          slug,
          id: {
            not: id
          }
        }
      });

      if (hospitalWithSlug) {
        return res.status(409).json({
          data: null,
          error: "Un hôpital avec ce nom existe déjà"
        });
      }
    }

    // Mettre à jour l'hôpital
    const updatedHospital = await db.hospital.update({
      where: {
        id
      },
      data: {
        name: name || undefined,
        slug: slug || undefined,
        address: address || undefined,
        phoneNumber: phoneNumber || undefined,
        email: email || undefined
      }
    });

    return res.status(200).json({
      data: updatedHospital,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la mise à jour de l'hôpital"
    });
  }
}

/**
 * Supprime un hôpital
 */
export async function deleteHospital(req: Request, res: Response) {
  const { id } = req.params;

  try {
    // Vérifier si l'hôpital existe
    const existingHospital = await db.hospital.findUnique({
      where: {
        id
      }
    });

    if (!existingHospital) {
      return res.status(404).json({
        data: null,
        error: "Hôpital non trouvé"
      });
    }

    // Supprimer l'hôpital
    await db.hospital.delete({
      where: {
        id
      }
    });

    return res.status(200).json({
      data: null,
      error: null,
      message: "Hôpital supprimé avec succès"
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la suppression de l'hôpital"
    });
  }
}