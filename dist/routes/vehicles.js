"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vehicles_1 = require("../controllers/vehicles");
const express_1 = __importDefault(require("express"));
const vehiclesRouter = express_1.default.Router();
vehiclesRouter.post("/vehicles", vehicles_1.createVehicle);
vehiclesRouter.get("/vehicles", vehicles_1.getVehicles);
vehiclesRouter.get("/vehicles/:id", vehicles_1.getVehicleById);
vehiclesRouter.put("/vehicles/:id", vehicles_1.updateVehicle);
vehiclesRouter.delete("/vehicles/:id", vehicles_1.deleteVehicle);
exports.default = vehiclesRouter;
