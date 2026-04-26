# Stone Crusher ERP - Feature & Screen Directory

This document provides a line-by-line breakdown of every screen and the logic behind each feature in the application.

## 1. Dashboard (`src/pages/Dashboard.tsx`)
- **Stats Grid**: Displays "Slips Generated", "Pending Tallies", "Daily Revenue", and "Active Vehicles". Data is calculated by filtering the `slips` and `transactions` arrays for the current date.
- **Volume Chart**: A visual representation of material volume dispatched over the last 7 days.
- **Pending Actions**: A quick-list of slips that are marked as "Loaded" but not yet "Tallied", requiring attention.

## 2. Dispatch Slips (`src/pages/Dispatch.tsx`)
- **Status Workflow**:
    - **Pending**: Initial state when a vehicle is registered at the gate.
    - **Loaded**: Updated when the operator confirms the material is filled.
    - **Tallied**: The final state where the exact weight or brass volume is confirmed by the supervisor.
- **Filtering**: Users can filter the dispatch list by Date Range (From/To), Material Type, and Customer Name.
- **Quick Action Buttons**: "Mark Loaded" and "Tally" buttons appear dynamically based on the current status of the slip.

## 3. Invoices (`src/pages/Invoices.tsx`)
- **Generation Logic**:
    - **Auto-Fill**: Selecting a customer and material type allows the user to see a list of un-invoiced slips.
    - **GST vs Cash**: 
        - GST mode adds 5% total tax (2.5% SGST + 2.5% CGST) and requires a GSTIN.
        - Cash mode is a direct bill without tax overhead.
- **Professional Templates**: The PDF template includes a auto-converted "Amount in Words" field, custom company logo, and editable Terms & Conditions.
- **Status Tracking**: Invoices can be marked as "Pending", "Paid", or "Cancelled" to track accounts receivable.

## 4. Customer Directory (`src/pages/Customers.tsx`)
- **Profile Management**: Stores Name, Phone, Address, and GSTIN.
- **Opening Balance**: Allows the user to set a starting balance for existing customers when migrating to this ERP.
- **Ledger System**: 
    - The "Statement" view is the most complex logic in the app. 
    - It iterates through ALL Slips, Invoices, and Payments for a specific customer.
    - It calculates a "Running Balance" chronologically so the user can see exactly when a customer's debt increased or decreased.

## 5. Master Ledger (`src/pages/Ledger.tsx`)
- **Income/Expense Tracking**: A general-purpose accounting log for everything not covered by customer billing (e.g., machinery maintenance, employee salary, fuel).
- **Categories**: Transactions are categorized (e.g., Fuel, Salary, Sales) for easier reporting in future modules.

## 6. Vehicle Management (`src/pages/Vehicles.tsx`)
- **Registry**: Keeps a list of active vehicles, their owners, and default drivers.
- **Auto-Complete**: When generating a slip, typing a vehicle number will auto-fill the associated owner and driver information to save time.

## 7. Global Settings (`src/pages/Settings.tsx`)
- **Material Pricing**: Define the "Base Rate" for each material. These rates are used as defaults in new slips.
- **Company Branding**: Upload a logo and set the primary theme color (Emerald, Blue, Violet, Rose, Amber). These choices affect the entire UI and the PDF documents.
- **Security**: Basic User Role switching (Admin, Partner, Manager) to test different permissions.

## 8. Data Synchronization (`src/context/ErpContext.tsx`)
- **Central Storage**: Uses React Context to provide data to all screens.
- **Sync Engine**: 
    - Every time a state change occurs (e.g., `addSlip`), a background `syncWithCloud` function is triggered.
    - This function sends the change to `api/data.ts` to update the PostgreSQL database.
    - It also handles "Offline Detection" (though advanced offline queuing is a future roadmap item).
