import { db } from "@/db/db";
import { Request, Response } from "express";
import { TypedRequestBody } from "@/types";
import { Specialization, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { AuthRequest } from "@/middleware/auth";
import { generateAccessToken, generateRefreshToken } from "@/utils/tokens";

function isBcryptHash(value: string): boolean {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

async function passwordsMatch(plain: string, stored: string): Promise<boolean> {
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plain, stored);
  }
  // Legacy POST /register stored a dummy plaintext instead of bcrypt.
  return stored === plain;
}

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  hospitalId: string | null;
  branchId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  hospital?: { id: string; name: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    hospitalId: user.hospitalId,
    hospitalName: user.hospital?.name ?? null,
    branchId: user.branchId,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

// Interface pour la création d'un utilisateur
interface CreateUserProps {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  hospitalId?: string;
  branchId?: string;
  phone?: string;
  isActive?: boolean;
  // Champs spécifiques aux rôles
  specialization?: Specialization; // Pour les médecins
  licenseNumber?: string; // Pour le personnel médical
  position?: string; // Pour les administrateurs
}

/**
 * Crée un nouvel utilisateur
 */
export async function createUser(
  req: TypedRequestBody<CreateUserProps>,
  res: Response
) {
  const {
    email,
    password,
    firstName,
    lastName,
    role,
    hospitalId,
    branchId,
    phone,
    isActive = true,
    specialization,
    licenseNumber,
    position
  } = req.body;

  try {
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({
        data: null,
        error: "Email, prénom, nom et rôle sont requis"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await db.user.findUnique({
      where: {
        email: normalizedEmail
      }
    });

    if (existingUser) {
      return res.status(409).json({
        data: null,
        error: "Un utilisateur avec cet email existe déjà"
      });
    }

    // Vérifier si l'hôpital existe (si fourni)
    if (hospitalId) {
      const hospital = await db.hospital.findUnique({
        where: {
          id: hospitalId
        }
      });

      if (!hospital) {
        return res.status(404).json({
          data: null,
          error: "Hôpital non trouvé"
        });
      }
    }

    // Vérifier si la branche existe (si fournie)
    if (branchId) {
      const branch = await db.hospitalBranch.findUnique({
        where: {
          id: branchId
        }
      });

      if (!branch) {
        return res.status(404).json({
          data: null,
          error: "Branche d'hôpital non trouvée"
        });
      }
    }

    // Vérifier les champs requis selon le rôle
    if (role === "DOCTOR" && !specialization) {
      return res.status(400).json({
        data: null,
        error: "La spécialisation est requise pour les médecins"
      });
    }    if ((role === "DOCTOR" || role === "NURSE" || role === "PHARMACIST") && !licenseNumber) {
      return res.status(400).json({
        data: null,
        error: "Le numéro de licence est requis pour ce rôle"
      });
    }

    if (role === "ADMINISTRATOR" && !position) {
      return res.status(400).json({
        data: null,
        error: "La position est requise pour les administrateurs"
      });
    }

    if (!password) {
      return res.status(400).json({
        data: null,
        error: "Le mot de passe est requis"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur de base
    const newUser = await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        hospitalId,
        branchId,
        phone,
        isActive
      }
    });

    // Créer l'enregistrement spécifique au rôle
    switch (role) {
      case "DOCTOR":
        await db.doctor.create({
          data: {
            userId: newUser.id,
            licenseNumber: licenseNumber!,
            specialization: specialization!
          }
        });
        break;
        
      case "NURSE":
        await db.nurse.create({
          data: {
            userId: newUser.id,
            licenseNumber:licenseNumber!,
          }
        });
        break;
        
      case "ADMINISTRATOR":
        await db.administrator.create({
          data: {
            userId: newUser.id,
            position : position!,
          }
        });
        break;
        
      case "RECEPTIONIST":
        await db.receptionist.create({
          data: {
            userId: newUser.id
          }
        });
        break;
          case "LAB_TECHNICIAN":
        await db.labTechnician.create({
          data: {
            userId: newUser.id,
            specialization: specialization // Optionnel selon le schéma
          }
        });
        break;
        
      case "ACCOUNTANT":
        await db.accountant.create({
          data: {
            userId: newUser.id
          }
        });
        break;
        
      case "PHARMACIST":
        await db.pharmacist.create({
          data: {
            userId: newUser.id,
            licenseNumber: licenseNumber!,
          }
        });
        break;
    }

    // Récupérer l'utilisateur créé avec ses informations de rôle
    const createdUser = await db.user.findUnique({
      where: {
        id: newUser.id
      },
      include: {
        doctor: role === "DOCTOR",
        nurse: role === "NURSE",
        administrator: role === "ADMINISTRATOR",
        receptionist: role === "RECEPTIONIST",
        labTechnician: role === "LAB_TECHNICIAN",
        accountant: role === "ACCOUNTANT",
        pharmacist: role === "PHARMACIST",
        hospital: hospitalId ? {
          select: {
            id: true,
            name: true
          }
        } : false,
        branch: branchId ? {
          select: {
            id: true,
            name: true
          }
        } : false
      }
    });

    // Supprimer le mot de passe de la réponse
    const { password: _, ...userWithoutPassword } = createdUser as any;

    return res.status(201).json({
      data: userWithoutPassword,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la création de l'utilisateur"
    });
  }
}

/**
 * Connexion email + mot de passe → JWT
 */
export async function login(
  req: TypedRequestBody<{ email?: string; password?: string }>,
  res: Response
) {
  const email = req.body?.email?.trim();
  const password = req.body?.password;

  if (!email || !password) {
    return res.status(400).json({
      data: null,
      error: "Email et mot de passe requis"
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();
    let user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        hospital: {
          select: { id: true, name: true }
        }
      }
    });

    if (!user && normalizedEmail !== email) {
      user = await db.user.findUnique({
        where: { email },
        include: {
          hospital: {
            select: { id: true, name: true }
          }
        }
      });
    }

    if (!user || !(await passwordsMatch(password, user.password))) {
      return res.status(401).json({
        data: null,
        error: "Email ou mot de passe incorrect"
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        data: null,
        error: "Compte désactivé"
      });
    }

    if (!isBcryptHash(user.password)) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      branchId: user.branchId
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return res.status(200).json({
      data: {
        user: publicUser(user),
        accessToken,
        refreshToken
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la connexion"
    });
  }
}

/**
 * Utilisateur courant (Bearer)
 */
export async function getMe(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({
      data: null,
      error: "Authentification requise"
    });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        hospital: {
          select: { id: true, name: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }

    return res.status(200).json({
      data: publicUser(user),
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération du profil"
    });
  }
}

/**
 * Récupère tous les utilisateurs
 */
export async function getAllUsers(req: Request, res: Response) {
  const { hospitalId, branchId, role, isActive, page = "1", limit = "10" } = req.query;
  
  const pageNumber = parseInt(page as string);
  const limitNumber = parseInt(limit as string);
  const skip = (pageNumber - 1) * limitNumber;

  try {
    // Construire les filtres
    const where: any = {};
    
    if (hospitalId) where.hospitalId = hospitalId as string;
    if (branchId) where.branchId = branchId as string;
    if (role) where.role = role as UserRole;
    if (isActive !== undefined) where.isActive = isActive === "true";

    // Compter le nombre total d'utilisateurs correspondant aux filtres
    const totalUsers = await db.user.count({ where });
    
    // Récupérer les utilisateurs avec pagination
    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        phone: true,
        createdAt: true,
        hospital: hospitalId ? {
          select: {
            id: true,
            name: true
          }
        } : false,
        branch: branchId ? {
          select: {
            id: true,
            name: true
          }
        } : false,
        doctor: {
          select: {
            id: true,
            specialization: true,
            licenseNumber: true
          }
        },
        nurse: {
          select: {
            licenseNumber: true,
            specialization: true
          }
        },
        administrator: {
          select: {
            position: true
          }
        },
        pharmacist: {
          select: {
            licenseNumber: true
          }
        },
        labTechnician: {
          select: {
            specialization: true
          }
        }
      },
      orderBy: {
        lastName: "asc"
      },
      skip,
      take: limitNumber
    });

    return res.status(200).json({
      data: {
        users,
        pagination: {
          total: totalUsers,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalUsers / limitNumber)
        }
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération des utilisateurs"
    });
  }
}

