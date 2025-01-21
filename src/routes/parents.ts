import { createParent, getParents } from "@/controllers/parents";
import { createSchool, getSchools } from "@/controllers/schools";
import express from "express";
const parentRouter = express.Router();

parentRouter.post("/parents", createParent);
parentRouter.get("/parents", getParents);
// schoolRouter.get("/customers/:id", getCustomerById);
// schoolRouter.get("/api/v2/customers", getV2Customers);

export default parentRouter;
