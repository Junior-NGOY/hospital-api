import {
  createMedicalSupply,
  getMedicalSupplies,
  getMedicalSupplyById,
  updateMedicalSupply,
  deleteMedicalSupply,
} from "@/controllers/medical-supplies";
import express from "express";

const medicalSuppliesRouter = express.Router();

medicalSuppliesRouter.post("/medical-supplies", createMedicalSupply);
medicalSuppliesRouter.get("/medical-supplies", getMedicalSupplies);
medicalSuppliesRouter.get("/medical-supplies/:id", getMedicalSupplyById);
medicalSuppliesRouter.put("/medical-supplies/:id", updateMedicalSupply);
medicalSuppliesRouter.delete("/medical-supplies/:id", deleteMedicalSupply);

export default medicalSuppliesRouter;
