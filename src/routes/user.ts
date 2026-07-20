import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "@/controllers/users";
import express from "express";
const userRouter = express.Router();

userRouter.post("/register", createUser);
// Alias so staff create can also POST /users
userRouter.post("/users", createUser);
userRouter.get("/users", getAllUsers);
userRouter.get("/users/:id", getUserById);
userRouter.put("/users/:id", updateUser);
userRouter.delete("/users/:id", deleteUser);

export default userRouter;