/**
 * Récupère un utilisateur par son ID
 */
export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const user = await db.user.findUnique({
      where: {
        id
      },
      include: {
        doctor: true,
        nurse: true,
        administrator: true,
        receptionist: true,
        labTechnician: true,
        accountant: true,
        pharmacist: true,
        hospital: {
          select: {
            id: true,
            name: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }

    // Supprimer le mot de passe de la réponse
    const { password, ...userWithoutPassword } = user;

    return res.status(200).json({
      data: userWithoutPassword,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération de l'utilisateur"
    });
  }
}

/**
 * Met à jour un utilisateur
 */
export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    phone,
    hospitalId,
    branchId,
    isActive,
    specialization,
    licenseNumber,
    position
  } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const existingUser = await db.user.findUnique({
      where: {
        id
      },
      include: {
        doctor: true,
        nurse: true,
        administrator: true,
        labTechnician: true,
        pharmacist: true
      }
    });

    if (!existingUser) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }

    // Vérifier si l'hôpital existe (si fourni)
    if (hospitalId) {
      const hospital = await db.hospital.findUnique({
        where: {
          id: hospitalId
        }
      });

      if (!hospital) {
        return res.status(404).json({
          data: null,
          error: "Hôpital non trouvé"
        });
      }
    }

    // Vérifier si la branche existe (si fournie)
    if (branchId) {
      const branch = await db.hospitalBranch.findUnique({
        where: {
          id: branchId
        }
      });

      if (!branch) {
        return res.status(404).json({
          data: null,
          error: "Branche d'hôpital non trouvée"
        });
      }
    }

    // Mettre à jour l'utilisateur de base
    const updatedUser = await db.user.update({
      where: {
        id
      },
      data: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        hospitalId: hospitalId || undefined,
        branchId: branchId || undefined,
        isActive: isActive !== undefined ? isActive : undefined
      },
      include: {
        doctor: true,
        nurse: true,
        administrator: true,
        receptionist: true,
        labTechnician: true,
        accountant: true,
        pharmacist: true,
        hospital: {
          select: {
            id: true,
            name: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Mettre à jour les informations spécifiques au rôle
    switch (existingUser.role) {
      case "DOCTOR":
        if (existingUser.doctor && (specialization || licenseNumber)) {
          await db.doctor.update({
            where: {
              userId: id
            },
            data: {
              specialization: specialization || undefined,
              licenseNumber: licenseNumber || undefined
            }
          });
        }
        break;
        
      case "NURSE":
        if (existingUser.nurse && licenseNumber) {
          await db.nurse.update({
            where: {
              userId: id
            },
            data: {
              licenseNumber
            }
          });
        }
        break;
        
      case "ADMINISTRATOR":
        if (existingUser.administrator && position) {
          await db.administrator.update({
            where: {
              userId: id
            },
            data: {
              position
            }
          });
        }
        break;
        
      case "LAB_TECHNICIAN":
        if (existingUser.labTechnician && licenseNumber) {
          await db.labTechnician.update({
            where: {
              userId: id
            },
            data: {
              specialization: specialization!
            }
          });
        }
        break;
        
      case "PHARMACIST":
        if (existingUser.pharmacist && licenseNumber) {
          await db.pharmacist.update({
            where: {
              userId: id
            },
            data: {
              licenseNumber
            }
          });
        }
        break;
    }

    // Supprimer le mot de passe de la réponse
    const { password, ...userWithoutPassword } = updatedUser;

    return res.status(200).json({
      data: userWithoutPassword,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la mise à jour de l'utilisateur"
    });
  }
}

/**
 * Change le mot de passe d'un utilisateur
 */
export async function changePassword(req: Request, res: Response) {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await db.user.findUnique({
      where: {
        id
      }
    });

    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        data: null,
        error: "Mot de passe actuel incorrect"
      });
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await db.user.update({
      where: {
        id
      },
      data: {
        password: hashedPassword
      }
    });

    return res.status(200).json({
      data: { message: "Mot de passe modifié avec succès" },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors du changement de mot de passe"
    });
  }
}

