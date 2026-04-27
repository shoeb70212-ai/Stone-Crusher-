import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { Customer, Slip, Transaction, Vehicle, Invoice, CompanySettings, Task } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "Admin" | "Partner" | "Manager";

/**
 * Shape of the global ERP context.
 * Every mutation function follows the pattern: update local state → queue a
 * delta-sync to the server so the JSON file stays in lockstep.
 */
interface ErpState {
  // Data collections
  customers: Customer[];
  slips: Slip[];
  transactions: Transaction[];
  vehicles: Vehicle[];
  invoices: Invoice[];
  tasks: Task[];
  companySettings: CompanySettings;

  // Auth
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;

  // Settings
  updateCompanySettings: (settings: CompanySettings) => void;
  toggleMaterialActive: (id: string) => void;

  // Customer CRUD
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  /** Soft-deletes: sets `isActive: false` to preserve ledger history. */
  deleteCustomer: (id: string) => void;

  // Vehicle CRUD
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (vehicle: Vehicle) => void;
  /** Soft-deletes: sets `isActive: false` to preserve dispatch history. */
  deleteVehicle: (id: string) => void;

  // Slip CRUD
  addSlip: (slip: Slip) => void;
  updateSlipStatus: (id: string, status: Slip["status"]) => void;
  updateSlip: (id: string, updates: Partial<Slip>) => void;

  // Invoice CRUD
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;

  // Transaction CRUD
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Task CRUD
  addTask: (task: Task) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  // Derived / utilities
  getCustomerBalance: (customerId: string) => number;
  /** Hard-deletes all soft-deleted customers & vehicles from the database. */
  purgeInactiveRecords: () => void;
}

