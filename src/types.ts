// ---------------------------------------------------------------------------
// Domain types for the CrushTrack stone-crusher ERP system.
//
// Naming conventions:
//   - Entity interfaces use PascalCase singular nouns (e.g. `Customer`).
//   - String unions are used instead of enums for JSON serialisation safety.
//   - Fields marked `isActive?: boolean` follow the soft-delete pattern —
//     omitting the field or setting it to `true` means active.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Master Data
// ---------------------------------------------------------------------------

/** A registered vehicle that loads material at the crusher site. */
export interface Vehicle {
  id: string;
  vehicleNo: string;
  ownerName: string;
  ownerPhone?: string;
  driverName?: string;
  driverPhone?: string;
  /** Determines which measurement panel the slip form opens by default. */
  defaultMeasurementType: MeasurementType;
  /** Preferred delivery mode for this vehicle, pre-fills the slip form. */
  defaultDeliveryMode?: DeliveryMode;
  /** Saved dimensions used to pre-fill the slip form for this vehicle. */
  measurement: VehicleMeasurement;
  isActive?: boolean;
}

/** A customer account that accumulates a running ledger balance. */
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  /**
   * Carried-forward balance from prior accounting period.
   * Positive = customer owes money (Debit).
   * Negative = advance paid / credit balance.
   */
  openingBalance: number;
  isActive?: boolean;
}

/** An employee account that tracks salary, advances, deductions, and payables. */
export interface Employee {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  address?: string;
  joiningDate?: string;
  salaryType: "Weekly" | "Monthly";
  salaryAmount: number;
  /**
   * Carried-forward employee balance from prior period.
   * Positive = salary/payable owed to employee.
   * Negative = advance/recoverable balance owed back to company.
   */
  openingBalance: number;
  notes?: string;
  isActive?: boolean;
}

/** Physical dimensions or weights captured per vehicle loading. */
export interface VehicleMeasurement {
  lengthFeet?: number;
  widthFeet?: number;
  heightFeet?: number;
  grossWeight?: number; // in tonnes
  tareWeight?: number;  // in tonnes
}

// ---------------------------------------------------------------------------
// Operational Enums (string unions)
// ---------------------------------------------------------------------------

/** Free-form material name — kept as `string` because crusher owners define custom names. */
export type MaterialType = string;

/** Workflow states for a dispatch slip. */
export type SlipStatus = "Pending" | "Loaded" | "Tallied" | "Cancelled";

/** Whether the material is delivered in the company's own truck or a customer/third-party truck. */
export type DeliveryMode = "Company Vehicle" | "Third-Party Vehicle";

/** How the loaded quantity is measured — by volume (brass) or by weight (tonnes). */
export type MeasurementType = "Volume (Brass)" | "Weight (Tonnes)";

/** Direction of a financial transaction in the Daybook / Ledger. */
export type TransactionType = "Income" | "Expense";

/** Employee ledger entry types. */
export type EmployeeTransactionType =
  | "Salary Earned"
  | "Salary Paid"
  | "Advance Given"
  | "Advance Returned"
  | "Deduction"
  | "Bonus / Allowance"
  | "Reimbursement"
  | "Adjustment Credit"
  | "Adjustment Debit";

/** Salary/advance/deduction event linked to one employee. */
export interface EmployeeTransaction {
  id: string;
  employeeId: string;
  date: string;
  type: EmployeeTransactionType;
  amount: number;
  description: string;
  /** Optional yyyy-MM pay period for salary and deduction entries. */
  period?: string;
  paymentMode?: "Cash" | "Bank" | "UPI" | "Cheque" | "Adjustment";
  /** Daybook transaction created for cash movements such as salary paid or advance given. */
  linkedTransactionId?: string;
}

// ---------------------------------------------------------------------------
// Material & User (sub-records of CompanySettings)
// ---------------------------------------------------------------------------

/** A material/product sold by the crusher, with pricing and GST metadata. */
export interface Material {
  id: string;
  name: string;
  defaultPrice: number;
  unit: string;
  hsnCode?: string;
  gstRate?: number;
  isActive?: boolean;
}