/**
 * Réinitialise le mot de passe d'un utilisateur (par un administrateur)
 */
export async function resetPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const user = await db.user.findUnique({
      where: {
        id
      }
    });

    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await db.user.update({
      where: {
        id
      },
      data: {
        password: hashedPassword
      }
    });

    return res.status(200).json({
      data: { message: "Mot de passe réinitialisé avec succès" },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la réinitialisation du mot de passe"
    });
  }
}

/**
 * Désactive un utilisateur
 */
export async function deactivateUser(req: Request, res: Response) {
  const { id } = req.params;

  try {
    // Vérifier si l'utilisateur existe
    const user = await db.user.findUnique({
      where: {
        id
      }
    });

    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }

    // Désactiver l'utilisateur
    const updatedUser = await db.user.update({
      where: {
        id
      },
      data: {
        isActive: false
      }
    });

    // Supprimer le mot de passe de la réponse
    const { password, ...userWithoutPassword } = updatedUser;

    return res.status(200).json({
      data: userWithoutPassword,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la désactivation de l'utilisateur"
    });
  }
}

/**
 * Réactive un utilisateur
 */
export async function activateUser(req: Request, res: Response) {
  const { id } = req.params;

  try {
    // Vérifier si l'utilisateur existe
    const user = await db.user.findUnique({
      where: {
        id
      }
    });

    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }

    // Réactiver l'utilisateur
    const updatedUser = await db.user.update({
      where: {
        id
      },
      data: {
        isActive: true
      }
    });

    // Supprimer le mot de passe de la réponse
    const { password, ...userWithoutPassword } = updatedUser;

    return res.status(200).json({
      data: userWithoutPassword,
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la réactivation de l'utilisateur"
    });
  }
}

