import { db } from "@/db/db";
import {
  TypedRequestBody,
  UserCreateProps,
  UserLoginProps
} from "@/types/types";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import {
  generateAccessToken,
  generateRefreshToken,
  TokenPayload
} from "@/utils/tokens";

export async function createUser(
  req: TypedRequestBody<UserCreateProps>,
  res: Response
) {
  const data = req.body;
  const { email, password, role, name, phone, image, schoolId, schoolName } =
    data;
  try {
    // Check if the user already exists\
    const existingEmail = await db.user.findUnique({
      where: {
        email
      }
    });

    if (existingEmail) {
      return res.status(409).json({
        data: null,
        error: "Email already exists"
      });
    }
    //hash password
    // Encrypt the Password =>bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    data.password = hashedPassword;
    const newUser = await db.user.create({
      data
    });
    console.log(`User created successfully: ${newUser.name} (${newUser.id})`);
    return res.status(201).json({
      data: newUser,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}
export async function loginUser(
  req: TypedRequestBody<UserLoginProps>,
  res: Response
) {
  const data = req.body;
  const { email, password } = data;
  try {
    // Check if the user already exists\
    const existingUser = await db.user.findUnique({
      where: {
        email
      }
    });

    if (!existingUser) {
      console.log("fuasse email");
      return res.status(409).json({
        data: null,
        error: "Invalid Credentials"
      });
    }
    //Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (!isPasswordValid) {
      console.log("pwd not good");
      return res.status(401).json({ error: "Invalid Credentials", data: null });
    } else {
      console.log("pwd is ok");
    }
    // Generate Tokens
    const tokenPayload: TokenPayload = {
      userId: existingUser.id,
      email: existingUser.email,
      role: existingUser.role
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token
    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: existingUser.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });
    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = existingUser;

    return res.status(200).json({
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
        password
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
}
export async function getUsers(req: Request, res: Response) {
  try {
    const users = await db.user.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
    return res.status(200).json(users);
  } catch (error) {
    console.log(error);
  }
}
// export async function getCustomerById(req: Request, res: Response) {
//   const { id } = req.params;
//   try {
//     const customer = await db.customer.findUnique({
//       where: {
//         id,
//       },
//     });
//     return res.status(200).json(customer);
//   } catch (error) {
//     console.log(error);
//   }
// }
