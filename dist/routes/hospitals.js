"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hospitals_1 = require("../controllers/hospitals");
const express_1 = __importDefault(require("express"));
const hospitalRouter = express_1.default.Router();
hospitalRouter.post("/hospitals", hospitals_1.createHospital);
hospitalRouter.get("/hospitals", hospitals_1.getHospitals);
hospitalRouter.get("/hospitals/:id", hospitals_1.getHospitalById);
exports.default = hospitalRouter;
