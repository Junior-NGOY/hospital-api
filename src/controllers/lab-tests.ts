import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import {
  jsonError,
  jsonOk,
  requireHospitalForWrite,
  requirePatientInHospital,
  resolveHospitalScope,
} from "@/utils/hospitalScope";
import {
  labTestInclude,
  normalizeExamResults,
  placeLabOrder,
  resolveDoctorUser,
  ResultPayload,
} from "@/utils/labOrders";
import { LabTestStatus } from "@prisma/client";
import { Response } from "express";

const QUEUE_STATUSES: LabTestStatus[] = [
  LabTestStatus.PENDING,
  LabTestStatus.IN_PROGRESS,
];

function parseStatusFilter(req: AuthRequest): LabTestStatus[] | null {
  if (req.query.pending === "true") return QUEUE_STATUSES;
  const raw = req.query.status;
  if (!raw) return null;
  const parts = String(raw)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const allowed = new Set(Object.values(LabTestStatus));
  const statuses = parts.filter((s): s is LabTestStatus =>
    allowed.has(s as LabTestStatus)
  );
  return statuses.length ? statuses : null;
}

export async function getLabTests(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonOk(res, []);

    const statuses = parseStatusFilter(req);
    const patientId = req.query.patientId ? String(req.query.patientId) : undefined;
    const consultationId = req.query.consultationId
      ? String(req.query.consultationId)
      : undefined;

    const tests = await db.labTest.findMany({
      where: {
        hospitalId,
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(patientId ? { patientId } : {}),
        ...(consultationId ? { consultationId } : {}),
      },
      include: labTestInclude,
      orderBy: [{ status: "asc" }, { orderDate: "desc" }],
      take: 300,
    });
    return jsonOk(res, tests);
  } catch (error) {
    console.error("getLabTests", error);
    return jsonError(res, 500, "Impossible de récupérer les demandes de laboratoire");
  }
}

export async function getLabTestById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) return jsonError(res, 403, "Accès refusé");
    const test = await db.labTest.findFirst({
      where: { id: req.params.id, hospitalId },
      include: labTestInclude,
    });
    if (!test) return jsonError(res, 404, "Demande de laboratoire introuvable");
    return jsonOk(res, test);
  } catch (error) {
    console.error("getLabTestById", error);
    return jsonError(res, 500, "Impossible de récupérer la demande");
  }
}

export async function createLabTest(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const body = req.body as Record<string, unknown>;
    const patientId = String(body.patientId || "");
    if (!patientId) return jsonError(res, 400, "patientId est requis");

    const scoped = await requirePatientInHospital(req, res, patientId);
    if (!scoped) return;

    const testName = String(body.testName || body.examName || "").trim();
    if (!testName) return jsonError(res, 400, "testName est requis");

    let consultationId: string | null = body.consultationId
      ? String(body.consultationId)
      : null;
    if (consultationId) {
      const consultation = await db.consultation.findFirst({
        where: { id: consultationId, patientId },
        select: { id: true, hospitalId: true, doctorId: true },
      });
      if (!consultation) {
        return jsonError(res, 400, "Consultation introuvable pour ce patient");
      }
      if (consultation.hospitalId && consultation.hospitalId !== scope.hospitalId) {
        return jsonError(res, 403, "Accès refusé");
      }
    }

    const doctorInfo = await resolveDoctorUser(
      body.doctorId ? String(body.doctorId) : scope.userId || null
    );

    let orderedByName = body.orderedBy ? String(body.orderedBy) : doctorInfo.name;
    if (!orderedByName && scope.userId) {
      const user = await db.user.findUnique({
        where: { id: scope.userId },
        select: { firstName: true, lastName: true },
      });
      orderedByName = user
        ? `${user.firstName} ${user.lastName}`.trim()
        : "Médecin";
    }

    const created = await placeLabOrder({
      hospitalId: scope.hospitalId,
      patientId,
      consultationId,
      doctorUserId: doctorInfo.userId,
      doctorProfileId: doctorInfo.profileId,
      testName,
      testType: body.testType ? String(body.testType) : null,
      urgency: body.urgency ? String(body.urgency) : body.priority ? String(body.priority) : null,
      notes: body.notes ? String(body.notes) : null,
      instructions: body.instructions ? String(body.instructions) : null,
      requestReason: body.requestReason ? String(body.requestReason) : null,
      orderedByName: orderedByName || "Médecin",
    });

    return jsonOk(res, created, 201);
  } catch (error) {
    console.error("createLabTest", error);
    const message =
      error instanceof Error && error.message.includes("examen")
        ? error.message
        : "Erreur lors de la création de la demande de laboratoire";
    return jsonError(res, 500, message);
  }
}

