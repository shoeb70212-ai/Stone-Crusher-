# 🏗️ CrushTrack ERP: Advanced Stone Crusher Management System

[![Vercel Deployment](https://img.shields.io/badge/Deployment-Vercel-black?logo=vercel)](https://stone-crusher-topaz.vercel.app/)
[![React Version](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**CrushTrack ERP** is a professional, high-performance Administrative and Billing platform tailored for material-centric industries like Stone Crushers, Quarries, and Logistics. It streamlines the lifecycle of dispatch operations—from the weighbridge to the final GST-compliant invoice.

---

## 🌟 Key Features

### 🚛 Intelligent Dispatch Management
- **Universal Measurement Support**: Handle loads in both **Weight (Tonnes)** and **Volume (Brass/CFT)**.
- **Industry-Specific Logic**: Built-in support for `Feet.Inches` notation (e.g., `5.6` = 5ft 6in) for accurate volume calculations.
- **Real-time Status Tracking**: Monitor slips from *Pending* to *Loaded* to *Tallied*.

### 🧾 Professional Billing Engine
- **One-Click Invoicing**: Group multiple unbilled dispatch slips into a single legal invoice.
- **GST & Cash Modes**: Toggle between formal GST-taxed bills and simplified cash receipts.
- **Dual PDF Templates**:
    - **A4 Classic**: For desktop printing and professional archives.
    - **Thermal (80mm/58mm)**: High-speed receipts for site exits.
- **Auto-Calculations**: Automatic tax (CGST/SGST/IGST), sub-totals, and "Amount to Words" conversion in Indian format.

### 📈 Financial Intelligence
- **Dynamic Ledger Accounts**: Real-time running balances for every customer.
- **Daybook Feed**: A consolidated chronological history of all truck movements and financial payments.
- **Balance Sheets**: Instantly see pending receivables and today's total revenue.

### 📱 Native-Feel Mobile Experience
- **Adaptive UI**: Fixed bottom navigation bar for mobile users.
- **Touch-Optimized Forms**: Full-screen modals and card-based lists replace complex desktop tables on small screens.
- **Print Anywhere**: Client-side PDF generation ensures perfect scaling on any device.

---

## 🛠️ Technical Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4.
- **Backend**: Vercel Serverless Functions (Node.js).
- **Database**: PostgreSQL (Production) / Local JSON Simulation (Dev).
- **State Management**: React Context API with Optimistic Delta Sync via custom PATCH endpoint.
- **Security**: Local-first Authentication interceptor (easily swappable with Firebase/Supabase).
- **PDF Engine**: `html2pdf.js` for lightweight, client-side rendering.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/shoeb70212-ai/Stone-Crusher-.git
   cd Stone-Crusher-
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Start the local development server with integrated backend simulation:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`. Changes are saved to `local-data.json`.

### Production Deployment
The app is optimized for Vercel. Ensure you set the `DATABASE_URL` environment variable for your PostgreSQL instance.
```bash
vercel deploy --prod
```

---

## 📂 Project Structure
- `/src/context/ErpContext.tsx`: The "Brain" of the app; handles all data logic and syncing.
- `/src/pages/`: Modular screens (Dashboard, Slips, Invoices, Customers, etc.).
- `/api/data.ts`: Production Vercel Function for cloud database synchronization.
- `server.ts`: Local development server proxy.

---

## 📜 License
Internal ERP - Confidential.

---
*Built with ❤️ for the Stone Crusher Industry.*
