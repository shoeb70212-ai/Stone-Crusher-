# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Implemented Direct Admin User Creation bypassing the invitation-based workflow.
- Added 'Manager' and 'Partner' user roles with appropriate settings and permission-based UI elements.
- Implemented a "trusted device" login mechanism with a persistent master key.

### Changed
- Streamlined authentication system to prioritize username/password login over email-based flows.
- Standardized PDF document exports, ensuring all document actions (Invoices, Dispatch Slips, Quotations, Ledger Statements) exclusively generate PDF files.
- Optimized data synchronization engine for high-performance, real-time updates with Supabase.
- Implemented lazy-loading pagination system for dispatch slips to improve application boot performance.
- Improved input field UI by standardizing the layout for password, lock, and eye-toggle icons.

### Fixed
- Fixed the "Password Setup" loop for Managers by correctly synchronizing the `mustChangePassword` flag.
- Ensured Managers correctly inherit their defined permissions upon login.
- Fixed session management issues to reliably clear state, vault keys, and cached credentials upon logout.
- Resolved a data synchronization failure where user roles and email addresses did not persist correctly between Supabase Auth and local settings.
- Fixed paper sizing standardization across mobile and desktop for consistent printing.

---
*Note: Whenever a new fix or feature is applied, please update this Unreleased section so we maintain a clean record.*
