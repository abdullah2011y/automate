-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'SYNCING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "financialStatus" TEXT DEFAULT 'pending',
ADD COLUMN     "fulfillmentStatus" TEXT DEFAULT 'unfulfilled',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'shopify';

-- AlterTable
ALTER TABLE "shopify_integrations" ADD COLUMN     "lastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "scopes" TEXT DEFAULT 'read_orders,write_orders,read_customers',
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncStatus" "SyncStatus" NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "syncedOrdersCount" INTEGER NOT NULL DEFAULT 0;
