import { db } from "@/db/db";
import { TypedRequestBody } from "@/types/types";
import { Request, Response } from "express";

/* export async function createContact(
  req: TypedRequestBody<ContactProps>,
  res: Response
) {
  const data = req.body;
  const { email, hospital } = data;
  try {
    const existingEmail = await db.contact.findUnique({
      where: {
        email
      }
    });
    const existingHospital = await db.contact.findUnique({
      where: {
        hospital
      }
    });
    if (existingHospital || existingEmail) {
      return res.status(409).json({
        data: null,
        error: "We already received a request for this hospital and email"
      });
    }
    const newContact = await db.contact.create({
      data
    });
    console.log(
      `Contact created successfully: ${newContact.fullName} (${newContact.id})`
    );
    return res.status(201).json({
      data: newContact,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Something went wrong"
    });
  }
} */
/* export async function getContacts(req: Request, res: Response) {
  try {
    const contacts = await db.contact.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
    return res.status(200).json(contacts);
  } catch (error) {
    console.log(error);
  }
} */
