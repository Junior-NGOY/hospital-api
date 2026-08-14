import { getFhirPatient } from "@/controllers/fhir";
import { authenticate, requireRoles } from "@/middleware/auth";
import express from "express";

const fhirRouter = express.Router();

/** Staff JWT only — future patient tokens (P2.2) are not a UserRole. */
const staffRead = [
  authenticate,
  requireRoles(
    "DOCTOR",
    "NURSE",
    "RECEPTIONIST",
    "PHARMACIST",
    "LAB_TECHNICIAN",
    "ACCOUNTANT"
  ),
] as const;

fhirRouter.get("/fhir/Patient/:id", ...staffRead, getFhirPatient);

export default fhirRouter;
