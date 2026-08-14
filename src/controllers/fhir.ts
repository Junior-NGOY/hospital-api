import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { toFhirPatient } from "@/utils/fhirPatient";
import { jsonError, resolveHospitalScope } from "@/utils/hospitalScope";
import { Response } from "express";

const FHIR_JSON = "application/fhir+json";

/**
 * P2.1 — thin FHIR R4 Patient read (export).
 * Staff JWT + hospitalId. Not public (QR DME stays GET /patients/:id/medical-record).
 * Not a FHIR server: no Bundle search, no write, no other resources.
 */
export async function getFhirPatient(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const id = String(req.params.id || "").trim();
    if (!id) {
      return jsonError(res, 400, "Identifiant patient requis");
    }

    const patient = await db.patient.findUnique({
      where: { id },
      include: { hospital: { select: { id: true, name: true } } },
    });

    if (!patient) {
      return jsonError(res, 404, "Patient introuvable");
    }
    if (patient.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const resource = toFhirPatient(patient);
    res.setHeader("Content-Type", FHIR_JSON);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(resource);
  } catch (error) {
    console.error("getFhirPatient", error);
    return jsonError(res, 500, "Impossible d'exporter le patient FHIR");
  }
}
