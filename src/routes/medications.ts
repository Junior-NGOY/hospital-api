
import { createMedication,
    getMedications,
    getMedicationById,
    updateMedication,
    deleteMedication,
    adjustMedicationStock } from "@/controllers/medications";
import express from "express";
const medicationRouter = express.Router();

medicationRouter.post("/medications", createMedication);
medicationRouter.get("/medications", getMedications);
medicationRouter.get("/medications/:id", getMedicationById);
medicationRouter.put("/medications/:id", updateMedication);
medicationRouter.delete("/medications/:id", deleteMedication);
medicationRouter.post("/medications/:id/stock", adjustMedicationStock);

export default medicationRouter;
