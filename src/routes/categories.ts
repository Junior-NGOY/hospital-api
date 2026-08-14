import { createMedicationCategory, deleteMedicationCategory, getCategories, getCategoryTree, getSingleMedicationCategory, updateMedicationCategory } from "@/controllers/categories";
import { authenticate, requireRoles } from "@/middleware/auth";
import express from "express";

const categoryRouter = express.Router();
const pharmacist = [authenticate, requireRoles("PHARMACIST")] as const;

categoryRouter.post("/medication-categorie", ...pharmacist, createMedicationCategory);
categoryRouter.get("/medication-categories", ...pharmacist, getCategories);
categoryRouter.get("/medication-categories/:id", ...pharmacist, getSingleMedicationCategory);
categoryRouter.get("/medication-categories/:id/tree", ...pharmacist, getCategoryTree);
categoryRouter.put("/medication-categories/:id", ...pharmacist, updateMedicationCategory);
categoryRouter.delete("/medication-categories/:id", ...pharmacist, deleteMedicationCategory);

export default categoryRouter;
