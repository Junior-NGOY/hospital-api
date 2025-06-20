"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const medications_1 = require("../controllers/medications");
const express_1 = __importDefault(require("express"));
const medicationRouter = express_1.default.Router();
medicationRouter.post("/medications", medications_1.createMedication);
medicationRouter.get("/medications", medications_1.getMedications);
medicationRouter.get("/medications/:id", medications_1.getMedicationById);
medicationRouter.put("/medications/:id", medications_1.updateMedication);
medicationRouter.delete("/medications/:id", medications_1.deleteMedication);
medicationRouter.post("/medications/:id/stock", medications_1.adjustMedicationStock);
exports.default = medicationRouter;
