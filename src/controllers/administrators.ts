import { db } from "@/db/db";
import { TypedRequestBody } from "@/types";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { UserRole,   Specialization } from "@prisma/client"; // Importer Specialization

/**
 * Crée un nouvel utilisateur
 */
interface UserCreateProps {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: string;
  specialization?: Specialization; 
  position?: string;
  licenseNumber?: string; 
  phone?: string;
  address?: string;
}

export async function createUser(
  req: TypedRequestBody<UserCreateProps>,
  res: Response
) {
  const { adminId } = req.params;
  const {
    email,
    password,
    firstName,
    lastName,
    role,
    departmentId,
    specialization,
    position,
    licenseNumber,
    phone,
    address
  } = req.body;
  
  try {
    const admin = await db.administrator.findUnique({
      where: { id: adminId },
      include: { user: true }
    });
    
    if (!admin) {
      return res.status(404).json({
        data: null,
        error: "Administrateur non trouvé"
      });
    }
    
    // Vérifier si l'email existe déjà
    const existingUser = await db.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(409).json({
        data: null,
        error: "Cet email est déjà utilisé"
      });
    }
    
    // Créer l'utilisateur
    const userData: any = {
      email,
      password: await bcrypt.hash(password, 10),
      firstName,
      lastName,
      role,
      isActive: true
    };
    
    // Ajouter les champs optionnels seulement s'ils sont définis
    if (phone) userData.phone = phone;
    if (address) userData.address = address;
    
    // Ajouter hospitalId et branchId seulement s'ils sont définis dans l'administrateur
    if (admin.user.hospitalId) userData.hospitalId = admin.user.hospitalId;
    if (admin.user.branchId) userData.branchId = admin.user.branchId;
    
    const user = await db.user.create({
      data: userData
    });
    
    // Créer le profil spécifique selon le rôle
    if (role === UserRole.DOCTOR) {
      // Vérifier si le département existe
      if (departmentId) {
        const department = await db.department.findUnique({
          where: { id: departmentId }
        });
        
        if (!department) {
          return res.status(404).json({
            data: null,
            error: "Département non trouvé"
          });
        }
      }
      
      // Créer le profil de médecin
      const doctorData: any = {
        userId: user.id
      };
      
      // Ajouter la spécialisation si définie
      if (specialization) doctorData.specialization = specialization;
      
      // Ajouter le département si défini
      if (departmentId) doctorData.departmentId = departmentId;
      
      await db.doctor.create({
        data: doctorData
      });
    } else if (role === UserRole.NURSE) {
      // Vérifier si le département existe
      if (departmentId) {
        const department = await db.department.findUnique({
          where: { id: departmentId }
        });
        
        if (!department) {
          return res.status(404).json({
            data: null,
            error: "Département non trouvé"
          });
        }
      }
      
      // Créer le profil d'infirmier
      const nurseData: any = {
        userId: user.id
      };
      
      // Ajouter le département si défini
      if (departmentId) nurseData.departmentId = departmentId;
      
      await db.nurse.create({
        data: nurseData
      });
    } else if (role === UserRole.RECEPTIONIST) {
      await db.receptionist.create({
        data: {
          userId: user.id
        }
      });
    } else if (role === UserRole.ADMINISTRATOR) {
      await db.administrator.create({
        data: {
            userId: user.id,
            position: position as string// Ajouter la position
          }
      });
    } else if (role === UserRole.PHARMACIST) {
      await db.pharmacist.create({
        data: {
            userId: user.id,
            licenseNumber: licenseNumber as string  // Ajouter le numéro de licence
          }
      });
    } else if (role === UserRole.LAB_TECHNICIAN) {
      await db.labTechnician.create({
        data: {
          userId: user.id
        }
      });
    } else if (role === UserRole.ACCOUNTANT) {
      await db.accountant.create({
        data: {
          userId: user.id
        }
      });
    }
    
    return res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
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