export interface Vehicle {
  id: string;
  vehicleNo: string;
  ownerName: string;
  ownerPhone?: string;
  driverName?: string;
  driverPhone?: string;
  defaultMeasurementType: MeasurementType;
  measurement: VehicleMeasurement;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  openingBalance: number; // Positive: Customer owes money (Debit), Negative: Balance in advance (Credit)
}

export interface VehicleMeasurement {
  lengthFeet?: number;
  widthFeet?: number;
  heightFeet?: number;
  grossWeight?: number; // in tons
  tareWeight?: number; // in tons
}

export type MaterialType = string;

export type SlipStatus = "Pending" | "Loaded" | "Tallied";

export type DeliveryMode = "Company Vehicle" | "Third-Party Vehicle";
export type MeasurementType = "Volume (Brass)" | "Weight (Tonnes)";

export interface Material {
  id: string;
  name: string;
  defaultPrice: number;
  unit: string;
  hsnCode?: string;
  gstRate?: number;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Partner" | "Manager";
  status: "Active" | "Inactive";
}

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  receiptFooter: string;
  logo?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  theme?: "light" | "dark" | "system";
  primaryColor?: "emerald" | "blue" | "violet" | "rose" | "amber";
  slipFormat?: "A4" | "Thermal-80mm" | "Thermal-58mm";
  invoiceFormat?: "A4" | "Thermal-80mm" | "Thermal-58mm";
  invoiceTemplate?: "Classic" | "Modern" | "Minimal";
  invoiceShowDueDate?: boolean;
  invoiceWatermark?: "None" | "Company Name" | "Status" | "Custom";
  invoiceWatermarkText?: string;
  invoiceColor?: string;
  expenseCategories?: string[];
  termsAndConditions?: string;
  materials?: Material[];
  users?: UserAccount[];
}

export interface InvoiceItem {
  materialType: string;
  quantity: number;
  rate: number;
  amount: number;
  hsnCode?: string;
  gstRate?: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  type: "GST" | "Cash";
  items: InvoiceItem[];
  subTotal: number;
  cgst: number;
  sgst: number;
  total: number;
  status: "Pending" | "Paid" | "Cancelled";
  slipIds?: string[];
}

export interface Slip {
  id: string;
  date: string; // ISO string
  vehicleNo: string;
  driverName?: string;
  driverPhone?: string;
  materialType: MaterialType;
  deliveryMode: DeliveryMode;
  measurementType: MeasurementType;
  measurement: VehicleMeasurement;
  quantity: number; // The computed Brass Volume OR Net Weight
  ratePerUnit: number;
  freightAmount: number; // Transport charges if Company Vehicle
  totalAmount: number; // rate * qty + freight
  amountPaid?: number;
  customerId: string; // "CASH" if no regular customer
  status: SlipStatus;
  notes: string;
  operatorName?: string;
  loaderName?: string;
  invoiceId?: string; // Optional reference to an Invoice
}

export type TransactionType = "Income" | "Expense";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO string
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  customerId?: string; // If related to a customer ledger
  slipId?: string; // If generated from a slip
}
