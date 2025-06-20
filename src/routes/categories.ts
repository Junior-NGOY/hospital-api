 
import { createMedicationCategory, deleteMedicationCategory, getCategories, getCategoryTree, getSingleMedicationCategory, updateMedicationCategory } from "@/controllers/categories";
import express from "express";

const categoryRouter = express.Router();

categoryRouter.post("/medication-categorie", createMedicationCategory);
categoryRouter.get("/medication-categories", getCategories);
categoryRouter.get("/medication-categories/:id/tree", getCategoryTree);
categoryRouter.put("/medication-categories/:id", updateMedicationCategory);
categoryRouter.delete("/medication-categories/:id", deleteMedicationCategory);
//departmentRouter.get("/streams", getStreams);
// adminRouter.get("/api/v2/customers", getV2Customers);

export default categoryRouter;
