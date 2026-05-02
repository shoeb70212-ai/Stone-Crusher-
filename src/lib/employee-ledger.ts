import type { EmployeeTransaction, EmployeeTransactionType } from "../types";

export const EMPLOYEE_TRANSACTION_TYPES = [
  "Salary Earned",
  "Salary Paid",
  "Advance Given",
  "Advance Returned",
  "Deduction",
  "Bonus / Allowance",
  "Reimbursement",
  "Adjustment Credit",
  "Adjustment Debit",
] as const satisfies readonly EmployeeTransactionType[];

const CREDIT_TYPES = new Set<EmployeeTransactionType>([
  "Salary Earned",
  "Advance Returned",
  "Bonus / Allowance",
  "Reimbursement",
  "Adjustment Credit",
]);

const CASH_MOVEMENT_TYPES = new Set<EmployeeTransactionType>([
  "Salary Paid",
  "Advance Given",
  "Advance Returned",
]);

export function getEmployeeTransactionImpact(
  txOrType: EmployeeTransaction | EmployeeTransactionType,
  amount?: number,
): number {
  const type = typeof txOrType === "string" ? txOrType : txOrType.type;
  const value = typeof txOrType === "string" ? amount ?? 0 : txOrType.amount;
  return CREDIT_TYPES.has(type) ? value : -value;
}

export function isEmployeeCashMovement(type: EmployeeTransactionType): boolean {
  return CASH_MOVEMENT_TYPES.has(type);
}

export function getEmployeeBalanceLabel(balance: number): string {
  if (balance > 0) return "Payable";
  if (balance < 0) return "Advance";
  return "Settled";
}

export function getDaybookCategoryForEmployeeEntry(type: EmployeeTransactionType): string {
  if (type === "Salary Paid") return "Salary Payment";
  if (type === "Advance Given") return "Employee Advance";
  if (type === "Advance Returned") return "Advance Returned";
  return "Employee Ledger";
}
