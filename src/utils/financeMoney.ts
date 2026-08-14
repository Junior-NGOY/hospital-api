import { Currency, PaymentMethod } from "@prisma/client";

const UI_TO_PRISMA: Record<string, PaymentMethod> = {
  ESPECES: "CASH",
  CASH: "CASH",
  CARTE: "CREDIT_CARD",
  CREDIT_CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  VIREMENT: "BANK_TRANSFER",
  BANK_TRANSFER: "BANK_TRANSFER",
  CHEQUE: "CHECK",
  CHECK: "CHECK",
  MOBILE_MONEY: "MOBILE_PAYMENT",
  MOBILE_PAYMENT: "MOBILE_PAYMENT",
  MUTUELLE: "MUTUELLE",
  PRISE_EN_CHARGE: "MUTUELLE",
  INSURANCE: "MUTUELLE",
  MPESA: "MPESA",
  M_PESA: "MPESA",
  VODACOM: "MPESA",
  AIRTEL: "AIRTEL_MONEY",
  AIRTEL_MONEY: "AIRTEL_MONEY",
  ORANGE: "ORANGE_MONEY",
  ORANGE_MONEY: "ORANGE_MONEY",
};

const PRISMA_TO_UI: Record<PaymentMethod, string> = {
  CASH: "ESPECES",
  CREDIT_CARD: "CARTE",
  DEBIT_CARD: "CARTE",
  BANK_TRANSFER: "VIREMENT",
  CHECK: "CHEQUE",
  MOBILE_PAYMENT: "MOBILE_MONEY",
  MUTUELLE: "MUTUELLE",
  MPESA: "MPESA",
  AIRTEL_MONEY: "AIRTEL_MONEY",
  ORANGE_MONEY: "ORANGE_MONEY",
};

export function isMutuelleMethod(method: PaymentMethod | string | null | undefined): boolean {
  return method === "MUTUELLE";
}

export function isMobileMoneyMethod(method: PaymentMethod | string | null | undefined): boolean {
  if (!method) return false;
  const key = String(method).toUpperCase().replace(/[\s-]+/g, "_");
  return (
    key === "MPESA" ||
    key === "M_PESA" ||
    key === "AIRTEL_MONEY" ||
    key === "AIRTEL" ||
    key === "ORANGE_MONEY" ||
    key === "ORANGE" ||
    key === "MOBILE_PAYMENT" ||
    key === "MOBILE_MONEY"
  );
}

export function parseMobileOperator(value: unknown): PaymentMethod | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (key === "MPESA" || key === "M_PESA" || key === "VODACOM") return "MPESA";
  if (key === "AIRTEL" || key === "AIRTEL_MONEY") return "AIRTEL_MONEY";
  if (key === "ORANGE" || key === "ORANGE_MONEY") return "ORANGE_MONEY";
  return null;
}

export function parsePaymentMethodOrNull(value: unknown): PaymentMethod | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const operator = parseMobileOperator(key);
  if (operator) return operator;
  return UI_TO_PRISMA[key] ?? null;
}

export function resolveInvoicePaymentMethod(
  methodValue: unknown,
  operatorValue?: unknown
): { method: PaymentMethod } | { error: string } {
  const parsed = parsePaymentMethodOrNull(methodValue);
  if (!parsed) {
    return { error: "Mode de paiement invalide" };
  }
  if (parsed === "MOBILE_PAYMENT") {
    const operator = parseMobileOperator(operatorValue);
    if (!operator) {
      return {
        error: "Opérateur mobile money requis (M-Pesa, Airtel Money ou Orange Money)",
      };
    }
    return { method: operator };
  }
  return { method: parsed };
}

export function mobileMoneyLabel(method: PaymentMethod | string): string {
  const key = String(method).toUpperCase().replace(/[\s-]+/g, "_");
  if (key === "MPESA" || key === "M_PESA") return "M-Pesa";
  if (key === "AIRTEL_MONEY" || key === "AIRTEL") return "Airtel Money";
  if (key === "ORANGE_MONEY" || key === "ORANGE") return "Orange Money";
  return "Mobile money";
}

export function toUiOperator(method: PaymentMethod | null | undefined): string | undefined {
  if (!method) return undefined;
  if (method === "MPESA" || method === "AIRTEL_MONEY" || method === "ORANGE_MONEY") {
    return method;
  }
  return undefined;
}

export function parseCurrency(value: unknown, fallback: Currency = "CDF"): Currency {
  if (value === "USD" || value === "CDF") return value;
  if (typeof value === "string") {
    const upper = value.toUpperCase();
    if (upper === "USD" || upper === "CDF") return upper as Currency;
  }
  return fallback;
}

export function parsePaymentMethod(
  value: unknown,
  fallback: PaymentMethod = "CASH"
): PaymentMethod {
  return parsePaymentMethodOrNull(value) ?? fallback;
}

export function toUiPaymentMethod(
  method: PaymentMethod | null | undefined
): string | undefined {
  if (!method) return undefined;
  return PRISMA_TO_UI[method];
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${year}-${rand}`;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}
