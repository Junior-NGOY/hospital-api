import {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  getNextPatientSequence,
} from "@/controllers/patients";
import { getPatientQrToken } from "@/controllers/patient-portal";
import { authenticate } from "@/middleware/auth";
import express from "express";

const patientRouter = express.Router();

// P0.3: list/create/update/delete require JWT so tenants cannot leak.
// GET /patients/:id/medical-record stays public (QR cards) — see medical-records router (P0.8).
patientRouter.post("/patients", authenticate, createPatient);
patientRouter.get("/patients", authenticate, getPatients);
patientRouter.get("/patients/seq", authenticate, getNextPatientSequence);
patientRouter.get("/patients/:id/qr-token", authenticate, getPatientQrToken);
patientRouter.get("/patients/:id", authenticate, getPatientById);
patientRouter.put("/patients/:id", authenticate, updatePatient);
patientRouter.delete("/patients/:id", authenticate, deletePatient);

export default patientRouter;
