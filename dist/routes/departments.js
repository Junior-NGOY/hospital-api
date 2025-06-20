"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const departments_1 = require("../controllers/departments");
const express_1 = __importDefault(require("express"));
const departmentRouter = express_1.default.Router();
departmentRouter.post("/departments", departments_1.createDepartment);
departmentRouter.get("/departments", departments_1.getDepartments);
exports.default = departmentRouter;
