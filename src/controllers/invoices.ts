import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { jsonError, jsonOk, resolveHospitalScope } from "@/utils/hospitalScope";
import {
  generateInvoiceNumber,
  isMobileMoneyMethod,
  isMutuelleMethod,
  mobileMoneyLabel,
  parseCurrency,
  parseDate,
  resolveInvoicePaymentMethod,
  roundMoney,
  toUiOperator,
  toUiPaymentMethod,
} from "@/utils/financeMoney";
import { computeInvoiceShares, normalizePatientCategory } from "@/utils/mutuelle";
import { Currency, InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { Response } from "express";

const invoiceInclude = {
  patient: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      fileNumber: true,
      phone: true,
      category: true,
      insuranceName: true,
      insuranceNumber: true,
    },
  },
  items: true,
  payments: { orderBy: { paymentDate: "desc" as const } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

function patientName(patient: InvoiceWithRelations["patient"]): string {
  if (!patient) return "";
  const composed = `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
  return patient.name || composed;
}

function effectiveStatus(invoice: {
  status: InvoiceStatus;
  dueDate: Date | null;
  amountPaid: number;
  totalAmount: number;
}): InvoiceStatus {
  if (invoice.status === "CANCELLED" || invoice.status === "PAID") {
    return invoice.status;
  }
  if (invoice.dueDate && invoice.dueDate < new Date() && invoice.amountPaid < invoice.totalAmount) {
    return "OVERDUE";
  }
  return invoice.status;
}

function paidByMethod(invoice: InvoiceWithRelations, mutuelle: boolean): number {
  return roundMoney(
    invoice.payments
      .filter((payment) => isMutuelleMethod(payment.method) === mutuelle)
      .reduce((sum, payment) => sum + payment.amount, 0)
  );
}

function serializeInvoice(invoice: InvoiceWithRelations) {
  const amountPaid = invoice.amountPaid ?? 0;
  const totalAmount = invoice.totalAmount ?? 0;
  const hasSplit = (invoice.patientShare ?? 0) > 0 || (invoice.mutuelleShare ?? 0) > 0;
  const patientShare = hasSplit ? roundMoney(invoice.patientShare ?? 0) : totalAmount;
  const mutuelleShare = hasSplit ? roundMoney(invoice.mutuelleShare ?? 0) : 0;
  const mutuellePaid = paidByMethod(invoice, true);
  const patientPaid = paidByMethod(invoice, false);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    hospitalId: invoice.hospitalId,
    patientId: invoice.patientId,
    patientName: patientName(invoice.patient),
    patient: invoice.patient,
    patientCategory: invoice.patient?.category || "PRIVATE",
    insuranceName: invoice.patient?.insuranceName || null,
    insuranceNumber: invoice.patient?.insuranceNumber || null,
    dateIssued: invoice.dateIssued,
    dueDate: invoice.dueDate ?? invoice.dateIssued,
    totalAmount,
    amountPaid,
    patientShare,
    mutuelleShare,
    coveragePercent: invoice.coveragePercent ?? (totalAmount > 0 ? roundMoney((mutuelleShare / totalAmount) * 100) : 0),
    patientBalance: roundMoney(Math.max(0, patientShare - patientPaid)),
    mutuelleBalance: roundMoney(Math.max(0, mutuelleShare - mutuellePaid)),
    balance: roundMoney(Math.max(0, totalAmount - amountPaid)),
    status: effectiveStatus(invoice),
    paymentMethod: toUiPaymentMethod(invoice.paymentMethod),
    currency: invoice.currency || "CDF",
    notes: invoice.notes,
    items: invoice.items.map((item) => ({
      id: item.id,
      invoiceId: item.invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      serviceType: item.serviceType || "CONSULTATION",
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      paymentDate: payment.paymentDate,
      method: toUiPaymentMethod(payment.method),
      operator: toUiOperator(payment.method),
      category: payment.category,
      reference: payment.reference,
      notes: payment.notes,
    })),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

function parseItems(raw: unknown): Array<{
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  serviceType: string;
}> | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    serviceType: string;
  }> = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!description || !Number.isFinite(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
    items.push({
      description,
      quantity,
      unitPrice: roundMoney(unitPrice),
      totalPrice: roundMoney(quantity * unitPrice),
      serviceType: String(item.serviceType || "CONSULTATION").trim() || "CONSULTATION",
    });
  }
  return items;
}

function incomeCategoryFromItems(
  items: Array<{ serviceType: string }>
): string {
  const first = items[0]?.serviceType || "CONSULTATION";
  const map: Record<string, string> = {
    CONSULTATION: "CONSULTATION",
    LABORATOIRE: "LABORATOIRE",
    LAB_TEST: "LABORATOIRE",
    IMAGERIE: "IMAGERIE",
    IMAGING: "IMAGERIE",
    HOSPITALISATION: "HOSPITALISATION",
    HOSPITALIZATION: "HOSPITALISATION",
    PHARMACIE: "PHARMACIE",
    PHARMACY: "PHARMACIE",
    CHIRURGIE: "CHIRURGIE",
    SURGERY: "CHIRURGIE",
  };
  return map[first] || "AUTRES";
}

function parseOptionalMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalPercent(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function applyPaymentInTx(
  tx: Prisma.TransactionClient,
  params: {
    invoice: {
      id: string;
      invoiceNumber: string;
      hospitalId: string | null;
      totalAmount: number;
      amountPaid: number;
      patientShare: number;
      mutuelleShare: number;
      currency: Currency;
      items: Array<{ serviceType: string | null }>;
    };
    hospitalId: string;
    branchId: string | null;
    userId: string | null;
    amount: number;
    method: PaymentMethod;
    currency: Currency;
    reference: string | null;
    notes: string | null;
  }
) {
  const remaining = roundMoney(params.invoice.totalAmount - params.invoice.amountPaid);
  if (remaining <= 0) {
    throw Object.assign(new Error("Cette facture est déjà soldée"), { status: 409 });
  }
  if (params.amount - remaining > 0.009) {
    throw Object.assign(new Error(`Le montant dépasse le solde (${remaining})`), { status: 400 });
  }

  const mutuelle = isMutuelleMethod(params.method);
  if (mutuelle) {
    const mutuellePaid = roundMoney(
      (
        await tx.payment.aggregate({
          where: { invoiceId: params.invoice.id, method: "MUTUELLE" },
          _sum: { amount: true },
        })
      )._sum.amount || 0
    );
    const mutuelleRemaining = roundMoney(params.invoice.mutuelleShare - mutuellePaid);
    if (mutuelleRemaining <= 0) {
      throw Object.assign(new Error("La part mutuelle est déjà enregistrée"), { status: 409 });
    }
    if (params.amount - mutuelleRemaining > 0.009) {
      throw Object.assign(
        new Error(`Le montant mutuelle dépasse la part restante (${mutuelleRemaining})`),
        { status: 400 }
      );
    }
  }

  const newPaid = roundMoney(params.invoice.amountPaid + params.amount);
  const newStatus: InvoiceStatus =
    newPaid + 0.009 >= params.invoice.totalAmount ? "PAID" : "PARTIALLY_PAID";

  await tx.payment.create({
    data: {
      invoiceId: params.invoice.id,
      hospitalId: params.hospitalId,
      amount: params.amount,
      currency: params.currency,
      method: params.method,
      category: mutuelle ? "MUTUELLE" : "PATIENT",
      reference: params.reference,
      notes: params.notes,
      status: "PAID",
      userId: params.userId,
    },
  });

  await tx.income.create({
    data: {
      hospitalId: params.hospitalId,
      branchId: params.branchId,
      amount: params.amount,
      currency: params.currency,
      source: mutuelle
        ? `Prise en charge mutuelle ${params.invoice.invoiceNumber}`
        : `Facture ${params.invoice.invoiceNumber}`,
      category: incomeCategoryFromItems(
        params.invoice.items.map((item) => ({ serviceType: item.serviceType || "CONSULTATION" }))
      ),
      notes:
        params.notes ||
        (mutuelle
          ? `Part mutuelle ${params.currency}`
          : isMobileMoneyMethod(params.method)
            ? `Encaissement ${mobileMoneyLabel(params.method)} ${params.currency} (saisie manuelle)`
            : `Encaissement cash ${params.currency}`),
      paymentMethod: toUiPaymentMethod(params.method) || (mutuelle ? "MUTUELLE" : "ESPECES"),
      status: "RECEIVED",
      invoiceId: params.invoice.id,
    },
  });

  return tx.invoice.update({
    where: { id: params.invoice.id },
    data: {
      amountPaid: newPaid,
      status: newStatus,
      paymentMethod: params.method,
    },
    include: invoiceInclude,
  });
}

export async function getInvoices(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);

    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const patientId = typeof req.query.patientId === "string" ? req.query.patientId : undefined;
    const where: Prisma.InvoiceWhereInput = { hospitalId };
    if (patientId) where.patientId = patientId;
    if (status && status !== "ALL" && status !== "OVERDUE") {
      where.status = status as InvoiceStatus;
    }

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { dateIssued: "desc" },
      include: invoiceInclude,
    });

    let serialized = invoices.map(serializeInvoice);
    if (status === "OVERDUE") {
      serialized = serialized.filter((inv) => inv.status === "OVERDUE");
    }
    return jsonOk(res, serialized);
  } catch (error) {
    console.error("getInvoices", error);
    return jsonError(res, 500, "Impossible de récupérer les factures");
  }
}

export async function getInvoiceById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const invoice = await db.invoice.findUnique({
      where: { id: req.params.id },
      include: invoiceInclude,
    });
    if (!invoice) return jsonError(res, 404, "Facture introuvable");
    if (!hospitalId || invoice.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    return jsonOk(res, serializeInvoice(invoice));
  } catch (error) {
    console.error("getInvoiceById", error);
    return jsonError(res, 500, "Impossible de récupérer la facture");
  }
}

export async function createInvoice(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const { hospitalId, branchId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 400, "Aucun hôpital associé au compte. Impossible de créer une facture.");
    }

    const patientId = typeof body.patientId === "string" ? body.patientId.trim() : "";
    if (!patientId) return jsonError(res, 400, "Patient requis");

    const items = parseItems(body.items);
    if (!items) {
      return jsonError(res, 400, "Au moins un élément de facture valide est requis");
    }

    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        hospitalId: true,
        category: true,
        insuranceName: true,
        insuranceNumber: true,
        subscriptions: {
          where: { status: "ACTIVE", endDate: { gte: new Date() } },
          include: { subscriptionPlan: { select: { consultationDiscount: true } } },
          orderBy: { endDate: "desc" },
          take: 1,
        },
      },
    });
    if (!patient) return jsonError(res, 404, "Patient introuvable");
    if (patient.hospitalId !== hospitalId) return jsonError(res, 403, "Accès refusé");

    const totalAmount = roundMoney(items.reduce((sum, item) => sum + item.totalPrice, 0));
    if (totalAmount <= 0) return jsonError(res, 400, "Le montant total doit être positif");

    const dueDate = parseDate(body.dueDate) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const currency = parseCurrency(body.currency);
    const category = normalizePatientCategory(patient.category);
    const planDiscount = patient.subscriptions[0]?.subscriptionPlan?.consultationDiscount ?? null;
    const shares = computeInvoiceShares({
      totalAmount,
      category,
      coveragePercent: parseOptionalPercent(body.coveragePercent),
      mutuelleShare: parseOptionalMoney(body.mutuelleShare),
      planDiscountPercent: planDiscount,
    });
    const recordMutuelle =
      shares.mutuelleShare > 0 && body.recordMutuellePayment !== false && body.recordMutuellePayment !== "false";
    const subscriptionId = patient.subscriptions[0]?.id || null;

    let created;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        created = await db.$transaction(async (tx) => {
          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber: generateInvoiceNumber(),
              patientId,
              hospitalId,
              subscriptionId,
              dueDate,
              totalAmount,
              amountPaid: 0,
              patientShare: shares.patientShare,
              mutuelleShare: shares.mutuelleShare,
              coveragePercent: shares.coveragePercent,
              status: "PENDING",
              currency,
              notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
              items: { create: items },
            },
            include: { items: true },
          });

          if (!recordMutuelle) {
            return tx.invoice.findUniqueOrThrow({
              where: { id: invoice.id },
              include: invoiceInclude,
            });
          }

          return applyPaymentInTx(tx, {
            invoice,
            hospitalId,
            branchId: branchId || null,
            userId: req.user?.userId || null,
            amount: shares.mutuelleShare,
            method: "MUTUELLE",
            currency,
            reference: patient.insuranceNumber || null,
            notes: patient.insuranceName
              ? `Prise en charge ${patient.insuranceName}`
              : "Prise en charge mutuelle",
          });
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!created) return jsonError(res, 500, "Impossible de créer la facture");
    return jsonOk(res, serializeInvoice(created), 201);
  } catch (error) {
    console.error("createInvoice", error);
    return jsonError(res, 500, "Impossible de créer la facture");
  }
}

export async function updateInvoice(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const invoice = await db.invoice.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!invoice) return jsonError(res, 404, "Facture introuvable");
    if (!hospitalId || invoice.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    if (invoice.status === "PAID" || invoice.amountPaid > 0) {
      return jsonError(res, 409, "Impossible de modifier une facture déjà encaissée");
    }

    const data: Prisma.InvoiceUpdateInput = {};
    if (body.notes !== undefined) {
      data.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
    }
    if (body.dueDate !== undefined) data.dueDate = parseDate(body.dueDate) || null;
    if (body.currency !== undefined) data.currency = parseCurrency(body.currency, invoice.currency);

    const items = body.items !== undefined ? parseItems(body.items) : null;
    const updated = await db.$transaction(async (tx) => {
      if (items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoiceItem.createMany({
          data: items.map((item) => ({ ...item, invoiceId: invoice.id })),
        });
        data.totalAmount = roundMoney(items.reduce((sum, item) => sum + item.totalPrice, 0));
      }
      return tx.invoice.update({
        where: { id: invoice.id },
        data,
        include: invoiceInclude,
      });
    });

    return jsonOk(res, serializeInvoice(updated));
  } catch (error) {
    console.error("updateInvoice", error);
    return jsonError(res, 500, "Impossible de modifier la facture");
  }
}

export async function deleteInvoice(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const invoice = await db.invoice.findUnique({
      where: { id: req.params.id },
      select: { id: true, hospitalId: true, amountPaid: true },
    });
    if (!invoice) return jsonError(res, 404, "Facture introuvable");
    if (!hospitalId || invoice.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }
    if (invoice.amountPaid > 0) {
      return jsonError(res, 409, "Impossible de supprimer une facture déjà encaissée");
    }
    await db.invoice.delete({ where: { id: invoice.id } });
    return jsonOk(res, { id: invoice.id });
  } catch (error) {
    console.error("deleteInvoice", error);
    return jsonError(res, 500, "Impossible de supprimer la facture");
  }
}

export async function createInvoicePayment(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const { hospitalId, branchId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 400, "Aucun hôpital associé au compte.");
    }

    const amount = roundMoney(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError(res, 400, "Montant de paiement invalide");
    }

    const resolved = resolveInvoicePaymentMethod(
      body.paymentMethod ?? body.method,
      body.operator ?? body.mobileOperator
    );
    if ("error" in resolved) {
      return jsonError(res, 400, resolved.error);
    }
    const method = resolved.method;
    const reference = typeof body.reference === "string" ? body.reference.trim() || null : null;
    if (isMobileMoneyMethod(method) && (!reference || reference.length < 3)) {
      return jsonError(
        res,
        400,
        "La référence de transaction est obligatoire pour le mobile money"
      );
    }
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

    const result = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!invoice) {
        throw Object.assign(new Error("Facture introuvable"), { status: 404 });
      }
      if (invoice.hospitalId !== hospitalId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }
      if (invoice.status === "CANCELLED") {
        throw Object.assign(new Error("Facture annulée"), { status: 409 });
      }

      const currency = parseCurrency(body.currency, invoice.currency);
      if (currency !== invoice.currency) {
        throw Object.assign(
          new Error(`Le paiement doit être en ${invoice.currency}`),
          { status: 400 }
        );
      }

      return applyPaymentInTx(tx, {
        invoice,
        hospitalId,
        branchId: branchId || null,
        userId: req.user?.userId || null,
        amount,
        method,
        currency,
        reference,
        notes,
      });
    });

    return jsonOk(res, serializeInvoice(result), 201);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status) {
      return jsonError(res, status, (error as Error).message);
    }
    console.error("createInvoicePayment", error);
    return jsonError(res, 500, "Impossible d'enregistrer le paiement");
  }
}

export async function getFinanceSummary(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const from = parseDate(req.query.from) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = parseDate(req.query.to) || new Date();
    to.setHours(23, 59, 59, 999);

    const emptyCurrency = { totalRevenue: 0, totalExpenses: 0, netProfit: 0, totalPayroll: 0 };
    if (!hospitalId) {
      return jsonOk(res, {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        pendingInvoices: 0,
        overdueInvoices: 0,
        totalPayroll: 0,
        byCurrency: { CDF: emptyCurrency, USD: emptyCurrency },
        period: { from, to },
      });
    }

    const [incomes, expenses, invoices] = await Promise.all([
      db.income.findMany({
        where: { hospitalId, date: { gte: from, lte: to } },
      }),
      db.expense.findMany({
        where: { hospitalId, date: { gte: from, lte: to } },
      }),
      db.invoice.findMany({
        where: { hospitalId, dateIssued: { gte: from, lte: to } },
        select: { status: true, dueDate: true, amountPaid: true, totalAmount: true },
      }),
    ]);

    const sumBy = (
      rows: Array<{ amount: number; currency: Currency; category?: string | null }>,
      currency: Currency,
      category?: string
    ) =>
      roundMoney(
        rows
          .filter((row) => row.currency === currency && (!category || row.category === category))
          .reduce((sum, row) => sum + row.amount, 0)
      );

    const pack = (currency: Currency) => {
      const totalRevenue = sumBy(incomes, currency);
      const totalExpenses = sumBy(expenses, currency);
      return {
        totalRevenue,
        totalExpenses,
        netProfit: roundMoney(totalRevenue - totalExpenses),
        totalPayroll: sumBy(expenses, currency, "SALAIRES"),
      };
    };

    const cdf = pack("CDF");
    const usd = pack("USD");
    const now = new Date();
    const pendingInvoices = invoices.filter((inv) =>
      ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status)
    ).length;
    const overdueInvoices = invoices.filter((inv) => {
      if (inv.status === "PAID" || inv.status === "CANCELLED") return false;
      return inv.dueDate != null && inv.dueDate < now && inv.amountPaid < inv.totalAmount;
    }).length;

    return jsonOk(res, {
      totalRevenue: cdf.totalRevenue,
      totalExpenses: cdf.totalExpenses,
      netProfit: cdf.netProfit,
      pendingInvoices,
      overdueInvoices,
      totalPayroll: cdf.totalPayroll,
      byCurrency: { CDF: cdf, USD: usd },
      period: { from, to },
    });
  } catch (error) {
    console.error("getFinanceSummary", error);
    return jsonError(res, 500, "Impossible de calculer le résumé financier");
  }
}
