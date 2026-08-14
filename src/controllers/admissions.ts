import { db } from "@/db/db";
import { AuthRequest } from "@/middleware/auth";
import { jsonError, jsonOk, resolveHospitalScope } from "@/utils/hospitalScope";
import { AdmissionStatus, AdmissionType, Prisma } from "@prisma/client";
import { Response } from "express";

const ADMISSION_TYPES = new Set<string>(Object.values(AdmissionType));
const ADMISSION_STATUSES = new Set<string>(Object.values(AdmissionStatus));

const admissionInclude = {
  patient: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      fileNumber: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      email: true,
      bloodType: true,
    },
  },
  bed: {
    include: {
      room: {
        include: {
          department: { select: { id: true, name: true } },
        },
      },
    },
  },
  admittingDoctor: {
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  },
  dischargingDoctor: {
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  },
  vitalSigns: {
    orderBy: { recordedAt: "desc" as const },
    take: 20,
  },
  dailyNotes: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: {
      author: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.AdmissionInclude;

async function refreshRoomAvailability(
  tx: Prisma.TransactionClient,
  roomId: string
) {
  const free = await tx.bed.count({
    where: { roomId, isOccupied: false },
  });
  await tx.room.update({
    where: { id: roomId },
    data: { isAvailable: free > 0 },
  });
}

export async function getAdmissions(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonOk(res, []);
    }

    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const where: Prisma.AdmissionWhereInput = { hospitalId };
    if (status && ADMISSION_STATUSES.has(status)) {
      where.status = status as AdmissionStatus;
    }

    const admissions = await db.admission.findMany({
      where,
      orderBy: { admissionDate: "desc" },
      include: admissionInclude,
    });

    return jsonOk(res, admissions);
  } catch (error) {
    console.error("getAdmissions", error);
    return jsonError(res, 500, "Impossible de récupérer les admissions");
  }
}

export async function getAdmissionStats(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonOk(res, {
        totalAdmissions: 0,
        activeAdmissions: 0,
        availableBeds: 0,
        totalBeds: 0,
        occupancyRate: 0,
        averageStay: 0,
        emergencyAdmissions: 0,
        dischargesThisWeek: 0,
      });
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalAdmissions,
      activeAdmissions,
      emergencyAdmissions,
      dischargesThisWeek,
      totalBeds,
      occupiedBeds,
      activeForStay,
    ] = await Promise.all([
      db.admission.count({ where: { hospitalId } }),
      db.admission.count({ where: { hospitalId, status: "ACTIVE" } }),
      db.admission.count({
        where: { hospitalId, admissionType: "EMERGENCY", status: "ACTIVE" },
      }),
      db.admission.count({
        where: {
          hospitalId,
          status: "DISCHARGED",
          dischargeDate: { gte: weekAgo },
        },
      }),
      db.bed.count({ where: { room: { hopitalId: hospitalId } } }),
      db.bed.count({
        where: { isOccupied: true, room: { hopitalId: hospitalId } },
      }),
      db.admission.findMany({
        where: { hospitalId, status: "ACTIVE" },
        select: { admissionDate: true },
      }),
    ]);

    const now = Date.now();
    const staySum = activeForStay.reduce((sum, a) => {
      const days = Math.max(
        0,
        Math.floor((now - new Date(a.admissionDate).getTime()) / 86_400_000)
      );
      return sum + days;
    }, 0);
    const averageStay =
      activeForStay.length > 0
        ? Math.round((staySum / activeForStay.length) * 10) / 10
        : 0;
    const occupancyRate =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return jsonOk(res, {
      totalAdmissions,
      activeAdmissions,
      availableBeds: Math.max(0, totalBeds - occupiedBeds),
      totalBeds,
      occupancyRate,
      averageStay,
      emergencyAdmissions,
      dischargesThisWeek,
    });
  } catch (error) {
    console.error("getAdmissionStats", error);
    return jsonError(res, 500, "Impossible de récupérer les statistiques");
  }
}

export async function getHospitalDoctors(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonOk(res, []);
    }

    const doctors = await db.doctor.findMany({
      where: { user: { hospitalId } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, isActive: true },
        },
      },
      orderBy: { user: { lastName: "asc" } },
    });

    return jsonOk(
      res,
      doctors.map((d) => ({
        id: d.id,
        userId: d.userId,
        firstName: d.user.firstName,
        lastName: d.user.lastName,
        specialization: d.specialization,
        isActive: d.user.isActive,
      }))
    );
  } catch (error) {
    console.error("getHospitalDoctors", error);
    return jsonError(res, 500, "Impossible de récupérer les médecins");
  }
}

