import { db } from "@/db/db";
import { Request, Response } from "express";
import { TypedRequestBody } from "@/types";
// ==================== FONCTIONS POUR LES DÉPARTEMENTS ====================

interface CreateDepartmentProps {
    name: string;
    description?: string;
    location?: string;
    hospitalId?: string;
    branchId?: string;
  }
  
  /**
   * Crée un nouveau département
   */
  export async function createDepartment(
    req: TypedRequestBody<CreateDepartmentProps>,
    res: Response
  ) {
    const { name, description, location, hospitalId, branchId } = req.body;
  
    try {
      // Vérifier qu'au moins un hospitalId ou branchId est fourni
      if (!hospitalId && !branchId) {
        return res.status(400).json({
          data: null,
          error: "Vous devez spécifier soit un hôpital, soit une branche"
        });
      }
  
      // Vérifier si l'hôpital existe si hospitalId est fourni
      if (hospitalId) {
        const hospital = await db.hospital.findUnique({
          where: { id: hospitalId }
        });
  
        if (!hospital) {
          return res.status(404).json({
            data: null,
            error: "Hôpital non trouvé"
          });
        }
      }
  
      // Vérifier si la branche existe si branchId est fourni
      if (branchId) {
        const branch = await db.hospitalBranch.findUnique({
          where: { id: branchId }
        });
  
        if (!branch) {
          return res.status(404).json({
            data: null,
            error: "Branche non trouvée"
          });
        }
      }
  
      // Créer le nouveau département
      const newDepartment = await db.department.create({
        data: {
          name,
          description,
          location,
          hospitalId,
          branchId
        }
      });
  
      return res.status(201).json({
        data: newDepartment,
        error: null
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        data: null,
        error: "Une erreur est survenue lors de la création du département"
      });
    }
  }
  
  /**
   * Récupère tous les départements d'un hôpital ou d'une branche
   */
  export async function getDepartments(req: Request, res: Response) {
    const { hospitalId, branchId } = req.query;
  
    try {
      // Construire les conditions de recherche
      const where: any = {};
      
      if (hospitalId) {
        where.hospitalId = hospitalId as string;
      }
      
      if (branchId) {
        where.branchId = branchId as string;
      }
  
      // Si aucun filtre n'est fourni, retourner tous les départements
      const departments = await db.department.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
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
          },
          _count: {
            select: {
              doctors: true,
              nurses: true,
              rooms: true,
              queues: true
            }
          }
        }
      });
  
      return res.status(200).json({
        data: departments,
        error: null
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        data: null,
        error: "Une erreur est survenue lors de la récupération des départements"
      });
    }
  }
  
  /**
   * Récupère un département par son ID
   */
  export async function getDepartmentById(req: Request, res: Response) {
    const { id } = req.params;
  
    try {
      const department = await db.department.findUnique({
        where: { id },
        include: {
          hospital: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },          branch: {
            select: {
              id: true,
              name: true
            }
          },
          doctors: {
            include: {
              doctor: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true
                    }
                  }
                }
              }
            }
          },
          nurses: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          rooms: true,
          queues: true
        }
      });
  
      if (!department) {
        return res.status(404).json({
          data: null,
          error: "Département non trouvé"
        });
      }
  
      return res.status(200).json({
        data: department,
        error: null
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        data: null,
        error: "Une erreur est survenue lors de la récupération du département"
      });
    }
  }
  
  /**
   * Met à jour un département
   */
  export async function updateDepartment(req: Request, res: Response) {
    const { id } = req.params;
    const { name, description, location, hospitalId, branchId } = req.body;
  
    try {
      // Vérifier si le département existe
      const department = await db.department.findUnique({
        where: { id }
      });
  
      if (!department) {
        return res.status(404).json({
          data: null,
          error: "Département non trouvé"
        });
      }
  
      // Vérifier si l'hôpital existe si hospitalId est fourni
      if (hospitalId) {
        const hospital = await db.hospital.findUnique({
          where: { id: hospitalId }
        });
  
        if (!hospital) {
          return res.status(404).json({
            data: null,
            error: "Hôpital non trouvé"
          });
        }
      }
  
      // Vérifier si la branche existe si branchId est fourni
      if (branchId) {
        const branch = await db.hospitalBranch.findUnique({
          where: { id: branchId }
        });
  
        if (!branch) {
          return res.status(404).json({
            data: null,
            error: "Branche non trouvée"
          });
        }
      }
  
      // Mettre à jour le département
      const updatedDepartment = await db.department.update({
        where: { id },
        data: {
          name: name || undefined,
          description: description !== undefined ? description : undefined,
          location: location !== undefined ? location : undefined,
          hospitalId: hospitalId || undefined,
          branchId: branchId || undefined
        }
      });
  
      return res.status(200).json({
        data: updatedDepartment,
        error: null
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        data: null,
        error: "Une erreur est survenue lors de la mise à jour du département"
      });
    }
  }
  
  /**
   * Supprime un département
   */
  export async function deleteDepartment(req: Request, res: Response) {
    const { id } = req.params;
  
    try {
      // Vérifier si le département existe
      const department = await db.department.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              doctors: true,
              nurses: true,
              rooms: true,
              queues: true,
              equipment: true
            }
          }
        }
      });
  
      if (!department) {
        return res.status(404).json({
          data: null,
          error: "Département non trouvé"
        });
      }
  
      // Vérifier s'il y a des entités liées
      if (
        department._count.doctors > 0 ||
        department._count.nurses > 0 ||
        department._count.rooms > 0 ||
        department._count.queues > 0 ||
        department._count.equipment > 0
      ) {
        return res.status(400).json({
          data: null,
          error: "Impossible de supprimer ce département car il contient des médecins, des infirmiers, des salles, des files d'attente ou des équipements"
        });
      }
  
      // Supprimer le département
      await db.department.delete({
        where: { id }
      });
  
      return res.status(200).json({
        data: { id },
        error: null
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        data: null,
        error: "Une erreur est survenue lors de la suppression du département"
      });
    }
  }
  
  /**
   * Assigne un médecin à un département
   */
  export async function assignDoctorToDepartment(req: Request, res: Response) {
    const { departmentId, doctorId } = req.body;
  
    try {
      // Vérifier si le département existe
      const department = await db.department.findUnique({
        where: { id: departmentId }
      });
  
      if (!department) {
        return res.status(404).json({
          data: null,
          error: "Département non trouvé"
        });
      }
  
      // Vérifier si le médecin existe
      const doctor = await db.doctor.findUnique({
        where: { id: doctorId }
      });
  
      if (!doctor) {
        return res.status(404).json({
          data: null,
          error: "Médecin non trouvé"
        });
      }
  
      // Vérifier si l'association existe déjà
      const existingAssignment = await db.departmentDoctor.findUnique({
        where: {
          departmentId_doctorId: {
            departmentId,
            doctorId
          }
        }
      });
  
      if (existingAssignment) {
        return res.status(409).json({
          data: null,
          error: "Ce médecin est déjà assigné à ce département"
        });
      }
  
      // Créer l'association
      const assignment = await db.departmentDoctor.create({
        data: {
          departmentId,
          doctorId
        }
      });
  
      return res.status(201).json({
        data: assignment,
        error: null
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        data: null,
        error: "Une erreur est survenue lors de l'assignation du médecin au département"
      });
    }
  }
  
  /**
   * Retire un médecin d'un département
   */
  export async function removeDoctorFromDepartment(req: Request, res: Response) {
    const { departmentId, doctorId } = req.params;
  
    try {
      // Vérifier si l'association existe
      const assignment = await db.departmentDoctor.findUnique({
        where: {
          departmentId_doctorId: {
            departmentId,
            doctorId
          }
        }
      });
  
      if (!assignment) {
        return res.status(404).json({
          data: null,
          error: "Ce médecin n'est pas assigné à ce département"
        });
      }
  
      // Supprimer l'association
      await db.departmentDoctor.delete({
        where: {
          departmentId_doctorId: {
            departmentId,
            doctorId
          }
        }
      });
  
      return res.status(200).json({
        data: { departmentId, doctorId },
        error: null
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        data: null,
        error: "Une erreur est survenue lors du retrait du médecin du département"
      });
    }
  }
  
  /**
   * Récupère les statistiques d'un département
   */
  export async function getDepartmentStatistics(req: Request, res: Response) {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
  
    try {
      // Vérifier si le département existe
      const department = await db.department.findUnique({
        where: { id }
      });
  
      if (!department) {
        return res.status(404).json({
          data: null,
          error: "Département non trouvé"
        });
      }
  
      // Définir la période pour les statistiques
      const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const end = endDate ? new Date(endDate as string) : new Date();
  
      // Récupérer les statistiques d'admission
      const admissionStats = await db.admissionStatistics.findFirst({
        where: {
          departmentId: id,
          date: {
            gte: start,
            lte: end
          }
        },
        orderBy: {
          date: "desc"
        }
      });
  
      // Récupérer les statistiques financières
      const financialStats = await db.financialStatistics.findFirst({
        where: {
          departmentId: id,
          date: {
            gte: start,
            lte: end
          }
        },
        orderBy: {
          date: "desc"
        }
      });
  
      // Compter les lits et leur occupation
      const rooms = await db.room.findMany({
        where: {
          departmentId: id
        },
        include: {
          beds: true
        }
      });
  
      const totalBeds = rooms.reduce((acc, room) => acc + room.beds.length, 0);
      const occupiedBeds = rooms.reduce((acc, room) => acc + room.beds.filter(bed => bed.isOccupied).length, 0);
      const bedOccupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
  
      // Compter le personnel
      const [doctorCount, nurseCount] = await Promise.all([
        db.departmentDoctor.count({
          where: {
            departmentId: id
          }
        }),
        db.nurse.count({
          where: {
            departmentId: id
          }
        })
      ]);
  
      // Construire l'objet de statistiques
      const statistics = {
        department: {
          id: department.id,
          name: department.name
        },
        period: {
          start,
          end
        },
        staff: {
          doctorCount,
          nurseCount,
          totalStaff: doctorCount + nurseCount
        },
        beds: {
          totalBeds,
          occupiedBeds,
          availableBeds: totalBeds - occupiedBeds,
          occupancyRate: bedOccupancyRate
        },
        admissions: admissionStats || {
          totalAdmissions: 0,
          totalDischarges: 0,
          averageLOS: 0,
          bedOccupancyRate: 0,
          readmissionRate: 0
        },
        financial: financialStats || {
          totalRevenue: 0,
          privateRevenue: 0,
          subscriberRevenue: 0,
          consultationCount: 0,
          admissionCount: 0
        }
      };
  
      return res.status(200).json({
        data: statistics,
        error: null
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        data: null,
        error: "Une erreur est survenue lors de la récupération des statistiques du département"
      });
    }
  }