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

const medicalRecordRouter = express.Router();

// Aggregate DME
medicalRecordRouter.get("/patients/:patientId/medical-record", getMedicalRecord);

// Section sync (replace list)
medicalRecordRouter.put("/patients/:patientId/medical-record/:section", syncSection);

// Allergies
medicalRecordRouter.post("/patients/:patientId/allergies", createAllergy);
medicalRecordRouter.put("/patients/:patientId/allergies/:id", updateAllergy);
medicalRecordRouter.delete("/patients/:patientId/allergies/:id", deleteAllergy);

// Vaccinations
medicalRecordRouter.post("/patients/:patientId/vaccinations", createVaccination);
medicalRecordRouter.put("/patients/:patientId/vaccinations/:id", updateVaccination);
medicalRecordRouter.delete("/patients/:patientId/vaccinations/:id", deleteVaccination);

// Chronic conditions
medicalRecordRouter.post("/patients/:patientId/chronic-conditions", createChronicCondition);
medicalRecordRouter.put("/patients/:patientId/chronic-conditions/:id", updateChronicCondition);
medicalRecordRouter.delete("/patients/:patientId/chronic-conditions/:id", deleteChronicCondition);

// Family history
medicalRecordRouter.post("/patients/:patientId/family-history", createFamilyHistory);
medicalRecordRouter.put("/patients/:patientId/family-history/:id", updateFamilyHistory);
medicalRecordRouter.delete("/patients/:patientId/family-history/:id", deleteFamilyHistory);

// Social history
medicalRecordRouter.put("/patients/:patientId/social-history", upsertSocialHistory);

// Emergency contacts
medicalRecordRouter.post("/patients/:patientId/emergency-contacts", createEmergencyContact);
medicalRecordRouter.put("/patients/:patientId/emergency-contacts/:id", updateEmergencyContact);
medicalRecordRouter.delete("/patients/:patientId/emergency-contacts/:id", deleteEmergencyContact);

// Exam results
medicalRecordRouter.post("/patients/:patientId/exam-results", createExamResult);
medicalRecordRouter.put("/patients/:patientId/exam-results/:id", updateExamResult);
medicalRecordRouter.delete("/patients/:patientId/exam-results/:id", deleteExamResult);

// Medical images
medicalRecordRouter.post("/patients/:patientId/medical-images", createMedicalImage);
medicalRecordRouter.put("/patients/:patientId/medical-images/:id", updateMedicalImage);
medicalRecordRouter.delete("/patients/:patientId/medical-images/:id", deleteMedicalImage);

// Current medications
medicalRecordRouter.post("/patients/:patientId/current-medications", createCurrentMedication);
medicalRecordRouter.put("/patients/:patientId/current-medications/:id", updateCurrentMedication);
medicalRecordRouter.delete("/patients/:patientId/current-medications/:id", deleteCurrentMedication);

export default medicalRecordRouter;
