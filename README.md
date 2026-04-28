# 🏗️ CrushTrack ERP - Stone Crusher Management System

[![Vercel Deployment](https://img.shields.io/badge/Deployment-Vercel-black?logo=vercel)](https://stone-crusher-topaz.vercel.app/)
[![React Version](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)

**CrushTrack ERP** is a comprehensive, production-ready Enterprise Resource Planning system designed specifically for stone crusher, quarry, and material logistics businesses. It manages the complete dispatch workflow—from vehicle entry at the gate to final invoicing.

---

## ✨ Features

### 🚛 Dispatch Management
- **Multi-Mode Measurement**: Support for both Weight (Tonnes) and Volume (Brass/CFT)
- **Smart Dimension Input**: `5.6` format for 5ft 6in dimensions
- **Status Workflow**: Pending → Loaded → Tallied
- **Vehicle Auto-Fill**: Pre-populated owner/driver details

### 🧾 Billing & Invoicing
- **GST & Cash Modes**: 5% GST (CGST+SGST) or direct cash bills
- **Multiple Print Formats**: A4, Thermal-80mm, Thermal-58mm
- **Invoice Templates**: Classic, Modern, Minimal
- **Auto Amount-to-Words**: Indian currency format conversion

### 💰 Financial Tracking
- **Customer Ledger**: Running balance with full statement history
- **Daybook Transactions**: Income/Expense tracking with categories
- **Dashboard Analytics**: Daily revenue, pending tallies, active vehicles
- **Export Options**: CSV and PDF export for all reports

### 👥 User Management
- **Role-Based Access**: Admin, Partner, Manager roles
- **User Activation/Deactivation**: Enable/disable user accounts
- **Secure Password Storage**: SHA-256 hashed passwords

### 📱 Mobile Experience
- **Responsive Design**: Optimized layouts for mobile and tablet
- **Touch-Friendly UI**: Large tap targets and bottom navigation
- **Print Anywhere**: Client-side PDF generation

---

## 🏗️ Architecture

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| State | React Context + Optimistic Delta Sync |
| Backend | Express.js (Dev) / Vercel Serverless (Prod) |
| Database | PostgreSQL (Prod) / JSON File (Dev) |
| PDF | html2pdf.js |

### Data Flow
```
User Action → React Context → Optimistic UI Update
                                ↓
                         Delta Sync Queue (1.5s debounce)
                                ↓
                         PATCH /api/data → Server
```

### Key Modules
- **ErpContext** - Central state management with CRUD operations
- **Delta Sync Engine** - Collision-safe incremental updates
- **Print Utils** - DOM-to-PDF bridge for all print formats
- **Auth Module** - Role-based access control

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm v9+

### Installation
```bash
# Clone the repository
git clone https://github.com/shoeb70212-ai/Stone-crusher-29-04.git
cd Stone-crusher-29-04

# Install dependencies
npm install
```

### Development
```bash
# Start development server (Express + Vite on port 5173)
npm run dev
```

### Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite) |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type checking |

---

## 📁 Project Structure

```
Stone-Crusher/
├── api/
│   └── data.ts              # API endpoints (dev + prod)
├── src/
│   ├── components/
│   │   ├── forms/           # Form components (CreateSlip, PrintInvoice, etc.)
│   │   ├── ui/              # UI components (Modal, Toast, etc.)
│   │   ├── Layout.tsx       # Main layout wrapper
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   └── Login.tsx        # Authentication
│   ├── context/
│   │   └── ErpContext.tsx   # Global state & sync engine
│   ├── lib/
│   │   ├── utils.ts         # Utilities (parseFeetInches, cn)
│   │   ├── print-utils.ts  # PDF generation
│   │   ├── auth.ts          # Password hashing
│   │   └── validation.ts   # Form validation
│   ├── pages/
│   │   ├── Dashboard.tsx    # Overview & stats
│   │   ├── Dispatch.tsx    # Slip management
│   │   ├── Invoices.tsx    # Invoice generation
│   │   ├── Customers.tsx   # Customer management
│   │   ├── Daybook.tsx     # Transactions
│   │   ├── Ledger.tsx      # Financial ledger
│   │   ├── Vehicles.tsx    # Vehicle registry
│   │   └── Settings.tsx    # Configuration
│   ├── types.ts            # TypeScript interfaces
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── server.ts               # Express dev server
├── vite.config.ts          # Vite configuration
├── package.json            # Dependencies
└── README.md               # This file
```

---

## 🔐 Default Credentials

On first run (no users configured):
- **Email**: `admin@admin.com`
- **Password**: `admin123`

---

## 📊 Business Logic

### Customer Balance
```
balance = openingBalance + unbilledSlipTotal + invoiceTotal + expenseDebits - paymentCredits
```

### Brass Volume Calculation
```
Brass = (Length × Width × Height) / 100
```

### Soft Deletes
Vehicles and Materials use `isActive: boolean` flag for soft deletion to preserve historical data.

---

## 🧪 Testing

E2E tests using Playwright are included in the `tests/` directory.

---

## 📄 License

Internal Use Only - Confidential

---

*Built with ❤️ for the Stone Crusher Industry*