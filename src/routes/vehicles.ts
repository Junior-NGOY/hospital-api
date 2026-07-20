import {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from "@/controllers/vehicles";
import express from "express";

const vehiclesRouter = express.Router();

vehiclesRouter.post("/vehicles", createVehicle);
vehiclesRouter.get("/vehicles", getVehicles);
vehiclesRouter.get("/vehicles/:id", getVehicleById);
vehiclesRouter.put("/vehicles/:id", updateVehicle);
vehiclesRouter.delete("/vehicles/:id", deleteVehicle);

export default vehiclesRouter;
