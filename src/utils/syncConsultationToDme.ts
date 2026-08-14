import { db } from "@/db/db";

type AllergyInput = {
  allergen?: string;
  type?: string;
  allergenType?: string;
  reaction?: string | string[];
  severity?: string;
  notes?: string;
  diagnosis?: string;
};

type FamilyInput = {
  relationship?: string;
  relation?: string;
  condition?: string;
  age?: string | number;
  status?: string;
  notes?: string;
};

type MedicalEventInput = {
  type?: string;
  description?: string;
  condition?: string;
  year?: string;
  date?: string;
  treatment?: string;
  notes?: string;
  severity?: string;
};

type ConditionInput = {
  name?: string;
  condition?: string;
  severity?: string;
  status?: string;
  notes?: string;
};

type MedicationInput = {
  name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

type VaccinationInput = {
  name?: string;
  vaccineName?: string;
  date?: string;
  nextDue?: string;
  status?: string;
};

/** Subset of the consultation POST body used to feed the DME. */
export type ConsultationDmePayload = {
  medicalHistory?: {
    medicalEvents?: MedicalEventInput[];
    familyHistory?: string | FamilyInput[];
    familyHistories?: FamilyInput[];
    allergies?: string | AllergyInput[];
    allergyList?: AllergyInput[];
  };
  additionalAnamnesis?: {
    familyHistory?: FamilyInput[];
    allergies?: AllergyInput[];
    vaccinations?: VaccinationInput[];
    lifestyle?: {
      smoking?: { status?: string; quantity?: string };
      alcohol?: { status?: string; frequency?: string; type?: string };
      diet?: { type?: string };
      physicalActivity?: { frequency?: string };
    };
    socialHistory?: {
      occupation?: { current?: string };
      livingConditions?: { type?: string };
    };
  };
  patientBackground?: {
    conditions?: ConditionInput[];
    conditionDetails?: string;
  };
  treatment?: {
    medications?: MedicationInput[];
    treatmentPlan?: string;
  };
};

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function splitList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapAllergenType(raw: unknown): string {
  const v = norm(raw);
  if (v.includes("medic") || v.includes("médic")) return "MEDICATION";
  if (v.includes("aliment") || v.includes("food")) return "FOOD";
  if (v.includes("environ")) return "ENVIRONMENTAL";
  return "OTHER";
}

function mapAllergySeverity(raw: unknown): string {
  const v = norm(raw);
  if (v.includes("life") || v.includes("mortel") || v.includes("critique") || v.includes("critical")) {
    return "LIFE_THREATENING";
  }
  if (v.includes("sev") || v.includes("sév")) return "SEVERE";
  if (v.includes("mod")) return "MODERATE";
  return "MILD";
}

function mapConditionSeverity(raw: unknown): string {
  const v = norm(raw);
  if (v.includes("sev") || v.includes("sév") || v.includes("critique") || v.includes("critical")) {
    return "SEVERE";
  }
  if (v.includes("mild") || v.includes("lég")) return "MILD";
  return "MODERATE";
}

function mapConditionStatus(raw: unknown): string {
  const v = norm(raw);
  if (v.includes("remiss")) return "REMISSION";
  if (v.includes("resol") || v.includes("inactif") || v.includes("inactive")) return "RESOLVED";
  return "ACTIVE";
}

function mapFamilyRelation(raw: unknown): string {
  const v = norm(raw);
  if (v.includes("père") || v.includes("pere") || v.includes("father") || v === "papa") return "FATHER";
  if (v.includes("mère") || v.includes("mere") || v.includes("mother") || v === "maman") return "MOTHER";
  if (v.includes("frère") || v.includes("frere") || v.includes("sœur") || v.includes("soeur") || v.includes("sibling")) {
    return "SIBLING";
  }
  if (v.includes("grand")) return "GRANDPARENT";
  if (v.includes("tante") || v.includes("oncle") || v.includes("aunt") || v.includes("uncle")) return "AUNT_UNCLE";
  if (v.includes("cousin")) return "COUSIN";
  return "OTHER";
}

function mapSmokingStatus(raw: unknown): string {
  const v = norm(raw);
  if (!v) return "NEVER";
  if (v.includes("ex") || v.includes("former") || v.includes("arrêt") || v.includes("arret")) return "FORMER";
  if (v.includes("non-fum") || v.includes("never") || v.includes("abstin") || v === "non") return "NEVER";
  if (v.includes("fum") || v.includes("current") || v.includes("oui") || v.includes("régul") || v.includes("occas")) {
    return "CURRENT";
  }
  return "NEVER";
}

function mapAlcoholUse(raw: unknown): string {
  const v = norm(raw);
  if (!v) return "NEVER";
  if (v.includes("import") || v.includes("heavy") || v.includes("élev")) return "HEAVY";
  if (v.includes("modér") || v.includes("moder")) return "MODERATE";
  if (v.includes("occas") || v.includes("parfois")) return "OCCASIONAL";
  if (v.includes("abstin") || v.includes("never") || v.includes("non") || v.includes("jamais")) return "NEVER";
  return "OCCASIONAL";
}

function mapDietType(raw: unknown): string | undefined {
  const v = norm(raw);
  if (!v) return undefined;
  if (v.includes("vegan") || v.includes("végétalien") || v.includes("vegetalien")) return "VEGAN";
  if (v.includes("végét") || v.includes("veget")) return "VEGETARIAN";
  if (v.includes("gluten")) return "GLUTEN_FREE";
  if (v.includes("diab")) return "DIABETIC";
  if (v.includes("standard") || v.includes("regular") || v.includes("normal")) return "REGULAR";
  return "OTHER";
}

function mapExerciseFrequency(raw: unknown): string | undefined {
  const v = norm(raw);
  if (!v) return undefined;
  if (v.includes("quot") || v.includes("daily") || v.includes("jour")) return "DAILY";
  if (v.includes("semain") || v.includes("week")) return "WEEKLY";
  if (v.includes("rare") || v.includes("parfois")) return "RARELY";
  if (v.includes("jamais") || v.includes("never") || v.includes("aucun")) return "NEVER";
  return "WEEKLY";
}

function yearToDate(year: unknown, fallback?: unknown): Date | undefined {
  if (typeof fallback === "string" && fallback && !Number.isNaN(Date.parse(fallback))) {
    return new Date(fallback);
  }
  const y = String(year ?? "").trim();
  if (/^\d{4}$/.test(y)) return new Date(`${y}-01-01T00:00:00.000Z`);
  return undefined;
}

/**
 * Persist consultation form sections into the patient DME.
 * Idempotent on allergen / condition / family relation+condition / active medication name.
 */
export async function syncConsultationToDme(
  patientId: string,
  data: ConsultationDmePayload,
  prescribedBy?: string
): Promise<void> {
  const history = data.medicalHistory;
  const anamnesis = data.additionalAnamnesis;
  const background = data.patientBackground;
  const treatment = data.treatment;

  const allergyInputs: AllergyInput[] = [];
  if (Array.isArray(anamnesis?.allergies)) {
    allergyInputs.push(...anamnesis.allergies);
  }
  if (Array.isArray(history?.allergyList)) {
    allergyInputs.push(...history.allergyList);
  }
  if (Array.isArray(history?.allergies)) {
    for (const item of history.allergies) {
      if (typeof item === "string") {
        allergyInputs.push({ allergen: item, type: "OTHER", severity: "MILD" });
      } else {
        allergyInputs.push(item);
      }
    }
  } else {
    for (const allergen of splitList(history?.allergies)) {
      allergyInputs.push({ allergen, type: "OTHER", severity: "MILD" });
    }
  }

  const existingAllergies = await db.patientAllergy.findMany({
    where: { patientId },
    select: { allergen: true },
  });
  const knownAllergens = new Set(existingAllergies.map((a) => norm(a.allergen)));

  for (const item of allergyInputs) {
    const allergen = (item.allergen || "").trim();
    if (!allergen || knownAllergens.has(norm(allergen))) continue;
    const reaction = Array.isArray(item.reaction)
      ? JSON.stringify(item.reaction)
      : item.reaction || null;
    await db.patientAllergy.create({
      data: {
        patientId,
        allergen,
        allergenType: mapAllergenType(item.allergenType || item.type),
        severity: mapAllergySeverity(item.severity),
        reaction,
        notes: item.notes || undefined,
        diagnosedDate: yearToDate(item.diagnosis),
        isActive: true,
      },
    });
    knownAllergens.add(norm(allergen));
  }

  const eventInputs: MedicalEventInput[] = Array.isArray(history?.medicalEvents)
    ? history.medicalEvents
    : [];
  const existingHistories = await db.medicalHistory.findMany({
    where: { patientId },
    select: { condition: true },
  });
  const knownConditions = new Set(existingHistories.map((h) => norm(h.condition)));

  for (const event of eventInputs) {
    const condition = (event.description || event.condition || "").trim();
    if (!condition || knownConditions.has(norm(condition))) continue;
    const diagnosedDate = yearToDate(event.year, event.date) || new Date();
    const notes = [event.type, event.treatment, event.notes].filter(Boolean).join(" — ") || null;
    await db.medicalHistory.create({
      data: {
        patientId,
        condition,
        notes,
        date: diagnosedDate,
        diagnosedDate,
      },
    });
    knownConditions.add(norm(condition));
  }

  const conditionInputs: ConditionInput[] = Array.isArray(background?.conditions)
    ? background.conditions
    : [];
  const existingChronic = await db.chronicCondition.findMany({
    where: { patientId },
    select: { condition: true },
  });
  const knownChronic = new Set(existingChronic.map((c) => norm(c.condition)));

  for (const item of conditionInputs) {
    const condition = (item.name || item.condition || "").trim();
    if (!condition || knownChronic.has(norm(condition))) continue;
    await db.chronicCondition.create({
      data: {
        patientId,
        condition,
        severity: mapConditionSeverity(item.severity),
        status: mapConditionStatus(item.status),
        notes: item.notes || background?.conditionDetails || undefined,
        diagnosedBy: prescribedBy || "Consultation",
      },
    });
    knownChronic.add(norm(condition));
  }

  const familyInputs: FamilyInput[] = [];
  if (Array.isArray(anamnesis?.familyHistory)) {
    familyInputs.push(...anamnesis.familyHistory);
  }
  if (Array.isArray(history?.familyHistories)) {
    familyInputs.push(...history.familyHistories);
  }
  if (Array.isArray(history?.familyHistory)) {
    familyInputs.push(...history.familyHistory);
  } else {
    const familyText = typeof history?.familyHistory === "string" ? history.familyHistory.trim() : "";
    if (familyText) {
      familyInputs.push({ relation: "OTHER", condition: familyText });
    }
  }

  const existingFamily = await db.familyHistory.findMany({
    where: { patientId },
    select: { relation: true, condition: true },
  });
  const knownFamily = new Set(existingFamily.map((f) => `${norm(f.relation)}|${norm(f.condition)}`));

  for (const item of familyInputs) {
    const condition = (item.condition || "").trim();
    if (!condition) continue;
    const relation = mapFamilyRelation(item.relation || item.relationship);
    const key = `${norm(relation)}|${norm(condition)}`;
    if (knownFamily.has(key)) continue;
    const age =
      item.age === undefined || item.age === ""
        ? undefined
        : Number.parseInt(String(item.age), 10);
    const status = norm(item.status);
    await db.familyHistory.create({
      data: {
        patientId,
        relation,
        condition,
        ageOfOnset: Number.isFinite(age) ? age : undefined,
        isDeceased: status.includes("décéd") || status.includes("deced") || status.includes("dead"),
        notes: item.notes || undefined,
      },
    });
    knownFamily.add(key);
  }

  const meds: MedicationInput[] = Array.isArray(treatment?.medications) ? treatment.medications : [];
  const existingMeds = await db.currentMedication.findMany({
    where: { patientId, status: "ACTIVE" },
    select: { name: true },
  });
  const knownMeds = new Set(existingMeds.map((m) => norm(m.name)));

  for (const med of meds) {
    const name = (med.name || "").trim();
    if (!name || knownMeds.has(norm(name))) continue;
    await db.currentMedication.create({
      data: {
        patientId,
        name,
        dosage: med.dosage || "Non renseigné",
        frequency: med.frequency || "Non renseigné",
        prescribedBy: prescribedBy || "Consultation",
        indication: med.instructions || treatment?.treatmentPlan || undefined,
        notes: med.duration ? `Durée: ${med.duration}` : undefined,
        status: "ACTIVE",
      },
    });
    knownMeds.add(norm(name));
  }

  const vaccines: VaccinationInput[] = Array.isArray(anamnesis?.vaccinations)
    ? anamnesis.vaccinations
    : [];
  const existingVaccines = await db.vaccination.findMany({
    where: { patientId },
    select: { vaccine: true, vaccineName: true },
  });
  const knownVaccines = new Set(
    existingVaccines.map((v) => norm(v.vaccineName || v.vaccine))
  );

  for (const vax of vaccines) {
    const name = (vax.name || vax.vaccineName || "").trim();
    if (!name || knownVaccines.has(norm(name))) continue;
    await db.vaccination.create({
      data: {
        patientId,
        vaccine: name,
        vaccineName: name,
        vaccineType: "OTHER",
        administrationDate: yearToDate(undefined, vax.date) || new Date(),
        nextDueDate: yearToDate(undefined, vax.nextDue),
        administeredBy: prescribedBy || "Consultation",
        notes: vax.status || undefined,
      },
    });
    knownVaccines.add(norm(name));
  }

  const lifestyle = anamnesis?.lifestyle;
  const social = anamnesis?.socialHistory;
  const hasSocialPayload =
    Boolean(lifestyle?.smoking?.status) ||
    Boolean(lifestyle?.alcohol?.status) ||
    Boolean(lifestyle?.alcohol?.frequency) ||
    Boolean(lifestyle?.diet?.type) ||
    Boolean(lifestyle?.physicalActivity?.frequency) ||
    Boolean(social?.occupation?.current) ||
    Boolean(social?.livingConditions?.type);

  if (hasSocialPayload) {
    const smokingStatus = mapSmokingStatus(lifestyle?.smoking?.status);
    const alcoholUse = mapAlcoholUse(
      lifestyle?.alcohol?.status || lifestyle?.alcohol?.frequency
    );
    await db.socialHistory.upsert({
      where: { patientId },
      create: {
        patientId,
        smokingStatus,
        smokingDetails: lifestyle?.smoking
          ? {
              quantity: lifestyle.smoking.quantity || undefined,
            }
          : undefined,
        alcoholUse,
        alcoholDetails: lifestyle?.alcohol
          ? {
              typeOfAlcohol: lifestyle.alcohol.type ? [lifestyle.alcohol.type] : undefined,
              frequency: lifestyle.alcohol.frequency || undefined,
            }
          : undefined,
        occupation: social?.occupation?.current || undefined,
        livingArrangement: social?.livingConditions?.type || undefined,
        dietType: mapDietType(lifestyle?.diet?.type),
        exerciseFrequency: mapExerciseFrequency(lifestyle?.physicalActivity?.frequency),
      },
      update: {
        smokingStatus,
        smokingDetails: lifestyle?.smoking
          ? {
              quantity: lifestyle.smoking.quantity || undefined,
            }
          : undefined,
        alcoholUse,
        alcoholDetails: lifestyle?.alcohol
          ? {
              typeOfAlcohol: lifestyle.alcohol.type ? [lifestyle.alcohol.type] : undefined,
              frequency: lifestyle.alcohol.frequency || undefined,
            }
          : undefined,
        occupation: social?.occupation?.current || undefined,
        livingArrangement: social?.livingConditions?.type || undefined,
        dietType: mapDietType(lifestyle?.diet?.type),
        exerciseFrequency: mapExerciseFrequency(lifestyle?.physicalActivity?.frequency),
      },
    });
  }
}
