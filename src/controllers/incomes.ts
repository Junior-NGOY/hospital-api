import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { jsonError, jsonOk, resolveHospitalScope } from "@/utils/hospitalScope";
import { parseCurrency, parseDate, roundMoney } from "@/utils/financeMoney";
import { Prisma } from "@prisma/client";
import { Response } from "express";

function serializeIncome(row: {
  id: string;
  hospitalId: string;
  branchId: string | null;
  amount: number;
  currency: string;
  source: string;
  category: string | null;
  date: Date;
  notes: string | null;
  paymentMethod: string | null;
  status: string | null;
  invoiceId: string | null;
}) {
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    branchId: row.branchId || undefined,
    amount: row.amount,
    currency: row.currency || "CDF",
    source: row.source,
    category: row.category || "AUTRES",
    description: row.notes || undefined,
    date: row.date,
    paymentMethod: row.paymentMethod || undefined,
    status: row.status || "RECEIVED",
    invoiceId: row.invoiceId || undefined,
    createdAt: row.date,
    updatedAt: row.date,
  };
}

export async function getIncomes(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);

    const where: Prisma.IncomeWhereInput = { hospitalId };
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (category && category !== "ALL") where.category = category;
    if (status && status !== "ALL") where.status = status;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const incomes = await db.income.findMany({
      where,
      orderBy: { date: "desc" },
    });
    return jsonOk(res, incomes.map(serializeIncome));
  } catch (error) {
    console.error("getIncomes", error);
    return jsonError(res, 500, "Impossible de récupérer les revenus");
  }
}

export async function getIncomeById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const income = await db.income.findUnique({ where: { id: req.params.id } });
    if (!income) return jsonError(res, 404, "Revenu introuvable");
    if (!hospitalId || income.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    return jsonOk(res, serializeIncome(income));
  } catch (error) {
    console.error("getIncomeById", error);
    return jsonError(res, 500, "Impossible de récupérer le revenu");
  }
}

export async function createIncome(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const { hospitalId, branchId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 400, "Aucun hôpital associé au compte.");
    }
    const amount = roundMoney(Number(body.amount));
    const source = typeof body.source === "string" ? body.source.trim() : "";
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError(res, 400, "Le montant doit être positif");
    }
    if (source.length < 2) return jsonError(res, 400, "La source est requise");

    const income = await db.income.create({
      data: {
        hospitalId,
        branchId: branchId || null,
        amount,
        currency: parseCurrency(body.currency),
        source,
        category: typeof body.category === "string" ? body.category : "AUTRES",
        date: parseDate(body.date) || new Date(),
        notes:
          typeof body.description === "string"
            ? body.description.trim() || null
            : typeof body.notes === "string"
              ? body.notes.trim() || null
              : null,
        paymentMethod:
          typeof body.paymentMethod === "string" ? body.paymentMethod : "ESPECES",
        status: typeof body.status === "string" ? body.status : "RECEIVED",
      },
    });
    return jsonOk(res, serializeIncome(income), 201);
  } catch (error) {
    console.error("createIncome", error);
    return jsonError(res, 500, "Impossible de créer le revenu");
  }
}

export async function updateIncome(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const existing = await db.income.findUnique({ where: { id: req.params.id } });
    if (!existing) return jsonError(res, 404, "Revenu introuvable");
    if (!hospitalId || existing.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const data: Prisma.IncomeUpdateInput = {};
    if (body.amount !== undefined) {
      const amount = roundMoney(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonError(res, 400, "Le montant doit être positif");
      }
      data.amount = amount;
    }
    if (body.source !== undefined) data.source = String(body.source).trim();
    if (body.category !== undefined) data.category = String(body.category);
    if (body.currency !== undefined) data.currency = parseCurrency(body.currency, existing.currency);
    if (body.date !== undefined) data.date = parseDate(body.date) || existing.date;
    if (body.description !== undefined || body.notes !== undefined) {
      const notes = body.description ?? body.notes;
      data.notes = typeof notes === "string" ? notes.trim() || null : null;
    }
    if (body.paymentMethod !== undefined) data.paymentMethod = String(body.paymentMethod);
    if (body.status !== undefined) data.status = String(body.status);

    const income = await db.income.update({ where: { id: existing.id }, data });
    return jsonOk(res, serializeIncome(income));
  } catch (error) {
    console.error("updateIncome", error);
    return jsonError(res, 500, "Impossible de modifier le revenu");
  }
}

export async function deleteIncome(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const existing = await db.income.findUnique({ where: { id: req.params.id } });
    if (!existing) return jsonError(res, 404, "Revenu introuvable");
    if (!hospitalId || existing.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    await db.income.delete({ where: { id: existing.id } });
    return jsonOk(res, { id: existing.id });
  } catch (error) {
    console.error("deleteIncome", error);
    return jsonError(res, 500, "Impossible de supprimer le revenu");
  }
}
