 
import { createUser, getAllUsers } from "@/controllers/users";
import express from "express";
const userRouter = express.Router();

userRouter.post("/register", createUser);
//userRouter.post("/login", loginUser);
userRouter.get("/users/", getAllUsers);
// adminRouter.get("/api/v2/customers", getV2Customers);

export default userRouter;
