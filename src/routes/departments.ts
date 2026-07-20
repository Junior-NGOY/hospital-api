import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from "@/controllers/departments";
import express from "express";
const departmentRouter = express.Router();

departmentRouter.post("/departments", createDepartment);
departmentRouter.get("/departments", getDepartments);
departmentRouter.get("/departments/:id", getDepartmentById);
departmentRouter.put("/departments/:id", updateDepartment);
departmentRouter.delete("/departments/:id", deleteDepartment);

export default departmentRouter;
