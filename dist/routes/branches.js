"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const branchs_1 = require("../controllers/branchs");
const branchRouter = express_1.default.Router();
branchRouter.post("/branches", branchs_1.createBranch);
branchRouter.get("/hospitals/:hospitalId/branches", branchs_1.getBranchesByHospital);
branchRouter.get("/branches/:id", branchs_1.getBranchById);
branchRouter.put("/branches/:id", branchs_1.updateBranch);
branchRouter.delete("/branches/:id", branchs_1.deleteBranch);
exports.default = branchRouter;
