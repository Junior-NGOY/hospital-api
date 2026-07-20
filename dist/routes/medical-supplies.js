"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const medical_supplies_1 = require("../controllers/medical-supplies");
const express_1 = __importDefault(require("express"));
const medicalSuppliesRouter = express_1.default.Router();
medicalSuppliesRouter.post("/medical-supplies", medical_supplies_1.createMedicalSupply);
medicalSuppliesRouter.get("/medical-supplies", medical_supplies_1.getMedicalSupplies);
medicalSuppliesRouter.get("/medical-supplies/:id", medical_supplies_1.getMedicalSupplyById);
medicalSuppliesRouter.put("/medical-supplies/:id", medical_supplies_1.updateMedicalSupply);
medicalSuppliesRouter.delete("/medical-supplies/:id", medical_supplies_1.deleteMedicalSupply);
exports.default = medicalSuppliesRouter;
