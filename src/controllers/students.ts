import { db } from "@/db/db";
import { StudentCreateProps, TypedRequestBody } from "@/types/types";
import { convertDateToIso } from "@/utils/convertDateToIso";
import { Request, Response } from "express";

export async function createStudent(
  req: TypedRequestBody<StudentCreateProps>,
  res: Response
) {
  const data = req.body;
  // const { BCN, regNo, email, rollNo, dob } = data;
  const { email, dob, admissionDate } = data;
  data.dob = convertDateToIso(dob);
  data.admissionDate = convertDateToIso(admissionDate);
  try {
    // Check if the school already exists\
    const existingEmail = await db.student.findUnique({
      where: {
        email
      }
    });
    /*    const existingBCN = await db.student.findUnique({
      where: {
        BCN
      }
    });
    const existingPhone = await db.student.findUnique({
      where: {
        dob
      }
    }); */
    /*    const existingRegNo = await db.student.findUnique({
      where: {
        regNo
      }
    });
    const existingRollNo = await db.student.findUnique({
      where: {
        rollNo
      }
    });

    if (existingEmail) {
      return res.status(409).json({
        data: null,
        error: "Student with this email address already exists"
      });
    }

    if (existingRegNo) {
      return res.status(409).json({
        data: null,
        error: "Student with this regNo number already exists"
      });
    } */
    const newStudent = await db.student.create({
      data
    });
    console.log(
      `Parent created successfully: ${newStudent.firstName} (${newStudent.id})`
    );
    return res.status(201).json({
      data: newStudent,
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
export async function getNextStudentSequence(req: Request, res: Response) {
  try {
    const lastStudent = await db.student.findFirst({
      orderBy: {
        createdAt: "desc"
      }
    });
    //BU/UG/2024/0001
    const stringSeq = lastStudent?.regNo?.split("/")[3];
    const lastSeq = stringSeq ? parseInt(stringSeq) : 0;
    const nextSeq = lastSeq + 1;
    return res.status(200).json(nextSeq);
  } catch (error) {
    console.log(error);
  }
}
export async function getStudents(req: Request, res: Response) {
  try {
    const students = await db.student.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
    return res.status(200).json(students);
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
