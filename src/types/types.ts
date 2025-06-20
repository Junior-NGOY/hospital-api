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
  school: string;
  country: string;
  schoolPage: string;
  students: number;
  role: string;
  media: string;
  message: string;
};

export type departmentCreateProps = {
  name: string;
  slug: string;
  schoolId: string;
};
export type StreamCreateProps = {
  title: string;
  slug: string;
  classId: string;
  schoolId: string;
};
export type ParentCreateProps = {
  title: string;
  firstname: string;
  lastname: string;
  relationship: string;
  email: string;
  NIN: string;
  gender: string;
  dob: string;
  phone: string;
  nationality: string;
  whatsappNo: string;
  imageUrl: string;
  contactMethod: string;
  occupation: string;
  address: string;
  password: string;
  schoolId: string;
  userId: string;
};

export type SubjectCreateProps = {
  name: string;
  slug: string;
  code: string;
  shortName: string;
  category: SubjectCategory;
  type: SubjectType;
  departmentId: string;
  departmentName: string;
};

export type TeacherCreateProps = {
  title: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsappNo: string;
  nationality: string;
  NIN: string;
  gender: Gender;
  dateOfBirth: string;
  contactMethod: string;
  password: string;
  dateOfJoining: string;
  designation: string;
  departmentId: string;
  departmentName: string;
  qualification: string;
  mainSubject: string;
  mainSubjectId: string;
  subjects: string[];
  classIds: string[];
  classes: string[];
  imageUrl: string;
  experience: number;
  address: string;
  schoolId: string;
  userId: string;
};
export type UserCreateProps = {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phone?: string;
  image?: string;
  schoolId?: string;
  schoolName?: string;
};
export type UserLoginProps = {
  email: string;
  password: string;
};
 */