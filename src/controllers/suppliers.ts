import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import {
  jsonError,
  jsonOk,
  requireHospitalForWrite,
  resolveHospitalScope,
} from "@/utils/hospitalScope";
import { Prisma } from "@prisma/client";
import { Response } from "express";

const supplierInclude = {
  medications: { select: { id: true, name: true, form: true, stock: true } },
  _count: { select: { medications: true, inventoryItems: true } },
} satisfies Prisma.SupplierInclude;

function serializeSupplier(
  supplier: Prisma.SupplierGetPayload<{ include: typeof supplierInclude }>
) {
  return {
    id: supplier.id,
    hospitalId: supplier.hospitalId,
    name: supplier.name,
    contactPerson: supplier.contactPerson || "",
    phone: supplier.phone || "",
    email: supplier.email || "",
    address: supplier.address || "",
    website: supplier.website || "",
    notes: supplier.notes || "",
    paymentTerms: supplier.paymentTerms,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    medications: supplier.medications,
  };
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim();
  return s || null;
}

export async function getSuppliers(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);
    const activeOnly = req.query.active === "true";
    const suppliers = await db.supplier.findMany({
      where: {
        hospitalId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: supplierInclude,
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(res, suppliers.map(serializeSupplier));
  } catch (error) {
    console.error("getSuppliers", error);
    return jsonError(res, 500, "Impossible de récupérer les fournisseurs");
  }
}

export async function getSupplierById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonError(res, 403, "Accès refusé");
    const supplier = await db.supplier.findFirst({
      where: { id: req.params.id, hospitalId },
      include: supplierInclude,
    });
    if (!supplier) {
      return jsonError(res, 404, "Fournisseur introuvable");
    }
    return jsonOk(res, serializeSupplier(supplier));
  } catch (error) {
    console.error("getSupplierById", error);
    return jsonError(res, 500, "Impossible de récupérer le fournisseur");
  }
}

export async function createSupplier(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const body = req.body as Record<string, unknown>;
    const name = String(body.name || "").trim();
    if (name.length < 2) {
      return jsonError(res, 400, "Le nom du fournisseur est requis");
    }

    const duplicate = await db.supplier.findFirst({
      where: {
        hospitalId: scope.hospitalId,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return jsonError(res, 400, "Un fournisseur avec ce nom existe déjà");
    }

    const created = await db.supplier.create({
      data: {
        hospitalId: scope.hospitalId,
        name,
        contactPerson: optionalString(body.contactPerson) ?? null,
        phone: optionalString(body.phone) ?? null,
        email: optionalString(body.email) ?? null,
        address: optionalString(body.address) ?? null,
        website: optionalString(body.website) ?? null,
        notes: optionalString(body.notes) ?? null,
        paymentTerms:
          body.paymentTerms !== undefined && body.paymentTerms !== null
            ? Number(body.paymentTerms) || null
            : null,
        isActive: true,
      },
      include: supplierInclude,
    });
    return jsonOk(res, serializeSupplier(created), 201);
  } catch (error) {
    console.error("createSupplier", error);
    return jsonError(res, 500, "Erreur lors de la création du fournisseur");
  }
}

export async function updateSupplier(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const existing = await db.supplier.findFirst({
      where: { id: req.params.id, hospitalId: scope.hospitalId },
    });
    if (!existing) {
      return jsonError(res, 404, "Fournisseur introuvable");
    }

    const body = req.body as Record<string, unknown>;
    const data: Prisma.SupplierUpdateInput = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2) {
        return jsonError(res, 400, "Le nom du fournisseur est requis");
      }
      data.name = name;
    }
    if (body.contactPerson !== undefined) data.contactPerson = optionalString(body.contactPerson);
    if (body.phone !== undefined) data.phone = optionalString(body.phone);
    if (body.email !== undefined) data.email = optionalString(body.email);
    if (body.address !== undefined) data.address = optionalString(body.address);
    if (body.website !== undefined) data.website = optionalString(body.website);
    if (body.notes !== undefined) data.notes = optionalString(body.notes);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.paymentTerms !== undefined) {
      data.paymentTerms =
        body.paymentTerms === null ? null : Number(body.paymentTerms) || null;
    }

    const updated = await db.supplier.update({
      where: { id: existing.id },
      data,
      include: supplierInclude,
    });
    return jsonOk(res, serializeSupplier(updated));
  } catch (error) {
    console.error("updateSupplier", error);
    return jsonError(res, 500, "Erreur lors de la mise à jour du fournisseur");
  }
}

export async function toggleSupplierStatus(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const existing = await db.supplier.findFirst({
      where: { id: req.params.id, hospitalId: scope.hospitalId },
    });
    if (!existing) {
      return jsonError(res, 404, "Fournisseur introuvable");
    }
    const updated = await db.supplier.update({
      where: { id: existing.id },
      data: { isActive: !existing.isActive },
      include: supplierInclude,
    });
    return jsonOk(res, serializeSupplier(updated));
  } catch (error) {
    console.error("toggleSupplierStatus", error);
    return jsonError(res, 500, "Erreur lors du changement de statut");
  }
}

export async function deleteSupplier(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const existing = await db.supplier.findFirst({
      where: { id: req.params.id, hospitalId: scope.hospitalId },
      include: { medications: true, inventoryItems: true },
    });
    if (!existing) {
      return jsonError(res, 404, "Fournisseur introuvable");
    }
    if (existing.medications.length > 0 || existing.inventoryItems.length > 0) {
      return jsonError(
        res,
        400,
        "Impossible de supprimer ce fournisseur : des médicaments ou lots y sont liés. Désactivez-le plutôt."
      );
    }
    await db.supplier.delete({ where: { id: existing.id } });
    return jsonOk(res, "Fournisseur supprimé avec succès");
  } catch (error) {
    console.error("deleteSupplier", error);
    return jsonError(res, 500, "Erreur lors de la suppression du fournisseur");
  }
}
