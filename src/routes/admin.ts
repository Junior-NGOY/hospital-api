import { createContact, getContacts } from "@/controllers/admin";
import express from "express";
const adminRouter = express.Router();

adminRouter.post("/contacts", createContact);
adminRouter.get("/contacts", getContacts);
// adminRouter.get("/customers/:id", getCustomerById);
// adminRouter.get("/api/v2/customers", getV2Customers);

export default adminRouter;