/**
 * Supprime un utilisateur
 */
export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;

  try {
    // Vérifier si l'utilisateur existe
    const user = await db.user.findUnique({
      where: {
        id
      },
      include: {
        doctor: {
          include: {
            consultations: {
              take: 1
            },
            surgeries: {
              take: 1
            }
          }
        },
        nurse: {
          include: {
            vitalSigns: {
              take: 1
            },
            medications: {
              take: 1
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        data: null,
        error: "Utilisateur non trouvé"
      });
    }

    // Vérifier si l'utilisateur a des données associées
    if (
      (user.doctor && (user.doctor.consultations.length > 0 || user.doctor.surgeries.length > 0)) ||
      (user.nurse && (user.nurse.vitalSigns.length > 0 || user.nurse.medications.length > 0))
    ) {
      return res.status(400).json({
        data: null,
        error: "Impossible de supprimer cet utilisateur car il a des données associées. Désactivez-le plutôt."
      });
    }

    // Supprimer les données spécifiques au rôle
    switch (user.role) {
      case "DOCTOR":
        if (user.doctor) {
          await db.doctor.delete({
            where: {
              userId: id
            }
          });
        }
        break;
        
      case "NURSE":
        if (user.nurse) {
          await db.nurse.delete({
            where: {
              userId: id
            }
          });
        }
        break;
        
      case "ADMINISTRATOR":
        await db.administrator.delete({
          where: {
            userId: id
          }
        });
        break;
        
      case "RECEPTIONIST":
        await db.receptionist.delete({
          where: {
            userId: id
          }
        });
        break;
        
      case "LAB_TECHNICIAN":
        await db.labTechnician.delete({
          where: {
            userId: id
          }
        });
        break;
        
      case "ACCOUNTANT":
        await db.accountant.delete({
          where: {
            userId: id
          }
        });
        break;
        
      case "PHARMACIST":
        await db.pharmacist.delete({
          where: {
            userId: id
          }
        });
        break;
    }

    // Supprimer l'utilisateur
    await db.user.delete({
      where: {
        id
      }
    });

    return res.status(200).json({
      data: { id },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la suppression de l'utilisateur"
    });
  }
}

/**
 * Récupère les utilisateurs par rôle
 */
export async function getUsersByRole(req: Request, res: Response) {
  const { role } = req.params;
  const { hospitalId, branchId, isActive, page = "1", limit = "10" } = req.query;
  
  const pageNumber = parseInt(page as string);
  const limitNumber = parseInt(limit as string);
  const skip = (pageNumber - 1) * limitNumber;

  try {
    // Vérifier si le rôle est valide
    if (!Object.values(UserRole).includes(role as UserRole)) {
      return res.status(400).json({
        data: null,
        error: "Rôle invalide"
      });
    }

    // Construire les filtres
    const where: any = { role: role as UserRole };
    
    if (hospitalId) where.hospitalId = hospitalId as string;
    if (branchId) where.branchId = branchId as string;
    if (isActive !== undefined) where.isActive = isActive === "true";

    // Compter le nombre total d'utilisateurs correspondant aux filtres
    const totalUsers = await db.user.count({ where });
    
    // Récupérer les utilisateurs avec pagination
    const users = await db.user.findMany({
      where,
      include: {
        doctor: role === "DOCTOR",
        nurse: role === "NURSE",
        administrator: role === "ADMINISTRATOR",
        receptionist: role === "RECEPTIONIST",
        labTechnician: role === "LAB_TECHNICIAN",
        accountant: role === "ACCOUNTANT",
        pharmacist: role === "PHARMACIST",
        hospital: hospitalId ? {
          select: {
            id: true,
            name: true
          }
        } : false,
        branch: branchId ? {
          select: {
            id: true,
            name: true
          }
        } : false
      },
      orderBy: {
        lastName: "asc"
      },
      skip,
      take: limitNumber
    });

    // Supprimer les mots de passe des réponses
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return res.status(200).json({
      data: {
        users: usersWithoutPasswords,
        pagination: {
          total: totalUsers,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalUsers / limitNumber)
        }
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: `Une erreur est survenue lors de la récupération des utilisateurs avec le rôle ${role}`
    });
  }
}

/**
 * Récupère les utilisateurs par hôpital
 */
export async function getUsersByHospital(req: Request, res: Response) {
  const { hospitalId } = req.params;
  const { role, isActive, page = "1", limit = "10" } = req.query;
  
  const pageNumber = parseInt(page as string);
  const limitNumber = parseInt(limit as string);
  const skip = (pageNumber - 1) * limitNumber;

  try {
    // Vérifier si l'hôpital existe
    const hospital = await db.hospital.findUnique({
      where: {
        id: hospitalId
      }
    });

    if (!hospital) {
      return res.status(404).json({
        data: null,
        error: "Hôpital non trouvé"
      });
    }

    // Construire les filtres
    const where: any = { hospitalId };
    
    if (role) where.role = role as UserRole;
    if (isActive !== undefined) where.isActive = isActive === "true";

    // Compter le nombre total d'utilisateurs correspondant aux filtres
    const totalUsers = await db.user.count({ where });
    
    // Récupérer les utilisateurs avec pagination
    const users = await db.user.findMany({
      where,
      include: {
        doctor: true,
        nurse: true,
        administrator: true,
        receptionist: true,
        labTechnician: true,
        accountant: true,
        pharmacist: true,
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        {
          role: "asc"
        },
        {
          lastName: "asc"
        }
      ],
      skip,
      take: limitNumber
    });

    // Supprimer les mots de passe des réponses
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return res.status(200).json({
      data: {
        users: usersWithoutPasswords,
        hospital: {
          id: hospital.id,
          name: hospital.name
        },
        pagination: {
          total: totalUsers,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalUsers / limitNumber)
        }
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération des utilisateurs de l'hôpital"
    });
  }
}

export async function getUsersByBranch(req: Request, res: Response) {
  const { branchId } = req.params;
  const { role, isActive, page = "1", limit = "10" } = req.query;
  
  const pageNumber = parseInt(page as string);
  const limitNumber = parseInt(limit as string);
  const skip = (pageNumber - 1) * limitNumber;

  try {
    // Vérifier si la branche existe
    const branch = await db.hospitalBranch.findUnique({
      where: {
        id: branchId
      }
    });

    if (!branch) {
      return res.status(404).json({
        data: null,
        error: "Branche d'hôpital non trouvée"
      });
    }

    // Construire les filtres
    const where: any = { branchId };
    
    if (role) where.role = role as UserRole;
    if (isActive !== undefined) where.isActive = isActive === "true";

    // Compter le nombre total d'utilisateurs correspondant aux filtres
    const totalUsers = await db.user.count({ where });
    
    // Récupérer les utilisateurs avec pagination
    const users = await db.user.findMany({
      where,
      include: {
        doctor: true,
        nurse: true,
        administrator: true,
        receptionist: true,
        labTechnician: true,
        accountant: true,
        pharmacist: true,
        hospital: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        {
          role: "asc"
        },
        {
          lastName: "asc"
        }
      ],
      skip,
      take: limitNumber
    });

    // Supprimer les mots de passe des réponses
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return res.status(200).json({
      data: {
        users: usersWithoutPasswords,
        branch: {
          id: branch.id,
          name: branch.name,
          hospitalId: branch.hospitalId
        },
        pagination: {
          total: totalUsers,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalUsers / limitNumber)
        }
      },
      error: null
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: null,
      error: "Une erreur est survenue lors de la récupération des utilisateurs de la branche"
    });
  }
}