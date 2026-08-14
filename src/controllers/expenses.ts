import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { jsonError, jsonOk, resolveHospitalScope } from "@/utils/hospitalScope";
import { parseCurrency, parseDate, roundMoney } from "@/utils/financeMoney";
import { Prisma } from "@prisma/client";
import { Response } from "express";

function serializeExpense(row: {
  id: string;
  hospitalId: string;
  branchId: string | null;
  amount: number;
  currency: string;
  category: string;
  vendor: string | null;
  date: Date;
  notes: string | null;
  paymentMethod: string | null;
  status: string | null;
}) {
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    branchId: row.branchId || undefined,
    amount: row.amount,
    currency: row.currency || "CDF",
    category: row.category,
    vendor: row.vendor || undefined,
    description: row.notes || "",
    date: row.date,
    paymentMethod: row.paymentMethod || undefined,
    status: row.status || "PAID",
    createdAt: row.date,
    updatedAt: row.date,
  };
}

export async function getExpenses(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);

    const where: Prisma.ExpenseWhereInput = { hospitalId };
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

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: "desc" },
    });
    return jsonOk(res, expenses.map(serializeExpense));
  } catch (error) {
    console.error("getExpenses", error);
    return jsonError(res, 500, "Impossible de récupérer les dépenses");
  }
}

export async function getExpenseById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const expense = await db.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) return jsonError(res, 404, "Dépense introuvable");
    if (!hospitalId || expense.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    return jsonOk(res, serializeExpense(expense));
  } catch (error) {
    console.error("getExpenseById", error);
    return jsonError(res, 500, "Impossible de récupérer la dépense");
  }
}

export async function createExpense(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const { hospitalId, branchId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 400, "Aucun hôpital associé au compte.");
    }
    const amount = roundMoney(Number(body.amount));
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : typeof body.notes === "string"
          ? body.notes.trim()
          : "";
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError(res, 400, "Le montant doit être positif");
    }
    if (!category) return jsonError(res, 400, "La catégorie est requise");
    if (description.length < 3) return jsonError(res, 400, "Description requise");

    const expense = await db.expense.create({
      data: {
        hospitalId,
        branchId: branchId || null,
        amount,
        currency: parseCurrency(body.currency),
        category,
        vendor: typeof body.vendor === "string" ? body.vendor.trim() || null : null,
        date: parseDate(body.date) || new Date(),
        notes: description,
        paymentMethod:
          typeof body.paymentMethod === "string" ? body.paymentMethod : "ESPECES",
        status: typeof body.status === "string" ? body.status : "PAID",
      },
    });
    return jsonOk(res, serializeExpense(expense), 201);
  } catch (error) {
    console.error("createExpense", error);
    return jsonError(res, 500, "Impossible de créer la dépense");
  }
}

export async function updateExpense(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const existing = await db.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return jsonError(res, 404, "Dépense introuvable");
    if (!hospitalId || existing.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const data: Prisma.ExpenseUpdateInput = {};
    if (body.amount !== undefined) {
      const amount = roundMoney(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonError(res, 400, "Le montant doit être positif");
      }
      data.amount = amount;
    }
    if (body.category !== undefined) data.category = String(body.category);
    if (body.currency !== undefined) data.currency = parseCurrency(body.currency, existing.currency);
    if (body.vendor !== undefined) {
      data.vendor = typeof body.vendor === "string" ? body.vendor.trim() || null : null;
    }
    if (body.date !== undefined) data.date = parseDate(body.date) || existing.date;
    if (body.description !== undefined || body.notes !== undefined) {
      const notes = body.description ?? body.notes;
      data.notes = typeof notes === "string" ? notes.trim() || null : null;
    }
    if (body.paymentMethod !== undefined) data.paymentMethod = String(body.paymentMethod);
    if (body.status !== undefined) data.status = String(body.status);

    const expense = await db.expense.update({ where: { id: existing.id }, data });
    return jsonOk(res, serializeExpense(expense));
  } catch (error) {
    console.error("updateExpense", error);
    return jsonError(res, 500, "Impossible de modifier la dépense");
  }
}

export async function deleteExpense(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const existing = await db.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return jsonError(res, 404, "Dépense introuvable");
    if (!hospitalId || existing.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    await db.expense.delete({ where: { id: existing.id } });
    return jsonOk(res, { id: existing.id });
  } catch (error) {
    console.error("deleteExpense", error);
    return jsonError(res, 500, "Impossible de supprimer la dépense");
  }
}
