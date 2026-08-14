import {
  createHospital,
  getHospitalById,
  getHospitals,
  updateHospital,
} from "@/controllers/hospitals";
import { getBranchesByHospital } from "@/controllers/branchs";
import { authenticate } from "@/middleware/auth";
import express from "express";
const hospitalRouter = express.Router();

// POST is public: SaaS tenant signup (new hospital) does not require a JWT.
hospitalRouter.post("/hospitals", createHospital);
hospitalRouter.get("/hospitals", getHospitals);
// Nested collection before /:id so Express does not treat "branches" as an id.
hospitalRouter.get(
  "/hospitals/:hospitalId/branches",
  authenticate,
  getBranchesByHospital
);
hospitalRouter.get("/hospitals/:id", getHospitalById);
hospitalRouter.put("/hospitals/:id", authenticate, updateHospital);

export default hospitalRouter;
