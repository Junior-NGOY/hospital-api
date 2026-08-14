import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { jsonError, jsonOk, resolveHospitalScope } from "@/utils/hospitalScope";
import {
  parseCurrency,
  parseDate,
  parsePaymentMethod,
  roundMoney,
  toUiOperator,
  toUiPaymentMethod,
} from "@/utils/financeMoney";
import { Prisma } from "@prisma/client";
import { Response } from "express";

function serializeCashPayment(row: {
  id: string;
  hospitalId: string | null;
  invoiceId: string | null;
  amount: number;
  currency: string;
  paymentDate: Date;
  method: Parameters<typeof toUiPaymentMethod>[0];
  reference: string | null;
  notes: string | null;
  invoice?: { invoiceNumber: string } | null;
}) {
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice?.invoiceNumber,
    amount: row.amount,
    currency: row.currency || "CDF",
    paymentDate: row.paymentDate,
    paymentMethod: toUiPaymentMethod(row.method),
    operator: toUiOperator(row.method),
    reference: row.reference,
    notes: row.notes,
  };
}

export async function getPayments(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);

    const payments = await db.payment.findMany({
      where: { hospitalId, invoiceId: { not: null } },
      orderBy: { paymentDate: "desc" },
      include: { invoice: { select: { invoiceNumber: true } } },
    });
    return jsonOk(res, payments.map(serializeCashPayment));
  } catch (error) {
    console.error("getPayments", error);
    return jsonError(res, 500, "Impossible de récupérer les paiements");
  }
}

function serializeStaffPayment(row: {
  id: string;
  hospitalId: string | null;
  userId: string | null;
  amount: number;
  currency: string;
  paymentDate: Date;
  method: Parameters<typeof toUiPaymentMethod>[0];
  reference: string | null;
  notes: string | null;
  status: string | null;
  category: string | null;
  period: string | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
}) {
  return {
    id: row.id,
    hospitalId: row.hospitalId || "",
    staffId: row.userId || "",
    amount: row.amount,
    currency: row.currency || "CDF",
    paymentType: row.category || "SALARY",
    paymentMethod: toUiPaymentMethod(row.method) || "VIREMENT",
    period: row.period || "",
    description: row.notes || undefined,
    status: row.status || "PAID",
    createdAt: row.paymentDate,
    updatedAt: row.paymentDate,
    staff: row.user
      ? {
          firstName: row.user.firstName,
          lastName: row.user.lastName,
          email: row.user.email,
          role: row.user.role,
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          role: "",
        },
  };
}

export async function getStaffPayments(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);

    const where: Prisma.PaymentWhereInput = {
      hospitalId,
      invoiceId: null,
      userId: { not: null },
    };
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const staffId = typeof req.query.staffId === "string" ? req.query.staffId : undefined;
    if (status && status !== "ALL") where.status = status;
    if (staffId) where.userId = staffId;

    const payments = await db.payment.findMany({
      where,
      orderBy: { paymentDate: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, role: true } },
      },
    });
    return jsonOk(res, payments.map(serializeStaffPayment));
  } catch (error) {
    console.error("getStaffPayments", error);
    return jsonError(res, 500, "Impossible de récupérer les paiements du personnel");
  }
}

export async function createStaffPayment(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 400, "Aucun hôpital associé au compte.");
    }

    const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
    const amount = roundMoney(Number(body.amount));
    if (!staffId) return jsonError(res, 400, "Personnel requis");
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError(res, 400, "Montant invalide");
    }

    const user = await db.user.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        hospitalId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
    if (!user) return jsonError(res, 404, "Membre du personnel introuvable");
    if (user.hospitalId !== hospitalId) return jsonError(res, 403, "Accès refusé");

    const payment = await db.payment.create({
      data: {
        userId: user.id,
        hospitalId,
        amount,
        currency: parseCurrency(body.currency),
        method: parsePaymentMethod(body.paymentMethod, "BANK_TRANSFER"),
        notes: typeof body.description === "string" ? body.description.trim() || null : null,
        status: typeof body.status === "string" ? body.status : "PENDING",
        category: typeof body.paymentType === "string" ? body.paymentType : "SALARY",
        period: typeof body.period === "string" ? body.period : null,
        paymentDate: parseDate(body.paymentDate) || new Date(),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, role: true } },
      },
    });

    return jsonOk(res, serializeStaffPayment(payment), 201);
  } catch (error) {
    console.error("createStaffPayment", error);
    return jsonError(res, 500, "Impossible de créer le paiement du personnel");
  }
}
