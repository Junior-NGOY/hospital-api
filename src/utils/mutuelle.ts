import { PatientCategory } from "@prisma/client";
import { roundMoney } from "@/utils/financeMoney";

/** Ticket modérateur type RDC : 80 % mutuelle / 20 % patient si abonné sans plan. */
export const DEFAULT_SUBSCRIBER_COVERAGE_PERCENT = 80;

export function normalizePatientCategory(raw: unknown): PatientCategory {
  const value = String(raw || "PRIVATE")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    value === "SUBSCRIBER" ||
    value === "SUS" ||
    value === "ABONNE" ||
    value === "ABONNEE"
  ) {
    return "SUBSCRIBER";
  }
  return "PRIVATE";
}

export function clampCoveragePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function computeInvoiceShares(params: {
  totalAmount: number;
  category: PatientCategory;
  coveragePercent?: number | null;
  mutuelleShare?: number | null;
  planDiscountPercent?: number | null;
}): { patientShare: number; mutuelleShare: number; coveragePercent: number } {
  const total = roundMoney(Math.max(0, params.totalAmount));

  if (params.mutuelleShare != null && Number.isFinite(params.mutuelleShare)) {
    const mutuelleShare = roundMoney(Math.min(total, Math.max(0, params.mutuelleShare)));
    const coveragePercent = total > 0 ? clampCoveragePercent((mutuelleShare / total) * 100) : 0;
    return {
      mutuelleShare,
      patientShare: roundMoney(total - mutuelleShare),
      coveragePercent,
    };
  }

  let coveragePercent: number;
  if (params.coveragePercent != null && Number.isFinite(params.coveragePercent)) {
    coveragePercent = clampCoveragePercent(params.coveragePercent);
  } else if (params.category === "SUBSCRIBER") {
    const fromPlan =
      params.planDiscountPercent != null && Number.isFinite(params.planDiscountPercent)
        ? params.planDiscountPercent
        : DEFAULT_SUBSCRIBER_COVERAGE_PERCENT;
    coveragePercent = clampCoveragePercent(fromPlan);
  } else {
    coveragePercent = 0;
  }

  const mutuelleShare = roundMoney((total * coveragePercent) / 100);
  return {
    mutuelleShare,
    patientShare: roundMoney(total - mutuelleShare),
    coveragePercent,
  };
}
