import { db } from "@/db/db";
import { LabTestStatus, Prisma } from "@prisma/client";

export const labTestInclude = {
  patient: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      fileNumber: true,
    },
  },
  doctor: { select: { id: true, firstName: true, lastName: true } },
  technician: { select: { id: true, firstName: true, lastName: true } },
  examResult: true,
  paraclinicalExam: true,
  consultation: { select: { id: true, date: true } },
} satisfies Prisma.LabTestInclude;

const KNOWN_EXAM_TYPES = new Set([
  "BLOOD_TEST",
  "URINE_TEST",
  "RADIOLOGY",
  "ECG",
  "ECHO",
  "CT_SCAN",
  "MRI",
  "ULTRASOUND",
  "BIOPSY",
  "OTHER",
]);

export function mapTestType(raw?: string | null): string {
  const value = String(raw || "").trim();
  if (!value) return "OTHER";
  const upper = value.toUpperCase().replace(/[\s-]+/g, "_");
  if (KNOWN_EXAM_TYPES.has(upper)) return upper;

  const lower = value.toLowerCase();
  if (lower.includes("urine") || lower.includes("ecbu")) return "URINE_TEST";
  if (lower === "blood" || lower.includes("sang") || lower.includes("nfs") || lower.includes("glycém")) {
    return "BLOOD_TEST";
  }
  if (lower === "imaging" || lower.includes("radio") || lower.includes("imagerie")) {
    return "RADIOLOGY";
  }
  if (lower === "cardio" || lower.includes("ecg") || lower.includes("électrocardi")) return "ECG";
  if (lower.includes("echo") || lower.includes("échocardio")) return "ECHO";
  if (lower.includes("scanner") || lower.includes("ct")) return "CT_SCAN";
  if (lower.includes("irm") || lower === "mri") return "MRI";
  if (lower.includes("échographie") || lower.includes("ultrasound")) return "ULTRASOUND";
  if (lower === "biopsy" || lower.includes("biopsie")) return "BIOPSY";
  return "OTHER";
}

export function mapUrgency(raw?: string | null): { urgency: string; priority: string } {
  const u = String(raw || "NORMAL").toUpperCase();
  if (u === "STAT" || u === "IMMEDIATE" || u === "IMMÉDIAT") {
    return { urgency: "STAT", priority: "STAT" };
  }
  if (u === "URGENT" || u === "HIGH" || u === "ELEVE") {
    return { urgency: "URGENT", priority: "URGENT" };
  }
  return { urgency: "NORMAL", priority: "ROUTINE" };
}

export type LabOrderInput = {
  hospitalId: string;
  patientId: string;
  consultationId?: string | null;
  doctorUserId?: string | null;
  doctorProfileId?: string | null;
  testName: string;
  testType?: string | null;
  urgency?: string | null;
  notes?: string | null;
  instructions?: string | null;
  requestReason?: string | null;
  orderedByName?: string | null;
};

export async function resolveDoctorUser(doctorOrUserId?: string | null): Promise<{
  userId: string | null;
  profileId: string | null;
  name: string | null;
}> {
  if (!doctorOrUserId) return { userId: null, profileId: null, name: null };

  const asDoctor = await db.doctor.findUnique({
    where: { id: doctorOrUserId },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (asDoctor) {
    return {
      userId: asDoctor.userId,
      profileId: asDoctor.id,
      name: `${asDoctor.user.firstName} ${asDoctor.user.lastName}`.trim() || null,
    };
  }

  const byUser = await db.doctor.findUnique({
    where: { userId: doctorOrUserId },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (byUser) {
    return {
      userId: byUser.userId,
      profileId: byUser.id,
      name: `${byUser.user.firstName} ${byUser.user.lastName}`.trim() || null,
    };
  }

  const user = await db.user.findUnique({
    where: { id: doctorOrUserId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (user) {
    return {
      userId: user.id,
      profileId: null,
      name: `${user.firstName} ${user.lastName}`.trim() || null,
    };
  }

  return { userId: null, profileId: null, name: null };
}

export async function placeLabOrder(input: LabOrderInput) {
  const testName = String(input.testName || "").trim();
  if (!testName) {
    throw new Error("Le nom de l'examen est requis");
  }

  const testType = mapTestType(input.testType);
  const { urgency, priority } = mapUrgency(input.urgency);

  return db.$transaction(async (tx) => {
    const examResult = await tx.examResult.create({
      data: {
        patientId: input.patientId,
        examType: testType,
        examName: testName,
        orderedBy: input.orderedByName || "Médecin",
        orderDate: new Date(),
        results: [],
        status: "ORDERED",
        priority,
        notes: input.notes || undefined,
      },
    });

    const paraclinicalExam = await tx.paraclinicalExam.create({
      data: {
        patientId: input.patientId,
        doctorId: input.doctorProfileId || undefined,
        consultationId: input.consultationId || undefined,
        examType: testType,
        status: "REQUESTED",
        priority,
        requestReason: input.requestReason || undefined,
        instructions: input.instructions || undefined,
      },
    });

    return tx.labTest.create({
      data: {
        hospitalId: input.hospitalId,
        patientId: input.patientId,
        doctorId: input.doctorUserId || undefined,
        consultationId: input.consultationId || undefined,
        examResultId: examResult.id,
        paraclinicalExamId: paraclinicalExam.id,
        testName,
        testType,
        status: LabTestStatus.PENDING,
        urgency,
        notes: input.notes || undefined,
      },
      include: labTestInclude,
    });
  });
}

export type ResultPayload = {
  results?: unknown;
  interpretation?: string | null;
  notes?: string | null;
  performedBy?: string | null;
};

export function normalizeExamResults(raw: unknown): {
  text: string;
  json: Prisma.InputJsonValue;
} {
  if (Array.isArray(raw) && raw.length > 0) {
    const json = raw.map((row) => {
      if (!row || typeof row !== "object") {
        return { parameter: "Résultat", value: String(row), flag: "NORMAL" };
      }
      const item = row as Record<string, unknown>;
      return {
        parameter: String(item.parameter || "Résultat"),
        value: item.value ?? "",
        unit: item.unit ? String(item.unit) : undefined,
        referenceRange: item.referenceRange ? String(item.referenceRange) : undefined,
        flag: item.flag ? String(item.flag) : "NORMAL",
        notes: item.notes ? String(item.notes) : undefined,
      };
    });
    const text = json
      .map((r) => {
        const unit = r.unit ? ` ${r.unit}` : "";
        return `${r.parameter}: ${r.value}${unit}`;
      })
      .join("\n");
    return { text, json };
  }

  const text = raw == null || raw === "" ? "" : String(raw).trim();
  const json: Prisma.InputJsonValue = text
    ? [{ parameter: "Résultat", value: text, flag: "NORMAL" }]
    : [];
  return { text, json };
}
