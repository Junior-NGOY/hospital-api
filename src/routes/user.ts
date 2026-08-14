import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  login,
  getMe,
} from "@/controllers/users";
import { authenticate, requireRoles } from "@/middleware/auth";
import express from "express";

const userRouter = express.Router();
const adminOnly = [authenticate, requireRoles()] as const;

userRouter.post("/login", login);
userRouter.post("/register", createUser);
// Staff create is admin-only; bootstrap of the first account stays on /register.
userRouter.post("/users", ...adminOnly, createUser);

userRouter.get("/me", authenticate, getMe);
userRouter.get("/users", ...adminOnly, getAllUsers);
userRouter.get("/users/:id", ...adminOnly, getUserById);
userRouter.put("/users/:id", ...adminOnly, updateUser);
userRouter.delete("/users/:id", ...adminOnly, deleteUser);

export default userRouter;