export async function getAdmissionById(req: AuthRequest, res: Response) {
  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const admission = await db.admission.findUnique({
      where: { id: req.params.id },
      include: admissionInclude,
    });

    if (!admission) {
      return jsonError(res, 404, "Admission introuvable");
    }
    if (admission.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    return jsonOk(res, admission);
  } catch (error) {
    console.error("getAdmissionById", error);
    return jsonError(res, 500, "Impossible de récupérer l'admission");
  }
}

export async function createAdmission(req: AuthRequest, res: Response) {
  const body = req.body as {
    patientId?: string;
    bedId?: string;
    admissionReason?: string;
    admissionType?: string;
    admittedBy?: string;
    expectedStayDuration?: number;
    notes?: string;
    diagnosisAtAdmission?: string;
    dailyRoomRate?: number;
    estimatedCost?: number;
    packageId?: string;
  };

  try {
    const { hospitalId, branchId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(
        res,
        400,
        "Aucun hôpital associé au compte. Impossible d'admettre un patient."
      );
    }

    const patientId = body.patientId?.trim();
    const bedId = body.bedId?.trim();
    const admissionReason = body.admissionReason?.trim();
    if (!patientId || !bedId || !admissionReason) {
      return jsonError(
        res,
        400,
        "Patient, lit et motif d'admission sont requis"
      );
    }

    const admissionType = (body.admissionType || "REGULAR") as AdmissionType;
    if (!ADMISSION_TYPES.has(admissionType)) {
      return jsonError(res, 400, "Type d'admission invalide");
    }

    const admission = await db.$transaction(async (tx) => {
      const patient = await tx.patient.findUnique({
        where: { id: patientId },
        select: { id: true, hospitalId: true },
      });
      if (!patient) {
        throw Object.assign(new Error("Patient introuvable"), { status: 404 });
      }
      if (patient.hospitalId !== hospitalId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }

      const active = await tx.admission.findFirst({
        where: { patientId, status: "ACTIVE" },
        select: { id: true },
      });
      if (active) {
        throw Object.assign(
          new Error("Ce patient a déjà une admission active"),
          { status: 409 }
        );
      }

      const bed = await tx.bed.findUnique({
        where: { id: bedId },
        include: { room: true },
      });
      if (!bed) {
        throw Object.assign(new Error("Lit introuvable"), { status: 404 });
      }
      if (bed.room.hopitalId !== hospitalId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }
      if (bed.isOccupied) {
        throw Object.assign(new Error("Ce lit est déjà occupé"), { status: 409 });
      }

      if (body.admittedBy) {
        const doctor = await tx.doctor.findUnique({
          where: { id: body.admittedBy },
          include: { user: { select: { hospitalId: true } } },
        });
        if (!doctor || doctor.user.hospitalId !== hospitalId) {
          throw Object.assign(new Error("Médecin introuvable"), { status: 404 });
        }
      }

      const created = await tx.admission.create({
        data: {
          patientId,
          bedId,
          hospitalId,
          branchId: branchId || bed.room.branchId || null,
          admissionReason,
          admissionType,
          admittedBy: body.admittedBy || null,
          expectedStayDuration:
            body.expectedStayDuration !== undefined
              ? Number(body.expectedStayDuration)
              : null,
          notes: body.notes?.trim() || null,
          diagnosisAtAdmission: body.diagnosisAtAdmission?.trim() || null,
          dailyRoomRate:
            body.dailyRoomRate !== undefined ? Number(body.dailyRoomRate) : null,
          estimatedCost:
            body.estimatedCost !== undefined ? Number(body.estimatedCost) : null,
          packageId: body.packageId || null,
          status: "ACTIVE",
        },
        include: admissionInclude,
      });

      await tx.bed.update({
        where: { id: bedId },
        data: { isOccupied: true },
      });
      await refreshRoomAvailability(tx, bed.roomId);

      return created;
    });

    return jsonOk(res, admission, 201);
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status)
        : 0;
    if (status) {
      return jsonError(
        res,
        status,
        error instanceof Error ? error.message : "Erreur"
      );
    }
    console.error("createAdmission", error);
    return jsonError(res, 500, "Impossible de créer l'admission");
  }
}

