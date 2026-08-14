import express from "express";
import {
  getMedicalRecord,
  createAllergy,
  updateAllergy,
  deleteAllergy,
  createVaccination,
  updateVaccination,
  deleteVaccination,
  createChronicCondition,
  updateChronicCondition,
  deleteChronicCondition,
  createFamilyHistory,
  updateFamilyHistory,
  deleteFamilyHistory,
  upsertSocialHistory,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  createExamResult,
  updateExamResult,
  deleteExamResult,
  createMedicalImage,
  updateMedicalImage,
  deleteMedicalImage,
  createCurrentMedication,
  updateCurrentMedication,
  deleteCurrentMedication,
  syncSection,
} from "@/controllers/medical-records";
import { authenticate, requireRoles } from "@/middleware/auth";
import { requirePatientHospital } from "@/utils/hospitalScope";

const medicalRecordRouter = express.Router();

const writeDme = [
  authenticate,
  requireRoles("DOCTOR", "NURSE"),
  requirePatientHospital,
] as const;

// P0.8 exception (cartes QR / P2.2): lecture DME publique. Écritures JWT + hospitalId.
// L’espace patient (P2.2) utilise /patient-portal/* avec une session patient, pas le dashboard.
medicalRecordRouter.get("/patients/:patientId/medical-record", getMedicalRecord);

medicalRecordRouter.put(
  "/patients/:patientId/medical-record/:section",
  ...writeDme,
  syncSection
);

medicalRecordRouter.post("/patients/:patientId/allergies", ...writeDme, createAllergy);
medicalRecordRouter.put("/patients/:patientId/allergies/:id", ...writeDme, updateAllergy);
medicalRecordRouter.delete("/patients/:patientId/allergies/:id", ...writeDme, deleteAllergy);

medicalRecordRouter.post("/patients/:patientId/vaccinations", ...writeDme, createVaccination);
medicalRecordRouter.put(
  "/patients/:patientId/vaccinations/:id",
  ...writeDme,
  updateVaccination
);
medicalRecordRouter.delete(
  "/patients/:patientId/vaccinations/:id",
  ...writeDme,
  deleteVaccination
);

medicalRecordRouter.post(
  "/patients/:patientId/chronic-conditions",
  ...writeDme,
  createChronicCondition
);
medicalRecordRouter.put(
  "/patients/:patientId/chronic-conditions/:id",
  ...writeDme,
  updateChronicCondition
);
medicalRecordRouter.delete(
  "/patients/:patientId/chronic-conditions/:id",
  ...writeDme,
  deleteChronicCondition
);

medicalRecordRouter.post(
  "/patients/:patientId/family-history",
  ...writeDme,
  createFamilyHistory
);
medicalRecordRouter.put(
  "/patients/:patientId/family-history/:id",
  ...writeDme,
  updateFamilyHistory
);
medicalRecordRouter.delete(
  "/patients/:patientId/family-history/:id",
  ...writeDme,
  deleteFamilyHistory
);

medicalRecordRouter.put(
  "/patients/:patientId/social-history",
  ...writeDme,
  upsertSocialHistory
);

medicalRecordRouter.post(
  "/patients/:patientId/emergency-contacts",
  ...writeDme,
  createEmergencyContact
);
medicalRecordRouter.put(
  "/patients/:patientId/emergency-contacts/:id",
  ...writeDme,
  updateEmergencyContact
);
medicalRecordRouter.delete(
  "/patients/:patientId/emergency-contacts/:id",
  ...writeDme,
  deleteEmergencyContact
);

medicalRecordRouter.post(
  "/patients/:patientId/exam-results",
  ...writeDme,
  createExamResult
);
medicalRecordRouter.put(
  "/patients/:patientId/exam-results/:id",
  ...writeDme,
  updateExamResult
);
medicalRecordRouter.delete(
  "/patients/:patientId/exam-results/:id",
  ...writeDme,
  deleteExamResult
);

medicalRecordRouter.post(
  "/patients/:patientId/medical-images",
  ...writeDme,
  createMedicalImage
);
medicalRecordRouter.put(
  "/patients/:patientId/medical-images/:id",
  ...writeDme,
  updateMedicalImage
);
medicalRecordRouter.delete(
  "/patients/:patientId/medical-images/:id",
  ...writeDme,
  deleteMedicalImage
);

medicalRecordRouter.post(
  "/patients/:patientId/current-medications",
  ...writeDme,
  createCurrentMedication
);
medicalRecordRouter.put(
  "/patients/:patientId/current-medications/:id",
  ...writeDme,
  updateCurrentMedication
);
medicalRecordRouter.delete(
  "/patients/:patientId/current-medications/:id",
  ...writeDme,
  deleteCurrentMedication
);

export default medicalRecordRouter;
