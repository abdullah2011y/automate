import { prisma } from '../db/prisma';
import {
  encryptCredential,
  decryptCredential,
  verifyMetaWebhookSignature,
} from '../utils/crypto';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import {
  JobStatus,
  MessageDirection,
  MessageStatus,
  OrderConfirmationStatus,
  Prisma,
  WhatsAppIntegrationStatus,
} from '@prisma/client';

export interface SaveWhatsAuthConfigInput {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  appSecret?: string;
  verifyToken: string;
  templateName?: string;
  templateLanguage?: string;
  autoConfirmEnabled?: boolean;
  codOnly?: boolean;
}

export class WhatsAppService {
  /**
   * Saves or updates tenant's Meta WhatsApp Cloud API credentials.
   * Access token and App Secret are encrypted at rest using AES-256-GCM.
   */
  public static async saveConfig(
    tenantId: string,
    input: SaveWhatsAuthConfigInput,
    userId?: string
  ) {
    if (!input.phoneNumberId || input.phoneNumberId.trim().length < 5) {
      throw new AppError('Valid Meta Phone Number ID is required', 400);
    }
    if (!input.businessAccountId || input.businessAccountId.trim().length < 5) {
      throw new AppError('Valid WhatsApp Business Account ID (WABA) is required', 400);
    }
    if (!input.accessToken || input.accessToken.trim().length < 10) {
      throw new AppError('Valid Meta System User Access Token is required', 400);
    }
    if (!input.verifyToken || input.verifyToken.trim().length < 3) {
      throw new AppError('Webhook Verification Token is required', 400);
    }

    const encryptedToken = encryptCredential(input.accessToken.trim());
    const encryptedSecret = input.appSecret?.trim()
      ? encryptCredential(input.appSecret.trim())
      : null;

    const integration = await prisma.$transaction(async (tx) => {
      const saved = await tx.whatsAppIntegration.upsert({
        where: { tenantId },
        update: {
          phoneNumberId: input.phoneNumberId.trim(),
          businessAccountId: input.businessAccountId.trim(),
          encryptedAccessToken: encryptedToken,
          encryptedAppSecret: encryptedSecret,
          verifyToken: input.verifyToken.trim(),
          templateName: input.templateName?.trim() || 'order_confirmation_v1',
          templateLanguage: input.templateLanguage?.trim() || 'en_US',
          autoConfirmEnabled: input.autoConfirmEnabled ?? true,
          codOnly: input.codOnly ?? true,
          isActive: true,
          status: WhatsAppIntegrationStatus.CONFIGURATION_REQUIRED,
          errorMessage: null,
        },
        create: {
          tenantId,
          phoneNumberId: input.phoneNumberId.trim(),
          businessAccountId: input.businessAccountId.trim(),
          encryptedAccessToken: encryptedToken,
          encryptedAppSecret: encryptedSecret,
          verifyToken: input.verifyToken.trim(),
          templateName: input.templateName?.trim() || 'order_confirmation_v1',
          templateLanguage: input.templateLanguage?.trim() || 'en_US',
          autoConfirmEnabled: input.autoConfirmEnabled ?? true,
          codOnly: input.codOnly ?? true,
          isActive: true,
          status: WhatsAppIntegrationStatus.CONFIGURATION_REQUIRED,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action: 'WHATSAPP_CONFIG_UPDATED',
          details: {
            phoneNumberId: input.phoneNumberId.trim(),
            businessAccountId: input.businessAccountId.trim(),
            templateName: saved.templateName,
          },
        },
      });

      return saved;
    });

    return {
      id: integration.id,
      phoneNumberId: integration.phoneNumberId,
      businessAccountId: integration.businessAccountId,
      status: integration.status,
      templateName: integration.templateName,
      templateLanguage: integration.templateLanguage,
    };
  }

