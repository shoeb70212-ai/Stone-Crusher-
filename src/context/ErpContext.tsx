import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Customer,
  Employee,
  EmployeeTransaction,
  Slip,
  Transaction,
  Vehicle,
  Invoice,
  CompanySettings,
  Task,
  AuditLog,
} from "../types";
import { supabase } from "../lib/supabase";
import { isNative } from "../lib/capacitor";
import { getEmployeeTransactionImpact } from "../lib/employee-ledger";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/** Returns headers for every /api/data request.
 *  Includes x-api-key when VITE_API_KEY is set in the environment. */
function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = import.meta.env.VITE_API_KEY as string | undefined;
  if (key) headers['x-api-key'] = key;
  return headers;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "Admin" | "Partner" | "Manager";

type AuditLogInput = Omit<AuditLog, "id" | "timestamp" | "actorId" | "actorName" | "actorRole">;

/**
 * Shape of the global ERP context.
 * Every mutation function follows the pattern: update local state → queue a
 * delta-sync to the server so the JSON file stays in lockstep.
 */
interface ErpState {
  // Data collections
  customers: Customer[];
  employees: Employee[];
  employeeTransactions: EmployeeTransaction[];
  slips: Slip[];
  transactions: Transaction[];
  vehicles: Vehicle[];
  invoices: Invoice[];
  tasks: Task[];
  auditLogs: AuditLog[];
  companySettings: CompanySettings;
  isLoading: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';

  // Auth
  userRole: UserRole;
  session: Session | null;
  signOut: () => Promise<void>;
  recordAuditEvent: (entry: AuditLogInput) => void;

  // Settings
  updateCompanySettings: (settings: CompanySettings) => Promise<boolean>;
  toggleMaterialActive: (id: string) => void;

  // Customer CRUD
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  /** Soft-deletes: sets `isActive: false` to preserve ledger history. */
  deleteCustomer: (id: string) => void;

