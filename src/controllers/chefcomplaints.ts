import { db } from "@/db/db";
import { ChefComplaintProps, TypedRequestBody } from "@/types";
 
import { Request, Response } from "express";

export async function createChefComplaint(
  req: TypedRequestBody<ChefComplaintProps>,
  res: Response
) {
  const data = req.body;
 
  try {

    const newChefComplaint = await db.chiefComplaint.create({
      data
    });
    console.log(
      `Contact created successfully: ${newChefComplaint.description} (${newChefComplaint.id})`
    );
    return res.status(201).json({
      data: newChefComplaint,
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
export async function getChefComplaints(req: Request, res: Response) {
  try {
    const chefComplaints = await db.chiefComplaint.findMany({
      
      orderBy: {
        createdAt: "desc"
      }
    });
   // return res.status(200).json(chefComplaints);
    return res.status(200).json({
      data: chefComplaints,
      error: null
    });
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
