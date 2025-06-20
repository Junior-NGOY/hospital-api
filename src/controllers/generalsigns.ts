import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

// Créer un nouveau signe général
export const createGeneralSign = async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      consultationId,
      consciousness,
      temperature,
      respirationRate,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      heartRate,
      weight,
      height,
      bmi,
      painLevel,
      mobility,
      notes,
      nurseId
    } = req.body;

    // Vérifier que le patient existe
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    // Vérifier que la consultation existe si un ID est fourni
    if (consultationId) {
      const consultation = await prisma.consultation.findUnique({
        where: { id: consultationId }
      });

      if (!consultation) {
        return res.status(404).json({ error: 'Consultation non trouvée' });
      }
    }

    // Vérifier que l'utilisateur qui enregistre existe si un ID est fourni
    if (nurseId) {
      const user = await prisma.user.findUnique({
        where: { id: nurseId }
      });

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
    }

    // Créer le signe général
    const generalSign = await prisma.generalSign.create({
      data: {
        patientId,
        consultationId,
        consciousness,
        temperature,
        respirationRate,
        bloodPressureSystolic,
        bloodPressureDiastolic,
        heartRate,
        weight,
        height,
        bmi,
        painLevel,
        mobility,
        notes,
        nurseId
      }
    });

    return res.status(201).json(generalSign);
  } catch (error) {
    console.error('Erreur lors de la création du signe général:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la création du signe général' });
  }
};

// Obtenir tous les signes généraux d'un patient
export const getPatientGeneralSigns = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    // Vérifier que le patient existe
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    // Récupérer tous les signes généraux du patient
    const generalSigns = await prisma.generalSign.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        nurse: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    return res.status(200).json(generalSigns);
  } catch (error) {
    console.error('Erreur lors de la récupération des signes généraux:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la récupération des signes généraux' });
  }
};

// Obtenir les signes généraux d'une consultation spécifique
export const getConsultationGeneralSigns = async (req: Request, res: Response) => {
  try {
    const { consultationId } = req.params;

    // Vérifier que la consultation existe
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId }
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation non trouvée' });
    }

    // Récupérer les signes généraux de la consultation
    const generalSigns = await prisma.generalSign.findMany({
      where: { consultationId },
      include: {
        nurse: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    return res.status(200).json(generalSigns);
  } catch (error) {
    console.error('Erreur lors de la récupération des signes généraux de la consultation:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la récupération des signes généraux de la consultation' });
  }
};

// Obtenir un signe général par son ID
export const getGeneralSignById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const generalSign = await prisma.generalSign.findUnique({
      where: { id },
      include: {
        patient: true,
        consultation: true,
        nurse: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    if (!generalSign) {
      return res.status(404).json({ error: 'Signe général non trouvé' });
    }

    return res.status(200).json(generalSign);
  } catch (error) {
    console.error('Erreur lors de la récupération du signe général:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la récupération du signe général' });
  }
};

// Mettre à jour un signe général
export const updateGeneralSign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      consciousness,
      temperature,
      respirationRate,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      heartRate,
      weight,
      height,
      bmi,
      painLevel,
      mobility,
      notes,
      nurseId
    } = req.body;

    // Vérifier que le signe général existe
    const existingGeneralSign = await prisma.generalSign.findUnique({
      where: { id }
    });

    if (!existingGeneralSign) {
      return res.status(404).json({ error: 'Signe général non trouvé' });
    }

    // Vérifier que l'utilisateur qui enregistre existe si un ID est fourni
    if (nurseId) {
      const user = await prisma.user.findUnique({
        where: { id: nurseId }
      });

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
    }

    // Mettre à jour le signe général
    const updatedGeneralSign = await prisma.generalSign.update({
      where: { id },
      data: {
        consciousness,
        temperature,
        respirationRate,
        bloodPressureSystolic,
        bloodPressureDiastolic,
        heartRate,
        weight,
        height,
        bmi,
        painLevel,
        mobility,
        notes,
        nurseId
      }
    });

    return res.status(200).json(updatedGeneralSign);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du signe général:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du signe général' });
  }
};

// Supprimer un signe général
export const deleteGeneralSign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Vérifier que le signe général existe
    const generalSign = await prisma.generalSign.findUnique({
      where: { id }
    });

    if (!generalSign) {
      return res.status(404).json({ error: 'Signe général non trouvé' });
    }

    // Supprimer le signe général
    await prisma.generalSign.delete({
      where: { id }
    });

    return res.status(200).json({ message: 'Signe général supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du signe général:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la suppression du signe général' });
  }
};

// Obtenir les derniers signes généraux d'un patient
export const getLatestGeneralSign = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    // Vérifier que le patient existe
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    // Récupérer le dernier signe général du patient
    const latestGeneralSign = await prisma.generalSign.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        nurse: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    if (!latestGeneralSign) {
      return res.status(404).json({ error: 'Aucun signe général trouvé pour ce patient' });
    }

    return res.status(200).json(latestGeneralSign);
  } catch (error) {
    console.error('Erreur lors de la récupération du dernier signe général:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la récupération du dernier signe général' });
  }
};