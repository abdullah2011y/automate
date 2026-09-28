# ByteForge Omni-Commerce — Production Deployment & Operations Guide

## 1. Target Infrastructure Overview

ByteForge Omni-Commerce is engineered as a lean, single-owner application with zero paid infrastructure dependencies:

- **Frontend:** [Vercel](https://vercel.com) (Next.js 14 App Router on Serverless/Edge, free Hobby tier).
- **Backend:** [Northflank](https://northflank.com) Developer Sandbox (Containerized Node.js/Express service, free tier).
- **Database:** PostgreSQL Addon on Northflank Developer Sandbox (Micro free tier, persistent storage).
- **Session Persistence:** Encrypted PostgreSQL Auth State Adapter (`whatsapp_sessions` table with AES-256-GCM).
- **Backup Target:** Local Administrator PC directory (`E:\ByteForge-Backups`) with SHA-256 signed manifests.

---

## 2. Northflank Developer Sandbox Limits & Verification

The Northflank Developer Sandbox provides generous free-tier compute intended for single-tenant workloads:
- **RAM Allowance:** 512 MB to 1024 MB per project.
- **CPU Allowance:** Up to 1.0 vCPU burstable.
- **Service Quotas:** 1 free combined or deployment service + 1 free database addon.
- **Cost:** **$0.00 / month (No credit card or billing approval required).**

### Actual ByteForge Resource Profile:
- **Measured Backend Memory (RSS):** ~50 MB to 55 MB (less than 11% of the 512 MB ceiling).
- **Database Connection Limit:** Set to `connection_limit=10` to prevent connection exhaustion.
- **Rate Limiters:** In-memory sliding window using Node.js `Map` with 5-minute cleanup cycles (< 100 KB RAM).
- **WhatsApp Web (Baileys):** Socket runs directly inside the Node.js process; ephemeral container filesystems do not cause session loss because all Signal keys and credentials are saved in PostgreSQL.

---

## 3. Backend Deployment to Northflank

### Step 1: Create Free PostgreSQL Database Addon
1. Log in to [Northflank](https://app.northflank.com).
2. Navigate to **Addons** -> **Create Addon** -> Select **PostgreSQL**.
3. Select **Developer Sandbox (Free)** plan.
4. Name the addon: `byteforge-db`.
5. Once provisioned, note the connection string:
   `postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require`

### Step 2: Deploy Backend Web Service
1. Navigate to **Services** -> **Create Service** -> **Deployment Service**.
2. Source: Select **GitHub** and choose the repository `ByteForge-OmniCommerce`.
3. Set **Build Context**: `apps/api`.
4. Build Type: **Dockerfile** (uses `apps/api/Dockerfile`).
5. Networking:
   - Port: `5000`
   - Protocol: `HTTP`
   - Public Access: Enabled (Northflank assigns a free HTTPS domain, e.g., `https://byteforge-api.northflank.app`).
   - Health Check Path: `/api/v1/health`
6. Environment Variables:
   ```env
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]?schema=public
   JWT_SECRET=[generate-random-64-character-hex-string]
   ENCRYPTION_KEY=[generate-exact-32-byte-hex-string]
   FRONTEND_URL=https://your-byteforge-app.vercel.app
   BACKEND_URL=https://byteforge-api.northflank.app
   LOG_LEVEL=info
   ```

### Step 3: Run Safe Database Migrations
In the Northflank service shell or via manual deployment hook:
```bash
npx prisma migrate deploy
```
*(Never run `prisma migrate reset` in production!)*

---

## 4. Frontend Deployment to Vercel

1. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
2. Import the GitHub repository.
3. Configure project settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web`
4. Set Production Environment Variables:
   ```env
   NEXT_PUBLIC_API_URL=https://byteforge-api.northflank.app
   NEXT_PUBLIC_APP_NAME=ByteForge Omni-Commerce
   ```
5. Click **Deploy**. Vercel will build the production bundle and assign your custom domain or `*.vercel.app` URL.
6. Verify CORS by checking that the Vercel domain matches `FRONTEND_URL` on Northflank.

---

## 5. System Health & Observability

ByteForge provides two built-in monitoring endpoints:

### A. Public Liveness Probe
- **URL:** `GET /api/v1/health`
- **Access:** Unauthenticated (Safe for uptime monitors like UptimeRobot, BetterStack, Northflank).
- **Payload:** Service uptime, DB connectivity status, DB query latency (ms), process memory usage. Secrets and tenant data are strictly omitted.

### B. Authenticated Diagnostic Dashboard
- **URL:** `GET /api/v1/health/detailed`
- **Access:** Requires Administrator Bearer Token.
- **Payload:** Detailed PostgreSQL pool health, Shopify integration sync state, Baileys socket connection status, and message queue pending/failed job counts.

---

## 6. Backup, Recovery & 20-Day Archival

All backups are stored on the administrator's PC under:
`E:\ByteForge-Backups`

### Available CLI Commands:
- **Create Verified Backup:**
  ```powershell
  npm run db:backup
  ```
  *(Creates timestamped directory, structured JSON dump, `pg_dump` SQL archive, and SHA-256 signed manifest).*

- **Verify & Restore Database:**
  ```powershell
  npm run db:restore
  ```
  *(Validates file integrity against SHA-256 manifest before applying restore).*

- **20-Day Historical Order Archival:**
  ```powershell
  npm run db:archive
  ```
  *(Enforces safety rule: refuses to run unless a verified backup exists within the last 24 hours. Only soft-archives completed historical orders older than 20 days. Never touches active orders, customer profiles, session credentials, or audit logs).*

- **Windows Automated Backup Script:**
  Run `scripts/backup-database.ps1` via Windows Task Scheduler when the PC is powered on.
