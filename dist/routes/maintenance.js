"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const maintenance_1 = require("../controllers/maintenance");
const express_1 = __importDefault(require("express"));
const maintenanceRouter = express_1.default.Router();
maintenanceRouter.post("/maintenance", maintenance_1.createMaintenance);
maintenanceRouter.get("/maintenance", maintenance_1.getMaintenance);
maintenanceRouter.get("/maintenance/:id", maintenance_1.getMaintenanceById);
maintenanceRouter.put("/maintenance/:id", maintenance_1.updateMaintenance);
maintenanceRouter.post("/maintenance/:id/complete", maintenance_1.completeMaintenance);
maintenanceRouter.delete("/maintenance/:id", maintenance_1.deleteMaintenance);
exports.default = maintenanceRouter;
