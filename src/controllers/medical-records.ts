import { db } from "@/db/db";
import { Request, Response } from "express";

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fall through to comma-separated
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toIso(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

async function assertPatientExists(patientId: string) {
  return db.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fileNumber: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

function mapAllergy(a: any) {
  return {
    id: a.id,
    patientId: a.patientId,
    allergen: a.allergen,
    allergenType: a.allergenType || "OTHER",
    severity: a.severity || "MILD",
    reaction: parseStringArray(a.reaction),
    onsetDate: toIso(a.onsetDate) || toIso(a.diagnosedDate),
    diagnosedBy: a.diagnosedBy || undefined,
    notes: a.notes || undefined,
    isActive: a.isActive,
    createdAt: toIso(a.createdAt) || new Date().toISOString(),
  };
}

function mapVaccination(v: any) {
  return {
    id: v.id,
    patientId: v.patientId,
    vaccineName: v.vaccineName || v.vaccine,
    vaccineType: v.vaccineType || v.vaccine || "OTHER",
    manufacturer: v.manufacturer || undefined,
    lotNumber: v.lotNumber || undefined,
    administrationDate:
      toIso(v.administrationDate) || toIso(v.date) || new Date().toISOString(),
    administeredBy: v.administeredBy || "Non renseigné",
    site: v.site || "OTHER",
    doseNumber: v.doseNumber ?? undefined,
    totalDoses: v.totalDoses ?? undefined,
    nextDueDate: toIso(v.nextDueDate),
    reactions: parseStringArray(v.reactions),
    notes: v.notes || undefined,
    createdAt: toIso(v.createdAt) || new Date().toISOString(),
  };
}

function mapChronicCondition(c: any) {
  return {
    id: c.id,
    patientId: c.patientId,
    condition: c.condition,
    icdCode: c.icdCode || undefined,
    diagnosisDate: toIso(c.diagnosisDate) || new Date().toISOString(),
    diagnosedBy: c.diagnosedBy || "Non renseigné",
    severity: c.severity || "MODERATE",
    status: c.status || "ACTIVE",
    treatmentPlan: c.treatmentPlan || undefined,
    lastReviewDate: toIso(c.lastReviewDate),
    nextReviewDate: toIso(c.nextReviewDate),
    notes: c.notes || undefined,
    createdAt: toIso(c.createdAt) || new Date().toISOString(),
  };
}

function mapFamilyHistory(f: any) {
  return {
    id: f.id,
    patientId: f.patientId,
    relation: f.relation,
    condition: f.condition,
    ageOfOnset: f.ageOfOnset ?? undefined,
    isDeceased: f.isDeceased ?? false,
    causeOfDeath: f.causeOfDeath || undefined,
    notes: f.notes || undefined,
    createdAt: toIso(f.createdAt) || new Date().toISOString(),
  };
}

function mapSocialHistory(s: any, patientId: string) {
  if (!s) {
    return {
      id: "",
      patientId,
      smokingStatus: "NEVER",
      alcoholUse: "NEVER",
      drugUse: "NEVER",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    id: s.id,
    patientId: s.patientId,
    smokingStatus: s.smokingStatus,
    smokingDetails: s.smokingDetails || undefined,
    alcoholUse: s.alcoholUse,
    alcoholDetails: s.alcoholDetails || undefined,
    drugUse: s.drugUse,
    drugDetails: s.drugDetails || undefined,
    occupation: s.occupation || undefined,
    maritalStatus: s.maritalStatus || undefined,
    education: s.education || undefined,
    livingArrangement: s.livingArrangement || undefined,
    exerciseFrequency: s.exerciseFrequency || undefined,
    dietType: s.dietType || undefined,
    createdAt: toIso(s.createdAt) || new Date().toISOString(),
    updatedAt: toIso(s.updatedAt) || new Date().toISOString(),
  };
}

function mapEmergencyContact(c: any) {
  return {
    id: c.id,
    patientId: c.patientId,
    name: c.name,
    relationship: c.relationship,
    phoneNumber: c.phoneNumber,
    alternatePhone: c.alternatePhone || undefined,
    email: c.email || undefined,
    address: c.address || undefined,
    isPrimary: c.isPrimary,
    canMakeDecisions: c.canMakeDecisions,
    notes: c.notes || undefined,
    createdAt: toIso(c.createdAt) || new Date().toISOString(),
  };
}

function mapExamResult(e: any) {
  return {
    id: e.id,
    patientId: e.patientId,
    examType: e.examType,
    examName: e.examName,
    orderedBy: e.orderedBy || "Non renseigné",
    performedBy: e.performedBy || undefined,
    orderDate: toIso(e.orderDate) || new Date().toISOString(),
    performedDate: toIso(e.performedDate),
    resultDate: toIso(e.resultDate),
    results: Array.isArray(e.results) ? e.results : [],
    interpretation: e.interpretation || undefined,
    status: e.status || "ORDERED",
    priority: e.priority || "ROUTINE",
    attachments: e.attachments || [],
    notes: e.notes || undefined,
  };
}

function mapMedicalImage(i: any) {
  return {
    id: i.id,
    patientId: i.patientId,
    imageType: i.imageType,
    bodyPart: i.bodyPart,
    studyDate: toIso(i.studyDate) || new Date().toISOString(),
    orderedBy: i.orderedBy || "Non renseigné",
    performedBy: i.performedBy || undefined,
    radiologist: i.radiologist || undefined,
    indication: i.indication || "",
    findings: i.findings || "",
    impression: i.impression || "",
    recommendations: i.recommendations || undefined,
    imageUrls: i.imageUrls || [],
    dicomUrls: i.dicomUrls || [],
    status: i.status || "SCHEDULED",
    priority: i.priority || "ROUTINE",
    createdAt: toIso(i.createdAt) || new Date().toISOString(),
  };
}

function mapSurgery(s: any) {
  return {
    id: s.id,
    date: toIso(s.date) || toIso(s.actualStart) || new Date().toISOString(),
    procedure: s.type || s.surgeryType || "Intervention",
    surgeon: s.primarySurgeon?.user
      ? `${s.primarySurgeon.user.firstName} ${s.primarySurgeon.user.lastName}`
      : "Non renseigné",
    hospital: s.hospital?.name || "Non renseigné",
    complications: s.complications || undefined,
    notes: s.notes || undefined,
  };
}

function mapAdmission(a: any) {
  return {
    id: a.id,
    admissionDate: toIso(a.admissionDate) || new Date().toISOString(),
    dischargeDate: toIso(a.dischargeDate),
    reason: a.admissionReason || "",
    diagnosis: a.diagnosisAtDischarge || a.diagnosisAtAdmission || "",
    treatment: a.notes || "",
    hospital: a.hospital?.name || "Non renseigné",
    attendingPhysician: a.admittingDoctor?.user
      ? `${a.admittingDoctor.user.firstName} ${a.admittingDoctor.user.lastName}`
      : "Non renseigné",
  };
}

function mapMedication(m: any) {
  return {
    id: m.id,
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency,
    startDate: toIso(m.startDate) || new Date().toISOString(),
    endDate: toIso(m.endDate),
    prescribedBy: m.prescribedBy || "Non renseigné",
    indication: m.indication || "",
    status: m.status || "ACTIVE",
  };
}

/**
 * GET /patients/:patientId/medical-record
 * Aggregate DME shaped for the web MedicalRecord type.
 */
export async function getMedicalRecord(req: Request, res: Response) {
  const { patientId } = req.params;

  try {
    const patient = await assertPatientExists(patientId);
    if (!patient) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const [
      allergies,
      medicalHistories,
      vaccinations,
      chronicConditions,
      familyHistories,
      socialHistory,
      emergencyContacts,
      examResults,
      medicalImages,
      currentMedications,
      surgeries,
      admissions,
    ] = await Promise.all([
      db.patientAllergy.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      db.medicalHistory.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      db.vaccination.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      db.chronicCondition.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      db.familyHistory.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      db.socialHistory.findUnique({ where: { patientId } }),
      db.patientEmergencyContact.findMany({
        where: { patientId },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      }),
      db.examResult.findMany({ where: { patientId }, orderBy: { orderDate: "desc" } }),
      db.medicalImage.findMany({ where: { patientId }, orderBy: { studyDate: "desc" } }),
      db.currentMedication.findMany({ where: { patientId }, orderBy: { startDate: "desc" } }),
      db.surgery.findMany({
        where: { patientId },
        include: {
          hospital: true,
          primarySurgeon: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.admission.findMany({
        where: { patientId },
        include: {
          hospital: true,
          admittingDoctor: { include: { user: true } },
        },
        orderBy: { admissionDate: "desc" },
      }),
    ]);

    // Access audit skipped here: PatientAccessLog requires authenticated userId

    const chronicDiseaseNames = [
      ...new Set([
        ...chronicConditions.filter((c) => c.status === "ACTIVE").map((c) => c.condition),
        ...medicalHistories.map((h) => h.condition),
      ]),
    ];

    const medicalRecord = {
      id: `MR-${patient.id}`,
      patientId: patient.id,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        fileNumber: patient.fileNumber,
      },
      createdAt: toIso(patient.createdAt),
      updatedAt: toIso(patient.updatedAt),
      medicalHistory: {
        id: `MH-${patient.id}`,
        patientId: patient.id,
        chronicDiseases: chronicDiseaseNames,
        surgicalHistory: surgeries.map(mapSurgery),
        hospitalizations: admissions.map(mapAdmission),
        medications: currentMedications.map(mapMedication),
        createdAt: toIso(patient.createdAt),
        updatedAt: toIso(patient.updatedAt),
      },
      allergies: allergies.map(mapAllergy),
      examResults: examResults.map(mapExamResult),
      medicalImages: medicalImages.map(mapMedicalImage),
      vaccinations: vaccinations.map(mapVaccination),
      chronicConditions: chronicConditions.map(mapChronicCondition),
      familyHistory: familyHistories.map(mapFamilyHistory),
      socialHistory: mapSocialHistory(socialHistory, patientId),
      emergencyContacts: emergencyContacts.map(mapEmergencyContact),
    };

    return res.status(200).json({ data: medicalRecord, error: null });
  } catch (error) {
    console.error("getMedicalRecord error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Allergies ----------

export async function createAllergy(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const reaction = Array.isArray(body.reaction)
      ? JSON.stringify(body.reaction)
      : body.reaction || null;

    const allergy = await db.patientAllergy.create({
      data: {
        patientId,
        allergen: body.allergen,
        allergenType: body.allergenType || "OTHER",
        severity: body.severity || "MILD",
        reaction,
        onsetDate: body.onsetDate ? new Date(body.onsetDate) : undefined,
        diagnosedDate: body.onsetDate || body.diagnosedDate
          ? new Date(body.onsetDate || body.diagnosedDate)
          : undefined,
        diagnosedBy: body.diagnosedBy,
        notes: body.notes,
        isActive: body.isActive ?? true,
      },
    });

    return res.status(201).json({ data: mapAllergy(allergy), error: null });
  } catch (error) {
    console.error("createAllergy error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function updateAllergy(req: Request, res: Response) {
  const { patientId, id } = req.params;
  const body = req.body;

  try {
    const existing = await db.patientAllergy.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Allergy not found" });
    }

    const reaction =
      body.reaction !== undefined
        ? Array.isArray(body.reaction)
          ? JSON.stringify(body.reaction)
          : body.reaction
        : undefined;

    const allergy = await db.patientAllergy.update({
      where: { id },
      data: {
        allergen: body.allergen,
        allergenType: body.allergenType,
        severity: body.severity,
        reaction,
        onsetDate: body.onsetDate ? new Date(body.onsetDate) : undefined,
        diagnosedBy: body.diagnosedBy,
        notes: body.notes,
        isActive: body.isActive,
      },
    });

    return res.status(200).json({ data: mapAllergy(allergy), error: null });
  } catch (error) {
    console.error("updateAllergy error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function deleteAllergy(req: Request, res: Response) {
  const { patientId, id } = req.params;
  try {
    const existing = await db.patientAllergy.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Allergy not found" });
    }
    await db.patientAllergy.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteAllergy error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Vaccinations ----------

export async function createVaccination(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const vaccineName = body.vaccineName || body.vaccine;
    const vaccination = await db.vaccination.create({
      data: {
        patientId,
        vaccine: vaccineName,
        vaccineName,
        vaccineType: body.vaccineType,
        manufacturer: body.manufacturer,
        lotNumber: body.lotNumber,
        administrationDate: body.administrationDate
          ? new Date(body.administrationDate)
          : new Date(),
        administeredBy: body.administeredBy,
        site: body.site,
        doseNumber: body.doseNumber,
        totalDoses: body.totalDoses,
        nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : undefined,
        reactions: Array.isArray(body.reactions)
          ? JSON.stringify(body.reactions)
          : body.reactions,
        notes: body.notes,
        date: body.administrationDate ? new Date(body.administrationDate) : new Date(),
      },
    });

    return res.status(201).json({ data: mapVaccination(vaccination), error: null });
  } catch (error) {
    console.error("createVaccination error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function updateVaccination(req: Request, res: Response) {
  const { patientId, id } = req.params;
  const body = req.body;

  try {
    const existing = await db.vaccination.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Vaccination not found" });
    }

    const vaccineName = body.vaccineName || body.vaccine;
    const vaccination = await db.vaccination.update({
      where: { id },
      data: {
        vaccine: vaccineName ?? existing.vaccine,
        vaccineName,
        vaccineType: body.vaccineType,
        manufacturer: body.manufacturer,
        lotNumber: body.lotNumber,
        administrationDate: body.administrationDate
          ? new Date(body.administrationDate)
          : undefined,
        administeredBy: body.administeredBy,
        site: body.site,
        doseNumber: body.doseNumber,
        totalDoses: body.totalDoses,
        nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : undefined,
        reactions:
          body.reactions !== undefined
            ? Array.isArray(body.reactions)
              ? JSON.stringify(body.reactions)
              : body.reactions
            : undefined,
        notes: body.notes,
      },
    });

    return res.status(200).json({ data: mapVaccination(vaccination), error: null });
  } catch (error) {
    console.error("updateVaccination error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function deleteVaccination(req: Request, res: Response) {
  const { patientId, id } = req.params;
  try {
    const existing = await db.vaccination.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Vaccination not found" });
    }
    await db.vaccination.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteVaccination error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Chronic conditions ----------

export async function createChronicCondition(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const condition = await db.chronicCondition.create({
      data: {
        patientId,
        condition: body.condition,
        icdCode: body.icdCode,
        diagnosisDate: body.diagnosisDate ? new Date(body.diagnosisDate) : new Date(),
        diagnosedBy: body.diagnosedBy,
        severity: body.severity || "MODERATE",
        status: body.status || "ACTIVE",
        treatmentPlan: body.treatmentPlan,
        lastReviewDate: body.lastReviewDate ? new Date(body.lastReviewDate) : undefined,
        nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : undefined,
        notes: body.notes,
      },
    });

    return res.status(201).json({ data: mapChronicCondition(condition), error: null });
  } catch (error) {
    console.error("createChronicCondition error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function updateChronicCondition(req: Request, res: Response) {
  const { patientId, id } = req.params;
  const body = req.body;

  try {
    const existing = await db.chronicCondition.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Chronic condition not found" });
    }

    const condition = await db.chronicCondition.update({
      where: { id },
      data: {
        condition: body.condition,
        icdCode: body.icdCode,
        diagnosisDate: body.diagnosisDate ? new Date(body.diagnosisDate) : undefined,
        diagnosedBy: body.diagnosedBy,
        severity: body.severity,
        status: body.status,
        treatmentPlan: body.treatmentPlan,
        lastReviewDate: body.lastReviewDate ? new Date(body.lastReviewDate) : undefined,
        nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : undefined,
        notes: body.notes,
      },
    });

    return res.status(200).json({ data: mapChronicCondition(condition), error: null });
  } catch (error) {
    console.error("updateChronicCondition error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function deleteChronicCondition(req: Request, res: Response) {
  const { patientId, id } = req.params;
  try {
    const existing = await db.chronicCondition.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Chronic condition not found" });
    }
    await db.chronicCondition.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteChronicCondition error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Family history ----------

export async function createFamilyHistory(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const item = await db.familyHistory.create({
      data: {
        patientId,
        relation: body.relation,
        condition: body.condition,
        ageOfOnset: body.ageOfOnset,
        isDeceased: body.isDeceased ?? false,
        causeOfDeath: body.causeOfDeath,
        notes: body.notes,
      },
    });

    return res.status(201).json({ data: mapFamilyHistory(item), error: null });
  } catch (error) {
    console.error("createFamilyHistory error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function updateFamilyHistory(req: Request, res: Response) {
  const { patientId, id } = req.params;
  const body = req.body;

  try {
    const existing = await db.familyHistory.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Family history not found" });
    }

    const item = await db.familyHistory.update({
      where: { id },
      data: {
        relation: body.relation,
        condition: body.condition,
        ageOfOnset: body.ageOfOnset,
        isDeceased: body.isDeceased,
        causeOfDeath: body.causeOfDeath,
        notes: body.notes,
      },
    });

    return res.status(200).json({ data: mapFamilyHistory(item), error: null });
  } catch (error) {
    console.error("updateFamilyHistory error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function deleteFamilyHistory(req: Request, res: Response) {
  const { patientId, id } = req.params;
  try {
    const existing = await db.familyHistory.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Family history not found" });
    }
    await db.familyHistory.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteFamilyHistory error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Social history (upsert) ----------

export async function upsertSocialHistory(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const data = {
      smokingStatus: body.smokingStatus || "NEVER",
      smokingDetails: body.smokingDetails ?? undefined,
      alcoholUse: body.alcoholUse || "NEVER",
      alcoholDetails: body.alcoholDetails ?? undefined,
      drugUse: body.drugUse || "NEVER",
      drugDetails: body.drugDetails ?? undefined,
      occupation: body.occupation,
      maritalStatus: body.maritalStatus,
      education: body.education,
      livingArrangement: body.livingArrangement,
      exerciseFrequency: body.exerciseFrequency,
      dietType: body.dietType,
    };

    const social = await db.socialHistory.upsert({
      where: { patientId },
      create: { patientId, ...data },
      update: data,
    });

    return res.status(200).json({ data: mapSocialHistory(social, patientId), error: null });
  } catch (error) {
    console.error("upsertSocialHistory error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Emergency contacts ----------

export async function createEmergencyContact(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    if (body.isPrimary) {
      await db.patientEmergencyContact.updateMany({
        where: { patientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await db.patientEmergencyContact.create({
      data: {
        patientId,
        name: body.name,
        relationship: body.relationship,
        phoneNumber: body.phoneNumber,
        alternatePhone: body.alternatePhone,
        email: body.email,
        address: body.address ?? undefined,
        isPrimary: body.isPrimary ?? false,
        canMakeDecisions: body.canMakeDecisions ?? false,
        notes: body.notes,
      },
    });

    return res.status(201).json({ data: mapEmergencyContact(contact), error: null });
  } catch (error) {
    console.error("createEmergencyContact error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function updateEmergencyContact(req: Request, res: Response) {
  const { patientId, id } = req.params;
  const body = req.body;

  try {
    const existing = await db.patientEmergencyContact.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Emergency contact not found" });
    }

    if (body.isPrimary) {
      await db.patientEmergencyContact.updateMany({
        where: { patientId, isPrimary: true, NOT: { id } },
        data: { isPrimary: false },
      });
    }

    const contact = await db.patientEmergencyContact.update({
      where: { id },
      data: {
        name: body.name,
        relationship: body.relationship,
        phoneNumber: body.phoneNumber,
        alternatePhone: body.alternatePhone,
        email: body.email,
        address: body.address,
        isPrimary: body.isPrimary,
        canMakeDecisions: body.canMakeDecisions,
        notes: body.notes,
      },
    });

    return res.status(200).json({ data: mapEmergencyContact(contact), error: null });
  } catch (error) {
    console.error("updateEmergencyContact error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function deleteEmergencyContact(req: Request, res: Response) {
  const { patientId, id } = req.params;
  try {
    const existing = await db.patientEmergencyContact.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Emergency contact not found" });
    }
    await db.patientEmergencyContact.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteEmergencyContact error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Exam results ----------

export async function createExamResult(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const exam = await db.examResult.create({
      data: {
        patientId,
        examType: body.examType || "OTHER",
        examName: body.examName,
        orderedBy: body.orderedBy,
        performedBy: body.performedBy,
        orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
        performedDate: body.performedDate ? new Date(body.performedDate) : undefined,
        resultDate: body.resultDate ? new Date(body.resultDate) : undefined,
        results: body.results ?? [],
        interpretation: body.interpretation,
        status: body.status || "ORDERED",
        priority: body.priority || "ROUTINE",
        attachments: body.attachments || [],
        notes: body.notes,
      },
    });

    return res.status(201).json({ data: mapExamResult(exam), error: null });
  } catch (error) {
    console.error("createExamResult error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function updateExamResult(req: Request, res: Response) {
  const { patientId, id } = req.params;
  const body = req.body;

  try {
    const existing = await db.examResult.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Exam result not found" });
    }

    const exam = await db.examResult.update({
      where: { id },
      data: {
        examType: body.examType,
        examName: body.examName,
        orderedBy: body.orderedBy,
        performedBy: body.performedBy,
        orderDate: body.orderDate ? new Date(body.orderDate) : undefined,
        performedDate: body.performedDate ? new Date(body.performedDate) : undefined,
        resultDate: body.resultDate ? new Date(body.resultDate) : undefined,
        results: body.results,
        interpretation: body.interpretation,
        status: body.status,
        priority: body.priority,
        attachments: body.attachments,
        notes: body.notes,
      },
    });

    return res.status(200).json({ data: mapExamResult(exam), error: null });
  } catch (error) {
    console.error("updateExamResult error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function deleteExamResult(req: Request, res: Response) {
  const { patientId, id } = req.params;
  try {
    const existing = await db.examResult.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Exam result not found" });
    }
    await db.examResult.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteExamResult error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Medical images ----------

export async function createMedicalImage(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const image = await db.medicalImage.create({
      data: {
        patientId,
        imageType: body.imageType || "OTHER",
        bodyPart: body.bodyPart,
        studyDate: body.studyDate ? new Date(body.studyDate) : new Date(),
        orderedBy: body.orderedBy,
        performedBy: body.performedBy,
        radiologist: body.radiologist,
        indication: body.indication,
        findings: body.findings,
        impression: body.impression,
        recommendations: body.recommendations,
        imageUrls: body.imageUrls || [],
        dicomUrls: body.dicomUrls || [],
        status: body.status || "SCHEDULED",
        priority: body.priority || "ROUTINE",
      },
    });

    return res.status(201).json({ data: mapMedicalImage(image), error: null });
  } catch (error) {
    console.error("createMedicalImage error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function updateMedicalImage(req: Request, res: Response) {
  const { patientId, id } = req.params;
  const body = req.body;

  try {
    const existing = await db.medicalImage.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Medical image not found" });
    }

    const image = await db.medicalImage.update({
      where: { id },
      data: {
        imageType: body.imageType,
        bodyPart: body.bodyPart,
        studyDate: body.studyDate ? new Date(body.studyDate) : undefined,
        orderedBy: body.orderedBy,
        performedBy: body.performedBy,
        radiologist: body.radiologist,
        indication: body.indication,
        findings: body.findings,
        impression: body.impression,
        recommendations: body.recommendations,
        imageUrls: body.imageUrls,
        dicomUrls: body.dicomUrls,
        status: body.status,
        priority: body.priority,
      },
    });

    return res.status(200).json({ data: mapMedicalImage(image), error: null });
  } catch (error) {
    console.error("updateMedicalImage error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function deleteMedicalImage(req: Request, res: Response) {
  const { patientId, id } = req.params;
  try {
    const existing = await db.medicalImage.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Medical image not found" });
    }
    await db.medicalImage.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteMedicalImage error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

// ---------- Current medications ----------

export async function createCurrentMedication(req: Request, res: Response) {
  const { patientId } = req.params;
  const body = req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    const med = await db.currentMedication.create({
      data: {
        patientId,
        name: body.name,
        dosage: body.dosage,
        frequency: body.frequency,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        prescribedBy: body.prescribedBy,
        indication: body.indication,
        status: body.status || "ACTIVE",
        notes: body.notes,
      },
    });

    return res.status(201).json({ data: mapMedication(med), error: null });
  } catch (error) {
    console.error("createCurrentMedication error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function updateCurrentMedication(req: Request, res: Response) {
  const { patientId, id } = req.params;
  const body = req.body;

  try {
    const existing = await db.currentMedication.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Medication not found" });
    }

    const med = await db.currentMedication.update({
      where: { id },
      data: {
        name: body.name,
        dosage: body.dosage,
        frequency: body.frequency,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        prescribedBy: body.prescribedBy,
        indication: body.indication,
        status: body.status,
        notes: body.notes,
      },
    });

    return res.status(200).json({ data: mapMedication(med), error: null });
  } catch (error) {
    console.error("updateCurrentMedication error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

export async function deleteCurrentMedication(req: Request, res: Response) {
  const { patientId, id } = req.params;
  try {
    const existing = await db.currentMedication.findFirst({ where: { id, patientId } });
    if (!existing) {
      return res.status(404).json({ data: null, error: "Medication not found" });
    }
    await db.currentMedication.delete({ where: { id } });
    return res.status(200).json({ data: { id }, error: null });
  } catch (error) {
    console.error("deleteCurrentMedication error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}

/**
 * Replace an entire section list (sync create/update/delete by id).
 * Used by the DME UI which edits sections as arrays in memory.
 */
export async function syncSection(req: Request, res: Response) {
  const { patientId, section } = req.params;
  const items: any[] = Array.isArray(req.body?.items) ? req.body.items : req.body;

  try {
    if (!(await assertPatientExists(patientId))) {
      return res.status(404).json({ data: null, error: "Patient not found" });
    }

    if (section === "social-history") {
      const body = Array.isArray(items) ? items[0] : req.body;
      req.body = body;
      return upsertSocialHistory(req, res);
    }

    // For list sections: upsert provided items and delete missing ones
    const handlers: Record<
      string,
      {
        findMany: () => Promise<{ id: string }[]>;
        create: (item: any) => Promise<any>;
        update: (id: string, item: any) => Promise<any>;
        remove: (id: string) => Promise<any>;
        map: (row: any) => any;
      }
    > = {
      allergies: {
        findMany: () => db.patientAllergy.findMany({ where: { patientId }, select: { id: true } }),
        create: async (item) => {
          const reaction = Array.isArray(item.reaction)
            ? JSON.stringify(item.reaction)
            : item.reaction || null;
          return db.patientAllergy.create({
            data: {
              patientId,
              allergen: item.allergen,
              allergenType: item.allergenType || "OTHER",
              severity: item.severity || "MILD",
              reaction,
              onsetDate: item.onsetDate ? new Date(item.onsetDate) : undefined,
              diagnosedBy: item.diagnosedBy,
              notes: item.notes,
              isActive: item.isActive ?? true,
            },
          });
        },
        update: async (id, item) => {
          const reaction =
            item.reaction !== undefined
              ? Array.isArray(item.reaction)
                ? JSON.stringify(item.reaction)
                : item.reaction
              : undefined;
          return db.patientAllergy.update({
            where: { id },
            data: {
              allergen: item.allergen,
              allergenType: item.allergenType,
              severity: item.severity,
              reaction,
              onsetDate: item.onsetDate ? new Date(item.onsetDate) : undefined,
              diagnosedBy: item.diagnosedBy,
              notes: item.notes,
              isActive: item.isActive,
            },
          });
        },
        remove: (id) => db.patientAllergy.delete({ where: { id } }),
        map: mapAllergy,
      },
      vaccinations: {
        findMany: () => db.vaccination.findMany({ where: { patientId }, select: { id: true } }),
        create: async (item) => {
          const vaccineName = item.vaccineName || item.vaccine;
          return db.vaccination.create({
            data: {
              patientId,
              vaccine: vaccineName,
              vaccineName,
              vaccineType: item.vaccineType,
              manufacturer: item.manufacturer,
              lotNumber: item.lotNumber,
              administrationDate: item.administrationDate
                ? new Date(item.administrationDate)
                : new Date(),
              administeredBy: item.administeredBy,
              site: item.site,
              doseNumber: item.doseNumber,
              totalDoses: item.totalDoses,
              nextDueDate: item.nextDueDate ? new Date(item.nextDueDate) : undefined,
              reactions: Array.isArray(item.reactions)
                ? JSON.stringify(item.reactions)
                : item.reactions,
              notes: item.notes,
              date: item.administrationDate ? new Date(item.administrationDate) : new Date(),
            },
          });
        },
        update: async (id, item) => {
          const vaccineName = item.vaccineName || item.vaccine;
          return db.vaccination.update({
            where: { id },
            data: {
              vaccine: vaccineName,
              vaccineName,
              vaccineType: item.vaccineType,
              manufacturer: item.manufacturer,
              lotNumber: item.lotNumber,
              administrationDate: item.administrationDate
                ? new Date(item.administrationDate)
                : undefined,
              administeredBy: item.administeredBy,
              site: item.site,
              doseNumber: item.doseNumber,
              totalDoses: item.totalDoses,
              nextDueDate: item.nextDueDate ? new Date(item.nextDueDate) : undefined,
              reactions: Array.isArray(item.reactions)
                ? JSON.stringify(item.reactions)
                : item.reactions,
              notes: item.notes,
            },
          });
        },
        remove: (id) => db.vaccination.delete({ where: { id } }),
        map: mapVaccination,
      },
      "chronic-conditions": {
        findMany: () =>
          db.chronicCondition.findMany({ where: { patientId }, select: { id: true } }),
        create: async (item) =>
          db.chronicCondition.create({
            data: {
              patientId,
              condition: item.condition,
              icdCode: item.icdCode,
              diagnosisDate: item.diagnosisDate ? new Date(item.diagnosisDate) : new Date(),
              diagnosedBy: item.diagnosedBy,
              severity: item.severity || "MODERATE",
              status: item.status || "ACTIVE",
              treatmentPlan: item.treatmentPlan,
              lastReviewDate: item.lastReviewDate ? new Date(item.lastReviewDate) : undefined,
              nextReviewDate: item.nextReviewDate ? new Date(item.nextReviewDate) : undefined,
              notes: item.notes,
            },
          }),
        update: async (id, item) =>
          db.chronicCondition.update({
            where: { id },
            data: {
              condition: item.condition,
              icdCode: item.icdCode,
              diagnosisDate: item.diagnosisDate ? new Date(item.diagnosisDate) : undefined,
              diagnosedBy: item.diagnosedBy,
              severity: item.severity,
              status: item.status,
              treatmentPlan: item.treatmentPlan,
              lastReviewDate: item.lastReviewDate ? new Date(item.lastReviewDate) : undefined,
              nextReviewDate: item.nextReviewDate ? new Date(item.nextReviewDate) : undefined,
              notes: item.notes,
            },
          }),
        remove: (id) => db.chronicCondition.delete({ where: { id } }),
        map: mapChronicCondition,
      },
      "family-history": {
        findMany: () => db.familyHistory.findMany({ where: { patientId }, select: { id: true } }),
        create: async (item) =>
          db.familyHistory.create({
            data: {
              patientId,
              relation: item.relation,
              condition: item.condition,
              ageOfOnset: item.ageOfOnset,
              isDeceased: item.isDeceased ?? false,
              causeOfDeath: item.causeOfDeath,
              notes: item.notes,
            },
          }),
        update: async (id, item) =>
          db.familyHistory.update({
            where: { id },
            data: {
              relation: item.relation,
              condition: item.condition,
              ageOfOnset: item.ageOfOnset,
              isDeceased: item.isDeceased,
              causeOfDeath: item.causeOfDeath,
              notes: item.notes,
            },
          }),
        remove: (id) => db.familyHistory.delete({ where: { id } }),
        map: mapFamilyHistory,
      },
      "emergency-contacts": {
        findMany: () =>
          db.patientEmergencyContact.findMany({ where: { patientId }, select: { id: true } }),
        create: async (item) =>
          db.patientEmergencyContact.create({
            data: {
              patientId,
              name: item.name,
              relationship: item.relationship,
              phoneNumber: item.phoneNumber,
              alternatePhone: item.alternatePhone,
              email: item.email,
              address: item.address ?? undefined,
              isPrimary: item.isPrimary ?? false,
              canMakeDecisions: item.canMakeDecisions ?? false,
              notes: item.notes,
            },
          }),
        update: async (id, item) =>
          db.patientEmergencyContact.update({
            where: { id },
            data: {
              name: item.name,
              relationship: item.relationship,
              phoneNumber: item.phoneNumber,
              alternatePhone: item.alternatePhone,
              email: item.email,
              address: item.address,
              isPrimary: item.isPrimary,
              canMakeDecisions: item.canMakeDecisions,
              notes: item.notes,
            },
          }),
        remove: (id) => db.patientEmergencyContact.delete({ where: { id } }),
        map: mapEmergencyContact,
      },
      "exam-results": {
        findMany: () => db.examResult.findMany({ where: { patientId }, select: { id: true } }),
        create: async (item) =>
          db.examResult.create({
            data: {
              patientId,
              examType: item.examType || "OTHER",
              examName: item.examName,
              orderedBy: item.orderedBy,
              performedBy: item.performedBy,
              orderDate: item.orderDate ? new Date(item.orderDate) : new Date(),
              performedDate: item.performedDate ? new Date(item.performedDate) : undefined,
              resultDate: item.resultDate ? new Date(item.resultDate) : undefined,
              results: item.results ?? [],
              interpretation: item.interpretation,
              status: item.status || "ORDERED",
              priority: item.priority || "ROUTINE",
              attachments: item.attachments || [],
              notes: item.notes,
            },
          }),
        update: async (id, item) =>
          db.examResult.update({
            where: { id },
            data: {
              examType: item.examType,
              examName: item.examName,
              orderedBy: item.orderedBy,
              performedBy: item.performedBy,
              orderDate: item.orderDate ? new Date(item.orderDate) : undefined,
              performedDate: item.performedDate ? new Date(item.performedDate) : undefined,
              resultDate: item.resultDate ? new Date(item.resultDate) : undefined,
              results: item.results,
              interpretation: item.interpretation,
              status: item.status,
              priority: item.priority,
              attachments: item.attachments,
              notes: item.notes,
            },
          }),
        remove: (id) => db.examResult.delete({ where: { id } }),
        map: mapExamResult,
      },
      "medical-images": {
        findMany: () => db.medicalImage.findMany({ where: { patientId }, select: { id: true } }),
        create: async (item) =>
          db.medicalImage.create({
            data: {
              patientId,
              imageType: item.imageType || "OTHER",
              bodyPart: item.bodyPart,
              studyDate: item.studyDate ? new Date(item.studyDate) : new Date(),
              orderedBy: item.orderedBy,
              performedBy: item.performedBy,
              radiologist: item.radiologist,
              indication: item.indication,
              findings: item.findings,
              impression: item.impression,
              recommendations: item.recommendations,
              imageUrls: item.imageUrls || [],
              dicomUrls: item.dicomUrls || [],
              status: item.status || "SCHEDULED",
              priority: item.priority || "ROUTINE",
            },
          }),
        update: async (id, item) =>
          db.medicalImage.update({
            where: { id },
            data: {
              imageType: item.imageType,
              bodyPart: item.bodyPart,
              studyDate: item.studyDate ? new Date(item.studyDate) : undefined,
              orderedBy: item.orderedBy,
              performedBy: item.performedBy,
              radiologist: item.radiologist,
              indication: item.indication,
              findings: item.findings,
              impression: item.impression,
              recommendations: item.recommendations,
              imageUrls: item.imageUrls,
              dicomUrls: item.dicomUrls,
              status: item.status,
              priority: item.priority,
            },
          }),
        remove: (id) => db.medicalImage.delete({ where: { id } }),
        map: mapMedicalImage,
      },
    };

    const handler = handlers[section];
    if (!handler) {
      return res.status(400).json({ data: null, error: `Unknown section: ${section}` });
    }

    const existing = await handler.findMany();
    const existingIds = new Set(existing.map((e) => e.id));
    const incomingIds = new Set(
      items.filter((i) => i.id && existingIds.has(i.id)).map((i) => i.id as string)
    );

    // Delete removed
    for (const row of existing) {
      if (!incomingIds.has(row.id)) {
        await handler.remove(row.id);
      }
    }

    const result = [];
    for (const item of items) {
      if (item.id && existingIds.has(item.id)) {
        result.push(handler.map(await handler.update(item.id, item)));
      } else {
        result.push(handler.map(await handler.create(item)));
      }
    }

    return res.status(200).json({ data: result, error: null });
  } catch (error) {
    console.error("syncSection error:", error);
    return res.status(500).json({ data: null, error: "Something went wrong" });
  }
}
