-- AlterTable
ALTER TABLE "automation_settings" ADD COLUMN     "eligibleOrderTypes" TEXT[] DEFAULT ARRAY['cash_on_delivery']::TEXT[],
ADD COLUMN     "maxRetryAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "optOutKeywords" TEXT[] DEFAULT ARRAY['stop', 'unsubscribe', 'optout', 'ruk jao', 'mat bhejna']::TEXT[],
ADD COLUMN     "optOutReplyText" TEXT NOT NULL DEFAULT 'Aapko notifications se unsubscribe kar diya gaya hai. Dobara activate karne ke liye START reply karein.',
ADD COLUMN     "skipMissingPhone" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "testPhoneNumber" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "isOptedOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optedOutAt" TIMESTAMP(3);
