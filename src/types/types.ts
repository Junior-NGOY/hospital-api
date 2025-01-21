import { Gender, SubjectCategory, SubjectType, UserRole } from "@prisma/client";
import { Request, Response } from "express";

export interface TypedRequestBody<T> extends Request {
  body: T;
}
export type ContactProps = {
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
export type ClassCreateProps = {
  title: string;
  slug: string;
  schoolId: string;
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
export type StudentCreateProps = {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  parentId: string;
  classId: string;
  streamId: string;
  parentName?: string;
  classTitle?: string;
  streamTitle?: string;
  password: string;
  imageUrl: string;
  phone?: string;
  state?: string;
  BCN?: string; // Birth Certificate Number
  nationality: string;
  religion?: string;
  gender: string;
  dob: string;
  rollNo?: string;
  regNo?: string;
  admissionDate: string;
  address: string;
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