  // Employee CRUD
  addEmployee: (employee: Employee) => void;
  updateEmployee: (employee: Employee) => void;
  /** Soft-deletes: sets `isActive: false` to preserve salary/advance history. */
  deleteEmployee: (id: string) => void;
  addEmployeeTransaction: (transaction: EmployeeTransaction) => void;
  deleteEmployeeTransaction: (id: string) => void;

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
  getEmployeeBalance: (employeeId: string) => number;
  /** Hard-deletes soft-deleted customers & vehicles that have no financial history.
   *  Returns counts of purged and skipped (orphan-protected) records. */
  purgeInactiveRecords: () => { purged: number; skipped: number };
  /** Immediately flushes any pending mutations in the sync queue to the server.
   *  Called by OfflineIndicator when the device comes back online. */
  flushSync: () => Promise<boolean>;
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
  mobileLayout: "Comfortable",
  expenseCategories: ["Diesel", "Maintenance", "Salaries", "Rent", "Office Supplies", "Electricity"],
  materials: [
    { id: "1", name: "10mm", defaultPrice: 450, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
    { id: "2", name: "20mm", defaultPrice: 480, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
    { id: "3", name: "40mm", defaultPrice: 400, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
    { id: "4", name: "Dust", defaultPrice: 350, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
    { id: "5", name: "GSB", defaultPrice: 300, unit: "Ton", hsnCode: "25171020", gstRate: 5 },
    { id: "6", name: "Boulders", defaultPrice: 250, unit: "Ton", hsnCode: "25169090", gstRate: 5 },
  ],
  users: [],
};

const LOCAL_BACKUP_KEY = "erp_data_backup";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ErpContext = createContext<ErpState | undefined>(undefined);

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

/** Returns true if the role may perform admin-only operations. */
const isAdmin = (role: UserRole) => role === "Admin";

/** Returns true if the role may perform manager-or-above operations. */
const isManagerOrAbove = (role: UserRole) => role === "Admin" || role === "Manager";

export function ErpProvider({ children }: { children: ReactNode }) {
  // ---- Core state (initialised empty; hydrated from server on mount) ------
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeTransactions, setEmployeeTransactions] = useState<EmployeeTransaction[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, _setUserRole] = useState<UserRole>("Admin");
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  // Restore persisted role on cold boot so the correct role is visible before
  // companySettings loads from the server.
  useEffect(() => {
    const saved = localStorage.getItem('erp_user_role');
    if (saved === 'Admin' || saved === 'Manager' || saved === 'Partner') {
      _setUserRole(saved);
    }
  }, []);

  // Subscribe to Supabase Auth state changes.  When the session transitions
  // the role is re-derived below (in the settings-load effect).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // Clear stale legacy keys so they never pollute a fresh Supabase session.
      if (!newSession) {
        localStorage.removeItem('erp_auth_token');
        localStorage.removeItem('erp_user_role');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // -----------------------------------------------------------------------
  // Data Loading — server-first with localStorage fallback
  // -----------------------------------------------------------------------

  useEffect(() => {
    async function loadData() {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "";
        const key = import.meta.env.VITE_API_KEY as string | undefined;
        const res = await fetch(`${API_URL}/api/data`, {
          headers: key ? { 'x-api-key': key } : undefined,
        });
        if (!res.ok) throw new Error(`Failed to load API data: HTTP ${res.status}`);
        const data = await res.json();
        if (data.customers) setCustomers(data.customers);
        if (data.employees) setEmployees(data.employees);
        if (data.employeeTransactions) setEmployeeTransactions(data.employeeTransactions);
        if (data.slips) setSlips(data.slips);
        if (data.transactions) setTransactions(data.transactions);
        if (data.vehicles) setVehicles(data.vehicles);
        if (data.invoices) setInvoices(data.invoices);
        if (data.tasks) setTasks(data.tasks);
        if (data.auditLogs) setAuditLogs(data.auditLogs);
        if (data.companySettings) setCompanySettings(data.companySettings);
      } catch {
        // Server unreachable — fall back to localStorage mirror so the app
        // remains usable offline.
        const saved = localStorage.getItem(LOCAL_BACKUP_KEY);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (data.customers) setCustomers(data.customers);
            if (data.employees) setEmployees(data.employees);
            if (data.employeeTransactions) setEmployeeTransactions(data.employeeTransactions);
            if (data.slips) setSlips(data.slips);
            if (data.transactions) setTransactions(data.transactions);
            if (data.vehicles) setVehicles(data.vehicles);
            if (data.invoices) setInvoices(data.invoices);
            if (data.tasks) setTasks(data.tasks);
            if (data.auditLogs) setAuditLogs(data.auditLogs);
            if (data.companySettings) setCompanySettings(data.companySettings);
          } catch {
            // Corrupt backup — start fresh (context state remains at defaults).
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // -----------------------------------------------------------------------
  // Delta-Sync Queue — batches mutations and PATCHes them to the server
  // -----------------------------------------------------------------------

  type QueueItem =
    | Customer
    | Employee
    | EmployeeTransaction
    | Slip
    | Transaction
    | Vehicle
    | Invoice
    | Task
    | AuditLog
    | CompanySettings;

  const syncQueueRef = useRef<{
    updates: Record<string, unknown[]> & { companySettings?: CompanySettings };
    deletions: Record<string, string[]>;
  }>({ updates: {}, deletions: {} });

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  const requeueFailedPayload = useCallback((payload: {
    updates: Record<string, unknown[]> & { companySettings?: CompanySettings };
    deletions: Record<string, string[]>;
  }) => {
    for (const [table, items] of Object.entries(payload.updates)) {
      if (table === "companySettings") {
        syncQueueRef.current.updates.companySettings =
          syncQueueRef.current.updates.companySettings ?? (items as CompanySettings);
      } else {
        const existing = (syncQueueRef.current.updates[table] || []) as QueueItem[];
        const retry = items as QueueItem[];
        const existingIds = new Set(existing.map((item) => (item as { id?: string }).id).filter(Boolean));
        const merged = [
          ...retry.filter((item) => {
            const id = (item as { id?: string }).id;
            return !id || !existingIds.has(id);
          }),
          ...existing,
        ];
        syncQueueRef.current.updates[table] = merged;
      }
    }
    for (const [table, ids] of Object.entries(payload.deletions)) {
      const existing = syncQueueRef.current.deletions[table] || [];
      const merged = Array.from(new Set([...existing, ...ids]));
      syncQueueRef.current.deletions[table] = merged;
    }
  }, []);

  const flushSyncQueue = useCallback(async (): Promise<boolean> => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = undefined;
    }

    const payload = {
      updates: { ...syncQueueRef.current.updates },
      deletions: { ...syncQueueRef.current.deletions },
    };

    const hasUpdates = Object.keys(payload.updates).length > 0;
    const hasDeletions = Object.keys(payload.deletions).length > 0;
    if (!hasUpdates && !hasDeletions) return true;

    // Reset queue before the async call so concurrent mutations that arrive
    // while this request is in-flight go into the next batch.
    syncQueueRef.current = { updates: {}, deletions: {} };

    setSyncStatus('syncing');
    try {
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/data`, {
        method: "PATCH",
        headers: apiHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.details || `Sync failed with HTTP ${res.status}`);
      }

      retryCountRef.current = 0;
      setSyncStatus('idle');
      return true;
    } catch {
      setSyncStatus('error');
      requeueFailedPayload(payload);
      return false;
    }
  }, [requeueFailedPayload]);

  /** Flushes the accumulated delta queue to the server after a 400ms debounce.
   *  Reduced from 1500ms to improve responsiveness during rapid data entry. */
  const triggerSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      const ok = await flushSyncQueue();
      if (!ok && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        triggerSync();
      }
      // When MAX_RETRIES is exhausted, syncStatus remains 'error' so the
      // OfflineIndicator can surface the failure to the user.
    }, 400);
  }, [flushSyncQueue]);

  /**
   * Enqueues an upsert for a single record.
   * `companySettings` is treated as a singleton; all other tables are arrays.
   */
  const queueUpdate = useCallback((table: string, item: any) => {
    if (table === "companySettings") {
      syncQueueRef.current.updates.companySettings = item;
    } else {
      const existing = syncQueueRef.current.updates[table] || [];
      const filtered = existing.filter((i: any) => i.id !== item.id);
      syncQueueRef.current.updates[table] = [...filtered, item];
    }
    triggerSync();
  }, [triggerSync]);

  /** Enqueues a hard-delete for a record by table name and ID. */
  const queueDelete = useCallback((table: string, id: string) => {
    const existing = syncQueueRef.current.deletions[table] || [];
    if (!existing.includes(id)) {
      syncQueueRef.current.deletions[table] = [...existing, id];
    }
    triggerSync();
  }, [triggerSync]);

  // -----------------------------------------------------------------------
  // Local mirror — debounced backup to localStorage (5s) as a crash-safety net.
  // Immediate writes were blocking the UI thread on every keystroke on mobile.
  // -----------------------------------------------------------------------

  const backupTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isLoading) return;
    if (backupTimeoutRef.current) clearTimeout(backupTimeoutRef.current);
    backupTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(
        LOCAL_BACKUP_KEY,
        JSON.stringify({
          customers,
          employees,
          employeeTransactions,
          slips,
          transactions,
          vehicles,
          invoices,
          tasks,
          auditLogs,
          companySettings,
        }),
      );
    }, 5000);
  }, [
    customers,
    employees,
    employeeTransactions,
    slips,
    transactions,
    vehicles,
    invoices,
    tasks,
    auditLogs,
    companySettings,
    isLoading,
  ]);

  // -----------------------------------------------------------------------
  // Network reconnect — flush queued mutations as soon as connectivity returns
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!isNative()) return;
    let removeListener: (() => void) | undefined;

    import('@capacitor/network').then(({ Network }) => {
      Network.addListener('networkStatusChange', (status) => {
        if (status.connected) triggerSync();
      }).then((handle) => {
        removeListener = () => handle.remove();
      });
    });

    return () => removeListener?.();
  }, [triggerSync]);

  // -----------------------------------------------------------------------
  // App badge count — shows pending slips + incomplete tasks on the icon
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (isLoading || !isNative()) return;

    const pendingSlips = slips.filter(
      (s) => s.status === 'Pending' || s.status === 'Tallied',
    ).length;
    const incompleteTasks = tasks.filter((t) => !t.completed).length;
    const count = pendingSlips + incompleteTasks;

    import('@capawesome/capacitor-badge').then(({ Badge }) => {
      Badge.isSupported().then(({ isSupported }) => {
        if (isSupported) {
          Badge.set({ count }).catch(() => {});
        }
      });
    });
  }, [slips, tasks, isLoading]);

  // After settings load (or when the session changes), re-derive the role so a
  // user cannot self-promote by editing localStorage.  Priority:
  //   1. app_metadata.role set by the server (tamper-proof)
  //   2. companySettings.users lookup by Supabase user id or email
  useEffect(() => {
    if (isLoading || !session) return;

    let resolvedRole: UserRole | null = null;

    const appRole = session.user.app_metadata?.role as string | undefined;
    if (appRole === 'Admin' || appRole === 'Manager' || appRole === 'Partner') {
      resolvedRole = appRole;
    } else {
      const users = companySettings.users ?? [];
      const match = users.find(
        (u) =>
          (u.id === session.user.id ||
            u.email.toLowerCase() === (session.user.email ?? '').toLowerCase()) &&
          u.status === 'Active',
      );
      if (match) resolvedRole = match.role as UserRole;
    }

    if (resolvedRole) {
      _setUserRole(resolvedRole);
      localStorage.setItem('erp_user_role', resolvedRole);
    }
  }, [isLoading, session, companySettings.users]);

  // -----------------------------------------------------------------------
  // Audit logging
  // -----------------------------------------------------------------------

  const getCurrentActor = useCallback(() => {
    if (!session) {
      return { actorName: 'System', actorRole: userRole };
    }

    const users = companySettings.users ?? [];
    const user = users.find(
      (u) =>
        u.id === session.user.id ||
        u.email.toLowerCase() === (session.user.email ?? '').toLowerCase(),
    );

    if (user) {
      return {
        actorId: user.id,
        actorName: user.name || user.email || user.role,
        actorRole: user.role,
      };
    }

    return { actorName: `${userRole} User`, actorRole: userRole };
  }, [session, companySettings.users, userRole]);

  /** Signs the current user out of Supabase Auth and clears local state. */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('erp_auth_token');
    localStorage.removeItem('erp_user_role');
  }, []);

  const recordAudit = useCallback((entry: AuditLogInput) => {
    const actor = getCurrentActor();
    const log: AuditLog = {
      id: typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      ...actor,
      ...entry,
    };
    setAuditLogs((prev) => [log, ...prev]);
    queueUpdate("auditLogs", log);
  }, [getCurrentActor, queueUpdate]);

  // -----------------------------------------------------------------------
  // Vehicle CRUD
  // -----------------------------------------------------------------------

  /** Adds a vehicle, defaulting `isActive` to `true` if omitted. */
  const addVehicle = useCallback((vehicle: Vehicle) => {
    if (!isManagerOrAbove(userRole)) return;
    const normalised = { ...vehicle, isActive: vehicle.isActive ?? true };
    setVehicles((prev) => [...prev, normalised]);
    queueUpdate("vehicles", normalised);
    recordAudit({
      action: "Created vehicle",
      entityType: "Vehicle",
      entityId: normalised.id,
      entityLabel: normalised.vehicleNo,
      description: `Created vehicle ${normalised.vehicleNo}.`,
      metadata: { ownerName: normalised.ownerName || undefined },
    });
  }, [userRole, queueUpdate, recordAudit]);

  /** Replaces a vehicle record in-place by ID. */
  const updateVehicle = useCallback((updated: Vehicle) => {
    if (!isManagerOrAbove(userRole)) return;
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    queueUpdate("vehicles", updated);
    recordAudit({
      action: "Updated vehicle",
      entityType: "Vehicle",
      entityId: updated.id,
      entityLabel: updated.vehicleNo,
      description: `Updated vehicle ${updated.vehicleNo}.`,
      metadata: { ownerName: updated.ownerName || undefined, isActive: updated.isActive !== false },
    });
  }, [userRole, queueUpdate, recordAudit]);

  /** Soft-deletes a vehicle so historical slips referencing it stay intact. */
  const deleteVehicle = useCallback((id: string) => {
    if (!isManagerOrAbove(userRole)) return;
    const vehicle = vehicles.find((v) => v.id === id);
    if (!vehicle) return;
    const deactivated = { ...vehicle, isActive: false };
    setVehicles((prev) => prev.map((v) => (v.id === id ? deactivated : v)));
    queueUpdate("vehicles", deactivated);
    recordAudit({
      action: "Deactivated vehicle",
      entityType: "Vehicle",
      entityId: id,
      entityLabel: vehicle.vehicleNo,
      description: `Deactivated vehicle ${vehicle.vehicleNo}.`,
    });
  }, [userRole, vehicles, queueUpdate, recordAudit]);

  // -----------------------------------------------------------------------
  // Invoice CRUD
  // -----------------------------------------------------------------------

  /** Appends a new invoice to the collection. */
  const addInvoice = useCallback((invoice: Invoice) => {
    setInvoices((prev) => [...prev, invoice]);
    queueUpdate("invoices", invoice);
    recordAudit({
      action: "Created invoice",
      entityType: "Invoice",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNo,
      description: `Created ${invoice.type} invoice ${invoice.invoiceNo} for ${invoice.total.toLocaleString("en-IN")}.`,
      metadata: { status: invoice.status, total: invoice.total, slipCount: invoice.slipIds?.length || 0 },
    });
  }, [queueUpdate, recordAudit]);

  /** Partially updates an invoice by ID (e.g. changing status to Paid). */
  const updateInvoice = useCallback((id: string, updates: Partial<Invoice>) => {
    const previous = invoices.find((inv) => inv.id === id);
    if (!previous) return;
    const updated = { ...previous, ...updates };
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
    queueUpdate("invoices", updated);

    const action =
      updates.status && updates.status !== previous.status
        ? updates.status === "Cancelled"
          ? "Cancelled invoice"
          : `Marked invoice ${updates.status.toLowerCase()}`
        : "Updated invoice";

    recordAudit({
      action,
      entityType: "Invoice",
      entityId: id,
      entityLabel: updated.invoiceNo,
      description:
        updates.status && updates.status !== previous.status
          ? `Changed invoice ${updated.invoiceNo} from ${previous.status} to ${updated.status}.`
          : `Updated invoice ${updated.invoiceNo}.`,
      metadata: { status: updated.status, total: updated.total, slipCount: updated.slipIds?.length || 0 },
    });
  }, [invoices, queueUpdate, recordAudit]);

  // -----------------------------------------------------------------------
  // Company Settings & Materials
  // -----------------------------------------------------------------------

  /** Persists the full settings object, ensuring every material has `isActive`.
   *  Bypasses the Admin role guard when called during first-run setup (no users
   *  exist yet), so the initial admin account can always be saved. */
  const updateCompanySettings = useCallback(async (settings: CompanySettings): Promise<boolean> => {
    const isFirstRunSetup = !companySettings.users || companySettings.users.length === 0;
    if (!isAdmin(userRole) && !isFirstRunSetup) return false;
    const normalised = {
      ...settings,
      materials: (settings.materials || []).map((m) => ({
        ...m,
        isActive: m.isActive ?? true,
      })),
    };
    setCompanySettings(normalised);
    queueUpdate("companySettings", normalised);
    recordAudit({
      action: "Updated settings",
      entityType: "Settings",
      entityLabel: normalised.name || "Company settings",
      description: "Updated company settings.",
      metadata: {
        userCount: normalised.users?.length || 0,
        materialCount: normalised.materials?.length || 0,
        theme: normalised.theme,
        invoiceTemplate: normalised.invoiceTemplate,
      },
    });
    return flushSyncQueue();
  }, [userRole, queueUpdate, recordAudit, flushSyncQueue]);

  /** Toggles a material's active/inactive state by ID. */
  const toggleMaterialActive = useCallback((id: string) => {
    if (!isAdmin(userRole)) return;
    const material = (companySettings.materials || []).find((m) => m.id === id);
    if (!material) return;
    const nextIsActive = material.isActive === false;
    const updatedMaterials = (companySettings.materials || []).map((m) =>
      m.id === id ? { ...m, isActive: nextIsActive } : m,
    );
    const next = { ...companySettings, materials: updatedMaterials };
    setCompanySettings(next);
    queueUpdate("companySettings", next);
    recordAudit({
      action: nextIsActive ? "Activated material" : "Deactivated material",
      entityType: "Material",
      entityId: id,
      entityLabel: material.name,
      description: `${nextIsActive ? "Activated" : "Deactivated"} material ${material.name}.`,
    });
  }, [userRole, companySettings, queueUpdate, recordAudit]);

  // -----------------------------------------------------------------------
  // Customer CRUD
  // -----------------------------------------------------------------------

  /** Appends a new customer to the collection. */
  const addCustomer = useCallback((customer: Customer) => {
    if (!isManagerOrAbove(userRole)) return;
    setCustomers((prev) => [...prev, customer]);
    queueUpdate("customers", customer);
    recordAudit({
      action: "Created customer",
      entityType: "Customer",
      entityId: customer.id,
      entityLabel: customer.name,
      description: `Created customer ${customer.name}.`,
      metadata: { openingBalance: customer.openingBalance },
    });
  }, [userRole, queueUpdate, recordAudit]);

  /** Replaces a customer record in-place by ID. */
  const updateCustomer = useCallback((customer: Customer) => {
    if (!isManagerOrAbove(userRole)) return;
    setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
    queueUpdate("customers", customer);
    recordAudit({
      action: "Updated customer",
      entityType: "Customer",
      entityId: customer.id,
      entityLabel: customer.name,
      description: `Updated customer ${customer.name}.`,
      metadata: { openingBalance: customer.openingBalance, isActive: customer.isActive !== false },
    });
  }, [userRole, queueUpdate, recordAudit]);

  /** Soft-deletes a customer so ledger history is preserved. */
  const deleteCustomer = useCallback((id: string) => {
    if (!isAdmin(userRole)) return;
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    const deactivated = { ...customer, isActive: false };
    setCustomers((prev) => prev.map((c) => (c.id === id ? deactivated : c)));
    queueUpdate("customers", deactivated);
    recordAudit({
      action: "Deactivated customer",
      entityType: "Customer",
      entityId: id,
      entityLabel: customer.name,
      description: `Deactivated customer ${customer.name}.`,
    });
  }, [userRole, customers, queueUpdate, recordAudit]);

  // -----------------------------------------------------------------------
  // Employee CRUD
  // -----------------------------------------------------------------------

  /** Appends a new employee to the salary/advance ledger. */
  const addEmployee = useCallback((employee: Employee) => {
    if (!isAdmin(userRole)) return;
    const normalised = { ...employee, isActive: employee.isActive ?? true };
    setEmployees((prev) => [...prev, normalised]);
    queueUpdate("employees", normalised);
    recordAudit({
      action: "Created employee",
      entityType: "Employee",
      entityId: normalised.id,
      entityLabel: normalised.name,
      description: `Created employee ${normalised.name}.`,
      metadata: {
        role: normalised.role || undefined,
        salaryType: normalised.salaryType,
        salaryAmount: normalised.salaryAmount,
        openingBalance: normalised.openingBalance,
      },
    });
  }, [userRole, queueUpdate, recordAudit]);

  /** Replaces an employee master record in-place by ID. */
  const updateEmployee = useCallback((employee: Employee) => {
    if (!isAdmin(userRole)) return;
    const normalised = { ...employee, isActive: employee.isActive ?? true };
    setEmployees((prev) => prev.map((e) => (e.id === normalised.id ? normalised : e)));
    queueUpdate("employees", normalised);
    recordAudit({
      action: "Updated employee",
      entityType: "Employee",
      entityId: normalised.id,
      entityLabel: normalised.name,
      description: `Updated employee ${normalised.name}.`,
      metadata: {
        role: normalised.role || undefined,
        salaryType: normalised.salaryType,
        salaryAmount: normalised.salaryAmount,
        isActive: normalised.isActive !== false,
      },
    });
  }, [userRole, queueUpdate, recordAudit]);

  /** Soft-deletes an employee so salary, advance, and deduction history stays intact. */
  const deleteEmployee = useCallback((id: string) => {
    if (!isAdmin(userRole)) return;
    const employee = employees.find((e) => e.id === id);
    if (!employee) return;
    const deactivated = { ...employee, isActive: false };
    setEmployees((prev) => prev.map((e) => (e.id === id ? deactivated : e)));
    queueUpdate("employees", deactivated);
    recordAudit({
      action: "Deactivated employee",
      entityType: "Employee",
      entityId: id,
      entityLabel: employee.name,
      description: `Deactivated employee ${employee.name}.`,
    });
  }, [userRole, employees, queueUpdate, recordAudit]);

  /** Adds a salary, advance, deduction, or adjustment entry for an employee. */
  const addEmployeeTransaction = useCallback((transaction: EmployeeTransaction) => {
    if (!isAdmin(userRole)) return;
    setEmployeeTransactions((prev) => [...prev, transaction]);
    queueUpdate("employeeTransactions", transaction);
    const employee = employees.find((e) => e.id === transaction.employeeId);
    recordAudit({
      action: "Created employee ledger entry",
      entityType: "EmployeeTransaction",
      entityId: transaction.id,
      entityLabel: employee?.name || transaction.type,
      description: `Created ${transaction.type.toLowerCase()} entry for ${employee?.name || "employee"}.`,
      metadata: {
        employeeId: transaction.employeeId,
        type: transaction.type,
        amount: transaction.amount,
        linkedTransactionId: transaction.linkedTransactionId,
      },
    });
  }, [userRole, employees, queueUpdate, recordAudit]);

  /** Hard-deletes an employee ledger entry. */
  const deleteEmployeeTransaction = useCallback((id: string) => {
    if (!isAdmin(userRole)) return;
    const transaction = employeeTransactions.find((t) => t.id === id);
    setEmployeeTransactions((prev) => prev.filter((t) => t.id !== id));
    queueDelete("employeeTransactions", id);
    if (transaction) {
      const employee = employees.find((e) => e.id === transaction.employeeId);
      recordAudit({
        action: "Deleted employee ledger entry",
        entityType: "EmployeeTransaction",
        entityId: id,
        entityLabel: employee?.name || transaction.type,
        description: `Deleted ${transaction.type.toLowerCase()} entry for ${employee?.name || "employee"}.`,
        metadata: {
          employeeId: transaction.employeeId,
          type: transaction.type,
          amount: transaction.amount,
          linkedTransactionId: transaction.linkedTransactionId,
        },
      });
    }
  }, [userRole, employeeTransactions, employees, queueDelete, recordAudit]);

  // -----------------------------------------------------------------------
  // Slip CRUD
  // -----------------------------------------------------------------------

  /** Appends a new dispatch slip. */
  const addSlip = useCallback((slip: Slip) => {
    setSlips((prev) => [...prev, slip]);
    queueUpdate("slips", slip);
    recordAudit({
      action: "Created slip",
      entityType: "Slip",
      entityId: slip.id,
      entityLabel: slip.vehicleNo,
      description: `Created slip ${slip.id} for ${slip.vehicleNo}.`,
      metadata: {
        status: slip.status,
        materialType: slip.materialType,
        customerId: slip.customerId,
        totalAmount: slip.totalAmount,
      },
    });
  }, [queueUpdate, recordAudit]);

  /** Advances a slip's workflow status (Pending → Loaded → Tallied / Cancelled). */
  const updateSlipStatus = useCallback((id: string, status: Slip["status"]) => {
    const previous = slips.find((s) => s.id === id);
    if (!previous) return;
    const updated = { ...previous, status };
    setSlips((prev) => prev.map((s) => (s.id === id ? updated : s)));
    queueUpdate("slips", updated);
    recordAudit({
      action: status === "Cancelled" ? "Cancelled slip" : "Changed slip status",
      entityType: "Slip",
      entityId: id,
      entityLabel: previous.vehicleNo,
      description: `Changed slip ${id} from ${previous.status} to ${status}.`,
      metadata: { previousStatus: previous.status, status, totalAmount: updated.totalAmount },
    });
  }, [slips, queueUpdate, recordAudit]);

  /** Partially updates a slip by ID (used by EditSlipForm). */
  const updateSlip = useCallback((id: string, updates: Partial<Slip>) => {
    const previous = slips.find((s) => s.id === id);
    if (!previous) return;
    const updated = { ...previous, ...updates };
    setSlips((prev) => prev.map((s) => (s.id === id ? updated : s)));
    queueUpdate("slips", updated);
    recordAudit({
      action: "Updated slip",
      entityType: "Slip",
      entityId: id,
      entityLabel: updated.vehicleNo,
      description: `Updated slip ${id} for ${updated.vehicleNo}.`,
      metadata: {
        status: updated.status,
        materialType: updated.materialType,
        customerId: updated.customerId,
        totalAmount: updated.totalAmount,
        invoiceId: updated.invoiceId,
      },
    });
  }, [slips, queueUpdate, recordAudit]);

  // -----------------------------------------------------------------------
  // Transaction CRUD
  // -----------------------------------------------------------------------

  /** Records a financial transaction (income or expense). */
  const addTransaction = useCallback((transaction: Transaction) => {
    setTransactions((prev) => [...prev, transaction]);
    queueUpdate("transactions", transaction);
    recordAudit({
      action: "Created transaction",
      entityType: "Transaction",
      entityId: transaction.id,
      entityLabel: transaction.category,
      description: `Created ${transaction.type.toLowerCase()} transaction for ${transaction.amount.toLocaleString("en-IN")}.`,
      metadata: {
        type: transaction.type,
        amount: transaction.amount,
        category: transaction.category,
        customerId: transaction.customerId,
        slipId: transaction.slipId,
      },
    });
  }, [queueUpdate, recordAudit]);

  /** Partially updates a transaction by ID. */
  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    const previous = transactions.find((t) => t.id === id);
    if (!previous) return;
    const updated = { ...previous, ...updates };
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
    queueUpdate("transactions", updated);
    recordAudit({
      action: "Updated transaction",
      entityType: "Transaction",
      entityId: id,
      entityLabel: updated.category,
      description: `Updated ${updated.type.toLowerCase()} transaction for ${updated.amount.toLocaleString("en-IN")}.`,
      metadata: { type: updated.type, amount: updated.amount, category: updated.category },
    });
  }, [transactions, queueUpdate, recordAudit]);

  /** Hard-deletes a transaction — only transactions support true deletion. */
  const deleteTransaction = useCallback((id: string) => {
    if (!isManagerOrAbove(userRole)) return;
    const transaction = transactions.find((t) => t.id === id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    queueDelete("transactions", id);
    if (transaction) {
      recordAudit({
        action: "Deleted transaction",
        entityType: "Transaction",
        entityId: id,
        entityLabel: transaction.category,
        description: `Deleted ${transaction.type.toLowerCase()} transaction for ${transaction.amount.toLocaleString("en-IN")}.`,
        metadata: { type: transaction.type, amount: transaction.amount, category: transaction.category },
      });
    }
  }, [userRole, transactions, queueDelete, recordAudit]);

  // -----------------------------------------------------------------------
  // Task CRUD
  // -----------------------------------------------------------------------

  /** Appends a quick-task to the checklist. */
  const addTask = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task]);
    queueUpdate("tasks", task);
    recordAudit({
      action: "Created task",
      entityType: "Task",
      entityId: task.id,
      entityLabel: task.title,
      description: `Created task ${task.title}.`,
    });
  }, [queueUpdate, recordAudit]);

  /** Toggles a task's completed state. */
  const toggleTask = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    queueUpdate("tasks", updated);
    recordAudit({
      action: updated.completed ? "Completed task" : "Reopened task",
      entityType: "Task",
      entityId: id,
      entityLabel: task.title,
      description: `${updated.completed ? "Completed" : "Reopened"} task ${task.title}.`,
    });
  }, [tasks, queueUpdate, recordAudit]);

  /** Hard-deletes a task. */
  const deleteTask = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    queueDelete("tasks", id);
    if (task) {
      recordAudit({
        action: "Deleted task",
        entityType: "Task",
        entityId: id,
        entityLabel: task.title,
        description: `Deleted task ${task.title}.`,
      });
    }
  }, [tasks, queueDelete, recordAudit]);

  // -----------------------------------------------------------------------
  // Derived: Customer Balance (with result cache)
  //
  // Balances are cached in a Map keyed by customerId. The cache is invalidated
  // on every render by rebuilding with fresh data — but since the Map lookup
  // is O(1) and avoids repeated array traversals per customer, the total work
  // across all callers drops from O(customers × data) to O(data) per render.
  // -----------------------------------------------------------------------

  /**
   * Computes a customer's outstanding balance by combining four sources:
   *   1. Opening balance (carried forward from previous books)
   *   2. Un-billed slips (Pending, Loaded, or Tallied — not yet invoiced)
   *   3. Invoices (GST / Cash — excluding cancelled)
   *   4. Manual transactions (payments credited, expenses debited)
   *
   * A positive result means the customer owes money (debit).
   * A negative result means the company owes the customer (advance/credit).
   *
   * The result is memoised per customer across renders via a Map that is
   * rebuilt whenever any of the four source arrays changes reference — so
   * editing a slip's totalAmount (which replaces the slips array) always
   * produces a fresh balance, unlike the old array-length-keyed cache.
   */
  const balanceCacheRef = useRef<Map<string, number>>(new Map());

  // Invalidate the entire per-customer cache when source data changes.
  // This is intentionally placed before getCustomerBalance so the ref reset
  // fires during render, before any subscriber calls getCustomerBalance.
  const prevSlipsRef = useRef(slips);
  const prevInvoicesRef = useRef(invoices);
  const prevTxsRef = useRef(transactions);
  const prevCustomersRef = useRef(customers);
  if (
    prevSlipsRef.current !== slips ||
    prevInvoicesRef.current !== invoices ||
    prevTxsRef.current !== transactions ||
    prevCustomersRef.current !== customers
  ) {
    balanceCacheRef.current = new Map();
    prevSlipsRef.current = slips;
    prevInvoicesRef.current = invoices;
    prevTxsRef.current = transactions;
    prevCustomersRef.current = customers;
  }

  const getCustomerBalance = useCallback((customerId: string): number => {
    if (customerId === "CASH") return 0;

    if (balanceCacheRef.current.has(customerId)) {
      return balanceCacheRef.current.get(customerId)!;
    }

    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return 0;

    // Include Pending, Loaded, and Tallied slips that have not been invoiced
    // so material that left the yard is always reflected in the balance.
    const unbilledSlipTotal = slips
      .filter(
        (s) =>
          s.customerId === customerId &&
          (s.status === "Tallied" || s.status === "Pending" || s.status === "Loaded") &&
          !s.invoiceId,
      )
      .reduce((sum, s) => sum + s.totalAmount, 0);

    const invoiceTotal = invoices
      .filter((inv) => inv.customerId === customerId && inv.status !== "Cancelled")
      .reduce((sum, inv) => sum + inv.total, 0);

    const custTxs = transactions.filter((t) => t.customerId === customerId);
    const incomeTotal = custTxs.filter((t) => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = custTxs.filter((t) => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);

    const balance = cust.openingBalance + unbilledSlipTotal + invoiceTotal + expenseTotal - incomeTotal;
    balanceCacheRef.current.set(customerId, balance);
    return balance;
  }, [customers, slips, invoices, transactions]);

  // -----------------------------------------------------------------------
  // Derived: Employee Balance
  // -----------------------------------------------------------------------

  const employeeBalanceById = useMemo(() => {
    const balances = new Map<string, number>();
    employees.forEach((employee) => balances.set(employee.id, employee.openingBalance));
    employeeTransactions.forEach((tx) => {
      if (!balances.has(tx.employeeId)) return;
      balances.set(tx.employeeId, (balances.get(tx.employeeId) || 0) + getEmployeeTransactionImpact(tx));
    });
    return balances;
  }, [employees, employeeTransactions]);

  const getEmployeeBalance = useCallback((employeeId: string): number => {
    return employeeBalanceById.get(employeeId) || 0;
  }, [employeeBalanceById]);

  // -----------------------------------------------------------------------
  // Admin Utility: Purge
  // -----------------------------------------------------------------------

  /**
   * Permanently removes all soft-deleted (isActive === false) customers,
   * employees, and vehicles from both local state and the server database.
   *
   * Customers that still have slips, invoices, or transactions referencing them
   * are skipped to prevent orphaning financial records. Returns the count of
   * records that were blocked so the UI can surface a warning.
   */
  const purgeInactiveRecords = useCallback((): { purged: number; skipped: number } => {
    if (!isAdmin(userRole)) return { purged: 0, skipped: 0 };

    const inactiveCustomers = customers.filter((c) => c.isActive === false);
    const inactiveEmployees = employees.filter((e) => e.isActive === false);
    const inactiveVehicleIds = vehicles.filter((v) => v.isActive === false).map((v) => v.id);

    let purged = 0;
    let skipped = 0;

    inactiveCustomers.forEach((c) => {
      const hasSlips = slips.some((s) => s.customerId === c.id);
      const hasInvoices = invoices.some((inv) => inv.customerId === c.id);
      const hasTxs = transactions.some((t) => t.customerId === c.id);
      if (hasSlips || hasInvoices || hasTxs) {
        skipped++;
        return;
      }
      setCustomers((prev) => prev.filter((cu) => cu.id !== c.id));
      queueDelete("customers", c.id);
      purged++;
    });

    inactiveEmployees.forEach((e) => {
      const hasLedger = employeeTransactions.some((tx) => tx.employeeId === e.id);
      if (hasLedger) {
        skipped++;
        return;
      }
      setEmployees((prev) => prev.filter((emp) => emp.id !== e.id));
      queueDelete("employees", e.id);
      purged++;
    });

    setVehicles((prev) => prev.filter((v) => v.isActive !== false));
    inactiveVehicleIds.forEach((id) => queueDelete("vehicles", id));
    purged += inactiveVehicleIds.length;

    recordAudit({
      action: "Purged inactive records",
      entityType: "System",
      description: `Purged ${purged} inactive record(s); skipped ${skipped} protected customer(s).`,
      metadata: { purged, skipped },
    });

    return { purged, skipped };
  }, [
    userRole,
    customers,
    employees,
    employeeTransactions,
    vehicles,
    slips,
    invoices,
    transactions,
    queueDelete,
    recordAudit,
  ]);

  // -----------------------------------------------------------------------
  // Provider — value is memoised so reference-equality holds across re-renders,
  // preventing all consumers from re-rendering when unrelated state changes.
  // -----------------------------------------------------------------------

  const contextValue = useMemo<ErpState>(() => ({
    customers,
    employees,
    employeeTransactions,
    slips,
    transactions,
    vehicles,
    invoices,
    tasks,
    auditLogs,
    companySettings,
    isLoading,
    syncStatus,
    userRole,
    session,
    signOut,
    recordAuditEvent: recordAudit,
    updateCompanySettings,
    toggleMaterialActive,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addEmployeeTransaction,
    deleteEmployeeTransaction,
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
    getEmployeeBalance,
    purgeInactiveRecords,
    flushSync: flushSyncQueue,
  }), [
    customers, employees, employeeTransactions, slips, transactions, vehicles, invoices, tasks, auditLogs,
    companySettings, isLoading, syncStatus, userRole, session, signOut,
    recordAudit,
    updateCompanySettings, toggleMaterialActive,
    addCustomer, updateCustomer, deleteCustomer,
    addEmployee, updateEmployee, deleteEmployee,
    addEmployeeTransaction, deleteEmployeeTransaction,
    addVehicle, updateVehicle, deleteVehicle,
    addSlip, updateSlipStatus, updateSlip,
    addInvoice, updateInvoice,
    addTransaction, updateTransaction, deleteTransaction,
    addTask, toggleTask, deleteTask,
    getCustomerBalance, getEmployeeBalance, purgeInactiveRecords, flushSyncQueue,
  ]);

  return (
    <ErpContext.Provider value={contextValue}>
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
