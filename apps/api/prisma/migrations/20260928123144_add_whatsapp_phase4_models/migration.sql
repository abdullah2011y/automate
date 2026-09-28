-- CreateEnum
CREATE TYPE "WhatsAppIntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONFIGURATION_REQUIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "whatsapp_integrations" ADD COLUMN     "autoConfirmEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "codOnly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "encryptedAppSecret" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "status" "WhatsAppIntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED';

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "buttonPayload" TEXT,
ADD COLUMN     "customerResponse" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "message_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_jobs_orderId_key" ON "message_jobs"("orderId");

-- CreateIndex
CREATE INDEX "message_jobs_status_nextAttemptAt_idx" ON "message_jobs"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "message_jobs_tenantId_status_idx" ON "message_jobs"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
