# CrushTrack ERP: Comprehensive Technical & Functional Documentation

This document serves as the absolute source of truth for **CrushTrack ERP**. It is engineered to be highly detailed, covering every file, folder, screen, button, data model, and workflow. It is designed to allow any developer (or AI agent) to immediately understand the system's architecture, business rules, and UI behaviors.

---

## 1. Executive Summary

**CrushTrack ERP** is a specialized, web-based Administrative, Billing, and Dispatch Management platform. It targets material-centric supply chain businesses such as:
- Stone Crushers
- Quarries and Mines
- Aggregate and Sand Suppliers
- Transport and Logistics Agencies
- Construction Material Traders

**Core Value Proposition:**
It bridges the gap between raw weighbridge/dispatch operations and financial accounting. It tracks every truck leaving the facility (Dispatch Slips), manages the exact measurement (Weight in Tonnes or Volume in Brass/Cubic Feet), handles real-time payments, converts raw dispatch data into formal Invoices (GST or Cash), and maintains rigorous Customer Ledgers via a dual-entry-like Daybook and Financial Transaction system.

---

## 2. Technical Stack & Architecture

- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (Mobile-first, fully responsive)
- **Icons:** `lucide-react`
- **State Management:** React Context API (`src/context/ErpContext.tsx`). The app uses an in-memory/local-state approach for the current demo, structured identically to a real NoSQL or normalized relational database schema.
- **Routing:** React Router DOM (v6)
- **Utilities:** 
  - `date-fns` (Date manipulation)
  - `to-words` (Currency to Text, Indian format)

### 2.1 Directory Structure & File Manifest

*   **`src/`**: The main source directory.
    *   **`App.tsx`**: The root React component. Mounts `ErpProvider` and defines the React Router `<Routes>`.
    *   **`main.tsx`**: The entry point. Mounts the React app to the HTML DOM element.
    *   **`types.ts`**: The central TypeScript interfaces mapping the entire database schema (see Section 3).
    *   **`index.css`**: Global Tailwind imports and base CSS rules.
    *   **`components/`**: Reusable generic pieces of the UI.
        *   **`layout/`**: Structural components.
            *   `Layout.tsx`: The main wrapper containing Sidebar/Navbar and the main content outlet `<Outlet />`.
            *   `Sidebar.tsx`: The vertical navigation menu detailing all primary routes.
        *   **`ui/`**: Low-level atomic components.
            *   `Combobox.tsx`: An autocomplete dropdown for selecting existing customers or entering new ones.
            *   `ConfirmationModal.tsx`: A generic dialog for confirming destructive actions (Delete/Cancel).
        *   **`forms/`**: Complex user input systems.
            *   `CreateSlipForm.tsx` & `EditSlipForm.tsx`: Handlers for Dispatch Slips.
            *   `CreateInvoiceForm.tsx`: Generator for Invoices.
            *   `TransactionForm.tsx`: Generator for Income/Expense entries.
            *   `PrintSlipModal.tsx` & `PrintInvoiceModal.tsx`: The print-preview interfaces containing `@media print` CSS logic for A4/Thermal generation.
    *   **`context/`**: State management.
        *   `ErpContext.tsx`: The global state provider, injecting CRUD operations to the rest of the app.
    *   **`pages/`**: The top-level screens accessed via the Sidebar.
        *   `Dashboard.tsx`
        *   `Slips.tsx`
        *   `Invoices.tsx`
        *   `Customers.tsx`
        *   `Finances.tsx`
        *   `Daybook.tsx`
        *   `Settings.tsx`
    *   **`lib/`**: Helpers and external integrations.
        *   `print-utils.ts`: Scripts bridging the DOM to native print or PDF download APIs.
        *   `utils.ts`: General helper utilities (e.g., `cn()` for Tailwind class merging).

---

## 3. Data Models (Schema Definition)

Defined in `src/types.ts`.

