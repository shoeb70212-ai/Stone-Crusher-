import React, { useMemo, useState } from "react";
import { format, parseISO, startOfMonth } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  FileText,
  IndianRupee,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useErp } from "../context/ErpContext";
import type { Employee, EmployeeTransaction, EmployeeTransactionType, Transaction } from "../types";
import { employeeSchema, employeeTransactionSchema } from "../lib/validation";
import {
  EMPLOYEE_TRANSACTION_TYPES,
  getDaybookCategoryForEmployeeEntry,
  getEmployeeBalanceLabel,
  getEmployeeTransactionImpact,
  isEmployeeCashMovement,
} from "../lib/employee-ledger";
import { useToast } from "../components/ui/Toast";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { EmptyState } from "../components/ui/EmptyState";
import { downloadCSV } from "../lib/export-utils";

const salaryTypes: Employee["salaryType"][] = ["Weekly", "Monthly"];
const paymentModes: NonNullable<EmployeeTransaction["paymentMode"]>[] = ["Cash", "Bank", "UPI", "Cheque", "Adjustment"];

const todayInput = () => format(new Date(), "yyyy-MM-dd");
const monthInput = () => format(new Date(), "yyyy-MM");

const employeeFormDefaults = {
  name: "",
  phone: "",
  role: "",
  address: "",
  joiningDate: "",
  salaryType: "Monthly" as Employee["salaryType"],
  salaryAmount: "0",
  openingBalance: "0",
  notes: "",
};

function entryFormDefaults(employeeId = "") {
  return {
    employeeId,
    date: todayInput(),
    type: "Salary Paid" as EmployeeTransactionType,
    amount: "",
    period: monthInput(),
    paymentMode: "Cash" as EmployeeTransaction["paymentMode"] | "",
    description: "",
    syncDaybook: true,
  };
}

function formatMoney(value: number) {
  return `Rs. ${Math.abs(Math.round(value)).toLocaleString("en-IN")}`;
}

function balanceClass(balance: number) {
  if (balance > 0) return "text-rose-600 dark:text-rose-400";
  if (balance < 0) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-700 dark:text-zinc-200";
}

