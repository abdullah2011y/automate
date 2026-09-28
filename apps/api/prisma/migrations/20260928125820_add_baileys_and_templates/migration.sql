-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WhatsAppIntegrationStatus" ADD VALUE 'CONNECTING';
ALTER TYPE "WhatsAppIntegrationStatus" ADD VALUE 'QR_REQUIRED';
ALTER TYPE "WhatsAppIntegrationStatus" ADD VALUE 'RECONNECTING';

-- AlterTable
ALTER TABLE "whatsapp_integrations" ADD COLUMN     "lastConnectedAt" TIMESTAMP(3),
ADD COLUMN     "qrCode" TEXT,
ALTER COLUMN "phoneNumberId" DROP NOT NULL,
ALTER COLUMN "businessAccountId" DROP NOT NULL,
ALTER COLUMN "encryptedAccessToken" DROP NOT NULL,
ALTER COLUMN "verifyToken" DROP NOT NULL;

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event" TEXT NOT NULL DEFAULT 'ORDER_CONFIRMATION',
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "variables" TEXT[] DEFAULT ARRAY['customer_name', 'store_name', 'order_number', 'order_total', 'currency']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "autoConfirmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codOnly" BOOLEAN NOT NULL DEFAULT true,
    "defaultTemplateId" TEXT,
    "confirmKeywords" TEXT[] DEFAULT ARRAY['confirm', 'yes', 'haan', 'theek', 'sahi', 'bilkul', '1']::TEXT[],
    "cancelKeywords" TEXT[] DEFAULT ARRAY['cancel', 'no', 'nahi', 'mat bhejo', 'cancel kardo', '2']::TEXT[],
    "minDelaySeconds" INTEGER NOT NULL DEFAULT 3,
    "successReplyText" TEXT NOT NULL DEFAULT 'Shukriya! Aapka order successfully confirm ho chuka hai. Hum jald aapka parcel dispatch karein ge.',
    "cancelReplyText" TEXT NOT NULL DEFAULT 'Aapka order cancel kar diya gaya hai. Agar aapko mazeed maloomat darkaar hon toh hamse rabta karein.',
    "ambiguousReplyText" TEXT NOT NULL DEFAULT 'Barah-e-karam apna order confirm karne ke liye CONFIRM ya cancel karne ke liye CANCEL likh kar reply karein.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_sessions_sessionId_idx" ON "whatsapp_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_sessionId_key_key" ON "whatsapp_sessions"("sessionId", "key");

-- CreateIndex
CREATE INDEX "message_templates_tenantId_event_idx" ON "message_templates"("tenantId", "event");

-- CreateIndex
CREATE UNIQUE INDEX "automation_settings_tenantId_key" ON "automation_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
