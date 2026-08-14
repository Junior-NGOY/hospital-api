import {
  createLabTest,
  getLabTestById,
  getLabTests,
  recordLabResult,
  startLabTest,
} from "@/controllers/lab-tests";
import { authenticate, requireRoles } from "@/middleware/auth";
import express from "express";

const labTestRouter = express.Router();
const lab = [authenticate, requireRoles("LAB_TECHNICIAN", "DOCTOR")] as const;

labTestRouter.get("/lab-tests", ...lab, getLabTests);
labTestRouter.post("/lab-tests", ...lab, createLabTest);
labTestRouter.get("/lab-tests/:id", ...lab, getLabTestById);
labTestRouter.post("/lab-tests/:id/start", ...lab, startLabTest);
labTestRouter.post("/lab-tests/:id/result", ...lab, recordLabResult);

export default labTestRouter;