/** A system user with role-based access. */
export type UserRole = "Admin" | "Partner" | "Manager";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  /** SHA-256 hex digest of the user's password. Never store plaintext. */
  passwordHash?: string;
  role: UserRole;
  status: "Active" | "Inactive";
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

/** Entity groups tracked by the admin activity log. */
export type AuditEntityType =
  | "Slip"
  | "Invoice"
  | "Customer"
  | "Employee"
  | "EmployeeTransaction"
  | "Vehicle"
  | "Transaction"
  | "Task"
  | "Material"
  | "Settings"
  | "System";

/** Immutable activity record for important operational changes. */
export interface AuditLog {
  id: string;
  timestamp: string;
  actorId?: string;
  actorName: string;
  actorRole: UserAccount["role"] | "System";
  action: string;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Company Settings (singleton)
// ---------------------------------------------------------------------------

/** Global configuration for the crusher business — persisted as a single document. */
export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  receiptFooter: string;
  logo?: string;

  // Bank details (printed on invoices)
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;

  // UI preferences
  theme?: "light" | "dark" | "system";
  primaryColor?: "emerald" | "blue" | "violet" | "rose" | "amber";
  mobileLayout?: "Comfortable" | "Compact";

  // Print / invoice layout
  slipFormat?: "A4" | "Thermal-80mm" | "Thermal-58mm";
  invoiceFormat?: "A4" | "Thermal-80mm" | "Thermal-58mm";
  invoiceTemplate?: "Classic" | "Modern" | "Minimal";
  invoiceShowDueDate?: boolean;
  invoiceWatermark?: "None" | "Company Name" | "Status" | "Custom";
  invoiceWatermarkText?: string;
  invoiceColor?: string;

  // Master lists
  expenseCategories?: string[];
  employeeRoles?: string[];
  termsAndConditions?: string;
  materials?: Material[];
  users?: UserAccount[];

  /** Feature flags for gradual rollouts. */
  flags?: Record<string, boolean>;

  /** Optimistic locking version for concurrent edit detection. */
  version?: number;
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

/** A single line-item on an invoice. */
export interface InvoiceItem {
  materialType: string;
  quantity: number;
  rate: number;
  amount: number;
  hsnCode?: string;
  gstRate?: number;
}

/** A GST or cash invoice generated for a customer. */
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
  /** IDs of the dispatch slips included in this invoice. */
  slipIds?: string[];
}

// ---------------------------------------------------------------------------
// Dispatch Slip
// ---------------------------------------------------------------------------

/** A single vehicle dispatch record — the core transactional unit of the system. */
export interface Slip {
  id: string;
  date: string; // ISO-8601 string
  vehicleNo: string;
  driverName?: string;
  driverPhone?: string;
  materialType: MaterialType;
  deliveryMode: DeliveryMode;
  measurementType: MeasurementType;
  measurement: VehicleMeasurement;
  /** Computed brass volume or net weight depending on `measurementType`. */
  quantity: number;
  ratePerUnit: number;
  /** Final billable amount: rate multiplied by quantity. */
  totalAmount: number;
  amountPaid?: number;
  /** `"CASH"` for walk-in customers without an account. */
  customerId: string;
  status: SlipStatus;
  notes: string;
  operatorName?: string;
  loaderName?: string;
  /** Set when this slip is included on a formal invoice. */
  invoiceId?: string;
  /** Local file URI of a scanned document photo attached to this slip. */
  attachmentUri?: string;
}

// ---------------------------------------------------------------------------
// Supporting Entities
// ---------------------------------------------------------------------------

/** A lightweight to-do item shown on the Dashboard checklist. */
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

/** A financial transaction recorded in the Daybook / Ledger. */
export interface Transaction {
  id: string;
  date: string; // ISO-8601 string
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  /** Present when this transaction is linked to a specific customer's ledger. */
  customerId?: string;
  /** Present when this transaction was auto-generated from a dispatch slip. */
  slipId?: string;
}
