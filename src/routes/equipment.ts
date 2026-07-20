import {
  createEquipment,
  getEquipment,
  getEquipmentById,
  updateEquipment,
  deleteEquipment,
  updateEquipmentStatus,
  getEquipmentSummary,
} from "@/controllers/equipment";
import express from "express";

const equipmentRouter = express.Router();

equipmentRouter.post("/equipment", createEquipment);
equipmentRouter.get("/equipment", getEquipment);
equipmentRouter.get("/equipment/summary", getEquipmentSummary);
equipmentRouter.get("/equipment/:id", getEquipmentById);
equipmentRouter.put("/equipment/:id", updateEquipment);
equipmentRouter.patch("/equipment/:id/status", updateEquipmentStatus);
equipmentRouter.delete("/equipment/:id", deleteEquipment);

export default equipmentRouter;