### 3.1 `CompanySettings`
Stores global tenant configuration.
- `name`, `address`, `phone`, `gstin`: Basic contact info.
- `logo`: Base64 or URL string of the company logo.
- `bankName`, `accountNumber`, `ifscCode`: Financial routing details printed on invoices.
- `primaryColor`: A hex code or tailwind color name (e.g., 'emerald', 'blue') that themes the PDFs.
- `invoiceFormat`: The default paper size (`A4`, `Thermal-80mm`, `Thermal-58mm`).
- Arrays of allowed master strings: `materials`, `vehicles`, `expenseCategories`.

### 3.2 `Customer`
The CRM entity.
- `id`, `name`, `phone`, `address`, `gstin`, `email`.
- `openingBalance`: The initial debt (+) or credit (-) before using the software.

### 3.3 `Slip` (Dispatch Record/Challan)
The backbone data structure of the operations.
- `id`: Primary key.
- `slipNumber`: Sequential, human-readable ID (e.g., "SLP-0010").
- `date`: ISO Date string.
- `customerId`: Foreign key to Customer.
- `vehicleNo`: String of the truck plate.
- `deliveryMode`: Enum `"Company Vehicle" | "Third-Party Vehicle"`.
- `materialType`: Selected from master list.
- `measurementType`: Enum `"Volume (Brass)" | "Weight (Tonnes)"`.
- **Measurement Fields:** 
  - Weight: `grossWeight`, `tareWeight`, `netWeight`.
  - Volume: `length`, `width`, `height`, `quantity`.
- `rate`: Price per Tonne/Brass.
- `totalAmount`: Rate * Net/Quantity.
- `freightAmount`: Cost of transport (if third-party and not Cash).
- `amountPaid`: Upfront cash paid on the spot.
- `status`: Lifecycle state (`Pending` -> `Loaded` -> `Tallied`).
- `isBilled`: Boolean. Becomes `true` when attached to an Invoice.

### 3.4 `Invoice` (Formal Bill)
- `id`, `invoiceNo`, `date`, `customerId`.
- `type`: Enum `"GST" | "Cash"`.
- `items`: Array of Line Items. An item can either reference a previously unbilled Slip or be an arbitrary "direct" item.
- `subtotal`: Sum of all item amounts.
- `cgst`, `sgst`, `igst`: Tax values based on percentages.
- `total`: Final grand total.
- `status`: Enum `"Paid" | "Unpaid" | "Overdue"`.
- `linkedSlipIds`: Array of slip IDs that are part of this invoice, proving they are now "Billed".

### 3.5 `Transaction` (Financial Ledger Entry)
- `id`, `date`.
- `type`: Enum `"Income" | "Expense" | "Advance"`.
- `amount`: Numeric value.
- `category`: Selected from master list (e.g., Fuel, Salary).
- `customerId?`: Optional foreign key. If present, this modifies the customer's ledger balance.
- `paymentMethod`: `"Cash" | "UPI" | "Bank Transfer"`.

---

## 4. UI/UX & Screen-by-Screen Breakdown

### 4.1 Global Layout (`Layout.tsx` & `Sidebar.tsx`)
- **Desktop:** Left-aligned permanent Sidebar. User navigates by clicking `lucide-react` icons combined with text labels.
- **Mobile:** Sidebar collapses under a hamburger menu.
- **Responsive Topbar:** Appears on mobile to house the hamburger menu and the page title.

### 4.2 Dashboard (`/`)
*Purpose: Executive overview.*
- **Top Metrics Cards:**
  - `Today's Revenue`: Sum of `amountPaid` from today's slips + non-slip income.
  - `Total Dispatch`: Total quantities shipped today, separated by Tonnes and Brass.
  - `Active Customers`: Total number of saved clients.
  - `Pending Receivables`: Total outstanding balances across all customer ledgers.
- **Quick Actions (Buttons):** "+ New Slip", "+ New Invoice", "+ Add Payment". They invoke forms over the UI.
- **Recent Activity Tables:** Lists the 5 most recent `Slips` and 5 most recent `Transactions`.

### 4.3 Dispatch Slips (`/slips`)
*Purpose: Managing the weighbridge & site exits.*
- **Header:** Title and "+ Create Slip" button.
- **Filter Bar:** 
  - `Search`: Text input against vehicle number or customer name.
  - `Status Dropdown`: All, Pending, Loaded, Tallied.
  - `Date Dropdown`: All Time, Today, This Week, This Month.
