import { db } from "@/db/db";
import { TypedRequestBody } from "@/types";
import { Request, Response } from "express";
import {   InvoiceStatus, PaymentMethod } from "@prisma/client";

/**
 * Récupère les factures en attente de paiement
 */
export async function getPendingInvoices(req: Request, res: Response) {
  const { accountantId } = req.params;
  
  try {
    const accountant = await db.accountant.findUnique({
      where: { id: accountantId },
      include: {
        user: true
      }
    });
    
    if (!accountant) {
      return res.status(404).json({
        data: null,
        error: "Comptable non trouvé"
      });
    }
      const pendingInvoices = await db.invoice.findMany({
      where: {
        status: 'PENDING',
        hospitalId: accountant.user.hospitalId || undefined
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fileNumber: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return res.status(200).json({
      data: pendingInvoices,
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
 * Enregistre un paiement
 */
interface PaymentRecordProps {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export async function recordPayment(
  req: TypedRequestBody<PaymentRecordProps>,
  res: Response
) {
  const { accountantId } = req.params;
  const { invoiceId, amount, method, reference, notes } = req.body;
  
  try {
    const accountant = await db.accountant.findUnique({
      where: { id: accountantId },
      include: {
        user: true
      }
    });
    
    if (!accountant) {
      return res.status(404).json({
        data: null,
        error: "Comptable non trouvé"
      });
    }
      const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        patient: true
      }
    });
    
    if (!invoice) {
      return res.status(404).json({
        data: null,
        error: "Facture non trouvée"
      });
    }
      // Utiliser le totalAmount de la facture directement
    const totalAmount = invoice.totalAmount;
      // Calculer le montant déjà payé (utiliser amountPaid de la facture)
    const paidAmount = invoice.amountPaid;
    const remainingAmount = totalAmount - paidAmount;
    
    if (amount > remainingAmount) {
      return res.status(400).json({
        data: null,
        error: `Le montant du paiement (${amount}) est supérieur au montant restant dû (${remainingAmount})`
      });
    }
      // Créer le paiement
    const paymentData: any = {
      amount,
      method,
      userId: accountant.userId
    };
    
    // Ajouter les champs optionnels seulement s'ils sont définis
    if (reference) paymentData.reference = reference;
    if (notes) paymentData.notes = notes;
    
    const payment = await db.payment.create({
      data: paymentData
    });
    
    // Mettre à jour le montant payé et le statut de la facture
    const newPaidAmount = paidAmount + amount;
    let newStatus: InvoiceStatus = invoice.status;
    
    if (newPaidAmount >= totalAmount) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIALLY_PAID';
    }
    
    await db.invoice.update({
      where: { id: invoiceId },
      data: { 
        status: newStatus,
        amountPaid: newPaidAmount
      }
    });
    
    return res.status(201).json({
      data: {
        payment,
        invoiceStatus: newStatus,
        paidAmount: newPaidAmount,
        remainingAmount: totalAmount - newPaidAmount
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

/**
 * Crée une nouvelle facture
 */
interface InvoiceCreateProps {
  patientId: string;
  admissionId?: string;
  consultationId?: string;
  dueDate?: string;
  totalAmount: number;
  notes?: string;
}

export async function createInvoice(
  req: TypedRequestBody<InvoiceCreateProps>,
  res: Response
) {
  const { accountantId } = req.params;
  const { patientId, admissionId, consultationId, dueDate, totalAmount, notes } = req.body;
  
  try {
    const accountant = await db.accountant.findUnique({
      where: { id: accountantId },
      include: {
        user: true
      }
    });
    
    if (!accountant) {
      return res.status(404).json({
        data: null,
        error: "Comptable non trouvé"
      });
    }
    
    const patient = await db.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({
        data: null,
        error: "Patient non trouvé"
      });
    }
    
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        data: null,
        error: "Le montant total doit être supérieur à 0"
      });
    }
    
    // Créer la facture
    const invoiceData: any = {
      invoiceNumber: `INV-${Date.now()}`, // Générer un numéro de facture
      patientId,
      status: 'PENDING' as InvoiceStatus,
      totalAmount,
      accountantId: accountant.id
    };
    
    // Ajouter les champs optionnels seulement s'ils sont définis
    if (dueDate) invoiceData.dueDate = new Date(dueDate);
    if (notes) invoiceData.notes = notes;
    
    // Ajouter hospitalId seulement s'il est défini dans l'utilisateur
    if (accountant.user.hospitalId) invoiceData.hospitalId = accountant.user.hospitalId;
    
    const invoice = await db.invoice.create({
      data: invoiceData,
      include: {
        patient: true
      }
    });
    
    return res.status(201).json({
      data: invoice,
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