import express from "express";
import { authenticate } from "@/middleware/auth";
import {
  createBranch,
  getAllBranches,
  getBranchesByHospital,
  getBranchById,
  updateBranch,
  deleteBranch,
} from "@/controllers/branchs";

const branchRouter = express.Router();

branchRouter.post("/branches", authenticate, createBranch);
branchRouter.get("/branches", authenticate, getAllBranches);
branchRouter.get("/hospitals/:hospitalId/branches", authenticate, getBranchesByHospital);
branchRouter.get("/branches/:id", authenticate, getBranchById);
branchRouter.put("/branches/:id", authenticate, updateBranch);
branchRouter.delete("/branches/:id", authenticate, deleteBranch);

export default branchRouter;