- **Data Table Elements:** Date, Slip #, Customer, Vehicle, Material, Qty, Rate, Amount, Status Badge, Actions.
- **Actions Column (Buttons):**
  - **Edit (Pen Icon):** Opens `EditSlipForm`.
  - **Print (Printer Icon):** Opens `PrintSlipModal`.
  - **Delete (Trash Icon):** Invokes Confirmation Modal.

#### **Form Logic: Create/Edit Slip (`CreateSlipForm.tsx`)**
- **Customer Selection:** Uses the `Combobox`. Allows typing to search or selecting "Cash".
- **Dynamic Fields Mapping:**
  - If Measurement = `"Weight (Tonnes)"`: Renders Gross Weight and Tare Weight inputs. Net Weight calculates dynamically (`Gross - Tare`). Asserts Gross > Tare and neither are negative.
  - If Measurement = `"Volume (Brass)"`: Renders L, W, H inputs. Quantity calculates `(L*W*H)/100` (Standard brass conversion).
- **Payment Handling:** Entering `amountPaid`. If `amountPaid` > 0, it asks to confirm if it should be an upfront cash entry.

### 4.4 Invoices (`/invoices`)
*Purpose: Grouping dispatches into legal taxing documents.*
- **Header:** "+ Create Invoice" button.
- **Tabs (Sub-navigation):** Buttons to toggle between `All`, `GST Invoices`, and `Cash Invoices`.
- **Data Table Elements:** Date, Invoice #, Customer, Type, Total Amount, Status (Paid/Unpaid), Actions.
- **Actions Column:** Edit, Print/Download (Printer Icon), Cancel.

#### **Form Logic: Create/Edit Invoice (`CreateInvoiceForm.tsx`)**
- **Type Selection dropdown:** Chooses GST vs. Cash.
- **Customer Selector.**
- **The "Load Unbilled Slips" Button:**
  - *Crucial Workflow:* When clicked, the app queries all `Slips` where `customerId === selectedCustomer` AND `isBilled === false`.
  - It pushes each slip into the invoice's `items` array, auto-populating Material, Qty, and Rate.
- **Line Items Grid (Dynamic List):**
  - Users can click "+ Add Item" to manually add a row.
  - Responsive stack: On mobile, line items render vertically as cards. On Desktop, they render as a standard `<table data-th>`.
  - Auto-calculates Amount = Qty * Rate.
- **GST Section:** If Type = "GST", shows inputs for IGST, CGST, SGST percentages and auto-calculates total tax.

### 4.5 Customers (`/customers`)
*Purpose: CRM and Ledger Account Tracking.*
- **Header:** "+ Add Customer".
- **Customer Cards (Grid Layout):** Displays name, phone, GSTIN. Clicking a card opens the **Ledger View**.

#### **Detailed Ledger View (Customer Details)**
This is the core financial engine of the Customer.
- **Sidebar Details:** Contact info, "Total Balance" summary (Red text if negative/credit, Green if positive/debit), Action Buttons ("Edit Info", "Delete").
- **Date Filters & Sorting:** Start Date, End Date, Type (Credit/Debit), Sort Order.
- **Timeline / Ledger Table:**
  - *Calculation Rule:* The system reconstructs the history chronologically. It grabs:
    1. Base `openingBalance`.
    2. All `Invoices` for this customer (Increases amount due).
    3. All *Unbilled* `Slips` for this customer (Increases amount due). *Note: Billed slips are excluded here because the Invoice already holds their value.*
    4. All `Transactions` linked to this customer (Usually Income payments, which decrease the amount due).
  - It sorts them by `date` and calculates a continuous `Running Balance` for every row.
- **Statement Generation:** The user can click a "Print/PDF" button to export this exact filtered timeline as a professional PDF sent for collections.

### 4.6 Finances (`/finances`)
*Purpose: Ledger entry creation.*
- **Header:** "+ Add Income", "+ Add Expense".
- **Filter Bar:** Date Range, Type Filter (Income/Expense/Advance), Chart of Accounts / Categories filter.
- **Data Table:** Date, Type Badge (Green Income, Red Expense), Category, Linked Customer (optional), Amount.

