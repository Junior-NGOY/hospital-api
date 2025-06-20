"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const patients_1 = require("../controllers/patients");
const express_1 = __importDefault(require("express"));
const patientRouter = express_1.default.Router();
patientRouter.post("/patients", patients_1.createPatient);
patientRouter.get("/patients", patients_1.getPatients);
patientRouter.get("/patients/seq", patients_1.getNextPatientSequence);
exports.default = patientRouter;
