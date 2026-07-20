import {
  createMaintenance,
  getMaintenance,
  getMaintenanceById,
  updateMaintenance,
  completeMaintenance,
  deleteMaintenance,
} from "@/controllers/maintenance";
import express from "express";

const maintenanceRouter = express.Router();

maintenanceRouter.post("/maintenance", createMaintenance);
maintenanceRouter.get("/maintenance", getMaintenance);
maintenanceRouter.get("/maintenance/:id", getMaintenanceById);
maintenanceRouter.put("/maintenance/:id", updateMaintenance);
maintenanceRouter.post("/maintenance/:id/complete", completeMaintenance);
maintenanceRouter.delete("/maintenance/:id", deleteMaintenance);

export default maintenanceRouter;
