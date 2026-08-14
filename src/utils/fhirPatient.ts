import { Gender, MaritalStatus } from "@prisma/client";

/**
 * Thin FHIR R4 Patient mapping (P2.1).
 * Identity only — not a FHIR server, not a DME export.
 * See docs/FHIR-MAPPING.md.
 */

export const FHIR_FILE_NUMBER_SYSTEM = "https://hope.cd/fhir/sid/file-number";
export const FHIR_MARITAL_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus";

export type HopePatientForFhir = {
  id: string;
  fileNumber: string;
  title: string | null;
  name: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: Gender;
  maritalStatus: MaritalStatus | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  hospitalId: string | null;
  updatedAt: Date;
  hospital: { id: string; name: string } | null;
};

export type FhirPatient = {
  resourceType: "Patient";
  id: string;
  meta: { lastUpdated: string };
  identifier: Array<{
    use: "usual";
    type: {
      coding: Array<{ system: string; code: string; display: string }>;
      text: string;
    };
    system: string;
    value: string;
  }>;
  active: true;
  name: Array<{
    use: "official";
    text: string;
    family: string;
    given: string[];
    prefix?: string[];
  }>;
  telecom?: Array<{
    system: "phone" | "email";
    value: string;
    use?: "mobile" | "home";
  }>;
  gender: "male" | "female" | "unknown";
  birthDate: string;
  address?: Array<{
    use: "home";
    text: string;
    country: "CD";
  }>;
  maritalStatus?: {
    coding: Array<{ system: string; code: string; display: string }>;
    text: string;
  };
  managingOrganization?: {
    reference: string;
    display: string;
  };
};

const MARITAL: Record<
  MaritalStatus,
  { code: string; display: string; text: string }
> = {
  MARRIED: { code: "M", display: "Married", text: "Marié(e)" },
  SINGLE: { code: "S", display: "Never Married", text: "Célibataire" },
  DIVORCED: { code: "D", display: "Divorced", text: "Divorcé(e)" },
  WIDOWED: { code: "W", display: "Widowed", text: "Veuf / veuve" },
};

function fhirGender(gender: Gender): FhirPatient["gender"] {
  if (gender === Gender.MALE) return "male";
  if (gender === Gender.FEMALE) return "female";
  return "unknown";
}

/** Dates are stored as YYYY-MM-DDT00:00:00.000Z (see convertDateToIso). */
export function fhirBirthDate(dateOfBirth: Date): string {
  return dateOfBirth.toISOString().slice(0, 10);
}

export function toFhirPatient(patient: HopePatientForFhir): FhirPatient {
  const given = patient.firstName.trim() ? [patient.firstName.trim()] : [];
  const family = patient.lastName.trim() || patient.name.trim() || "Inconnu";
  const text =
    patient.name.trim() || `${patient.firstName} ${patient.lastName}`.trim();
  const prefix = patient.title?.trim();

  const name: FhirPatient["name"][0] = {
    use: "official",
    text,
    family,
    given,
  };
  if (prefix) name.prefix = [prefix];

  const telecom: NonNullable<FhirPatient["telecom"]> = [];
  const phone = patient.phone?.trim();
  if (phone) {
    telecom.push({ system: "phone", value: phone, use: "mobile" });
  }
  const email = patient.email?.trim();
  if (email) {
    telecom.push({ system: "email", value: email });
  }

  const resource: FhirPatient = {
    resourceType: "Patient",
    id: patient.id,
    meta: { lastUpdated: patient.updatedAt.toISOString() },
    identifier: [
      {
        use: "usual",
        type: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0203",
              code: "MR",
              display: "Medical record number",
            },
          ],
          text: "Numéro de dossier",
        },
        system: FHIR_FILE_NUMBER_SYSTEM,
        value: patient.fileNumber,
      },
    ],
    active: true,
    name: [name],
    gender: fhirGender(patient.gender),
    birthDate: fhirBirthDate(patient.dateOfBirth),
  };

  if (telecom.length) resource.telecom = telecom;

  const address = patient.address?.trim();
  if (address) {
    resource.address = [{ use: "home", text: address, country: "CD" }];
  }

  if (patient.maritalStatus) {
    const mapped = MARITAL[patient.maritalStatus];
    resource.maritalStatus = {
      coding: [
        {
          system: FHIR_MARITAL_SYSTEM,
          code: mapped.code,
          display: mapped.display,
        },
      ],
      text: mapped.text,
    };
  }

  if (patient.hospital) {
    resource.managingOrganization = {
      reference: `Organization/${patient.hospital.id}`,
      display: patient.hospital.name,
    };
  } else if (patient.hospitalId) {
    resource.managingOrganization = {
      reference: `Organization/${patient.hospitalId}`,
      display: "Hôpital",
    };
  }

  return resource;
}
