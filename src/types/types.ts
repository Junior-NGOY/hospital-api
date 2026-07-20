import { Gender, MaritalStatus, PatientCategory } from "@prisma/client";
import { Request, Response } from "express";

export interface TypedRequestBody<T> extends Request {
  body: T;
}
export type PatientCreateProps = {
  title: string;
  name: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth: string; // Date of Birth
  gender: Gender;
  maritalStatut: MaritalStatus;
  address: string;
  phoneNumber: string;
  emergencyContact?: string;
  profession?: string;
  regNo?: string;
  admissionDate: string;
  category: PatientCategory;
};
export type QueueItemCreateProps = {
  id: string;
  patientId: string;
  arrivalTime: string;
  //status?: Status;
  patientName?: String;
  patientFirstName?: String;
  patientLastName?: String;
  patientRegNo?: String;
  patientGender?: String;
  patientPhoneNumber?: String;
};
export type ConsultationCreateProps = {
  id              :string,    
  patientId      : string,
  patient        : string,  
/*   staffId           String
  staff             Staff     @relation(fields: [staffId], references: [id])
  hospitalId        String
  hospital          Hospital  @relation(fields: [hospitalId], references: [id])
  chiefComplaintId String?
  chiefComplaint  Complaint? @relation(fields: [chiefComplaintId], references: [id])
  otherComplaints String?
  historyOfIllness String   // Histoire de la maladie
  diagnosis       String
  treatment       String
  notes           String?
  vitalSigns      VitalSigns[]
  prescriptions   Prescription[] */
}
/* export type ContactProps = {
  fullName: string;
  email: string;
  phone: string;
  hospital: string;
  country: string;
  hospitalPage: string;
  bedCount: number;
  role: string;
  media: string;
  message: string;
};

export type departmentCreateProps = {
  name: string;
  slug: string;
  hospitalId: string;
};

export type UserCreateProps = {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phone?: string;
  image?: string;
  hospitalId?: string;
  hospitalName?: string;
};
export type UserLoginProps = {
  email: string;
  password: string;
};
 */