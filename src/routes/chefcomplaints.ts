 
import { createChefComplaint, getChefComplaints } from "@/controllers/chefcomplaints";
import express from "express";
const chefComplaintRouter = express.Router();

chefComplaintRouter.post("/chefcomplaints", createChefComplaint);
chefComplaintRouter.get("/chefcomplaints", getChefComplaints);
//departmentRouter.post("/streams", createStream);
//departmentRouter.get("/streams", getStreams);
// adminRouter.get("/customers/:id", getCustomerById);
// adminRouter.get("/api/v2/customers", getV2Customers);

export default chefComplaintRouter;
