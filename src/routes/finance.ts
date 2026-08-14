import {
  createInvoice,
  createInvoicePayment,
  deleteInvoice,
  getFinanceSummary,
  getInvoiceById,
  getInvoices,
  updateInvoice,
} from "@/controllers/invoices";
import {
  createIncome,
  deleteIncome,
  getIncomeById,
  getIncomes,
  updateIncome,
} from "@/controllers/incomes";
import {
  createExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  updateExpense,
} from "@/controllers/expenses";
import {
  createStaffPayment,
  getPayments,
  getStaffPayments,
} from "@/controllers/payments";
import { authenticate, requireRoles } from "@/middleware/auth";
import express from "express";

const financeRouter = express.Router();
const cashier = [authenticate, requireRoles("ACCOUNTANT")] as const;

financeRouter.get("/finance/summary", ...cashier, getFinanceSummary);

financeRouter.get("/invoices", ...cashier, getInvoices);
financeRouter.post("/invoices", ...cashier, createInvoice);
financeRouter.get("/invoices/:id", ...cashier, getInvoiceById);
financeRouter.put("/invoices/:id", ...cashier, updateInvoice);
financeRouter.delete("/invoices/:id", ...cashier, deleteInvoice);
financeRouter.post("/invoices/:id/payments", ...cashier, createInvoicePayment);

financeRouter.get("/payments", ...cashier, getPayments);

financeRouter.get("/staff-payments", ...cashier, getStaffPayments);
financeRouter.post("/staff-payments", ...cashier, createStaffPayment);

financeRouter.get("/incomes", ...cashier, getIncomes);
financeRouter.post("/incomes", ...cashier, createIncome);
financeRouter.get("/incomes/:id", ...cashier, getIncomeById);
financeRouter.put("/incomes/:id", ...cashier, updateIncome);
financeRouter.delete("/incomes/:id", ...cashier, deleteIncome);

financeRouter.get("/expenses", ...cashier, getExpenses);
financeRouter.post("/expenses", ...cashier, createExpense);
financeRouter.get("/expenses/:id", ...cashier, getExpenseById);
financeRouter.put("/expenses/:id", ...cashier, updateExpense);
financeRouter.delete("/expenses/:id", ...cashier, deleteExpense);

export default financeRouter;