  /**
   * Tests connection with Meta Graph API for the configured Phone Number ID.
   */
  public static async testConnection(tenantId: string) {
    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { tenantId },
    });

    if (!integration || !integration.encryptedAccessToken) {
      throw new AppError('No WhatsApp Cloud API access token configured for this store', 404);
    }

    try {
      const accessToken = decryptCredential(integration.encryptedAccessToken);
      const version = config.META_API_VERSION || 'v21.0';
      const endpoint = `https://graph.facebook.com/${version}/${integration.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data: any = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || `HTTP ${response.status}: Meta Graph API verification failed`;
        await prisma.whatsAppIntegration.update({
          where: { tenantId },
          data: {
            status: WhatsAppIntegrationStatus.ERROR,
            errorMessage: errorMsg,
          },
        });
        return {
          connected: false,
          error: errorMsg,
          code: data?.error?.code,
        };
      }

      await prisma.whatsAppIntegration.update({
        where: { tenantId },
        data: {
          status: WhatsAppIntegrationStatus.CONNECTED,
          displayPhoneNumber: data.display_phone_number || integration.displayPhoneNumber,
          lastVerifiedAt: new Date(),
          errorMessage: null,
        },
      });

      return {
        connected: true,
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
      };
    } catch (err: any) {
      await prisma.whatsAppIntegration.update({
        where: { tenantId },
        data: {
          status: WhatsAppIntegrationStatus.ERROR,
          errorMessage: err.message,
        },
      });
      return { connected: false, error: err.message };
    }
  }

  /**
   * Retrieves tenant's WhatsApp status and message statistics without exposing credentials.
   */
  public static async getStatus(tenantId: string) {
    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { tenantId },
      select: {
        id: true,
        phoneNumberId: true,
        businessAccountId: true,
        displayPhoneNumber: true,
        status: true,
        isActive: true,
        autoConfirmEnabled: true,
        codOnly: true,
        templateName: true,
        templateLanguage: true,
        lastVerifiedAt: true,
        errorMessage: true,
      },
    });

    // Aggregate delivery stats from real PostgreSQL messages
    const [totalMessages, sentCount, deliveredCount, readCount, failedCount, recentMessages] =
      await Promise.all([
        prisma.whatsAppMessage.count({ where: { tenantId } }),
        prisma.whatsAppMessage.count({ where: { tenantId, status: MessageStatus.SENT } }),
        prisma.whatsAppMessage.count({ where: { tenantId, status: MessageStatus.DELIVERED } }),
        prisma.whatsAppMessage.count({ where: { tenantId, status: MessageStatus.READ } }),
        prisma.whatsAppMessage.count({ where: { tenantId, status: MessageStatus.FAILED } }),
        prisma.whatsAppMessage.findMany({
          where: { tenantId },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                shopifyOrderNumber: true,
                totalPrice: true,
                confirmationStatus: true,
              },
            },
          },
        }),
      ]);

    const deliveryRate =
      totalMessages > 0
        ? (((deliveredCount + readCount) / totalMessages) * 100).toFixed(1) + '%'
        : '0.0%';

    return {
      integration,
      stats: {
        totalMessages,
        sentCount,
        deliveredCount,
        readCount,
        failedCount,
        deliveryRate,
      },
      recentMessages: recentMessages.map((m: any) => ({
        id: m.id,
        wamid: m.wamid,
        recipientPhone: m.recipientPhone,
        status: m.status,
        customerResponse: m.customerResponse,
        orderNumber: m.order?.shopifyOrderNumber || 'N/A',
        orderTotal: m.order?.totalPrice ? `$${m.order.totalPrice}` : 'N/A',
        sentAt: m.sentAt,
        deliveredAt: m.deliveredAt,
        readAt: m.readAt,
        failedAt: m.failedAt,
        failureReason: m.failureReason,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Checks eligibility and queues an automated order confirmation message job.
   */
  public static async queueOrderConfirmation(tenantId: string, orderId: string) {
    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { tenantId },
    });

    if (!integration || !integration.isActive || !integration.autoConfirmEnabled) {
      return { queued: false, reason: 'WhatsApp auto-confirmation is disabled for this store' };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, tenant: true },
    });

    if (!order) {
      return { queued: false, reason: 'Order not found' };
    }

    if (order.confirmationStatus !== OrderConfirmationStatus.PENDING_CONFIRMATION) {
      return { queued: false, reason: `Order is already ${order.confirmationStatus}` };
    }

    if (integration.codOnly && order.paymentGateway !== 'cash_on_delivery') {
      return { queued: false, reason: 'Order is not Cash on Delivery' };
    }

    const phone = order.customer.phoneNumber;
    if (!phone || phone.length < 8 || phone === '+000000000000') {
      return { queued: false, reason: 'Customer has no valid phone number' };
    }

    // Check if job already exists (idempotency)
    const existingJob = await prisma.messageJob.findUnique({
      where: { orderId },
    });

    if (existingJob) {
      return { queued: false, reason: 'Confirmation job already exists for this order' };
    }

    const customerName = `${order.customer.firstName || 'Valued'} ${order.customer.lastName || 'Customer'}`.trim();
    const storeName = order.tenant.name || 'Our Store';

    const job = await prisma.messageJob.create({
      data: {
        tenantId,
        orderId: order.id,
        recipientPhone: phone,
        templateName: integration.templateName,
        parameters: {
          customerName,
          storeName,
          orderNumber: order.shopifyOrderNumber,
          currency: order.currency,
          orderTotal: order.totalPrice.toString(),
        },
        status: JobStatus.PENDING,
      },
    });

    // Asynchronously dispatch the job
    setImmediate(() => {
      this.processJob(job.id).catch((err) => {
        console.error(`[MessageJob ${job.id}] Execution failed:`, err);
      });
    });

    return { queued: true, jobId: job.id };
  }

  /**
   * Processes a single MessageJob from the durable PostgreSQL queue.
   */
  public static async processJob(jobId: string) {
    const job = await prisma.messageJob.findUnique({
      where: { id: jobId },
      include: {
        tenant: { include: { whatsapp: true } },
        order: { include: { customer: true } },
      },
    });

    if (!job || job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
      return;
    }

    const integration = job.tenant.whatsapp;
    if (!integration || !integration.isActive) {
      await prisma.messageJob.update({
        where: { id: jobId },
        data: { status: JobStatus.FAILED, lastError: 'No active WhatsApp integration' },
      });
      return;
    }

    // Mark as PROCESSING
    await prisma.messageJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PROCESSING, lockedAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      if (!integration.encryptedAccessToken) {
        throw new Error('WhatsApp Cloud API access token is missing');
      }
      const accessToken = decryptCredential(integration.encryptedAccessToken);
      const params = job.parameters as any;
      const version = config.META_API_VERSION || 'v21.0';

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: job.recipientPhone,
        type: 'template',
        template: {
          name: job.templateName,
          language: { code: integration.templateLanguage || 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: params.customerName },
                { type: 'text', text: params.storeName },
                { type: 'text', text: params.orderNumber },
                { type: 'text', text: params.currency },
                { type: 'text', text: params.orderTotal },
              ],
            },
            {
              type: 'button',
              sub_type: 'quick_reply',
              index: '0',
              parameters: [{ type: 'payload', payload: `CONFIRM_${job.orderId}` }],
            },
            {
              type: 'button',
              sub_type: 'quick_reply',
              index: '1',
              parameters: [{ type: 'payload', payload: `CANCEL_${job.orderId}` }],
            },
          ],
        },
      };

      const response = await fetch(
        `https://graph.facebook.com/${version}/${integration.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const resData: any = await response.json();

      if (!response.ok) {
        const errorMsg = resData?.error?.message || `HTTP ${response.status}: Meta API rejected message`;
        const isTransient = response.status === 429 || response.status >= 500;

        if (isTransient && job.attempts < job.maxAttempts) {
          const backoffSec = Math.pow(2, job.attempts) * 2;
          await prisma.messageJob.update({
            where: { id: jobId },
            data: {
              status: JobStatus.PENDING,
              lastError: errorMsg,
              nextAttemptAt: new Date(Date.now() + backoffSec * 1000),
            },
          });
          return;
        }

        await prisma.messageJob.update({
          where: { id: jobId },
          data: { status: JobStatus.FAILED, lastError: errorMsg },
        });

        // Record failed message entry
        await prisma.whatsAppMessage.create({
          data: {
            tenantId: job.tenantId,
            orderId: job.orderId,
            customerId: job.order.customerId,
            recipientPhone: job.recipientPhone,
            direction: MessageDirection.OUTBOUND,
            status: MessageStatus.FAILED,
            failedAt: new Date(),
            failureReason: errorMsg,
            payload,
            rawResponse: resData,
          },
        });
        return;
      }

      const wamid = resData?.messages?.[0]?.id || `wamid_sim_${Date.now()}`;

      await prisma.$transaction([
        prisma.messageJob.update({
          where: { id: jobId },
          data: { status: JobStatus.COMPLETED, lastError: null },
        }),
        prisma.whatsAppMessage.create({
          data: {
            tenantId: job.tenantId,
            orderId: job.orderId,
            customerId: job.order.customerId,
            wamid,
            recipientPhone: job.recipientPhone,
            direction: MessageDirection.OUTBOUND,
            status: MessageStatus.SENT,
            sentAt: new Date(),
            payload,
            buttonPayload: `CONFIRM_${job.orderId}`,
            rawResponse: resData,
          },
        }),
        prisma.order.update({
          where: { id: job.orderId },
          data: { messageSentAt: new Date() },
        }),
      ]);
    } catch (err: any) {
      await prisma.messageJob.update({
        where: { id: jobId },
        data: { status: JobStatus.FAILED, lastError: err.message },
      });
    }
  }

  /**
   * Processes Meta WhatsApp Cloud API incoming webhooks.
   * Handles delivery status updates (sent, delivered, read, failed)
   * and interactive button clicks (Confirm / Cancel).
   */
  public static async processIncomingWebhook(
    rawBody: Buffer | undefined,
    signatureHeader: string | undefined,
    payload: any
  ) {
    if (!payload?.entry || !Array.isArray(payload.entry)) {
      return { status: 'IGNORED', reason: 'Non-WhatsApp payload' };
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        // 1. Resolve tenant integration by phone_number_id
        const integration = await prisma.whatsAppIntegration.findFirst({
          where: { phoneNumberId },
        });

        if (!integration) {
          console.warn(`[Meta Webhook] No integration found for phone_number_id: ${phoneNumberId}`);
          continue;
        }

        // 2. Verify signature if appSecret is configured
        if (integration.encryptedAppSecret && signatureHeader) {
          const appSecret = decryptCredential(integration.encryptedAppSecret);
          const isValid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
          if (!isValid) {
            throw new AppError('Invalid Meta X-Hub-Signature-256 signature', 401);
          }
        }

        // 3. Handle Message Delivery Status Events (sent, delivered, read, failed)
        for (const status of value.statuses || []) {
          await this.handleMessageStatusEvent(integration.tenantId, status);
        }

        // 4. Handle Inbound Customer Messages & Interactive Buttons
        for (const message of value.messages || []) {
          await this.handleInboundCustomerMessage(integration.tenantId, message);
        }
      }
    }

    return { status: 'PROCESSED' };
  }

  /**
   * Updates message delivery states in PostgreSQL based on Meta status webhooks.
   */
  private static async handleMessageStatusEvent(tenantId: string, statusEvent: any) {
    const wamid = statusEvent.id;
    const statusStr = statusEvent.status; // 'sent', 'delivered', 'read', 'failed'
    const timestamp = statusEvent.timestamp ? new Date(Number(statusEvent.timestamp) * 1000) : new Date();

    const existingMessage = await prisma.whatsAppMessage.findUnique({
      where: { wamid },
    });

    if (!existingMessage) {
      return;
    }

    const updateData: Prisma.WhatsAppMessageUpdateInput = {};

    if (statusStr === 'delivered') {
      updateData.status = MessageStatus.DELIVERED;
      updateData.deliveredAt = timestamp;
    } else if (statusStr === 'read') {
      updateData.status = MessageStatus.READ;
      updateData.readAt = timestamp;
    } else if (statusStr === 'failed') {
      updateData.status = MessageStatus.FAILED;
      updateData.failedAt = timestamp;
      const errorObj = statusEvent.errors?.[0];
      updateData.failureReason = errorObj ? `${errorObj.code}: ${errorObj.title || errorObj.message}` : 'Meta delivery failed';
    }

    await prisma.whatsAppMessage.update({
      where: { id: existingMessage.id },
      data: updateData,
    });
  }

  /**
   * Processes customer interactive button clicks (Confirm / Cancel) or text responses.
   */
  private static async handleInboundCustomerMessage(tenantId: string, message: any) {
    let buttonPayload: string | null = null;
    let textBody: string | null = null;

    if (message.type === 'interactive' && message.interactive?.button_reply) {
      buttonPayload = message.interactive.button_reply.id;
    } else if (message.type === 'button') {
      buttonPayload = message.button?.payload;
    } else if (message.type === 'text') {
      textBody = message.text?.body?.trim().toLowerCase();
    }

    if (!buttonPayload && !textBody) {
      return;
    }

    // Parse button payload format: CONFIRM_<orderId> or CANCEL_<orderId>
    let action: 'CONFIRM' | 'CANCEL' | 'AMBIGUOUS' | null = null;
    let orderId: string | null = null;

    if (buttonPayload) {
      if (buttonPayload.startsWith('CONFIRM_')) {
        action = 'CONFIRM';
        orderId = buttonPayload.replace('CONFIRM_', '');
      } else if (buttonPayload.startsWith('CANCEL_')) {
        action = 'CANCEL';
        orderId = buttonPayload.replace('CANCEL_', '');
      }
    } else if (textBody) {
      // Natural language matching fallback
      const normalized = textBody.toLowerCase();
      if (/^(yes|confirm|confirmed|haan|theek|sahi|bilkul)$/i.test(normalized)) {
        action = 'CONFIRM';
      } else if (/^(no|cancel|cancelled|nahi|mat bhejo)$/i.test(normalized)) {
        action = 'CANCEL';
      } else {
        action = 'AMBIGUOUS';
      }

      // Find active pending order for this customer's phone
      const phone = `+${message.from.replace(/\D/g, '')}`;
      const pendingOrder = await prisma.order.findFirst({
        where: {
          tenantId,
          customer: { phoneNumber: { contains: phone.slice(-10) } },
          confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
        },
        orderBy: { orderCreatedAt: 'desc' },
      });

      if (pendingOrder) {
        orderId = pendingOrder.id;
      }
    }

    if (!orderId || !action) {
      return;
    }

    // Verify order exists, belongs to tenant, and is still in PENDING_CONFIRMATION
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      return;
    }

    // Prevent changing state if order was already dispatched, delivered, or returned
    if (
      order.confirmationStatus === OrderConfirmationStatus.DISPATCHED ||
      order.confirmationStatus === OrderConfirmationStatus.DELIVERED ||
      order.confirmationStatus === OrderConfirmationStatus.RETURNED
    ) {
      console.warn(`[WhatsApp] Ignored stale ${action} response for already ${order.confirmationStatus} order ${order.id}`);
      return;
    }

    const now = new Date();

    if (action === 'CONFIRM') {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            confirmationStatus: OrderConfirmationStatus.CONFIRMED,
            confirmedAt: now,
            statusChangedAt: now,
          },
        });

        // Update corresponding message response
        await tx.whatsAppMessage.updateMany({
          where: { orderId: order.id, direction: MessageDirection.OUTBOUND },
          data: {
            customerResponse: 'CONFIRMED',
            respondedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            orderId: order.id,
            action: 'WHATSAPP_ORDER_CONFIRMED',
            details: {
              responseType: buttonPayload ? 'INTERACTIVE_BUTTON' : 'TEXT_MATCH',
              confirmedAt: now,
            },
          },
        });
      });
    } else if (action === 'CANCEL') {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            confirmationStatus: OrderConfirmationStatus.CANCELLED,
            cancelledAt: now,
            cancellationReason: 'Customer confirmed cancellation via WhatsApp',
            statusChangedAt: now,
          },
        });

        await tx.whatsAppMessage.updateMany({
          where: { orderId: order.id, direction: MessageDirection.OUTBOUND },
          data: {
            customerResponse: 'CANCELLED',
            respondedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            orderId: order.id,
            action: 'WHATSAPP_ORDER_CANCELLED',
            details: {
              responseType: buttonPayload ? 'INTERACTIVE_BUTTON' : 'TEXT_MATCH',
              cancelledAt: now,
            },
          },
        });
      });
    } else if (action === 'AMBIGUOUS') {
      await prisma.auditLog.create({
        data: {
          tenantId,
          orderId: order.id,
          action: 'WHATSAPP_AMBIGUOUS_REPLY',
          details: { text: textBody },
        },
      });
    }
  }

  /**
   * Manually resends a WhatsApp confirmation message with rate limiting and duplicate protection.
   */
  public static async resendConfirmation(tenantId: string, orderId: string, userId?: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { customer: true, tenant: true },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (
      order.confirmationStatus === OrderConfirmationStatus.CANCELLED ||
      order.confirmationStatus === OrderConfirmationStatus.DISPATCHED ||
      order.confirmationStatus === OrderConfirmationStatus.DELIVERED
    ) {
      throw new AppError(`Cannot resend confirmation for ${order.confirmationStatus} order`, 400);
    }

    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { tenantId },
    });

    if (!integration || !integration.isActive) {
      throw new AppError('WhatsApp integration is not active for this store', 400);
    }

    // Rate-limiting / cooldown check: Check recent outbound message for this order
    const recentMessage = await prisma.whatsAppMessage.findFirst({
      where: { orderId, direction: MessageDirection.OUTBOUND },
      orderBy: { createdAt: 'desc' },
    });

    if (recentMessage && Date.now() - recentMessage.createdAt.getTime() < 60000) {
      const waitSeconds = Math.ceil((60000 - (Date.now() - recentMessage.createdAt.getTime())) / 1000);
      throw new AppError(`Please wait ${waitSeconds} seconds before resending another confirmation message.`, 429);
    }

    const phone = order.customer.phoneNumber;
    if (!phone || phone.length < 8 || phone === '+000000000000') {
      throw new AppError('Customer does not have a valid phone number', 400);
    }

    const customerName = `${order.customer.firstName || 'Valued'} ${order.customer.lastName || 'Customer'}`.trim();
    const storeName = order.tenant.name || 'Our Store';

    // Upsert or reset MessageJob
    const job = await prisma.messageJob.upsert({
      where: { orderId },
      create: {
        tenantId,
        orderId,
        recipientPhone: phone,
        templateName: integration.templateName,
        parameters: {
          customerName,
          storeName,
          orderNumber: order.shopifyOrderNumber,
          currency: order.currency,
          orderTotal: order.totalPrice.toString(),
        },
        status: JobStatus.PENDING,
      },
      update: {
        status: JobStatus.PENDING,
        attempts: 0,
        lastError: null,
        recipientPhone: phone,
        parameters: {
          customerName,
          storeName,
          orderNumber: order.shopifyOrderNumber,
          currency: order.currency,
          orderTotal: order.totalPrice.toString(),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        orderId,
        userId: userId || null,
        action: 'WHATSAPP_CONFIRMATION_RESENT',
        details: {
          recipientPhone: phone,
          jobId: job.id,
        },
      },
    });

    // Execute job asynchronously
    setImmediate(() => {
      this.processJob(job.id).catch((err) => {
        console.error(`[MessageJob ${job.id}] Manual resend execution failed:`, err);
      });
    });

    return { success: true, message: 'Confirmation request enqueued successfully', jobId: job.id };
  }
}

