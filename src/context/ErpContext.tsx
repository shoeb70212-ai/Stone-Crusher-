import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Customer, Slip, Transaction, Vehicle, Invoice, CompanySettings, Task } from "../types";

export type UserRole = "Admin" | "Partner" | "Manager";

interface ErpState {
  customers: Customer[];
  slips: Slip[];
  transactions: Transaction[];
  vehicles: Vehicle[];
  invoices: Invoice[];
  tasks: Task[];
  companySettings: CompanySettings;
  updateCompanySettings: (settings: CompanySettings) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  addSlip: (slip: Slip) => void;
  updateSlipStatus: (id: string, status: Slip["status"]) => void;
  updateSlip: (id: string, updates: Partial<Slip>) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addTask: (task: Task) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (vehicle: Vehicle) => void;
  addInvoice: (invoice: Invoice) => void;
  getCustomerBalance: (customerId: string) => number;
}

const mockCustomers: Customer[] = [
  {
    id: "1",
    name: "Ramesh Builders",
    phone: "9876543210",
    openingBalance: 50000,
  },
  {
    id: "2",
    name: "Shiva Construction",
    phone: "9876543211",
    openingBalance: -10000,
  },
];

const mockSlips: Slip[] = [
  {
    id: "s1",
    date: new Date().toISOString(),
    vehicleNo: "MH 14 AB 1234",
    driverName: "Ramu",
    driverPhone: "9876543210",
    materialType: "20mm",
    deliveryMode: "Third-Party Vehicle",
    measurementType: "Volume (Brass)",
    measurement: { lengthFeet: 10, widthFeet: 5, heightFeet: 2 },
    quantity: 1, // 100 sq ft / 100 = 1 brass
    ratePerUnit: 3500,
    freightAmount: 0,
    totalAmount: 3500,
    customerId: "1",
    status: "Pending",
    notes: "",
  },
];

const mockTransactions: Transaction[] = [
  {
    id: "t1",
    date: new Date().toISOString(),
    type: "Expense",
    amount: 1500,
    category: "Diesel",
    description: "Diesel for generator",
  },
];

const mockVehicles: Vehicle[] = [
  {
    id: "v1",
    vehicleNo: "MH 14 AB 1234",
    ownerName: "Ramu Logistics",
    defaultMeasurementType: "Volume (Brass)",
    measurement: { lengthFeet: 10, widthFeet: 5, heightFeet: 2 },
  },
];

const ErpContext = createContext<ErpState | undefined>(undefined);

export function ErpProvider({ children }: { children: ReactNode }) {
  // State initialized with empty arrays. Initial data will be loaded from the server.
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
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
    ]
  });
  const [userRole, setUserRole] = useState<UserRole>("Admin");
  const [isLoaded, setIsLoaded] = useState(false);

  // Initial Load
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const data = await res.json();
          if (data.customers) setCustomers(data.customers);
          if (data.slips) setSlips(data.slips);
          if (data.transactions) setTransactions(data.transactions);
          if (data.vehicles) setVehicles(data.vehicles);
          if (data.invoices) setInvoices(data.invoices);
          if (data.tasks) setTasks(data.tasks);
          if (data.companySettings) setCompanySettings(data.companySettings);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load data from server:", error);
        // Fallback to localStorage if server is unavailable
        const saved = localStorage.getItem("erp_data_backup");
        if (saved) {
           const data = JSON.parse(saved);
           setCustomers(data.customers || []);
           // ... (rest of fallback)
        }
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  // Sync to Server
  useEffect(() => {
    if (!isLoaded) return;

    const data = {
      customers,
      slips,
      transactions,
      vehicles,
      invoices,
      tasks,
      companySettings
    };

    // Save to local backup just in case
    localStorage.setItem("erp_data_backup", JSON.stringify(data));

    const sync = async () => {
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (error) {
        console.error("Failed to sync to server:", error);
      }
    };

    const timer = setTimeout(sync, 1000); // Debounce sync
    return () => clearTimeout(timer);
  }, [customers, slips, transactions, vehicles, invoices, tasks, companySettings, isLoaded]);

  useEffect(() => {
    localStorage.setItem("erp_userRole", JSON.stringify(userRole));
  }, [userRole]);

  const addVehicle = (vehicle: Vehicle) =>
    setVehicles((prev) => [...prev, vehicle]);

  const updateVehicle = (vehicle: Vehicle) =>
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicle.id ? vehicle : v)),
    );

  const addInvoice = (invoice: Invoice) =>
    setInvoices((prev) => [...prev, invoice]);

  const updateInvoice = (id: string, updates: Partial<Invoice>) =>
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)),
    );

  const updateCompanySettings = (settings: CompanySettings) => setCompanySettings(settings);

  const addCustomer = (customer: Customer) =>
    setCustomers((prev) => [...prev, customer]);

  const updateCustomer = (customer: Customer) =>
    setCustomers((prev) =>
      prev.map((c) => (c.id === customer.id ? customer : c)),
    );

  const deleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  const addSlip = (slip: Slip) => {
    setSlips((prev) => [...prev, slip]);
    // If it's a credit sale (assigned to customer), it should ideally reflect in balance after delivery/invoice
    // We'll keep it simple: slips don't automatically deduct balance until a 'Transaction' is added or it's tallied
  };

  const updateSlipStatus = (id: string, status: Slip["status"]) => {
    setSlips((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return { ...s, status };
        }
        return s;
      }),
    );
  };

  const updateSlip = (id: string, updates: Partial<Slip>) => {
    setSlips((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const addTransaction = (transaction: Transaction) => {
    setTransactions((prev) => [...prev, transaction]);
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const addTask = (task: Task) => {
    setTasks((prev) => [...prev, task]);
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const getCustomerBalance = (customerId: string) => {
    if (customerId === "CASH") return 0;
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return 0;
    
    // 1. Un-billed Slips (these are pending invoices but are already delivered/loading)
    const custSlips = slips.filter(
      (s) => s.customerId === customerId && (s.status === "Tallied" || s.status === "Pending") && !s.invoiceId,
    );
    const slipTotal = custSlips.reduce((sum, s) => sum + s.totalAmount, 0);

    // 2. All Invoices (GST/Cash Invoices)
    const custInvoices = invoices.filter(
      (inv) => inv.customerId === customerId && inv.status !== "Cancelled"
    );
    const invoiceTotal = custInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // 3. Manual Transactions (Payments/Advances)
    const custTxs = transactions.filter((t) => t.customerId === customerId);
    const incomeTotal = custTxs
      .filter((t) => t.type === "Income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = custTxs
      .filter((t) => t.type === "Expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Balance = Opening + Deliveries (unbilled) + Invoices + Expenses (debits) - Payments (credits)
    return cust.openingBalance + slipTotal + invoiceTotal + expenseTotal - incomeTotal;
  };

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
        updateCompanySettings,
        updateInvoice,
        userRole,
        setUserRole,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addSlip,
        updateSlipStatus,
        updateSlip,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addTask,
        toggleTask,
        deleteTask,
        addVehicle,
        updateVehicle,
        addInvoice,
        getCustomerBalance,
      }}
    >
      {children}
    </ErpContext.Provider>
  );
}

export function useErp() {
  const context = useContext(ErpContext);
  if (context === undefined) {
    throw new Error("useErp must be used within an ErpProvider");
  }
  return context;
}
