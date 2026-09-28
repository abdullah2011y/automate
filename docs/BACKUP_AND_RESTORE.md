# ByteForge Disaster Recovery, Backup & Restoration Guide

## 1. Overview
The ByteForge Omni-Commerce application persists all operational data, multi-device WhatsApp Web session credentials, templates, and Shopify order records inside PostgreSQL.

To safeguard business continuity on Northflank Developer Sandbox and the administrator's local machine, ByteForge employs a verified automated backup and archival mechanism.

---

## 2. Backup Protocol

### Destination
Backups are saved to:
`E:\ByteForge-Backups\backup_<timestamp>\`

### Contents of Each Backup
1. **`database_dump.json`**: Complete structured JSON export of all relational tables:
   - `tenants`, `users`
   - `customers` (including opt-out status)
   - `orders` and `order_items`
   - `whatsapp_messages` and `message_jobs`
   - `whatsapp_sessions` (AES-256-GCM encrypted WhatsApp Web Signal keys and credentials)
   - `message_templates` and `automation_settings`
   - `audit_logs`
2. **`database_dump.sql`**: Full PostgreSQL SQL dump when `pg_dump` binary is detected.
3. **`backup_manifest.json`**: Cryptographic integrity manifest containing:
   - ISO-8601 creation timestamp.
   - SHA-256 checksum of the archive.
   - Table-by-table record counts.
   - `status: "VERIFIED"`.
4. **`latest_backup.json`** (at root `E:\ByteForge-Backups\`): Quick pointer to the most recently verified backup directory.

### Running a Backup
To run a manual backup on demand:
```bash
npm run db:backup
```
Or via Windows PowerShell:
```powershell
.\scripts\backup-database.ps1
```

### Scheduling Backups on Windows
You can schedule automated daily backups using Windows Task Scheduler:
1. Open **Task Scheduler** &rarr; **Create Basic Task**.
2. Name: `ByteForge Daily Database Backup`.
3. Trigger: **Daily at 02:00 AM**.
4. Action: **Start a program**.
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "E:\Automation Software\scripts\backup-database.ps1"`

*(Note: PC backups only run when the administrator's PC is powered on. If the PC is offline, the next scheduled run or manual run will execute).*

---

## 3. Database Restoration & Disaster Recovery

### Safe Restoration Command
To restore from the latest verified backup:
```bash
npm run db:restore
```
To restore from a specific timestamped backup:
```bash
npm run db:restore "E:\ByteForge-Backups\backup_2026-09-28T13-27-21-615Z"
```

### Integrity Verification Prior to Restore
The restoration tool:
1. Verifies that `backup_manifest.json` exists.
2. Recalculates the SHA-256 hash of `database_dump.json`.
3. Verifies that the checksum matches the manifest. If a mismatch or corruption is detected, restoration aborts immediately to protect database integrity.
4. Restores WhatsApp session credentials, templates, and automation settings using transactional upserts so no existing data is destructively dropped.

---

## 4. 20-Day Safe Historical Order Archival Policy

To keep active query latency low and avoid table bloat, orders older than 20 days can be archived:
* **Prerequisite**: An active verified backup created in `E:\ByteForge-Backups` within the preceding 24 hours **must** exist. If no recent verified backup is found, archival will safely abort.
* **Eligible Orders**: Only completed historical orders (`CONFIRMED`, `CANCELLED`, `DELIVERED`).
* **Non-Destructive**: Sets `archivedAt = new Date()`. Customer records, session keys, audit logs, and message records are **never deleted**.

### Executing Archival
```bash
npm run db:archive
```

---

## 5. WhatsApp Session Recovery after Northflank Redeployments
Northflank containers have ephemeral filesystems. When a container restarts:
1. The backend boots up and connects to PostgreSQL.
2. `usePostgresAuthState('default')` reads the encrypted `whatsapp_sessions` records from PostgreSQL.
3. AES-256-GCM decrypts the Signal cryptographic keys.
4. Baileys seamlessly reconnects to the active WhatsApp Web multi-device session without requiring the administrator to re-scan the QR code.
