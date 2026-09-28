import { prisma } from '../db/prisma';

export interface UpdateAutomationSettingsInput {
  autoConfirmEnabled?: boolean;
  codOnly?: boolean;
  defaultTemplateId?: string;
  confirmKeywords?: string[];
  cancelKeywords?: string[];
  optOutKeywords?: string[];
  minDelaySeconds?: number;
  successReplyText?: string;
  cancelReplyText?: string;
  ambiguousReplyText?: string;
  optOutReplyText?: string;
  testPhoneNumber?: string;
  eligibleOrderTypes?: string[];
  maxRetryAttempts?: number;
  skipMissingPhone?: boolean;
}

export class AutomationService {
  /**
   * Retrieves or initializes automation settings for a tenant.
   */
  public static async getSettings(tenantId: string) {
    let settings = await prisma.automationSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await prisma.automationSettings.create({
        data: {
          tenantId,
          autoConfirmEnabled: true,
          codOnly: true,
          confirmKeywords: ['confirm', 'yes', 'haan', 'theek', 'sahi', 'bilkul', '1'],
          cancelKeywords: ['cancel', 'no', 'nahi', 'mat bhejo', 'cancel kardo', '2'],
          optOutKeywords: ['stop', 'unsubscribe', 'optout', 'ruk jao', 'mat bhejna'],
          minDelaySeconds: 3,
          successReplyText: 'Shukriya! Aapka order successfully confirm ho chuka hai. Hum jald aapka parcel dispatch karein ge.',
          cancelReplyText: 'Aapka order cancel kar diya gaya hai. Agar aapko mazeed maloomat darkaar hon toh hamse rabta karein.',
          ambiguousReplyText: 'Barah-e-karam apna order confirm karne ke liye CONFIRM ya cancel karne ke liye CANCEL likh kar reply karein.',
          optOutReplyText: 'Aapko automated WhatsApp notifications se unsubscribe kar diya gaya hai. Dobara activate karne ke liye START reply karein.',
          eligibleOrderTypes: ['cash_on_delivery'],
          maxRetryAttempts: 3,
          skipMissingPhone: true,
        },
      });
    }

    return settings;
  }

  /**
   * Updates automation settings for a tenant.
   */
  public static async updateSettings(
    tenantId: string,
    input: UpdateAutomationSettingsInput
  ) {
    const current = await this.getSettings(tenantId);

    return prisma.automationSettings.update({
      where: { id: current.id },
      data: {
        autoConfirmEnabled: input.autoConfirmEnabled !== undefined ? input.autoConfirmEnabled : undefined,
        codOnly: input.codOnly !== undefined ? input.codOnly : undefined,
        defaultTemplateId: input.defaultTemplateId !== undefined ? input.defaultTemplateId : undefined,
        confirmKeywords: input.confirmKeywords ? input.confirmKeywords.map((k) => k.trim().toLowerCase()) : undefined,
        cancelKeywords: input.cancelKeywords ? input.cancelKeywords.map((k) => k.trim().toLowerCase()) : undefined,
        optOutKeywords: input.optOutKeywords ? input.optOutKeywords.map((k) => k.trim().toLowerCase()) : undefined,
        minDelaySeconds: input.minDelaySeconds !== undefined ? Math.max(1, input.minDelaySeconds) : undefined,
        successReplyText: input.successReplyText !== undefined ? input.successReplyText : undefined,
        cancelReplyText: input.cancelReplyText !== undefined ? input.cancelReplyText : undefined,
        ambiguousReplyText: input.ambiguousReplyText !== undefined ? input.ambiguousReplyText : undefined,
        optOutReplyText: input.optOutReplyText !== undefined ? input.optOutReplyText : undefined,
        testPhoneNumber: input.testPhoneNumber !== undefined ? input.testPhoneNumber.trim() : undefined,
        eligibleOrderTypes: input.eligibleOrderTypes !== undefined ? input.eligibleOrderTypes : undefined,
        maxRetryAttempts: input.maxRetryAttempts !== undefined ? Math.max(1, Math.min(10, input.maxRetryAttempts)) : undefined,
        skipMissingPhone: input.skipMissingPhone !== undefined ? input.skipMissingPhone : undefined,
      },
    });
  }
}
