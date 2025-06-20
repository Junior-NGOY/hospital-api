import { db } from "@/db/db";
import { QueueCreateProps, QueueEntryCreateProps, QueueEntryUpdateProps, QueueUpdateProps, TypedRequestBody } from "@/types";
import { calculateAge } from "@/utils/calculateAge";
import { convertDateToIso } from "@/utils/convertDateToIso";
import { Request, Response } from "express";

// Créer une nouvelle file d'attente
export async function createQueue(
  req: TypedRequestBody<QueueCreateProps>,
  res: Response
) {
  const data = req.body;  try {
    if (!data.departmentId) {
      return res.status(400).json({
        data: null,
        error: "departmentId est requis"
      });
    }

    const newQueue = await db.queue.create({
      data: {
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        isActive: true
      }
    });
    
    console.log(`Queue created successfully: ${newQueue.name} (${newQueue.id})`);
    
    return res.status(201).json({
      data: newQueue,
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

// Mettre à jour une file d'attente
export async function updateQueue(
  req: TypedRequestBody<QueueUpdateProps>,
  res: Response
) {
  const { id } = req.params;
  const data = req.body;
  
  try {
    const updatedQueue = await db.queue.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        isActive: data.isActive
      }
    });
    
    return res.status(200).json({
      data: updatedQueue,
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
export async function deleteQueue(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await db.queue.delete({
      where: { id }
    });
    
    return res.status(200).json({
      data: { success: true, message: "Queue deleted successfully" },
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
// Récupérer toutes les files d'attente
export async function getQueues(req: Request, res: Response) {
  try {    const queues = await db.queue.findMany({
      include: {
        department: true,
        hospital: true,
        _count: {
          select: {
            entries: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return res.status(200).json({
      data: queues,
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

export async function addToQueue(
  req: TypedRequestBody<QueueEntryCreateProps>,
  res: Response
) {
  const data = req.body;
  try {
    // Trouver le numéro de ticket maximum actuel pour cette file d'attente spécifique
    const maxTicket = await db.queueEntry.findFirst({
      where: { 
        queueId: data.queueId,
        // Optionnel : limiter aux entrées créées aujourd'hui si vous voulez réinitialiser les numéros chaque jour
         createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }      },
      orderBy: { ticketNumber: 'desc' }
    });
    
    const nextNumber = maxTicket ? (maxTicket.ticketNumber || 0) + 1 : 1;
    const priority = data.priority || 'NORMAL';
    // Créer l'entrée dans la file d'attente avec le numéro de ticket
    const newQueueEntry = await db.queueEntry.create({
      data: {
        queueId: data.queueId,
        patientId: data.patientId,
        status: data.status || 'WAITING',
        priority: priority,
        notes: data.notes,
        ticketNumber: nextNumber
      },
      include: {
        patient: true, // Inclure les informations du patient si nécessaire
        queue: true    // Inclure les informations de la file d'attente si nécessaire
      }
    });
    
    console.log(`Queue entry created successfully: ${newQueueEntry.id} with ticket number ${nextNumber}`);
    return res.status(201).json({
      data: newQueueEntry,
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

// Obtenir les données pour l'affichage public
/**
 * Récupère les informations d'affichage d'une file d'attente spécifique
 * Inclut les entrées actives (en attente et en cours de traitement) avec leurs informations patient
 */
 export async function getQueueDisplay(req: Request, res: Response) {
  const { queueId } = req.params;
  
  try {
    // Vérifier si la file d'attente existe
    const queue = await db.queue.findUnique({
      where: { id: queueId },
      include: {
        department: true,
        //queueConfiguration: true
      }
    });
    
    if (!queue) {
      return res.status(404).json({
        data: null,
        error: "Queue not found"
      });
    }
    
    // Récupérer les entrées actives de la file d'attente (en attente et en cours de traitement)
    const activeEntries = await db.queueEntry.findMany({
      where: {
        queueId,
        status: {
          in: ['WAITING', 'IN_PROGRESS'] // Uniquement les entrées actives
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            phone: true,
            email: true,
            // Exclure les informations sensibles comme l'adresse complète
          }
        },
        // Inclure l'utilisateur assigné si nécessaire
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            role: true
          }
        }
      },
      orderBy: [
        // Trier d'abord par priorité (du plus urgent au moins urgent)
        { priority: 'desc' },
        // Puis par numéro de ticket (du plus ancien au plus récent)
        { ticketNumber: 'asc' }
      ]
    });
    
    // Calculer des statistiques sur la file d'attente
    const waitingCount = activeEntries.filter(entry => entry.status === 'WAITING').length;
    const processingCount = activeEntries.filter(entry => entry.status === 'IN_PROGRESS').length;
    
    // Récupérer le temps d'attente moyen (si nécessaire)
    const completedEntriesToday = await db.queueEntry.findMany({
      where: {
        queueId,
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)) // Depuis minuit aujourd'hui
        },
        completedAt: {
          not: null
        }
      },
      select: {
        createdAt: true,
        completedAt: true
      }
    });
    
    // Calculer le temps d'attente moyen en minutes
    let averageWaitTime = 0;
    if (completedEntriesToday.length > 0) {
      const totalWaitTimeMs = completedEntriesToday.reduce((total, entry) => {
        const waitTime = entry.completedAt!.getTime() - entry.createdAt.getTime();
        return total + waitTime;
      }, 0);
      averageWaitTime = Math.round(totalWaitTimeMs / completedEntriesToday.length / 60000); // Convertir en minutes
    }
    
    // Formater les données pour l'affichage
    const displayData = {
      queue: {
        id: queue.id,
        name: queue.name,
        description: queue.description,
        department: queue.department ? {
          id: queue.department.id,
          name: queue.department.name
        } : null,
        isActive: queue.isActive,
       // configuration: queue.queueConfiguration
      },
      statistics: {
        waitingCount,
        processingCount,
        totalActiveCount: waitingCount + processingCount,
        averageWaitTimeMinutes: averageWaitTime
      },
      entries: activeEntries.map(entry => ({
        id: entry.id,
        ticketNumber: entry.ticketNumber,
        status: entry.status,
        priority: entry.priority,
        createdAt: entry.createdAt,
        waitingTime: Math.round((new Date().getTime() - entry.createdAt.getTime()) / 60000), // Temps d'attente en minutes
        patient: {
          id: entry.patient.id,
          name: `${entry.patient.firstName} ${entry.patient.lastName}`,
          // Masquer partiellement les informations sensibles pour l'affichage public
          displayName: `${entry.patient.firstName} ${entry.patient.lastName.charAt(0)}.`,
          gender: entry.patient.gender,
          age: calculateAge(entry.patient.dateOfBirth)
        },
        assignedTo: entry.assignedTo ? {
          id: entry.assignedTo.id,
          name: entry.assignedTo.firstName,
          role: entry.assignedTo.role
        } : null,
        notes: entry.notes
      }))
    };
    
    return res.status(200).json({
      data: displayData,
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


  export async function getQueueDisplayAll(req: Request, res: Response) {
    try {
      // Récupérer toutes les files d'attente actives
      const queues = await db.queue.findMany({
        where: { 
          isActive: true 
        },
        include: {
          department: true
        }
      });
      
      // Traiter chaque file d'attente et récupérer ses entrées
      const queueDisplayData = await Promise.all(queues.map(async (queue) => {
        // Récupérer la configuration de la file d'attente
        const queueConfiguration = await db.queueConfiguration.findUnique({
          where: { queueId: queue.id }
        });
        
        // Récupérer les entrées actives
        const activeEntries = await db.queueEntry.findMany({
          where: {
            queueId: queue.id,
            status: {
              in: ['WAITING', 'IN_PROGRESS']
            }
          },
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                gender: true
              }
            },
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                role: true
              }
            }
          },
          orderBy: [
            { priority: 'desc' },
            { ticketNumber: 'asc' }
          ]
        });
        
        // Calculer les statistiques
        const waitingCount = activeEntries.filter(entry => entry.status === 'WAITING').length;
        const processingCount = activeEntries.filter(entry => entry.status === 'IN_PROGRESS').length;
        
        // Formater les données
        return {
          queue: {
            id: queue.id,
            name: queue.name,
            description: queue.description,
            department: queue.department ? {
              id: queue.department.id,
              name: queue.department.name
            } : null,
            isActive: queue.isActive,
            configuration: queueConfiguration
          },
          statistics: {
            waitingCount,
            processingCount,
            totalActiveCount: waitingCount + processingCount
          },
          entries: activeEntries.map(entry => ({
            id: entry.id,
            ticketNumber: entry.ticketNumber,
            status: entry.status,
            priority: entry.priority,
            createdAt: entry.createdAt,
            patient: {
              id: entry.patient.id,
              displayName: `${entry.patient.firstName} ${entry.patient.lastName.charAt(0)}.`,
              gender: entry.patient.gender,
              age: calculateAge(entry.patient.dateOfBirth)
            },
            assignedTo: entry.assignedTo ? {
              id: entry.assignedTo.id,
              name: entry.assignedTo.firstName,
              role: entry.assignedTo.role
            } : null
          }))
        };
      }));
      
      return res.status(200).json({
        data: queueDisplayData,
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
 

// Appeler le prochain patient
/**
 * Appelle le prochain patient dans la file d'attente
 * Met à jour le statut de l'entrée de WAITING à PROCESSING
 * Assigne l'entrée à l'utilisateur qui a appelé le patient (médecin/personnel)
 */
export async function callNextPatient(
  req: TypedRequestBody<{ userId: string }>,
  res: Response
) {
  const { queueId } = req.params;
  const { userId } = req.body;
  
  try {
    // Vérifier si la file d'attente existe
    const queue = await db.queue.findUnique({
      where: { id: queueId }
    });
    
    if (!queue) {
      return res.status(404).json({
        data: null,
        error: "Queue not found"
      });
    }
    
    // Vérifier si l'utilisateur existe
    const user = await db.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({
        data: null,
        error: "User not found"
      });
    }
    
    // Trouver le prochain patient en attente
    // Trier par priorité (du plus urgent au moins urgent) puis par numéro de ticket (FIFO)
    const nextPatient = await db.queueEntry.findFirst({
      where: {
        queueId,
        status: 'WAITING'
      },
      orderBy: [
        { priority: 'desc' },
        { ticketNumber: 'asc' }
      ],
      include: {
        patient: true,
        queue: true
      }
    });
    
    if (!nextPatient) {
      return res.status(404).json({
        data: null,
        error: "No patients waiting in queue"
      });
    }
    
    // Mettre à jour le statut de l'entrée et assigner l'utilisateur
    const updatedEntry = await db.queueEntry.update({
      where: { id: nextPatient.id },
      data: {
        status: 'IN_PROGRESS',
        // Utiliser le nom correct du champ pour l'utilisateur assigné
        // Si c'est assignedToId :
        assignedToId: userId,
        // Si c'est userId :
        // userId: userId,
        // Si c'est doctorId :
        // doctorId: userId,
      },
      include: {
        patient: true,
        queue: true,
        // Inclure l'utilisateur assigné avec le nom correct de la relation
        // Si c'est assignedTo :
        assignedTo: true,
        // Si c'est user :
        // user: true,
        // Si c'est doctor :
        // doctor: true,
      }
    });
    
    // Enregistrer l'action dans les logs (optionnel)
    console.log(`Patient ${updatedEntry.patient.firstName} ${updatedEntry.patient.lastName} (ID: ${updatedEntry.patient.id}) called by user ${userId} in queue ${queueId}`);
    
    // Formater la réponse
    const responseData = {
      id: updatedEntry.id,
      ticketNumber: updatedEntry.ticketNumber,
      status: updatedEntry.status,
      priority: updatedEntry.priority,
      createdAt: updatedEntry.createdAt,
      waitingTime: Math.round((new Date().getTime() - updatedEntry.createdAt.getTime()) / 60000), // Temps d'attente en minutes
      patient: {
        id: updatedEntry.patient.id,
        name: `${updatedEntry.patient.firstName} ${updatedEntry.patient.lastName}`,
        gender: updatedEntry.patient.gender,
        age: calculateAge(updatedEntry.patient.dateOfBirth)      },
      queue: {
        id: updatedEntry.queue?.id || '',
        name: updatedEntry.queue?.name || 'Queue inconnue'
      },
      // Utiliser le nom correct de la relation pour l'utilisateur assigné
      // Si c'est assignedTo :
      assignedTo: {
        id: updatedEntry?.assignedTo?.id || null,
        name: updatedEntry?.assignedTo?.firstName,
        role: updatedEntry?.assignedTo?.role
      },
      // Si c'est user :
      // assignedTo: {
      //   id: updatedEntry.user.id,
      //   name: updatedEntry.user.name,
      //   role: updatedEntry.user.role
      // },
      // Si c'est doctor :
      // assignedTo: {
      //   id: updatedEntry.doctor.id,
      //   name: updatedEntry.doctor.name,
      //   role: updatedEntry.doctor.role
      // },
      notes: updatedEntry.notes
    };
    
    return res.status(200).json({
      data: responseData,
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

// Mettre à jour une entrée de file d'attente
/**
 * Met à jour une entrée dans la file d'attente
 * Permet de modifier le statut, la priorité, les notes, et l'utilisateur assigné
 */
export async function updateQueueEntry(
  req: TypedRequestBody<QueueEntryUpdateProps>,
  res: Response
) {
  const { entryId } = req.params;
  const data = req.body;
  
  try {
    // Vérifier si l'entrée existe
    const existingEntry = await db.queueEntry.findUnique({
      where: { id: entryId },
      include: {
        patient: true,
        queue: true
      }
    });
    
    if (!existingEntry) {
      return res.status(404).json({
        data: null,
        error: "Queue entry not found"
      });
    }
    
    // Préparer les données de mise à jour
    const updateData: any = {};
    
    // Mettre à jour le statut si fourni
    if (data.status) {
      updateData.status = data.status;
      
      // Si le statut passe à COMPLETED, enregistrer l'heure de fin
      if (data.status === 'COMPLETED' && existingEntry.status !== 'COMPLETED') {
        updateData.completedAt = new Date();
      }
      
      // Si le statut passe de COMPLETED à autre chose, réinitialiser l'heure de fin
      if (data.status !== 'COMPLETED' && existingEntry.status === 'COMPLETED') {
        updateData.completedAt = null;
      }
    }
    
    // Mettre à jour la priorité si fournie
    if (data.priority !== undefined) {
      // Convertir la priorité numérique en valeur d'énumération si nécessaire
      if (typeof data.priority === 'number') {
        updateData.priority = mapNumberToPriority(data.priority);
      } else {
        updateData.priority = data.priority;
      }
    }
    
    // Mettre à jour les notes si fournies
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    
    // Mettre à jour l'utilisateur assigné si fourni
    if (data.assignedToId !== undefined) {
      // Utiliser le nom correct du champ pour l'utilisateur assigné
      // Si c'est assignedToId :
      updateData.assignedToId = data.assignedToId;
      // Si c'est userId :
      // updateData.userId = data.assignedToId;
      // Si c'est doctorId :
      // updateData.doctorId = data.assignedToId;
    }
    
    // Effectuer la mise à jour
    const updatedEntry = await db.queueEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        patient: true,
        queue: true,
        // Inclure l'utilisateur assigné avec le nom correct de la relation
        // Si c'est assignedTo :
        assignedTo: true,
        // Si c'est user :
        // user: true,
        // Si c'est doctor :
        // doctor: true,
      }
    });
    
    // Enregistrer l'action dans les logs (optionnel)
    console.log(`Queue entry ${entryId} updated: ${JSON.stringify(data)}`);
    
    // Formater la réponse
    const responseData = {
      id: updatedEntry.id,
      ticketNumber: updatedEntry.ticketNumber,
      status: updatedEntry.status,
      priority: updatedEntry.priority,
      createdAt: updatedEntry.createdAt,
      updatedAt: updatedEntry.updatedAt,
      completedAt: updatedEntry.completedAt,
      waitingTime: Math.round((
        (updatedEntry.completedAt || new Date()).getTime() - 
        updatedEntry.createdAt.getTime()
      ) / 60000), // Temps d'attente en minutes
      patient: {
        id: updatedEntry.patient.id,
        name: `${updatedEntry.patient.firstName} ${updatedEntry.patient.lastName}`,
        gender: updatedEntry.patient.gender,
        age: calculateAge(updatedEntry.patient.dateOfBirth)
      },      queue: {
        id: updatedEntry.queue?.id || '',
        name: updatedEntry.queue?.name || 'Queue inconnue'
      },
      // Utiliser le nom correct de la relation pour l'utilisateur assigné
      // Si c'est assignedTo :
      assignedTo: updatedEntry.assignedTo ? {
        id: updatedEntry.assignedTo.id,
        name: updatedEntry.assignedTo.firstName,
        role: updatedEntry.assignedTo.role
      } : null,
      // Si c'est user :
      // assignedTo: updatedEntry.user ? {
      //   id: updatedEntry.user.id,
      //   name: updatedEntry.user.name,
      //   role: updatedEntry.user.role
      // } : null,
      // Si c'est doctor :
      // assignedTo: updatedEntry.doctor ? {
      //   id: updatedEntry.doctor.id,
      //   name: updatedEntry.doctor.name,
      //   role: updatedEntry.doctor.role
      // } : null,
      notes: updatedEntry.notes
    };
    
    return res.status(200).json({
      data: responseData,
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
// Fonction pour convertir un nombre en valeur d'énumération QueuePriority
function mapNumberToPriority(priorityNumber: number): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  switch (priorityNumber) {
    case 0: return 'LOW';
    case 1: return 'NORMAL';
    case 2: return 'HIGH';
    case 3: return 'URGENT';
    default: return 'NORMAL';
  }
} 


// Récupérer une file d'attente par ID
/**
 * Récupère les détails d'une file d'attente spécifique par son ID
 * Inclut les entrées actives, la configuration et les statistiques
 */
export async function getQueueById(req: Request, res: Response) {
  const { queueId } = req.params;
  
  try {
    // Vérifier si la file d'attente existe
    const queue = await db.queue.findUnique({
      where: { id: queueId },
      include: {
        department: true,
        queueConfiguration: true
      }
    });
    
    if (!queue) {
      return res.status(404).json({
        data: null,
        error: "Queue not found"
      });
    }
    
    // Récupérer toutes les entrées de la file d'attente
    const queueEntries = await db.queueEntry.findMany({
      where: { queueId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            email: true,
            // Utilisez le nom correct pour le numéro de téléphone si disponible
            // phone: true,
          }
        },
        // Utilisez le nom correct de la relation pour l'utilisateur assigné
        // Si c'est assignedTo :
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            role: true
          }
        },
        // Si c'est user :
        // user: {
        //   select: {
        //     id: true,
        //     name: true,
        //     role: true
        //   }
        // },
        // Si c'est doctor :
        // doctor: {
        //   select: {
        //     id: true,
        //     name: true,
        //     role: true
        //   }
        // },
      },
      orderBy: [
        { status: 'asc' }, // D'abord par statut (WAITING, PROCESSING, etc.)
        { priority: 'desc' }, // Puis par priorité (du plus urgent au moins urgent)
        { ticketNumber: 'asc' } // Enfin par numéro de ticket (FIFO)
      ]
    });
    
    // Calculer des statistiques sur la file d'attente
    const waitingCount = queueEntries.filter(entry => entry.status === 'WAITING').length;
    const processingCount = queueEntries.filter(entry => entry.status === 'IN_PROGRESS').length;
    const completedCount = queueEntries.filter(entry => entry.status === 'COMPLETED').length;
    const cancelledCount = queueEntries.filter(entry => entry.status === 'CANCELLED' || entry.status === 'NO_SHOW').length;
    
    // Calculer le temps d'attente moyen pour les entrées complétées aujourd'hui
    const completedEntriesToday = queueEntries.filter(entry => 
      entry.status === 'COMPLETED' && 
      entry.completedAt && 
      entry.createdAt.toDateString() === new Date().toDateString()
    );
    
    let averageWaitTime = 0;
    if (completedEntriesToday.length > 0) {
      const totalWaitTimeMs = completedEntriesToday.reduce((total, entry) => {
        const waitTime = entry.completedAt!.getTime() - entry.createdAt.getTime();
        return total + waitTime;
      }, 0);
      averageWaitTime = Math.round(totalWaitTimeMs / completedEntriesToday.length / 60000); // Convertir en minutes
    }
    
    // Formater les entrées pour la réponse
    const formattedEntries = queueEntries.map(entry => {
      // Calculer le temps d'attente en minutes
      const waitingTime = entry.completedAt 
        ? Math.round((entry.completedAt.getTime() - entry.createdAt.getTime()) / 60000)
        : Math.round((new Date().getTime() - entry.createdAt.getTime()) / 60000);
      
      return {
        id: entry.id,
        ticketNumber: entry.ticketNumber,
        status: entry.status,
        priority: entry.priority,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        completedAt: entry.completedAt,
        waitingTime: waitingTime,
        patient: {
          id: entry.patient.id,
          name: `${entry.patient.firstName} ${entry.patient.lastName}`,
          gender: entry.patient.gender,
          age: calculateAge(entry.patient.dateOfBirth),
          email: entry.patient.email,
          // Utilisez le nom correct pour le numéro de téléphone si disponible
          // phone: entry.patient.phone,
        },
        // Utilisez le nom correct de la relation pour l'utilisateur assigné
        // Si c'est assignedTo :
        assignedTo: entry.assignedTo ? {
          id: entry.assignedTo.id,
          name: entry.assignedTo.firstName,
          role: entry.assignedTo.role
        } : null,
        // Si c'est user :
        // assignedTo: entry.user ? {
        //   id: entry.user.id,
        //   name: entry.user.name,
        //   role: entry.user.role
        // } : null,
        // Si c'est doctor :
        // assignedTo: entry.doctor ? {
        //   id: entry.doctor.id,
        //   name: entry.doctor.name,
        //   role: entry.doctor.role
        // } : null,
        notes: entry.notes
      };
    });
    
    // Formater la réponse
    const responseData = {
      queue: {
        id: queue.id,
        name: queue.name,
        description: queue.description,
        department: queue.department ? {
          id: queue.department.id,
          name: queue.department.name
        } : null,
        isActive: queue.isActive,
        createdAt: queue.createdAt,
        updatedAt: queue.updatedAt,
        configuration: queue.queueConfiguration
      },
      statistics: {
        waitingCount,
        processingCount,
        completedCount,
        cancelledCount,
        totalCount: queueEntries.length,
        averageWaitTimeMinutes: averageWaitTime
      },
      entries: formattedEntries
    };
    
    return res.status(200).json({
      data: responseData,
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

/**
 * Transfère un patient d'une file d'attente à une autre
 * Utile pour rediriger les patients vers d'autres services
 */
export async function transferPatient(
  req: TypedRequestBody<{ targetQueueId: string }>,
  res: Response
) {
  const { entryId } = req.params;
  const { targetQueueId } = req.body;
  
  try {
    // Vérifier si l'entrée existe
    const entry = await db.queueEntry.findUnique({
      where: { id: entryId },
      include: {
        patient: true,
        queue: true
      }
    });
    
    if (!entry) {
      return res.status(404).json({
        data: null,
        error: "Queue entry not found"
      });
    }
    
    // Vérifier si la file d'attente cible existe
    const targetQueue = await db.queue.findUnique({
      where: { id: targetQueueId }
    });
    
    if (!targetQueue) {
      return res.status(404).json({
        data: null,
        error: "Target queue not found"
      });
    }
    
    // Trouver le prochain numéro de ticket dans la file cible
    const maxTicket = await db.queueEntry.findFirst({
      where: { queueId: targetQueueId },      orderBy: { ticketNumber: 'desc' }
    });
    
    const nextNumber = maxTicket ? (maxTicket.ticketNumber || 0) + 1 : 1;
    
    // Créer une nouvelle entrée dans la file cible
    const newEntry = await db.queueEntry.create({
      data: {
        queueId: targetQueueId,
        patientId: entry.patientId,
        status: 'WAITING',
        priority: entry.priority,
        notes: `Transféré depuis ${entry.queue?.name || 'Queue inconnue'}. Notes originales: ${entry.notes || 'Aucune'}`,
        ticketNumber: nextNumber
      },
      include: {
        patient: true,
        queue: true
      }
    });
    
    // Mettre à jour l'entrée originale comme transférée (ou annulée)
    await db.queueEntry.update({
      where: { id: entryId },
      data: {
        status: 'CANCELLED',
        notes: `${entry.notes || ''} Transféré vers ${targetQueue.name}.`
      }
    });
    
    // Formater la réponse
    const responseData = {
      originalEntry: {
        id: entry.id,
        queueId: entry.queueId,
        queueName: entry.queue?.name || 'Queue inconnue',
        status: 'CANCELLED'
      },
      newEntry: {
        id: newEntry.id,
        queueId: newEntry.queueId,
        queueName: newEntry.queue?.name || 'Queue inconnue',
        ticketNumber: nextNumber,
        status: 'WAITING'
      },
      patient: {
        id: entry.patient.id,
        name: `${entry.patient.firstName} ${entry.patient.lastName}`
      }
    };
    
    return res.status(200).json({
      data: responseData,
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

/**
 * Récupère toutes les files d'attente pour un département spécifique
 * Utile pour l'organisation par service
 */
export async function getQueuesByDepartment(req: Request, res: Response) {
  const { departmentId } = req.params;
  
  try {
    // Vérifier si le département existe
    const department = await db.department.findUnique({
      where: { id: departmentId }
    });
    
    if (!department) {
      return res.status(404).json({
        data: null,
        error: "Department not found"
      });
    }
    
    // Récupérer toutes les files d'attente du département
    const queues = await db.queue.findMany({
      where: { departmentId },
      include: {
        queueConfiguration: true,        _count: {
          select: {
            entries: true
          }
        }
      }
    });
    
    // Formater les files d'attente pour la réponse
    const formattedQueues = queues.map(queue => ({
      id: queue.id,
      name: queue.name,
      description: queue.description,
      isActive: queue.isActive,
      createdAt: queue.createdAt,
      updatedAt: queue.updatedAt,
      //configuration: queue.queueConfiguration,
      //activeEntries: queue._count.queueEntries
    }));
    
    // Formater la réponse
    const responseData = {
      department: {
        id: department.id,
        name: department.name
      },
      queues: formattedQueues
    };
    
    return res.status(200).json({
      data: responseData,
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

/**
 * Récupère un aperçu de l'état actuel de toutes les files d'attente
 * Utile pour les tableaux de bord et les écrans d'affichage
 */
export async function getQueuesOverview(req: Request, res: Response) {
  try {
    // Récupérer toutes les files d'attente actives
    const queues = await db.queue.findMany({
      where: { isActive: true },
      include: {
        department: true,
        queueConfiguration: true
      }
    });
    
    // Récupérer les statistiques pour chaque file d'attente
    const queueStats = await Promise.all(queues.map(async (queue) => {
      // Compter les entrées par statut
      const waitingCount = await db.queueEntry.count({
        where: {
          queueId: queue.id,
          status: 'WAITING'
        }
      });
      
      const processingCount = await db.queueEntry.count({
        where: {
          queueId: queue.id,
          status: 'IN_PROGRESS'
        }
      });
      
      // Récupérer le temps d'attente moyen pour les entrées complétées aujourd'hui
      const completedEntriesToday = await db.queueEntry.findMany({
        where: {
          queueId: queue.id,
          status: 'COMPLETED',
          completedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        },
        select: {
          createdAt: true,
          completedAt: true
        }
      });
      
      let averageWaitTime = 0;
      if (completedEntriesToday.length > 0) {
        const totalWaitTimeMs = completedEntriesToday.reduce((total, entry) => {
          const waitTime = entry.completedAt!.getTime() - entry.createdAt.getTime();
          return total + waitTime;
        }, 0);
        averageWaitTime = Math.round(totalWaitTimeMs / completedEntriesToday.length / 60000); // Minutes
      }
      
      return {
        id: queue.id,
        name: queue.name,
        description: queue.description,
        department: queue.department ? {
          id: queue.department.id,
          name: queue.department.name
        } : null,
        isActive: queue.isActive,
        statistics: {
          waitingCount,
          processingCount,
          totalActiveCount: waitingCount + processingCount,
          averageWaitTimeMinutes: averageWaitTime
        }
      };
    }));
    
    // Calculer des statistiques globales
    const totalWaiting = queueStats.reduce((sum, queue) => sum + queue.statistics.waitingCount, 0);
    const totalProcessing = queueStats.reduce((sum, queue) => sum + queue.statistics.processingCount, 0);
    const totalActive = totalWaiting + totalProcessing;
    
    // Formater la réponse
    const responseData = {
      timestamp: new Date(),
      summary: {
        totalQueues: queues.length,
        totalWaiting,
        totalProcessing,
        totalActive
      },
      queues: queueStats
    };
    
    return res.status(200).json({
      data: responseData,
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


