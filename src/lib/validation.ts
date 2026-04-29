import { z } from "zod";

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
  freightAmount: z.coerce.number().min(0).default(0),
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

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type SlipInput = z.infer<typeof slipSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type LoginInput = z.infer<typeof loginSchema>;