#### **Transaction Form (`TransactionForm.tsx`)**
- Inputs for Amount, Date, Payment Method.
- **Customer Link Dropdown:** Crucial feature. If an Income transaction selects "John Doe", John Doe's ledger gets a payment credited to it.

### 4.7 Daybook (`/daybook`)
*Purpose: Cashier and Manager's daily handover snapshot.*
- **Date Controls:** `Start Date` and `End Date` inputs.
- **Cash Flow Summary (Top Cards):**
  - `Cash In`: Sum of all `Income` transactions + `amountPaid` upfront from slips during the period.
  - `Cash Out`: Sum of all `Expense` transactions.
  - `Net Cash Flow`: In - Out.
- **Combined Timeline:** A heavily stylized chronological list. It merges `Slips` and `Transactions` into one continuous feed. Slips show truck logic, Transactions show finance logic. Helps find discrepancies ("Did we enter the fuel expense before the stone truck left?").

### 4.8 Settings (`/settings`)
*Purpose: Global application configuration.*
- **Tabs Interface:** Left-side buttons toggling between forms.
- **General Info Tab:**
  - Inputs for Company Name, Address, GSTIN, Phone.
  - **Company Logo Uploader:** Uses a hidden `<input type="file" accept="image/*">`, reads with `FileReader`, converts to `Base64` and saves to Context. Renders a preview.
- **Bank Details Tab:** Bank Name, Account Number, IFSC.
- **Print Settings Tab:**
  - Select default `format` (A4, 80mm, 58mm).
  - Select `primaryColor`.
- **Categories Tab:** Simple inputs to add strings to global arrays.
  - "Materials" used in Slips.
  - "Expense Categories" used in Finances.
  - "Vehicles" used in Slips.

---

## 5. In-Depth Specific Behaviors

### 5.1 The Printing Subsystem (`PrintSlipModal` & `PrintInvoiceModal`)
Instead of a heavy PDF generation library like `pdfmake` or `jsPDF` which struggle with complex CSS grids, CrushTrack uses a **DOM-to-Print approach**.
1. When "Print" is clicked, a fullscreen Modal covers the screen.
2. Inside the Modal, the document (A4 or thermal) is rendered as standard HTML/Tailwind.
3. **Dynamic Styling:** Inline styles are injected based on the `Settings` menu. Example: `style={{ borderColor: primaryColorHex }}`.
4. **Thermal Scaling:** Using `max-w-[80mm]` and `text-xs` to ensure strings fit within point-of-sale receipt widths.
5. **Print Action:** A floating Action Bar triggers `window.print()`. The global `index.css` contains strict `@media print` rules:
   - Elements outside the modal are set to `display: none!important`.
   - Form buttons, Action Bars are hidden.
   - Page margins are overridden to `0` or `1cm` depending on the format.
6. **Amount to Words:** Invokes the `ToWords` class (`to-words` npm package) to parse e.g. `2500.50` into "Two Thousand Five Hundred Rupees And Fifty Paise Only".

### 5.2 Form Validations & Constraints
The system strictly prohibits bad states to maintain ERP integrity:
- **Weights:** Cannot be `< 0`. Tare weight cannot be `> Gross Weight`.
- **Slips editing Invoices:** If a Slip is marked `isBilled = true`, its quantity or material type generally cannot be drastically altered without canceling the parent invoice, preventing a mismatch where the Slip says 20 Tonnes but the Invoice billed for 15. The UI may enforce readonly states or warnings here.
- **Delete Cascades:** Attempting to delete a Customer will warn if they have linked Slips/Invoices, preserving referential integrity.

### 5.3 Modularity and Refactoring Concepts
- Every UI table is responsive: Wrapping in `overflow-x-auto` to allow horizontal swipe on small screens.
- Forms extensively use conditional rendering (e.g., `{formData.measurementType === 'Weight' && (<WeightInputs/>)}`).

---
*(End of Detailed Documentation)*
