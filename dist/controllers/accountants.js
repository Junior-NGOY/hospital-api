"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingInvoices = getPendingInvoices;
exports.recordPayment = recordPayment;
exports.createInvoice = createInvoice;
const db_1 = require("../db/db");
function getPendingInvoices(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { accountantId } = req.params;
        try {
            const accountant = yield db_1.db.accountant.findUnique({
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
            const pendingInvoices = yield db_1.db.invoice.findMany({
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
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function recordPayment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { accountantId } = req.params;
        const { invoiceId, amount, method, reference, notes } = req.body;
        try {
            const accountant = yield db_1.db.accountant.findUnique({
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
            const invoice = yield db_1.db.invoice.findUnique({
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
            const totalAmount = invoice.totalAmount;
            const paidAmount = invoice.amountPaid;
            const remainingAmount = totalAmount - paidAmount;
            if (amount > remainingAmount) {
                return res.status(400).json({
                    data: null,
                    error: `Le montant du paiement (${amount}) est supérieur au montant restant dû (${remainingAmount})`
                });
            }
            const paymentData = {
                amount,
                method,
                userId: accountant.userId
            };
            if (reference)
                paymentData.reference = reference;
            if (notes)
                paymentData.notes = notes;
            const payment = yield db_1.db.payment.create({
                data: paymentData
            });
            const newPaidAmount = paidAmount + amount;
            let newStatus = invoice.status;
            if (newPaidAmount >= totalAmount) {
                newStatus = 'PAID';
            }
            else if (newPaidAmount > 0) {
                newStatus = 'PARTIALLY_PAID';
            }
            yield db_1.db.invoice.update({
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
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function createInvoice(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { accountantId } = req.params;
        const { patientId, admissionId, consultationId, dueDate, totalAmount, notes } = req.body;
        try {
            const accountant = yield db_1.db.accountant.findUnique({
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
            const patient = yield db_1.db.patient.findUnique({
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
            const invoiceData = {
                invoiceNumber: `INV-${Date.now()}`,
                patientId,
                status: 'PENDING',
                totalAmount,
                accountantId: accountant.id
            };
            if (dueDate)
                invoiceData.dueDate = new Date(dueDate);
            if (notes)
                invoiceData.notes = notes;
            if (accountant.user.hospitalId)
                invoiceData.hospitalId = accountant.user.hospitalId;
            const invoice = yield db_1.db.invoice.create({
                data: invoiceData,
                include: {
                    patient: true
                }
            });
            return res.status(201).json({
                data: invoice,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
