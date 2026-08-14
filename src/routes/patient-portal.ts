import express from "express";
import {
  patientPortalHome,
  patientPortalLogin,
  patientPortalQr,
} from "@/controllers/patient-portal";
import { authenticatePatient } from "@/middleware/auth";

const patientPortalRouter = express.Router();

patientPortalRouter.post("/patient-portal/login", patientPortalLogin);
patientPortalRouter.post("/patient-portal/qr", patientPortalQr);
patientPortalRouter.get("/patient-portal/home", authenticatePatient, patientPortalHome);

export default patientPortalRouter;
