import {
  createConsultation,
  getConsultations,
  getConsultationById,
  updateConsultation,
  deleteConsultation,
} from "@/controllers/consultations";
import { authenticate, requireRoles } from "@/middleware/auth";
import express from "express";

const consultationRouter = express.Router();
const clinicalWrite = [authenticate, requireRoles("DOCTOR", "NURSE")] as const;

// P0.8: JWT on each route (not router.use) so other /api/v1 public routes stay open.
// Reads stay open to any authenticated staff (dashboard counts). Writes are clinical.
consultationRouter.post("/consultations", ...clinicalWrite, createConsultation);
consultationRouter.get("/consultations", authenticate, getConsultations);
consultationRouter.get("/consultations/:id", authenticate, getConsultationById);
consultationRouter.put("/consultations/:id", ...clinicalWrite, updateConsultation);
consultationRouter.delete("/consultations/:id", ...clinicalWrite, deleteConsultation);

export default consultationRouter;