export function Employees() {
  const {
    employees,
    employeeTransactions,
    transactions,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addEmployeeTransaction,
    deleteEmployeeTransaction,
    addTransaction,
    deleteTransaction,
    getEmployeeBalance,
  } = useErp();
  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<EmployeeTransaction | null>(null);

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState(employeeFormDefaults);

  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryForm, setEntryForm] = useState(entryFormDefaults());

  const [statementStartDate, setStatementStartDate] = useState("");
  const [statementEndDate, setStatementEndDate] = useState("");
  const [statementType, setStatementType] = useState<"All" | EmployeeTransactionType>("All");
  const [statementSort, setStatementSort] = useState<"desc" | "asc">("desc");

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive !== false),
    [employees],
  );

  const monthlyTotals = useMemo(() => {
    const start = startOfMonth(new Date());
    const monthEntries = employeeTransactions.filter((tx) => new Date(tx.date) >= start);
    const salaryEarned = monthEntries
      .filter((tx) => tx.type === "Salary Earned")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const advances = monthEntries
      .filter((tx) => tx.type === "Advance Given")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const deductions = monthEntries
      .filter((tx) => tx.type === "Deduction")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const monthlyWageBase = activeEmployees
      .filter((employee) => employee.salaryType === "Monthly" || employee.salaryType === "Weekly")
      .reduce((sum, employee) => sum + employee.salaryAmount, 0);

    const payable = activeEmployees.reduce((sum, employee) => {
      const balance = getEmployeeBalance(employee.id);
      return sum + (balance > 0 ? balance : 0);
    }, 0);

    const recoverable = activeEmployees.reduce((sum, employee) => {
      const balance = getEmployeeBalance(employee.id);
      return sum + (balance < 0 ? Math.abs(balance) : 0);
    }, 0);

    return { salaryEarned, advances, deductions, monthlyWageBase, payable, recoverable };
  }, [activeEmployees, employeeTransactions, getEmployeeBalance]);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase().replace(/\s+/g, "");
    return employees
      .filter((employee) => {
        if (!term) return true;
        return (
          employee.name.toLowerCase().replace(/\s+/g, "").includes(term) ||
          (employee.phone || "").replace(/\s+/g, "").includes(term) ||
          (employee.role || "").toLowerCase().replace(/\s+/g, "").includes(term)
        );
      })
      .sort((a, b) => {
        const activeSort = (a.isActive === false ? 1 : 0) - (b.isActive === false ? 1 : 0);
        if (activeSort !== 0) return activeSort;
        return a.name.localeCompare(b.name);
      });
  }, [employees, searchTerm]);

  const statementRows = useMemo(() => {
    if (!selectedEmployee) return [];

    type StatementRow = {
      id: string;
      date: string;
      type: string;
      description: string;
      amount: number;
      impact: number;
      runningBalance: number;
      linkedTransactionId?: string;
    };

    const start = statementStartDate ? new Date(`${statementStartDate}T00:00:00`) : null;
    const end = statementEndDate ? new Date(`${statementEndDate}T23:59:59.999`) : null;

    const ledgerRows: StatementRow[] = employeeTransactions
      .filter((tx) => tx.employeeId === selectedEmployee.id)
      .map((tx) => ({
        id: tx.id,
        date: tx.date,
        type: tx.type,
        description: tx.description,
        amount: tx.amount,
        impact: getEmployeeTransactionImpact(tx),
        runningBalance: 0,
        linkedTransactionId: tx.linkedTransactionId,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const periodOpening = ledgerRows.reduce((balance, row) => {
      if (start && new Date(row.date) < start) return balance + row.impact;
      return balance;
    }, selectedEmployee.openingBalance);

    const rows: StatementRow[] = [
      {
        id: "opening",
        date: new Date(0).toISOString(),
        type: start || end ? "Opening Balance (Period)" : "Opening Balance",
        description: start || end ? "Balance before selected period" : "Opening balance",
        amount: Math.abs(periodOpening),
        impact: periodOpening,
        runningBalance: 0,
      },
      ...ledgerRows.filter((row) => {
        if (statementType !== "All" && row.type !== statementType) return false;
        const date = new Date(row.date);
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      }),
    ];

    let runningBalance = 0;
    const withBalances = rows.map((row) => {
      runningBalance += row.impact;
      return { ...row, runningBalance };
    });

    let filtered = withBalances;
    if (statementSort === "desc") filtered = filtered.reverse();
    return filtered;
  }, [
    selectedEmployee,
    employeeTransactions,
    statementEndDate,
    statementSort,
    statementStartDate,
    statementType,
  ]);

  const openCreateEmployee = () => {
    setEditingEmployeeId(null);
    setEmployeeForm(employeeFormDefaults);
    setIsEmployeeModalOpen(true);
  };

  const openEditEmployee = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name,
      phone: employee.phone || "",
      role: employee.role || "",
      address: employee.address || "",
      joiningDate: employee.joiningDate || "",
      salaryType: employee.salaryType,
      salaryAmount: String(employee.salaryAmount || 0),
      openingBalance: String(employee.openingBalance || 0),
      notes: employee.notes || "",
    });
    setIsEmployeeModalOpen(true);
  };

  const openEntryModal = (employeeId = "") => {
    setEntryForm(entryFormDefaults(employeeId));
    setIsEntryModalOpen(true);
  };

  const closeStatement = () => {
    setSelectedEmployee(null);
    setStatementStartDate("");
    setStatementEndDate("");
    setStatementType("All");
    setStatementSort("desc");
  };

  const handleSaveEmployee = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = employeeSchema.safeParse({
      ...employeeForm,
      salaryAmount: parseFloat(employeeForm.salaryAmount) || 0,
      openingBalance: parseFloat(employeeForm.openingBalance) || 0,
    });

    if (!validation.success) {
      addToast("error", validation.error.issues[0]?.message ?? "Invalid employee data.");
      return;
    }

    const existing = editingEmployeeId ? employees.find((employee) => employee.id === editingEmployeeId) : null;
    const payload: Employee = {
      id: editingEmployeeId || crypto.randomUUID(),
      name: validation.data.name,
      phone: validation.data.phone || undefined,
      role: validation.data.role || undefined,
      address: validation.data.address || undefined,
      joiningDate: validation.data.joiningDate || undefined,
      salaryType: validation.data.salaryType,
      salaryAmount: Math.round(validation.data.salaryAmount),
      openingBalance: Math.round(validation.data.openingBalance),
      notes: validation.data.notes || undefined,
      isActive: existing?.isActive ?? true,
    };

    if (editingEmployeeId) {
      updateEmployee(payload);
      addToast("success", "Employee updated.");
    } else {
      addEmployee(payload);
      addToast("success", "Employee added.");
    }

    setIsEmployeeModalOpen(false);
    setEditingEmployeeId(null);
    setEmployeeForm(employeeFormDefaults);
  };

  const handleSaveEntry = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = employeeTransactionSchema.safeParse({
      ...entryForm,
      amount: parseFloat(entryForm.amount) || 0,
      paymentMode: entryForm.paymentMode || undefined,
    });

    if (!validation.success) {
      addToast("error", validation.error.issues[0]?.message ?? "Invalid employee ledger entry.");
      return;
    }

    const employee = employees.find((item) => item.id === validation.data.employeeId);
    if (!employee) {
      addToast("error", "Employee not found.");
      return;
    }

    const entryDate = new Date(`${validation.data.date}T00:00:00`);
    const now = new Date();
    entryDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    const amount = Math.round(validation.data.amount);
    let linkedTransactionId: string | undefined;

    if (entryForm.syncDaybook && isEmployeeCashMovement(validation.data.type)) {
      linkedTransactionId = crypto.randomUUID();
      const daybookTransaction: Transaction = {
        id: linkedTransactionId,
        date: entryDate.toISOString(),
        type: validation.data.type === "Advance Returned" ? "Income" : "Expense",
        amount,
        category: getDaybookCategoryForEmployeeEntry(validation.data.type),
        description: `${employee.name} - ${validation.data.description}`,
      };
      addTransaction(daybookTransaction);
    }

    addEmployeeTransaction({
      id: crypto.randomUUID(),
      employeeId: validation.data.employeeId,
      date: entryDate.toISOString(),
      type: validation.data.type,
      amount,
      description: validation.data.description,
      period: validation.data.period || undefined,
      paymentMode: validation.data.paymentMode || undefined,
      linkedTransactionId,
    });

    setIsEntryModalOpen(false);
    setEntryForm(entryFormDefaults());
    addToast("success", "Employee ledger entry saved.");
  };

  const handleDeleteEntry = () => {
    if (!entryToDelete) return;
    deleteEmployeeTransaction(entryToDelete.id);
    if (entryToDelete.linkedTransactionId && transactions.some((tx) => tx.id === entryToDelete.linkedTransactionId)) {
      deleteTransaction(entryToDelete.linkedTransactionId);
    }
    setEntryToDelete(null);
    addToast("success", "Employee ledger entry deleted.");
  };

  const exportStatement = async () => {
    if (!selectedEmployee || statementRows.length === 0) {
      addToast("warning", "No employee statement rows to export.");
      return;
    }

    await downloadCSV(
      statementRows.map((row) => ({
        date: row.id === "opening" ? "Opening" : new Date(row.date).toLocaleDateString("en-IN"),
        type: row.type,
        description: row.description,
        credit: row.impact > 0 ? row.amount : "",
        debit: row.impact < 0 ? row.amount : "",
        balance: `${formatMoney(row.runningBalance)} ${getEmployeeBalanceLabel(row.runningBalance)}`,
      })),
      {
        date: "Date",
        type: "Type",
        description: "Description",
        credit: "Adds to Payable",
        debit: "Reduces Payable / Advance",
        balance: "Running Balance",
      },
      `Employee_Statement_${selectedEmployee.name.replace(/\s+/g, "_")}`,
    );
  };

  const totalEntriesForEmployee = (employeeId: string) =>
    employeeTransactions.filter((tx) => tx.employeeId === employeeId).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white md:text-2xl">
            Employees
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Salary, advances, deductions, reimbursements, and employee balances.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => openEntryModal()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <FileText className="h-4 w-4" />
            Entry
          </button>
          <button
            type="button"
            onClick={openCreateEmployee}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Employee
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Active</p>
            <UserRound className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{activeEmployees.length}</p>
          <p className="mt-1 text-xs text-zinc-500">employees</p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Salary Base</p>
            <IndianRupee className="h-4 w-4 text-primary-500" />
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatMoney(monthlyTotals.monthlyWageBase)}</p>
          <p className="mt-1 text-xs text-zinc-500">fixed salary</p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Payable</p>
            <Wallet className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{formatMoney(monthlyTotals.payable)}</p>
          <p className="mt-1 text-xs text-zinc-500">salary due</p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Advances</p>
            <ArrowUpRight className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatMoney(monthlyTotals.recoverable)}</p>
          <p className="mt-1 text-xs text-zinc-500">recoverable</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-100 bg-white p-3 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Salary Earned</p>
          <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">{formatMoney(monthlyTotals.salaryEarned)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Advance Given</p>
          <p className="mt-1 text-sm font-bold text-amber-600 dark:text-amber-400">{formatMoney(monthlyTotals.advances)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Deductions</p>
          <p className="mt-1 text-sm font-bold text-rose-600 dark:text-rose-400">{formatMoney(monthlyTotals.deductions)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search employees by name, phone, or role..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        {filteredEmployees.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No employees found"
            description="Add the first employee to start tracking salary, advances, and deductions."
            action={
              <button
                type="button"
                onClick={openCreateEmployee}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700/70">
            {filteredEmployees.map((employee) => {
              const balance = getEmployeeBalance(employee.id);
              const isExpanded = expandedEmployeeId === employee.id;
              return (
                <div key={employee.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/70">
                  <button
                    type="button"
                    onClick={() => setExpandedEmployeeId(isExpanded ? null : employee.id)}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left sm:p-4"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{employee.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {employee.role || "Staff"}
                          </span>
                          {employee.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {employee.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                      <div className="text-right">
                        <p className="text-xs text-zinc-500">Bal</p>
                        <p className={`text-xs font-bold sm:text-sm ${balanceClass(balance)}`}>
                          {formatMoney(balance)} {getEmployeeBalanceLabel(balance)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${employee.isActive !== false ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300"}`}>
                        {employee.isActive !== false ? "Active" : "Inactive"}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50 px-3 pb-3 pt-3 dark:border-zinc-700 dark:bg-zinc-900/20 sm:px-4 sm:pb-4">
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Salary</p>
                          <p className="font-medium text-zinc-900 dark:text-white">{formatMoney(employee.salaryAmount)} / {employee.salaryType}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Opening</p>
                          <p className="font-medium text-zinc-900 dark:text-white">{formatMoney(employee.openingBalance)} {getEmployeeBalanceLabel(employee.openingBalance)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Entries</p>
                          <p className="font-medium text-zinc-900 dark:text-white">{totalEntriesForEmployee(employee.id)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Joined</p>
                          <p className="font-medium text-zinc-900 dark:text-white">
                            {employee.joiningDate ? format(parseISO(employee.joiningDate), "dd MMM yyyy") : "-"}
                          </p>
                        </div>
                      </div>
                      {employee.notes && (
                        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {employee.notes}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEntryModal(employee.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-300"
                        >
                          <Plus className="h-4 w-4" />
                          Entry
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(employee)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300"
                        >
                          <FileText className="h-4 w-4" />
                          Statement
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditEmployee(employee)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmployeeToDelete(employee)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${
                            employee.isActive !== false
                              ? "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                              : "border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300"
                          }`}
                        >
                          {employee.isActive !== false ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          {employee.isActive !== false ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-zinc-900/50 md:p-4">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl dark:bg-zinc-800 md:h-auto md:max-h-[90vh] md:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50 md:px-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingEmployeeId ? "Edit Employee" : "Add Employee"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                aria-label="Close employee form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Name</label>
                  <input
                    required
                    value={employeeForm.name}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, name: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Phone</label>
                  <input
                    value={employeeForm.phone}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                    placeholder="9876543210"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Role</label>
                  <input
                    value={employeeForm.role}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, role: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                    placeholder="Loader, Operator, Driver"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Joining Date</label>
                  <input
                    type="date"
                    value={employeeForm.joiningDate}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, joiningDate: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Salary Type</label>
                  <select
                    value={employeeForm.salaryType}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, salaryType: event.target.value as Employee["salaryType"] })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  >
                    {salaryTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Salary Amount</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={employeeForm.salaryAmount}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, salaryAmount: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Opening Balance</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={employeeForm.openingBalance}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, openingBalance: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                  <p className="text-xs text-zinc-500">Positive = payable, negative = advance recoverable.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Address</label>
                  <textarea
                    value={employeeForm.address}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, address: event.target.value })}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Notes</label>
                <textarea
                  value={employeeForm.notes}
                  onChange={(event) => setEmployeeForm({ ...employeeForm, notes: event.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-zinc-900/50 md:p-4">
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-800 md:h-auto md:max-h-[90vh] md:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50 md:px-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Employee Entry</h3>
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                aria-label="Close employee entry form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEntry} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Employee</label>
                <select
                  required
                  value={entryForm.employeeId}
                  onChange={(event) => setEntryForm({ ...entryForm, employeeId: event.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">Select employee</option>
                  {employees.filter((employee) => employee.isActive !== false).map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Type</label>
                  <select
                    value={entryForm.type}
                    onChange={(event) => {
                      const nextType = event.target.value as EmployeeTransactionType;
                      setEntryForm({
                        ...entryForm,
                        type: nextType,
                        syncDaybook: isEmployeeCashMovement(nextType),
                        paymentMode: isEmployeeCashMovement(nextType) ? "Cash" : "Adjustment",
                      });
                    }}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  >
                    {EMPLOYEE_TRANSACTION_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Amount</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={entryForm.amount}
                    onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Date</label>
                  <input
                    required
                    type="date"
                    value={entryForm.date}
                    onChange={(event) => setEntryForm({ ...entryForm, date: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Salary Month</label>
                  <input
                    type="month"
                    value={entryForm.period}
                    onChange={(event) => setEntryForm({ ...entryForm, period: event.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Mode</label>
                  <select
                    value={entryForm.paymentMode}
                    onChange={(event) => setEntryForm({ ...entryForm, paymentMode: event.target.value as EmployeeTransaction["paymentMode"] })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  >
                    {paymentModes.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
                {isEmployeeCashMovement(entryForm.type) && (
                  <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={entryForm.syncDaybook}
                      onChange={(event) => setEntryForm({ ...entryForm, syncDaybook: event.target.checked })}
                      className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                    />
                    Add cash entry in Daybook
                  </label>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Remarks</label>
                <textarea
                  required
                  value={entryForm.description}
                  onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  placeholder="Salary for April, advance for home expense, deduction reason..."
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-zinc-900/50 md:p-4">
          <div className="flex h-full w-full max-w-5xl flex-col bg-white shadow-xl dark:bg-zinc-800 md:h-auto md:max-h-[90vh] md:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50 md:px-6">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{selectedEmployee.name} Statement</h3>
                <p className={`text-sm font-semibold ${balanceClass(getEmployeeBalance(selectedEmployee.id))}`}>
                  {formatMoney(getEmployeeBalance(selectedEmployee.id))} {getEmployeeBalanceLabel(getEmployeeBalance(selectedEmployee.id))}
                </p>
              </div>
              <button
                type="button"
                onClick={closeStatement}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                aria-label="Close employee statement"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-b border-zinc-100 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800 md:px-6">
              <div className="min-w-[130px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">From</label>
                <input
                  type="date"
                  value={statementStartDate}
                  onChange={(event) => setStatementStartDate(event.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div className="min-w-[130px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">To</label>
                <input
                  type="date"
                  value={statementEndDate}
                  onChange={(event) => setStatementEndDate(event.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div className="min-w-[150px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Type</label>
                <select
                  value={statementType}
                  onChange={(event) => setStatementType(event.target.value as "All" | EmployeeTransactionType)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="All">All Types</option>
                  {EMPLOYEE_TRANSACTION_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[150px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Sort</label>
                <select
                  value={statementSort}
                  onChange={(event) => setStatementSort(event.target.value as "desc" | "asc")}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => void exportStatement()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-5">
              {statementRows.length === 0 ? (
                <EmptyState icon={Calendar} title="No statement rows" />
              ) : (
                <div className="space-y-2">
                  {statementRows.map((row) => {
                    const isCredit = row.impact > 0;
                    const isNeutral = row.impact === 0;
                    return (
                      <div key={row.id} className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {isNeutral ? (
                                <FileText className="h-4 w-4 text-zinc-400" />
                              ) : isCredit ? (
                                <ArrowDownRight className="h-4 w-4 text-primary-500" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-rose-500" />
                              )}
                              <p className="font-semibold text-zinc-900 dark:text-white">{row.type}</p>
                            </div>
                            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{row.description}</p>
                            <p className="mt-2 text-xs text-zinc-500">
                              {row.id === "opening" ? "Opening" : format(parseISO(row.date), "dd MMM yyyy, hh:mm a")}
                              {row.linkedTransactionId ? " - Daybook linked" : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-bold ${isNeutral ? "text-zinc-600 dark:text-zinc-300" : isCredit ? "text-primary-600 dark:text-primary-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {isNeutral ? "" : isCredit ? "+" : "-"} {formatMoney(row.amount)}
                            </p>
                            <p className={`mt-1 text-xs font-semibold ${balanceClass(row.runningBalance)}`}>
                              Bal: {formatMoney(row.runningBalance)} {getEmployeeBalanceLabel(row.runningBalance)}
                            </p>
                            {row.id !== "opening" && (
                              <button
                                type="button"
                                onClick={() => {
                                  const tx = employeeTransactions.find((item) => item.id === row.id);
                                  if (tx) setEntryToDelete(tx);
                                }}
                                className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!employeeToDelete}
        title={employeeToDelete?.isActive !== false ? "Deactivate Employee" : "Reactivate Employee"}
        message={
          employeeToDelete?.isActive !== false
            ? "This employee will be hidden from active lists, but salary, advance, and deduction history will stay intact."
            : "This employee will be made active again and appear in employee entry lists."
        }
        confirmText={employeeToDelete?.isActive !== false ? "Deactivate" : "Reactivate"}
        onConfirm={() => {
          if (employeeToDelete) {
            if (employeeToDelete.isActive !== false) {
              deleteEmployee(employeeToDelete.id);
            } else {
              updateEmployee({ ...employeeToDelete, isActive: true });
            }
            setEmployeeToDelete(null);
            addToast("success", employeeToDelete.isActive !== false ? "Employee deactivated." : "Employee reactivated.");
          }
        }}
        onCancel={() => setEmployeeToDelete(null)}
      />

      <ConfirmationModal
        isOpen={!!entryToDelete}
        title="Delete Employee Entry"
        message="This will remove the selected employee ledger entry. Any linked Daybook cash entry will also be removed."
        confirmText="Delete"
        onConfirm={handleDeleteEntry}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
}
