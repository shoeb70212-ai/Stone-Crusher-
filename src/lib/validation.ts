import { z } from "zod";
import { EMPLOYEE_TRANSACTION_TYPES } from "./employee-ledger";

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z
    .string()
    .regex(/^[0-9+\-\s]{10,15}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  address: z.string().max(500).optional(),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN")
    .optional()
    .or(z.literal("")),
  openingBalance: z.coerce.number().default(0),
});

export const slipSchema = z.object({
  vehicleNo: z.string().min(1, "Vehicle number is required"),
  driverName: z.string().max(100).optional(),
  driverPhone: z.string().max(20).optional(),
  materialType: z.string().min(1, "Material is required"),
  deliveryMode: z.enum(["Company Vehicle", "Third-Party Vehicle"]),
  measurementType: z.enum(["Volume (Brass)", "Weight (Tonnes)"]),
  lengthFeet: z.coerce.number().min(0).max(100).optional(),
  widthFeet: z.coerce.number().min(0).max(100).optional(),
  heightFeet: z.coerce.number().min(0).max(100).optional(),
  grossWeight: z.coerce.number().min(0).max(1000).optional(),
  tareWeight: z.coerce.number().min(0).max(1000).optional(),
  ratePerUnit: z.coerce.number().min(0, "Rate must be positive"),
  customerId: z.string().min(1, "Customer is required"),
  notes: z.string().max(500).optional(),
});

export const transactionSchema = z.object({
  type: z.enum(["Income", "Expense"]),
  amount: z.coerce.number().min(1, "Amount must be at least 1"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required").max(500),
  customerId: z.string().optional(),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  type: z.enum(["GST", "Cash"]),
  items: z.array(
    z.object({
      materialType: z.string(),
      quantity: z.number().positive(),
      rate: z.number().positive(),
      amount: z.number().positive(),
      hsnCode: z.string().optional(),
      gstRate: z.number().optional(),
    })
  ).min(1, "At least one item is required"),
});

export const employeeSchema = z.object({
  name: z.string().min(1, "Employee name is required").max(100),
  phone: z
    .string()
    .regex(/^[0-9+\-\s]{10,15}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  role: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  joiningDate: z.string().optional(),
  salaryType: z.enum(["Weekly", "Monthly"]),
  salaryAmount: z.coerce.number().min(0, "Salary amount cannot be negative"),
  openingBalance: z.coerce.number().default(0),
  notes: z.string().max(500).optional(),
});

export const employeeTransactionSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  date: z.string().min(1, "Date is required"),
  type: z.enum(EMPLOYEE_TRANSACTION_TYPES),
  amount: z.coerce.number().min(1, "Amount must be at least 1"),
  period: z.string().optional(),
  paymentMode: z.enum(["Cash", "Bank", "UPI", "Cheque", "Adjustment"]).optional().or(z.literal("")),
  description: z.string().min(1, "Remarks are required").max(500),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type SlipInput = z.infer<typeof slipSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type EmployeeTransactionInput = z.infer<typeof employeeTransactionSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
