import { createDepartment, getDepartments } from "@/controllers/departments";
import {

} from "@/controllers/nurses";
import express from "express";
const departmentRouter = express.Router();

departmentRouter.post("/departments", createDepartment);
departmentRouter.get("/departments", getDepartments);
//departmentRouter.get("/departments/brief", getBriefDepartments);
//departmentRouter.post("/streams", createStream);
//departmentRouter.get("/streams", getStreams);
// adminRouter.get("/customers/:id", getCustomerById);
// adminRouter.get("/api/v2/customers", getV2Customers);

export default departmentRouter;
