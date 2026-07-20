"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const equipment_1 = require("../controllers/equipment");
const express_1 = __importDefault(require("express"));
const equipmentRouter = express_1.default.Router();
equipmentRouter.post("/equipment", equipment_1.createEquipment);
equipmentRouter.get("/equipment", equipment_1.getEquipment);
equipmentRouter.get("/equipment/summary", equipment_1.getEquipmentSummary);
equipmentRouter.get("/equipment/:id", equipment_1.getEquipmentById);
equipmentRouter.put("/equipment/:id", equipment_1.updateEquipment);
equipmentRouter.patch("/equipment/:id/status", equipment_1.updateEquipmentStatus);
equipmentRouter.delete("/equipment/:id", equipment_1.deleteEquipment);
exports.default = equipmentRouter;