export async function updateAdmission(req: AuthRequest, res: Response) {
  const body = req.body as {
    admissionReason?: string;
    admissionType?: string;
    admittedBy?: string;
    expectedStayDuration?: number;
    notes?: string;
    diagnosisAtAdmission?: string;
    diagnosisAtDischarge?: string;
    dailyRoomRate?: number;
    estimatedCost?: number;
    finalCost?: number;
  };

  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const existing = await db.admission.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return jsonError(res, 404, "Admission introuvable");
    }
    if (existing.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    if (body.admissionType && !ADMISSION_TYPES.has(body.admissionType)) {
      return jsonError(res, 400, "Type d'admission invalide");
    }

    const admission = await db.admission.update({
      where: { id: existing.id },
      data: {
        admissionReason: body.admissionReason?.trim() || undefined,
        admissionType: body.admissionType as AdmissionType | undefined,
        admittedBy: body.admittedBy || undefined,
        expectedStayDuration:
          body.expectedStayDuration !== undefined
            ? Number(body.expectedStayDuration)
            : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        diagnosisAtAdmission:
          body.diagnosisAtAdmission !== undefined
            ? body.diagnosisAtAdmission
            : undefined,
        diagnosisAtDischarge:
          body.diagnosisAtDischarge !== undefined
            ? body.diagnosisAtDischarge
            : undefined,
        dailyRoomRate:
          body.dailyRoomRate !== undefined ? Number(body.dailyRoomRate) : undefined,
        estimatedCost:
          body.estimatedCost !== undefined ? Number(body.estimatedCost) : undefined,
        finalCost: body.finalCost !== undefined ? Number(body.finalCost) : undefined,
      },
      include: admissionInclude,
    });

    return jsonOk(res, admission);
  } catch (error) {
    console.error("updateAdmission", error);
    return jsonError(res, 500, "Impossible de mettre à jour l'admission");
  }
}

export async function dischargeAdmission(req: AuthRequest, res: Response) {
  const body = (req.body || {}) as {
    diagnosisAtDischarge?: string;
    notes?: string;
    dischargedBy?: string;
  };

  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const admission = await db.$transaction(async (tx) => {
      const existing = await tx.admission.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        throw Object.assign(new Error("Admission introuvable"), { status: 404 });
      }
      if (existing.hospitalId !== hospitalId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }
      if (existing.status !== "ACTIVE") {
        throw Object.assign(new Error("Cette admission n'est plus active"), {
          status: 409,
        });
      }

      const updated = await tx.admission.update({
        where: { id: existing.id },
        data: {
          status: "DISCHARGED",
          dischargeDate: new Date(),
          diagnosisAtDischarge: body.diagnosisAtDischarge?.trim() || null,
          notes: body.notes !== undefined ? body.notes : existing.notes,
          dischargedBy: body.dischargedBy || existing.dischargedBy,
        },
        include: admissionInclude,
      });

      if (existing.bedId) {
        const bed = await tx.bed.update({
          where: { id: existing.bedId },
          data: { isOccupied: false },
        });
        await refreshRoomAvailability(tx, bed.roomId);
      }

      return updated;
    });

    return jsonOk(res, admission);
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status)
        : 0;
    if (status) {
      return jsonError(
        res,
        status,
        error instanceof Error ? error.message : "Erreur"
      );
    }
    console.error("dischargeAdmission", error);
    return jsonError(res, 500, "Impossible de donner la sortie");
  }
}

export async function transferAdmission(req: AuthRequest, res: Response) {
  const body = req.body as { bedId?: string; reason?: string };

  try {
    const { hospitalId } = await resolveHospitalScope(req);
    const userId = req.user?.userId;
    if (!hospitalId || !userId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const newBedId = body.bedId?.trim();
    if (!newBedId) {
      return jsonError(res, 400, "Le lit de destination est requis");
    }

    const admission = await db.$transaction(async (tx) => {
      const existing = await tx.admission.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        throw Object.assign(new Error("Admission introuvable"), { status: 404 });
      }
      if (existing.hospitalId !== hospitalId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }
      if (existing.status !== "ACTIVE") {
        throw Object.assign(new Error("Cette admission n'est plus active"), {
          status: 409,
        });
      }

      const newBed = await tx.bed.findUnique({
        where: { id: newBedId },
        include: { room: true },
      });
      if (!newBed) {
        throw Object.assign(new Error("Lit introuvable"), { status: 404 });
      }
      if (newBed.room.hopitalId !== hospitalId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }
      if (newBed.isOccupied) {
        throw Object.assign(new Error("Ce lit est déjà occupé"), { status: 409 });
      }

      const oldBedId = existing.bedId;

      await tx.bedTransfer.create({
        data: {
          fromBedId: oldBedId,
          toBedId: newBedId,
          patientId: existing.patientId,
          userId,
          reason: body.reason?.trim() || null,
          admissionId: existing.id,
        },
      });

      const updated = await tx.admission.update({
        where: { id: existing.id },
        data: { bedId: newBedId },
        include: admissionInclude,
      });

      await tx.bed.update({
        where: { id: newBedId },
        data: { isOccupied: true },
      });
      await refreshRoomAvailability(tx, newBed.roomId);

      if (oldBedId && oldBedId !== newBedId) {
        const oldBed = await tx.bed.update({
          where: { id: oldBedId },
          data: { isOccupied: false },
        });
        await refreshRoomAvailability(tx, oldBed.roomId);
      }

      return updated;
    });

    return jsonOk(res, admission);
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status)
        : 0;
    if (status) {
      return jsonError(
        res,
        status,
        error instanceof Error ? error.message : "Erreur"
      );
    }
    console.error("transferAdmission", error);
    return jsonError(res, 500, "Impossible de transférer le patient");
  }
}