export async function startLabTest(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const test = await db.labTest.findFirst({
      where: { id: req.params.id, hospitalId: scope.hospitalId },
    });
    if (!test) return jsonError(res, 404, "Demande de laboratoire introuvable");
    if (test.status === LabTestStatus.COMPLETED) {
      return jsonError(res, 400, "Cet examen est déjà terminé");
    }
    if (test.status === LabTestStatus.CANCELLED || test.status === LabTestStatus.REJECTED) {
      return jsonError(res, 400, "Cet examen a été annulé");
    }

    const updated = await db.$transaction(async (tx) => {
      if (test.examResultId) {
        await tx.examResult.update({
          where: { id: test.examResultId },
          data: { status: "IN_PROGRESS", performedDate: new Date() },
        });
      }
      if (test.paraclinicalExamId) {
        await tx.paraclinicalExam.update({
          where: { id: test.paraclinicalExamId },
          data: { status: "IN_PROGRESS" },
        });
      }
      return tx.labTest.update({
        where: { id: test.id },
        data: {
          status: LabTestStatus.IN_PROGRESS,
          sampleDate: test.sampleDate || new Date(),
          technicianId: scope.userId || test.technicianId,
        },
        include: labTestInclude,
      });
    });

    return jsonOk(res, updated);
  } catch (error) {
    console.error("startLabTest", error);
    return jsonError(res, 500, "Impossible de démarrer l'analyse");
  }
}

export async function recordLabResult(req: AuthRequest, res: Response) {
  try {
    const scope = await requireHospitalForWrite(req, res);
    if (!scope) return;
    const test = await db.labTest.findFirst({
      where: { id: req.params.id, hospitalId: scope.hospitalId },
    });
    if (!test) return jsonError(res, 404, "Demande de laboratoire introuvable");
    if (test.status === LabTestStatus.CANCELLED || test.status === LabTestStatus.REJECTED) {
      return jsonError(res, 400, "Cet examen a été annulé");
    }

    const body = req.body as ResultPayload & Record<string, unknown>;
    const { text, json } = normalizeExamResults(body.results ?? body.result);
    if (!text && !body.interpretation) {
      return jsonError(res, 400, "Un résultat ou une interprétation est requis");
    }

    let technicianName = body.performedBy ? String(body.performedBy) : null;
    if (!technicianName && scope.userId) {
      const user = await db.user.findUnique({
        where: { id: scope.userId },
        select: { firstName: true, lastName: true },
      });
      technicianName = user
        ? `${user.firstName} ${user.lastName}`.trim()
        : "Laboratoire";
    }

    const interpretation = body.interpretation
      ? String(body.interpretation)
      : null;
    const notes = body.notes ? String(body.notes) : test.notes;
    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      let examResultId = test.examResultId;
      if (examResultId) {
        await tx.examResult.update({
          where: { id: examResultId },
          data: {
            results: json,
            interpretation: interpretation || undefined,
            performedBy: technicianName || undefined,
            performedDate: now,
            resultDate: now,
            status: "COMPLETED",
            notes: notes || undefined,
          },
        });
      } else {
        const exam = await tx.examResult.create({
          data: {
            patientId: test.patientId,
            examType: test.testType || "OTHER",
            examName: test.testName,
            orderedBy: "Médecin",
            performedBy: technicianName || undefined,
            orderDate: test.orderDate,
            performedDate: now,
            resultDate: now,
            results: json,
            interpretation: interpretation || undefined,
            status: "COMPLETED",
            notes: notes || undefined,
          },
        });
        examResultId = exam.id;
      }

      if (test.paraclinicalExamId) {
        await tx.paraclinicalExam.update({
          where: { id: test.paraclinicalExamId },
          data: { status: "COMPLETED" },
        });
      }

      return tx.labTest.update({
        where: { id: test.id },
        data: {
          status: LabTestStatus.COMPLETED,
          results: text || interpretation,
          resultDate: now,
          sampleDate: test.sampleDate || now,
          technicianId: scope.userId || test.technicianId,
          examResultId,
          notes,
        },
        include: labTestInclude,
      });
    });

    return jsonOk(res, updated);
  } catch (error) {
    console.error("recordLabResult", error);
    return jsonError(res, 500, "Impossible d'enregistrer le résultat");
  }
}
