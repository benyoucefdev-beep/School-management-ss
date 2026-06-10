# Axialogy Project Summary & Handoff

## Overview
Axialogy is an internal business management platform designed for staff to manage clients, tasks, finances (quotes, invoices, expenses), and ads.

**Tech Stack:**
*   **Frontend**: React 19, Vite (v8.0.3), React Router, React Query, Lucide-React.
*   **Backend**: Node.js, Express, PostgreSQL (Supabase).
*   **Hosting**: Frontend & Backend as a Monorepo hosted on Vercel.

## Key Features & Implementations
1.  **Multiple Task Assignees**: Migrated tasks to support multiple assignees (`assignee_ids` array).
2.  **Invoice Remise (Discount)**: Added `discount_pct` column to invoices. The subtotal minus the percentage discount now calculates the new grand total dynamically on the `InvoicesPage.jsx` and backend PDFs.
3.  **Ads Wallets Tabs**: Updated the Ads UI (`AdsPage.jsx`) to feature custom "pill-shaped" tabs to separate "Ads Clients" from "All Wallets".
4.  **Custom Branding**: Fully replaced default placeholder logos with the official custom Axialogy logo across the platform (Login Screen, Sidebar, and App Icons).

## Progressive Web App (PWA) & Notifications (Completed)
The platform is fully transformed into a **Progressive Web App (PWA)**, allowing the team to install it on mobile (iOS/Android) and receive **Push Notifications** for task assignments and budget alerts.

**Frontend:**
*   `vite-plugin-pwa` (v1.2.0) configured with the `injectManifest` strategy.
*   `src/sw.js` handles precaching and push event listeners for mobile notifications.
*   Manual service worker registration added in `main.jsx` (bypassing `virtual:pwa-register` to avoid Vercel build crashes).
*   Custom UI app icons generated (192x192, 512x512, apple-touch-icon, and favicon.ico) for proper home screen installation.

**Backend:**
*   `push_subscriptions` table active in Supabase.
*   `web-push` library integrated with safe **lazy-loading** (to prevent backend startup crashes if env variables are missing).
*   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_EMAIL` securely added to Vercel environment variables.

## Previous Critical Issues Resolved
*   **"Blank Page After Login" (React Error):** 500 errors from the API were returning `{ code, message }` objects, which crashed the React toast notifications. Fixed by adding fallback string guards.
*   **Backend 500 Crash Loop:** `require('web-push')` at the top level of route modules was crashing the entire Vercel serverless function on startup due to missing VAPID keys. Fixed by refactoring `utils/pushNotifications.js` to strictly initialize only during notification sending logic.
*   **Vercel Monorepo Build Failures:** Addressed silent build failures caused by missing module imports (`supplierPushService.js`) and PWA virtual module imports.
*   **PWA Routing on Vercel:** Vercel was misrouting `/manifest.webmanifest` and `/icons/*` to the fallback `index.html`. Added strict routing paths to `vercel.json` to correctly serve these static assets.
