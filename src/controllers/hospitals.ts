import { db } from "@/db/db";
import { generateSlug } from "@/utils/generateSlug";
import { Request, Response } from "express";
import { TypedRequestBody } from "@/types";
import { AuthRequest } from "@/middleware/auth";
import {
  jsonError,
  jsonOk,
  requireHospitalForWrite,
} from "@/utils/hospitalScope";

const HOSPITAL_SETTING_KEYS = [
  "contactPerson",
  "timezone",
  "language",
  "currency",
  "emailNotifications",
  "autoBackup",
] as const;

function hospitalInclude() {
  return {
    departments: true,
    branches: true,
    settings: true,
    _count: {
      select: {
        users: true,
        departments: true,
      },
    },
  } as const;
}

async function upsertHospitalSettings(
  hospitalId: string,
  body: Record<string, unknown>
) {
  const rows = HOSPITAL_SETTING_KEYS.filter((key) => body[key] !== undefined).map(
    (key) => {
      const raw = body[key];
      const value =
        typeof raw === "boolean" ? (raw ? "true" : "false") : String(raw ?? "");
      return { key, value };
    }
  );
  if (rows.length === 0) return;
  await Promise.all(
    rows.map((row) =>
      db.hospitalSettings.upsert({
        where: {
          hospitalId_key: {
            hospitalId,
            key: row.key,
          },
        },
        create: {
          hospitalId,
          key: row.key,
          value: row.value,
        },
        update: { value: row.value },
      })
    )
  );
}

// Interface pour la création d'un hôpital
interface CreateHospitalProps {
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
}

function prismaHospitalErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Une erreur est survenue lors de la création de l'hôpital";
  }
  const e = error as {
    code?: string;
    meta?: { target?: string | string[] };
    message?: string;
  };

  if (e.code === "P2002") {
    return "Un hôpital avec ces informations existe déjà";
  }

  const raw = typeof e.message === "string" ? e.message : "";
  if (/database_url|postgresql:\/\//i.test(raw)) {
    return "Impossible d'enregistrer l'hôpital (erreur base de données)";
  }

  const missing = raw.match(/Argument `(\w+)` is missing/);
  if (missing) {
    return `Le champ « ${missing[1]} » est requis`;
  }

  const invalid = raw.match(/Invalid value for argument `(\w+)`/);
  if (invalid) {
    return `Valeur invalide pour le champ « ${invalid[1]} »`;
  }

  return "Une erreur est survenue lors de la création de l'hôpital";
}

/**
 * Crée un nouvel hôpital (inscription SaaS publique — pas de JWT).
 */
export async function createHospital(
  req: TypedRequestBody<CreateHospitalProps>,
  res: Response
) {
  const name = req.body?.name?.trim();
  const address = req.body?.address?.trim();
  const phoneNumber = req.body?.phoneNumber?.trim();
  const email = req.body?.email?.trim() || undefined;

  try {
    if (!name || !address || !phoneNumber) {
      return res.status(400).json({
        data: null,
        error: "Le nom, l'adresse et le numéro de téléphone sont requis"
      });
    }

    const slug = generateSlug(name);
    if (!slug) {
      return res.status(400).json({
        data: null,
        error: "Le nom de l'hôpital est invalide"
      });
    }

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
      error: prismaHospitalErrorMessage(error)
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
      include: hospitalInclude()
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
 * Met à jour l'hôpital du JWT (jamais un id client type hospital_1).
 */
export async function updateHospital(req: AuthRequest, res: Response) {
  const scope = await requireHospitalForWrite(req, res);
  if (!scope) return;

  const { id } = req.params;
  if (id !== scope.hospitalId) {
    return jsonError(res, 403, "Accès refusé");
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const name =
    typeof body.name === "string" ? body.name.trim() : undefined;
  const address =
    typeof body.address === "string" ? body.address.trim() : undefined;
  const phoneNumber =
    typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : undefined;
  const email =
    typeof body.email === "string" ? body.email.trim() : undefined;

  try {
    const existingHospital = await db.hospital.findUnique({
      where: { id: scope.hospitalId },
    });

    if (!existingHospital) {
      return jsonError(res, 404, "Hôpital non trouvé");
    }

    if (name !== undefined && !name) {
      return jsonError(res, 400, "Le nom de l'hôpital est requis");
    }
    if (address !== undefined && !address) {
      return jsonError(res, 400, "L'adresse est requise");
    }
    if (phoneNumber !== undefined && !phoneNumber) {
      return jsonError(res, 400, "Le numéro de téléphone est requis");
    }

    let slug = existingHospital.slug;
    if (name && name !== existingHospital.name) {
      slug = generateSlug(name);
      if (!slug) {
        return jsonError(res, 400, "Le nom de l'hôpital est invalide");
      }

      const hospitalWithSlug = await db.hospital.findFirst({
        where: {
          slug,
          id: { not: scope.hospitalId },
        },
      });

      if (hospitalWithSlug) {
        return jsonError(res, 409, "Un hôpital avec ce nom existe déjà");
      }
    }

    await db.hospital.update({
      where: { id: scope.hospitalId },
      data: {
        name: name || undefined,
        slug: slug || undefined,
        address: address || undefined,
        phoneNumber: phoneNumber || undefined,
        email: email !== undefined ? email || null : undefined,
      },
    });

    await upsertHospitalSettings(scope.hospitalId, body);

    const updatedHospital = await db.hospital.findUnique({
      where: { id: scope.hospitalId },
      include: hospitalInclude(),
    });

    return jsonOk(res, updatedHospital);
  } catch (error) {
    console.log(error);
    return jsonError(
      res,
      500,
      "Une erreur est survenue lors de la mise à jour de l'hôpital"
    );
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