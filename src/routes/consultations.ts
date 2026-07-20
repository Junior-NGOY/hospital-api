import {
  createConsultation,
  getConsultations,
  getConsultationById,
  updateConsultation,
  deleteConsultation,
} from "@/controllers/consultations";
import express from "express";
const consultationRouter = express.Router();

consultationRouter.post("/consultations", createConsultation);
consultationRouter.get("/consultations", getConsultations);
consultationRouter.get("/consultations/:id", getConsultationById);
consultationRouter.put("/consultations/:id", updateConsultation);
consultationRouter.delete("/consultations/:id", deleteConsultation);

export default consultationRouter;

