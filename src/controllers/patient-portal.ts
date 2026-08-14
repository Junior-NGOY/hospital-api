import { db } from "@/db/db";
import { loadMedicalRecordByPatientId } from "@/controllers/medical-records";
import { AuthRequest, PatientAuthRequest } from "@/middleware/auth";
import {
  generatePatientAccessToken,
  signPatientQrToken,
  verifyPatientQrToken,
} from "@/utils/patientAccess";
import { jsonError, jsonOk, resolveHospitalScope } from "@/utils/hospitalScope";
import { phonesMatchCd } from "@/utils/phoneCd";
import { Request, Response } from "express";

const LOGIN_ERROR = "Numéro de dossier ou téléphone incorrect.";
const QR_ERROR = "Lien de carte invalide.";

function toIso(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

function publicPatient(patient: {
  id: string;
  firstName: string;
  lastName: string;
  fileNumber: string;
  dateOfBirth: Date;
  gender: string;
  phone: string | null;
  hospital: { name: string } | null;
}) {
  return {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    fileNumber: patient.fileNumber,
    dateOfBirth: toIso(patient.dateOfBirth),
    gender: patient.gender,
    phone: patient.phone,
    hospitalName: patient.hospital?.name ?? null,
  };
}

function sessionPayload(patient: {
  id: string;
  firstName: string;
  lastName: string;
  fileNumber: string;
  dateOfBirth: Date;
  gender: string;
  phone: string | null;
  hospital: { name: string } | null;
}) {
  const accessToken = generatePatientAccessToken({
    typ: "patient",
    patientId: patient.id,
    fileNumber: patient.fileNumber,
  });
  return {
    accessToken,
    patient: publicPatient(patient),
  };
}

const patientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fileNumber: true,
  dateOfBirth: true,
  gender: true,
  phone: true,
  hospital: { select: { name: true } },
} as const;

function mapPortalAppointment(a: {
  id: string;
  scheduledDate: Date;
  duration: number;
  status: string;
  reason: string | null;
  type: string | null;
  doctor: {
    user: { firstName: string; lastName: string };
    specialization?: unknown;
  };
  branch: { name: string } | null;
}) {
  return {
    id: a.id,
    scheduledDate: toIso(a.scheduledDate),
    duration: a.duration,
    status: a.status,
    reason: a.reason,
    type: a.type,
    doctorName: `${a.doctor.user.firstName} ${a.doctor.user.lastName}`.trim(),
    specialization: a.doctor.specialization
      ? String(a.doctor.specialization)
      : null,
    branchName: a.branch?.name ?? null,
  };
}

async function loadPortalHome(patientId: string) {
  const [patient, medicalRecord, appointments] = await Promise.all([
    db.patient.findUnique({
      where: { id: patientId },
      select: patientSelect,
    }),
    loadMedicalRecordByPatientId(patientId),
    db.appointment.findMany({
      where: { patientId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        branch: { select: { name: true } },
      },
      orderBy: { scheduledDate: "desc" },
      take: 50,
    }),
  ]);

  if (!patient || !medicalRecord) return null;

  return {
    patient: publicPatient(patient),
    medicalRecord,
    appointments: appointments.map(mapPortalAppointment),
  };
}

/**
 * POST /patient-portal/login
 * Body: { fileNumber, phone } — téléphone RDC (+243).
 */
export async function patientPortalLogin(req: Request, res: Response) {
  try {
    const fileNumber = String(req.body?.fileNumber || "").trim();
    const phone = String(req.body?.phone || "").trim();
    if (!fileNumber || !phone) {
      return jsonError(res, 400, "Le numéro de dossier et le téléphone sont requis.");
    }

    const patient = await db.patient.findFirst({
      where: { fileNumber: { equals: fileNumber, mode: "insensitive" } },
      select: patientSelect,
    });

    if (!patient || !phonesMatchCd(patient.phone, phone)) {
      return jsonError(res, 401, LOGIN_ERROR);
    }

    return jsonOk(res, sessionPayload(patient));
  } catch (error) {
    console.error("patientPortalLogin", error);
    return jsonError(res, 500, "Impossible d’ouvrir l’espace patient.");
  }
}

/**
 * POST /patient-portal/qr
 * Body: { token } — jeton HMAC imprimé sur la carte PVC.
 */
export async function patientPortalQr(req: Request, res: Response) {
  try {
    const token = String(req.body?.token || "").trim();
    const patientId = verifyPatientQrToken(token);
    if (!patientId) {
      return jsonError(res, 401, QR_ERROR);
    }

    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: patientSelect,
    });
    if (!patient) {
      return jsonError(res, 401, QR_ERROR);
    }

    return jsonOk(res, sessionPayload(patient));
  } catch (error) {
    console.error("patientPortalQr", error);
    return jsonError(res, 500, "Impossible d’ouvrir l’espace patient.");
  }
}

export async function patientPortalHome(req: PatientAuthRequest, res: Response) {
  try {
    const patientId = req.patientId;
    if (!patientId) {
      return jsonError(res, 401, "Authentification patient requise");
    }
    const home = await loadPortalHome(patientId);
    if (!home) {
      return jsonError(res, 404, "Dossier introuvable");
    }
    return jsonOk(res, home);
  } catch (error) {
    console.error("patientPortalHome", error);
    return jsonError(res, 500, "Impossible de charger le dossier.");
  }
}

/**
 * GET /patients/:id/qr-token — staff JWT, même hôpital.
 * Sert à imprimer le QR vers l’espace patient (pas le dashboard).
 */
export async function getPatientQrToken(req: AuthRequest, res: Response) {
  try {
    const patientId = String(req.params.id || "").trim();
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { id: true, hospitalId: true, fileNumber: true },
    });
    if (!patient) {
      return jsonError(res, 404, "Patient introuvable");
    }
    if (patient.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const token = signPatientQrToken(patient.id);
    return jsonOk(res, {
      token,
      path: `/p/${encodeURIComponent(token)}`,
    });
  } catch (error) {
    console.error("getPatientQrToken", error);
    return jsonError(res, 500, "Impossible de générer le QR patient.");
  }
}
