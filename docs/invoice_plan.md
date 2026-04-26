# Invoice Module Optimization Plan

## 1. Objectives
- **Export Utility Upgrade**: Remove raw JSON export and replace it with a user-friendly format for Chartered Accountants (CA). We will implement a CSV/Excel export function that aggregates invoice data logically (Invoice No, Date, Customer Name, Type, SubTotal, CGST, SGST, Total Amount).
- **Advanced Filtering**: Add date range (Start Date to End Date) and Customer filters to the invoice view, preventing the UI from showing "everything at a glance". This provides better usability for long-term invoice tracking.
- **UI/UX Optimization**: Ensure the Invoicing portal matches the modern, crisp, non-cluttered style of the rest of the application. The logic and mathematics underlying the tax calculation will be rigorously validated.
- **Mobile Readability**: Ensure the Invoice printing format (`PrintInvoiceModal`) renders cleanly and responsibly on mobile phone dimensions.

## 2. Implementation Steps

### Phase 1: CSV Export for CAs
- Replace the existing JSON export logic in `Invoices.tsx`.
- Create a `handleExportExcel` utility.
- Map the `invoices` array into an array of objects representing CA-friendly columns.
- Use native browser `Blob` and URL-based downloading to save as `.csv` (Excel readable).

### Phase 2: Advanced Search & Filtering
- Add `startDate`, `endDate`, and `filterCustomerId` state variables to `Invoices.tsx`.
- Include a filter header below the tabs in the main view.
- Update the filtering logic before rendering the invoice table, allowing the user to drill down to specific timeframes or specific customers.

### Phase 3: UI and Logic Validation
- Double check GST calculation (CGST + SGST) logic to ensure it perfectly splits the item GST rate.
- Optimize table columns to be responsive (hidden on mobile, visible on desktop).