// ---------------------------------------------------------------------------
// Default company settings — used only on first boot before server responds
// ---------------------------------------------------------------------------

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: "CrushTrack Enterprises",
  address: "123 Industrial Area, Phase 1\nCity, State 123456",
  phone: "+91 98765 43210",
  gstin: "22AAAAA0000A1Z5",
  receiptFooter: "Thank you for your business!",
  bankName: "HDFC Bank",
  accountNumber: "50200001234567",
  ifscCode: "HDFC0001234",
  branchName: "Industrial Area Branch",
  slipFormat: "Thermal-80mm",
  invoiceTemplate: "Classic",
  expenseCategories: ["Diesel", "Maintenance", "Salaries", "Rent", "Office Supplies", "Electricity"],
  materials: [
    { id: "1", name: "10mm", defaultPrice: 450, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
    { id: "2", name: "20mm", defaultPrice: 480, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
    { id: "3", name: "40mm", defaultPrice: 400, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
    { id: "4", name: "Dust", defaultPrice: 350, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
    { id: "5", name: "GSB", defaultPrice: 300, unit: "Ton", hsnCode: "25171020", gstRate: 5 },
    { id: "6", name: "Boulders", defaultPrice: 250, unit: "Ton", hsnCode: "25169090", gstRate: 5 },
  ],
  users: [
    { id: "1", name: "Admin User", email: "admin@crushtrack.com", role: "Admin", status: "Active" },
    { id: "2", name: "Operations Manager", email: "manager@crushtrack.com", role: "Manager", status: "Active" },
    { id: "3", name: "Partner", email: "partner@crushtrack.com", role: "Partner", status: "Active" },
  ],
};

const LOCAL_BACKUP_KEY = "erp_data_backup";
const LOCAL_ROLE_KEY = "erp_userRole";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ErpContext = createContext<ErpState | undefined>(undefined);

export function ErpProvider({ children }: { children: ReactNode }) {
  // ---- Core state (initialised empty; hydrated from server on mount) ------
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [userRole, setUserRole] = useState<UserRole>("Admin");
  const [isLoaded, setIsLoaded] = useState(false);

  // -----------------------------------------------------------------------
  // Data Loading — server-first with localStorage fallback
  // -----------------------------------------------------------------------

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const data = await res.json();
          if (data.customers) setCustomers(data.customers);
          if (data.slips) setSlips(data.slips);
          if (data.transactions) setTransactions(data.transactions);
          if (data.vehicles) setVehicles(data.vehicles);
          if (data.invoices) setInvoices(data.invoices);
          if (data.tasks) setTasks(data.tasks);
          if (data.companySettings) setCompanySettings(data.companySettings);
        }
      } catch (error) {
        console.error("Failed to load data from server:", error);
        // Fallback: hydrate from the localStorage mirror so the app is still
        // usable when the express server is unreachable (e.g. network blip).
        const saved = localStorage.getItem(LOCAL_BACKUP_KEY);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (data.customers) setCustomers(data.customers);
            if (data.slips) setSlips(data.slips);
            if (data.transactions) setTransactions(data.transactions);
            if (data.vehicles) setVehicles(data.vehicles);
            if (data.invoices) setInvoices(data.invoices);
            if (data.tasks) setTasks(data.tasks);
            if (data.companySettings) setCompanySettings(data.companySettings);
          } catch {
            console.error("Corrupt localStorage backup — starting fresh.");
          }
        }
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  // -----------------------------------------------------------------------
  // Delta-Sync Queue — batches mutations and PATCHes them to the server
  // -----------------------------------------------------------------------

  const syncQueueRef = useRef<{
    updates: Record<string, any>;
    deletions: Record<string, string[]>;
  }>({ updates: {}, deletions: {} });

  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  /** Flushes the accumulated delta queue to the server after a 1.5 s debounce. */
  const triggerSync = () => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      const payload = { ...syncQueueRef.current };

      const hasUpdates = Object.keys(payload.updates).length > 0;
      const hasDeletions = Object.keys(payload.deletions).length > 0;
      if (!hasUpdates && !hasDeletions) return;

      // Reset queue before the async call so concurrent mutations go into
      // the *next* batch rather than being silently dropped.
      syncQueueRef.current = { updates: {}, deletions: {} };

      try {
        await fetch("/api/data", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error("Failed to delta sync to server:", error);
      }
    }, 1500);
  };

  /**
   * Enqueues an upsert for a single record.
   * `companySettings` is treated as a singleton; all other tables are arrays.
   */
  const queueUpdate = (table: string, item: any) => {
    if (table === "companySettings") {
      syncQueueRef.current.updates.companySettings = item;
    } else {
      const existing = syncQueueRef.current.updates[table] || [];
      const filtered = existing.filter((i: any) => i.id !== item.id);
      syncQueueRef.current.updates[table] = [...filtered, item];
    }
    triggerSync();
  };

  /** Enqueues a hard-delete for a record by table name and ID. */
  const queueDelete = (table: string, id: string) => {
    const existing = syncQueueRef.current.deletions[table] || [];
    if (!existing.includes(id)) {
      syncQueueRef.current.deletions[table] = [...existing, id];
    }
    triggerSync();
  };

  // -----------------------------------------------------------------------
  // Local mirror — keeps a copy in localStorage as a crash-safety net
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(
      LOCAL_BACKUP_KEY,
      JSON.stringify({ customers, slips, transactions, vehicles, invoices, tasks, companySettings }),
    );
  }, [customers, slips, transactions, vehicles, invoices, tasks, companySettings, isLoaded]);

  useEffect(() => {
    localStorage.setItem(LOCAL_ROLE_KEY, JSON.stringify(userRole));
  }, [userRole]);

  // -----------------------------------------------------------------------
  // Vehicle CRUD
  // -----------------------------------------------------------------------

  /** Adds a vehicle, defaulting `isActive` to `true` if omitted. */
  const addVehicle = (vehicle: Vehicle) => {
    const normalised = { ...vehicle, isActive: vehicle.isActive ?? true };
    setVehicles((prev) => [...prev, normalised]);
    queueUpdate("vehicles", normalised);
  };

  /** Replaces a vehicle record in-place by ID. */
  const updateVehicle = (updated: Vehicle) => {
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    queueUpdate("vehicles", updated);
  };

  /** Soft-deletes a vehicle so historical slips referencing it stay intact. */
  const deleteVehicle = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          const deactivated = { ...v, isActive: false };
          queueUpdate("vehicles", deactivated);
          return deactivated;
        }
        return v;
      }),
    );
  };

  // -----------------------------------------------------------------------
  // Invoice CRUD
  // -----------------------------------------------------------------------

  /** Appends a new invoice to the collection. */
  const addInvoice = (invoice: Invoice) => {
    setInvoices((prev) => [...prev, invoice]);
    queueUpdate("invoices", invoice);
  };

  /** Partially updates an invoice by ID (e.g. changing status to Paid). */
  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices((prev) => {
      const next = prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv));
      const updated = next.find((i) => i.id === id);
      if (updated) queueUpdate("invoices", updated);
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Company Settings & Materials
  // -----------------------------------------------------------------------

  /** Persists the full settings object, ensuring every material has `isActive`. */
  const updateCompanySettings = (settings: CompanySettings) => {
    const normalised = {
      ...settings,
      materials: (settings.materials || []).map((m) => ({
        ...m,
        isActive: m.isActive ?? true,
      })),
    };
    setCompanySettings(normalised);
    queueUpdate("companySettings", normalised);
  };

  /** Toggles a material's active/inactive state by ID. */
  const toggleMaterialActive = (id: string) => {
    const updatedMaterials = (companySettings.materials || []).map((m) =>
      m.id === id ? { ...m, isActive: !m.isActive } : m,
    );
    const next = { ...companySettings, materials: updatedMaterials };
    setCompanySettings(next);
    queueUpdate("companySettings", next);
  };

  // -----------------------------------------------------------------------
  // Customer CRUD
  // -----------------------------------------------------------------------

  /** Appends a new customer to the collection. */
  const addCustomer = (customer: Customer) => {
    setCustomers((prev) => [...prev, customer]);
    queueUpdate("customers", customer);
  };

  /** Replaces a customer record in-place by ID. */
  const updateCustomer = (customer: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
    queueUpdate("customers", customer);
  };

  /** Soft-deletes a customer so ledger history is preserved. */
  const deleteCustomer = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const deactivated = { ...c, isActive: false };
          queueUpdate("customers", deactivated);
          return deactivated;
        }
        return c;
      }),
    );
  };

  // -----------------------------------------------------------------------
  // Slip CRUD
  // -----------------------------------------------------------------------

  /** Appends a new dispatch slip. */
  const addSlip = (slip: Slip) => {
    setSlips((prev) => [...prev, slip]);
    queueUpdate("slips", slip);
  };

  /** Advances a slip's workflow status (Pending → Loaded → Tallied / Cancelled). */
  const updateSlipStatus = (id: string, status: Slip["status"]) => {
    setSlips((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, status } : s));
      const updated = next.find((s) => s.id === id);
      if (updated) queueUpdate("slips", updated);
      return next;
    });
  };

  /** Partially updates a slip by ID (used by EditSlipForm). */
  const updateSlip = (id: string, updates: Partial<Slip>) => {
    setSlips((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
      const updated = next.find((s) => s.id === id);
      if (updated) queueUpdate("slips", updated);
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Transaction CRUD
  // -----------------------------------------------------------------------

  /** Records a financial transaction (income or expense). */
  const addTransaction = (transaction: Transaction) => {
    setTransactions((prev) => [...prev, transaction]);
    queueUpdate("transactions", transaction);
  };

  /** Partially updates a transaction by ID. */
  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) queueUpdate("transactions", updated);
      return next;
    });
  };

  /** Hard-deletes a transaction — only transactions support true deletion. */
  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    queueDelete("transactions", id);
  };

  // -----------------------------------------------------------------------
  // Task CRUD
  // -----------------------------------------------------------------------

  /** Appends a quick-task to the checklist. */
  const addTask = (task: Task) => {
    setTasks((prev) => [...prev, task]);
    queueUpdate("tasks", task);
  };

  /** Toggles a task's completed state. */
  const toggleTask = (id: string) => {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) queueUpdate("tasks", updated);
      return next;
    });
  };

  /** Hard-deletes a task. */
  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    queueDelete("tasks", id);
  };

  // -----------------------------------------------------------------------
  // Derived: Customer Balance
  // -----------------------------------------------------------------------

  /**
   * Computes a customer's outstanding balance by combining four sources:
   *   1. Opening balance (carried forward from previous books)
   *   2. Un-billed slips (dispatches not yet invoiced)
   *   3. Invoices (GST / Cash — excluding cancelled)
   *   4. Manual transactions (payments credited, expenses debited)
   *
   * A positive result means the customer owes money (debit).
   * A negative result means the company owes the customer (advance/credit).
   */
  const getCustomerBalance = (customerId: string) => {
    if (customerId === "CASH") return 0;
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return 0;

    // Unbilled slips — already delivered but not yet on an invoice
    const unbilledSlipTotal = slips
      .filter(
        (s) => s.customerId === customerId && (s.status === "Tallied" || s.status === "Pending") && !s.invoiceId,
      )
      .reduce((sum, s) => sum + s.totalAmount, 0);

    // Invoiced amounts (excluding cancelled invoices)
    const invoiceTotal = invoices
      .filter((inv) => inv.customerId === customerId && inv.status !== "Cancelled")
      .reduce((sum, inv) => sum + inv.total, 0);

    // Manual ledger transactions
    const custTxs = transactions.filter((t) => t.customerId === customerId);
    const incomeTotal = custTxs.filter((t) => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = custTxs.filter((t) => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);

    // Balance = Opening + Deliveries (unbilled) + Invoices + Expenses (debits) − Payments (credits)
    return cust.openingBalance + unbilledSlipTotal + invoiceTotal + expenseTotal - incomeTotal;
  };

  // -----------------------------------------------------------------------
  // Admin Utility: Purge
  // -----------------------------------------------------------------------

  /**
   * Permanently removes all soft-deleted (isActive === false) customers and
   * vehicles from both local state and the server database.
   * Intended as an admin-only cleanup action.
   */
  const purgeInactiveRecords = () => {
    const inactiveCustomerIds = customers.filter((c) => c.isActive === false).map((c) => c.id);
    const inactiveVehicleIds = vehicles.filter((v) => v.isActive === false).map((v) => v.id);

    setCustomers((prev) => prev.filter((c) => c.isActive !== false));
    setVehicles((prev) => prev.filter((v) => v.isActive !== false));

    inactiveCustomerIds.forEach((id) => queueDelete("customers", id));
    inactiveVehicleIds.forEach((id) => queueDelete("vehicles", id));
  };

  // -----------------------------------------------------------------------
  // Provider
  // -----------------------------------------------------------------------

  return (
    <ErpContext.Provider
      value={{
        customers,
        slips,
        transactions,
        vehicles,
        invoices,
        tasks,
        companySettings,
        userRole,
        setUserRole,
        updateCompanySettings,
        toggleMaterialActive,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        addSlip,
        updateSlipStatus,
        updateSlip,
        addInvoice,
        updateInvoice,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addTask,
        toggleTask,
        deleteTask,
        getCustomerBalance,
        purgeInactiveRecords,
      }}
    >
      {children}
    </ErpContext.Provider>
  );
}

/**
 * Hook to access the ERP context.
 * Must be called inside an `<ErpProvider>`.
 */
export function useErp() {
  const context = useContext(ErpContext);
  if (context === undefined) {
    throw new Error("useErp must be used within an ErpProvider");
  }
  return context;
}
