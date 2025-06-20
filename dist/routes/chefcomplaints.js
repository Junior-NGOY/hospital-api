"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chefcomplaints_1 = require("../controllers/chefcomplaints");
const express_1 = __importDefault(require("express"));
const chefComplaintRouter = express_1.default.Router();
chefComplaintRouter.post("/chefcomplaints", chefcomplaints_1.createChefComplaint);
chefComplaintRouter.get("/chefcomplaints", chefcomplaints_1.getChefComplaints);
exports.default = chefComplaintRouter;
