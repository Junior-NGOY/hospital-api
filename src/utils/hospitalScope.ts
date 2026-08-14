import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { NextFunction, Response } from "express";

/**
 * Hospital scope from JWT, with DB fallback for tokens issued before P0.3.
 * Never trust client-supplied hospitalId.
 */
export async function resolveHospitalScope(req: AuthRequest): Promise<{
  hospitalId: string | null;
  branchId: string | null;
}> {
  const fromToken = req.user?.hospitalId ?? null;
  const branchFromToken = req.user?.branchId ?? null;
  if (fromToken) {
    return { hospitalId: fromToken, branchId: branchFromToken };
  }
  const userId = req.user?.userId;
  if (!userId) {
    return { hospitalId: null, branchId: null };
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { hospitalId: true, branchId: true },
  });
  return {
    hospitalId: user?.hospitalId ?? null,
    branchId: user?.branchId ?? branchFromToken,
  };
}

export function jsonError(res: Response, status: number, error: string) {
  return res.status(status).json({ data: null, error });
}

export function jsonOk<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data, error: null });
}

/**
 * JWT hospital required for writes. Lists should return [] instead.
 */
export async function requireHospitalForWrite(
  req: AuthRequest,
  res: Response
): Promise<{
  hospitalId: string;
  branchId: string | null;
  userId: string | undefined;
} | null> {
  const { hospitalId, branchId } = await resolveHospitalScope(req);
  if (!hospitalId) {
    jsonError(res, 403, "Accès refusé");
    return null;
  }
  return { hospitalId, branchId, userId: req.user?.userId };
}

/**
 * Patient must belong to the JWT hospital. Used for DME writes and consultations.
 * Returns null after sending 403/404 — callers must return immediately.
 */
export async function requirePatientInHospital(
  req: AuthRequest,
  res: Response,
  patientId: string
): Promise<{
  hospitalId: string;
  branchId: string | null;
  patient: { id: string; hospitalId: string | null; branchId: string | null };
} | null> {
  const { hospitalId, branchId } = await resolveHospitalScope(req);
  if (!hospitalId) {
    jsonError(res, 403, "Accès refusé");
    return null;
  }
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, hospitalId: true, branchId: true },
  });
  if (!patient) {
    jsonError(res, 404, "Patient not found");
    return null;
  }
  if (patient.hospitalId !== hospitalId) {
    jsonError(res, 403, "Accès refusé");
    return null;
  }
  return { hospitalId, branchId, patient };
}

/**
 * Express middleware: JWT hospital must own :patientId (or :id).
 * Mount after `authenticate` on DME mutations only — GET DME stays public (QR).
 */
export async function requirePatientHospital(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const patientId = (req.params.patientId || req.params.id) as string | undefined;
  if (!patientId) {
    jsonError(res, 400, "Patient requis");
    return;
  }
  const scoped = await requirePatientInHospital(req, res, patientId);
  if (!scoped) return;
  return next();
}
