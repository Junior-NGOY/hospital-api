"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const consultations_1 = require("../controllers/consultations");
const express_1 = __importDefault(require("express"));
const consultationRouter = express_1.default.Router();
consultationRouter.post("/consultations", consultations_1.createConsultation);
consultationRouter.get("/consultations", consultations_1.getConsultations);
consultationRouter.get("/consultations/:id", consultations_1.getConsultationById);
consultationRouter.put("/consultations/:id", consultations_1.updateConsultation);
consultationRouter.delete("/consultations/:id", consultations_1.deleteConsultation);
exports.default = consultationRouter;
