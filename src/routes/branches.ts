import express from "express";
import {
  createBranch,
  getBranchesByHospital,
  getBranchById,
  updateBranch,
  deleteBranch,
} from "@/controllers/branchs";

const branchRouter = express.Router();

branchRouter.post("/branches", createBranch);
branchRouter.get("/hospitals/:hospitalId/branches", getBranchesByHospital);
branchRouter.get("/branches/:id", getBranchById);
branchRouter.put("/branches/:id", updateBranch);
branchRouter.delete("/branches/:id", deleteBranch);

export default branchRouter;
