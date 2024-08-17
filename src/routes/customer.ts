import {
  createCustomer,
  getCustomerById,
  getCustomers,
} from "@/controllers/customers";
import express from "express";
const customerRouter = express.Router();

customerRouter.post("/customers", createCustomer);
customerRouter.get("/customers", getCustomers);
customerRouter.get("/customers/:id", getCustomerById);
// customerRouter.get("/api/v2/customers", getV2Customers);

export default customerRouter;
