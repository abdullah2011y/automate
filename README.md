# ByteForge Omni-Commerce — Single-User WhatsApp Order Confirmation System

A high-performance, private, single-owner application for automated Shopify Cash-on-Delivery (COD) order confirmations using **Baileys (WhatsApp Web multi-device protocol)** and **PostgreSQL**.

---

## 1. System Architecture

- **Application Model:** Single-user application for one store owner (`admin@byteforge.io`) and one Shopify store.
- **WhatsApp Web Integration:** Built on `@whiskeysockets/baileys` with QR pairing; session state and cryptographic Signal keys are persisted in PostgreSQL with AES-256-GCM encryption.
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide icons, full mobile drawer and iPhone bottom bar navigation.
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL.
- **Mobile & Desktop Packaging:**
  - **PWA (Progressive Web App):** Installable on iOS Safari, Android, and Desktop Chrome/Edge with standalone window experience, offline fallback, and zero caching of sensitive data.
  - **Capacitor iOS App:** Configured in `apps/web/ios` with `@capacitor/core`, `@capacitor/cli`, and `@capacitor/ios` ready for Xcode and iPhone installation.
- **Deployment Infrastructure:** Vercel (Frontend), Northflank Developer Sandbox (Containerized Express Backend & Managed PostgreSQL Addon).

---

## 2. Workspace Directory Structure

```
e:\Automation Software\
├── apps/
│   ├── api/                    # Express + Prisma + Baileys backend
│   │   ├── prisma/             # PostgreSQL schema (orders, items, templates, sessions, audit)
│   │   ├── src/                # Express API with v1 routing, raw body HMAC, Zod validation
│   │   │   ├── services/       # Baileys WhatsApp, Shopify sync, encryption, analytics
│   │   │   ├── controllers/    # API endpoint controllers
│   │   │   └── middleware/     # Rate limiter, auth, error handler
│   │   ├── Dockerfile          # Northflank Sandbox production container
│   │   └── .env.example        # Backend environment variables
│   │
│   └── web/                    # Next.js App Router frontend dashboard & mobile app
│       ├── public/             # PWA assets (manifest.json, sw.js, offline.html, icons)
│       ├── ios/                # Capacitor native iOS Xcode project (App.xcworkspace)
│       ├── src/
│       │   ├── app/            # App router pages (Overview, Orders, WhatsApp, Shopify, Settings)
│       │   ├── components/     # AppShell, Desktop Sidebar, Mobile Drawer & iPhone Bottom Bar
│       │   └── lib/            # Strictly typed centralized API client
│       ├── capacitor.config.ts # Capacitor iOS configuration (com.byteforge.omnicommerce)
│       └── .env.example        # Frontend environment variables
│
├── docs/                       # Architecture, Deployment, iOS Installation & Desktop Evaluation
├── scripts/                    # Icon generation, database backup & test suites
└── package.json                # Root orchestration & multi-package scripts
```

---

## 3. Startup & Local Development Instructions

### 3.1 Prerequisites
- Node.js v18+ (tested on Node.js v24.18.0)
- PostgreSQL running locally (port 5432) or a remote connection string

### 3.2 Starting the Backend
```bash
cd apps/api
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
# Health endpoint live at: http://localhost:5000/api/v1/health
```

### 3.3 Starting the Frontend
```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
# Web dashboard live at: http://localhost:3000
```

---

## 4. Production Environment Configuration

### Backend Environment Variables (`apps/api/.env`)
```ini
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"
JWT_SECRET="<generate-random-32-character-secret>"
JWT_EXPIRES_IN="7d"
ENCRYPTION_KEY="<generate-random-64-character-hex-key>"
FRONTEND_URL="https://byteforge-web.vercel.app"
SHOPIFY_API_VERSION="2025-01"
```

### Frontend Environment Variables (`apps/web/.env.local`)
```ini
NEXT_PUBLIC_API_URL="https://byteforge-api.northflank.app"
NEXT_PUBLIC_APP_NAME="ByteForge Omni-Commerce"
```

> [!SECURITY]
> **Strict Secret Isolation:** Database credentials, Shopify tokens, WhatsApp encryption keys, and JWT secrets are never exposed in `apps/web` or the Capacitor iOS bundle.

---

## 5. PWA (Progressive Web App) Installation

ByteForge is fully configured with a web app manifest (`manifest.json`), service worker (`sw.js`), Apple touch icons, and offline fallback (`offline.html`).

### On iPhone (Safari):
1. Open your ByteForge URL in Safari on your iPhone.
2. Tap the **Share** button (box with an upward arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.
5. Launch ByteForge from your home screen. It will open in a standalone, immersive window with zero browser URL bar or navigation buttons.

### On Desktop (Chrome / Edge):
1. Navigate to the ByteForge dashboard.
2. Click the **Install** icon in the browser address bar (or menu > **Save and share** > **Install ByteForge**).
3. The app will launch as an independent desktop window with taskbar integration.

---

## 6. Capacitor iOS Integration & Build Commands

Capacitor packages the frontend into an iOS native application inside `apps/web/ios`.

### Build & Sync Commands
```bash
# 1. Build the production static web export bundle
npm --prefix apps/web run build:cap

# 2. Sync the bundle into the native iOS Xcode project
npm run cap:sync

# Or run both in a single command from root:
npm run build:mobile
```

### Opening in Xcode (macOS Required)
```bash
cd apps/web
npm run cap:open
```

See the complete step-by-step signing, provisioning, Sideloadly, and AltStore guide in:
👉 [`docs/IOS_INSTALLATION_GUIDE.md`](./docs/IOS_INSTALLATION_GUIDE.md)

---

## 7. Running Verification & Test Suites

```bash
# Run Phase 2 Auth, Tenant Isolation, and Order Management test suite:
npm run test:api

# Run Phase 3 Shopify HMAC, Webhooks, and Idempotency test suite:
npm run test:shopify

# Run Phase 4 Baileys WhatsApp Web, Session Persistence & Inbound test suite:
npm run test:whatsapp

# Run Phase 5 Production Hardening, Analytics, and Opt-Out test suite:
npm run test:phase5

# Run linting across the entire workspace:
npm run lint

# Run production build checks:
npm run build:api
npm run build:web
```

---

## 8. Troubleshooting & Common Issues

### Issue: "Network Disconnected" or API Health Shows OFFLINE
- Verify backend is running on `PORT 5000` (or your configured port).
- Verify `NEXT_PUBLIC_API_URL` points to the correct backend host.
- For local mobile testing via iPhone, your phone must either connect via Wi-Fi to your local PC IP or use the deployed HTTPS URL (`https://byteforge-api.northflank.app`).

### Issue: WhatsApp Disconnected or QR Expired
- Go to the **WhatsApp** tab in the dashboard.
- Click **Force New QR** or **Refresh QR**.
- Scan the displayed QR code with WhatsApp on your phone (**Linked Devices** > **Link a Device**).
- Once connected, session keys are encrypted with AES-256-GCM and stored in PostgreSQL, surviving backend restarts.

### Issue: CocoaPods or xcodebuild Warnings on Windows
- Capacitor `cap sync ios` will show warnings on Windows indicating CocoaPods and Xcode are not present. This is normal because native iOS toolchains only exist on macOS. The web assets and Xcode project structure are properly generated and updated.