function toFloat(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

function toInt(value: unknown): number | undefined {
  const n = toFloat(value);
  return n === undefined ? undefined : Math.round(n);
}

/**
 * P2.3 — persist admission vital signs (soins). JWT hospitalId; never from client body.
 */
export async function createAdmissionVitalSigns(req: AuthRequest, res: Response) {
  const body = req.body as {
    temperature?: unknown;
    bloodPressureSystolic?: unknown;
    bloodPressureDiastolic?: unknown;
    pas?: unknown;
    pad?: unknown;
    heartRate?: unknown;
    fc?: unknown;
    respiratoryRate?: unknown;
    respirationRate?: unknown;
    oxygenSaturation?: unknown;
    spo2?: unknown;
    weight?: unknown;
    height?: unknown;
    bloodGlucose?: unknown;
    pain?: unknown;
    consciousness?: unknown;
    notes?: unknown;
    recordedAt?: unknown;
  };

  try {
    const { hospitalId } = await resolveHospitalScope(req);
    if (!hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const admission = await db.admission.findUnique({
      where: { id: req.params.id },
      select: { id: true, hospitalId: true, patientId: true },
    });
    if (!admission) {
      return jsonError(res, 404, "Admission introuvable");
    }
    if (admission.hospitalId !== hospitalId) {
      return jsonError(res, 403, "Accès refusé");
    }

    const pas = body.pas ?? body.bloodPressureSystolic;
    const pad = body.pad ?? body.bloodPressureDiastolic;
    const fc = body.fc ?? body.heartRate;
    const spo2 = body.spo2 ?? body.oxygenSaturation;
    const respirationRate = body.respirationRate ?? body.respiratoryRate;

    const extras: string[] = [];
    const glucose = toFloat(body.bloodGlucose);
    if (glucose !== undefined) extras.push(`Glycémie ${glucose} mg/dL`);
    const pain = toInt(body.pain);
    if (pain !== undefined) extras.push(`Douleur ${pain}/10`);
    const consciousness =
      typeof body.consciousness === "string" ? body.consciousness.trim() : "";
    if (consciousness) extras.push(`Conscience ${consciousness}`);

    const noteParts = [
      typeof body.notes === "string" ? body.notes.trim() : "",
      extras.join(" · "),
    ].filter(Boolean);
    const notes = noteParts.length ? noteParts.join(" | ") : undefined;

    const hasAny =
      toFloat(body.temperature) !== undefined ||
      toInt(respirationRate) !== undefined ||
      toFloat(body.height) !== undefined ||
      toFloat(body.weight) !== undefined ||
      toFloat(pas) !== undefined ||
      toFloat(pad) !== undefined ||
      toFloat(fc) !== undefined ||
      toFloat(spo2) !== undefined ||
      Boolean(notes);

    if (!hasAny) {
      return jsonError(res, 400, "Saisissez au moins une constante");
    }

    let nurseId: string | undefined;
    const userId = req.user?.userId;
    if (userId) {
      const nurse = await db.nurse.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (nurse) nurseId = nurse.id;
    }

    const recordedAt =
      typeof body.recordedAt === "string" && body.recordedAt
        ? new Date(body.recordedAt)
        : new Date();

    const vitalSign = await db.vitalSign.create({
      data: {
        patientId: admission.patientId,
        admissionId: admission.id,
        nurseId: nurseId || undefined,
        temperature: toFloat(body.temperature),
        respirationRate: toInt(respirationRate),
        height: toFloat(body.height),
        weight: toFloat(body.weight),
        pas: toFloat(pas),
        pad: toFloat(pad),
        fc: toFloat(fc),
        spo2: toFloat(spo2),
        notes,
        recordedAt: Number.isFinite(recordedAt.getTime()) ? recordedAt : new Date(),
      },
    });

    return jsonOk(res, vitalSign, 201);
  } catch (error) {
    console.error("createAdmissionVitalSigns", error);
    return jsonError(res, 500, "Impossible d’enregistrer les constantes");
  }
}
