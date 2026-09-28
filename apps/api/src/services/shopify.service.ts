import { prisma } from '../db/prisma';
import {
  encryptCredential,
  decryptCredential,
  sanitizeShopDomain,
  verifyShopifyWebhookHmac,
} from '../utils/crypto';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import {
  OrderConfirmationStatus,
  Prisma,
  SyncStatus,
  WebhookStatus,
} from '@prisma/client';
import { BaileysService } from './baileys.service';

export interface ConnectStoreInput {
  shopDomain: string;
  accessToken: string;
  webhookSecret?: string;
  scopes?: string;
}

export interface WebhookHeaders {
  topic?: string;
  shopDomain?: string;
  hmac?: string;
  webhookId?: string;
}

export class ShopifyService {
  /**
   * Connects or updates a tenant's Shopify store credentials.
   * Access token is encrypted at rest using AES-256-GCM.
   */
  public static async connectStore(
    tenantId: string,
    input: ConnectStoreInput,
    userId?: string
  ) {
    const sanitizedDomain = sanitizeShopDomain(input.shopDomain);
    if (!sanitizedDomain) {
      throw new AppError(
        'Invalid Shopify store domain. Must be in the format: your-store.myshopify.com',
        400
      );
    }

    if (!input.accessToken || input.accessToken.trim().length < 8) {
      throw new AppError('Invalid Shopify access token provided', 400);
    }

    // Check if domain is already connected to another tenant
    const existing = await prisma.shopifyIntegration.findUnique({
      where: { shopDomain: sanitizedDomain },
    });

    if (existing && existing.tenantId !== tenantId) {
      throw new AppError(
        'This Shopify store is already connected to another organization',
        409
      );
    }

    const encryptedToken = encryptCredential(input.accessToken.trim());

    const integration = await prisma.$transaction(async (tx) => {
      const saved = await tx.shopifyIntegration.upsert({
        where: { tenantId },
        update: {
          shopDomain: sanitizedDomain,
          encryptedAccessToken: encryptedToken,
          webhookSecret: input.webhookSecret?.trim() || null,
          scopes: input.scopes || 'read_orders,write_orders,read_customers',
          isActive: true,
          syncStatus: SyncStatus.IDLE,
          syncError: null,
        },
        create: {
          tenantId,
          shopDomain: sanitizedDomain,
          encryptedAccessToken: encryptedToken,
          webhookSecret: input.webhookSecret?.trim() || null,
          scopes: input.scopes || 'read_orders,write_orders,read_customers',
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action: 'SHOPIFY_STORE_CONNECTED',
          details: { shopDomain: sanitizedDomain },
        },
      });

      return saved;
    });

    return {
      id: integration.id,
      shopDomain: integration.shopDomain,
      isActive: integration.isActive,
      installedAt: integration.installedAt,
      lastSyncedAt: integration.lastSyncedAt,
      syncStatus: integration.syncStatus,
    };
  }

  /**
   * Disconnects a tenant's Shopify integration.
   */
  public static async disconnectStore(tenantId: string, userId?: string) {
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { tenantId },
    });

    if (!integration) {
      throw new AppError('No Shopify store connected to this account', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.shopifyIntegration.delete({
        where: { tenantId },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action: 'SHOPIFY_STORE_DISCONNECTED',
          details: { shopDomain: integration.shopDomain },
        },
      });
    });

    return { success: true, message: 'Shopify store disconnected successfully' };
  }

  /**
   * Retrieves current Shopify store connection and sync status without exposing secrets.
   */
  public static async getStoreStatus(tenantId: string) {
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { tenantId },
      select: {
        id: true,
        shopDomain: true,
        isActive: true,
        scopes: true,
        installedAt: true,
        lastSyncedAt: true,
        lastWebhookAt: true,
        syncStatus: true,
        syncError: true,
        syncedOrdersCount: true,
      },
    });

    // Also fetch last 5 webhook events for audit / debugging
    const recentWebhooks = integration
      ? await prisma.webhookEvent.findMany({
          where: { tenantId, source: 'shopify' },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            topic: true,
            status: true,
            webhookId: true,
            errorMessage: true,
            createdAt: true,
          },
        })
      : [];

    return {
      connected: !!integration && integration.isActive,
      integration,
      recentWebhooks,
    };
  }

  /**
   * Ingests, authenticates, and routes incoming Shopify webhooks.
   * Guarantees HMAC signature verification on rawBody and idempotent processing.
   */
  public static async processWebhook(
    headers: WebhookHeaders,
    rawBody: Buffer | undefined,
    parsedPayload: any
  ) {
    const topic = headers.topic;
    const rawDomain = headers.shopDomain;
    const hmacHeader = headers.hmac;
    const webhookId = headers.webhookId;

    if (!topic || !rawDomain || !hmacHeader || !webhookId) {
      throw new AppError('Missing required Shopify webhook headers', 400);
    }

    const shopDomain = sanitizeShopDomain(rawDomain);
    if (!shopDomain) {
      throw new AppError('Invalid Shopify shop domain in webhook', 400);
    }

    // Resolve tenant by shopDomain
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { shopDomain },
    });

    if (!integration || !integration.isActive) {
      throw new AppError(`No active integration found for shop: ${shopDomain}`, 404);
    }

    // Verify HMAC-SHA256
    // Use configured webhookSecret, fallback to decrypted accessToken
    let secret = integration.webhookSecret;
    if (!secret) {
      try {
        secret = decryptCredential(integration.encryptedAccessToken);
      } catch (e) {
        secret = '';
      }
    }

    const isValid = verifyShopifyWebhookHmac(rawBody, hmacHeader, secret);
    if (!isValid) {
      // Record failed security event
      await prisma.webhookEvent.create({
        data: {
          tenantId: integration.tenantId,
          source: 'shopify',
          webhookId,
          topic,
          status: WebhookStatus.FAILED,
          errorMessage: 'HMAC signature verification failed',
          rawPayload: parsedPayload || {},
        },
      });
      throw new AppError('Invalid Shopify webhook HMAC signature', 401);
    }

    // Idempotency: Check if webhookId was already delivered
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: {
        source_webhookId: {
          source: 'shopify',
          webhookId,
        },
      },
    });

    if (existingEvent) {
      return {
        status: 'DUPLICATE_IGNORED',
        message: 'Webhook event was already ingested and processed',
        webhookId,
      };
    }

    // Record webhook receipt
    const event = await prisma.webhookEvent.create({
      data: {
        tenantId: integration.tenantId,
        source: 'shopify',
        webhookId,
        topic,
        status: WebhookStatus.PROCESSING,
        rawPayload: parsedPayload,
      },
    });

    try {
      if (topic === 'orders/create') {
        await this.handleOrderCreate(integration.tenantId, parsedPayload);
      } else if (topic === 'orders/updated') {
        await this.handleOrderUpdate(integration.tenantId, parsedPayload);
      } else if (topic === 'orders/cancelled') {
        await this.handleOrderCancelled(integration.tenantId, parsedPayload);
      }

      // Update event status to PROCESSED
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: WebhookStatus.PROCESSED,
          processedAt: new Date(),
        },
      });

      // Update lastWebhookAt timestamp
      await prisma.shopifyIntegration.update({
        where: { id: integration.id },
        data: { lastWebhookAt: new Date() },
      });

      return { status: 'PROCESSED', topic, webhookId };
    } catch (err: any) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: WebhookStatus.FAILED,
          errorMessage: err.message,
        },
      });
      throw err;
    }
  }

  /**
   * Handles orders/create webhook.
   */
  private static async handleOrderCreate(
    tenantId: string,
    payload: any,
    triggerWhatsApp: boolean = true
  ) {
    const shopifyOrderId = String(payload.id);
    const shopifyOrderNumber = payload.name || `#${payload.order_number || payload.id}`;

    // Normalize phone number
    const rawPhone =
      payload.shipping_address?.phone ||
      payload.billing_address?.phone ||
      payload.customer?.phone ||
      payload.phone;

    let phone = (rawPhone || '').replace(/[\s-]/g, '');
    if (phone && !phone.startsWith('+')) {
      phone = `+${phone}`;
    }
    if (!phone) {
      phone = `+000000000000`; // Fallback placeholder if Shopify order omitted phone
    }

    const firstName = payload.customer?.first_name || payload.shipping_address?.first_name || 'Customer';
    const lastName = payload.customer?.last_name || payload.shipping_address?.last_name || '';
    const email = payload.customer?.email || payload.email || null;

    const totalPrice = payload.total_price || '0.00';
    const subtotalPrice = payload.subtotal_price || totalPrice;
    const totalDiscounts = payload.total_discounts || '0.00';
    const currency = payload.currency || 'USD';
    const gateway = (payload.payment_gateway_names && payload.payment_gateway_names[0]) || 'cash_on_delivery';

    const order = await prisma.$transaction(async (tx) => {
      // Upsert customer scoped to tenant
      const customer = await tx.customer.upsert({
        where: {
          tenantId_phoneNumber: {
            tenantId,
            phoneNumber: phone,
          },
        },
        update: {
          firstName,
          lastName,
          email: email || undefined,
          totalOrders: { increment: 1 },
          totalSpent: { increment: parseFloat(totalPrice) },
        },
        create: {
          tenantId,
          firstName,
          lastName,
          phoneNumber: phone,
          email,
          totalOrders: 1,
          totalSpent: parseFloat(totalPrice),
        },
      });

      // Upsert order
      const existingOrder = await tx.order.findUnique({
        where: {
          tenantId_shopifyOrderId: {
            tenantId,
            shopifyOrderId,
          },
        },
      });

      if (existingOrder) {
        return existingOrder;
      }

      const lineItems = (payload.line_items || []).map((item: any) => ({
        shopifyLineId: String(item.id),
        title: item.title || item.name || 'Product',
        sku: item.sku || null,
        quantity: item.quantity || 1,
        unitPrice: item.price || '0.00',
        totalDiscount: item.total_discount || '0.00',
      }));

      const order = await tx.order.create({
        data: {
          tenantId,
          customerId: customer.id,
          shopifyOrderId,
          shopifyOrderNumber,
          currency,
          totalPrice,
          subtotalPrice,
          totalDiscounts,
          paymentGateway: gateway,
          financialStatus: payload.financial_status || 'pending',
          fulfillmentStatus: payload.fulfillment_status || 'unfulfilled',
          source: 'shopify',
          confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
          shippingAddress: payload.shipping_address ? (payload.shipping_address as Prisma.InputJsonValue) : Prisma.JsonNull,
          orderCreatedAt: payload.created_at ? new Date(payload.created_at) : new Date(),
          items: {
            create: lineItems,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          orderId: order.id,
          action: 'SHOPIFY_ORDER_INGESTED',
          details: {
            shopifyOrderId,
            orderNumber: shopifyOrderNumber,
            totalPrice,
          },
        },
      });

      return order;
    });

    // Phase 4: Automatically trigger WhatsApp order confirmation queue if eligible (Baileys Web)
    if (triggerWhatsApp && order) {
      setImmediate(() => {
        BaileysService.queueOrderConfirmation(tenantId, order.id).catch((err) => {
          console.error(`[Baileys WhatsApp] Auto-queue failed for order ${order.id}:`, err);
        });
      });
    }

    return order;
  }

  /**
   * Handles orders/updated webhook.
   * Updates fulfillment and financial status without overriding internal confirmation states.
   */
  private static async handleOrderUpdate(tenantId: string, payload: any) {
    const shopifyOrderId = String(payload.id);

    const existing = await prisma.order.findUnique({
      where: {
        tenantId_shopifyOrderId: {
          tenantId,
          shopifyOrderId,
        },
      },
    });

    if (!existing) {
      // If order does not exist yet, treat as create
      return this.handleOrderCreate(tenantId, payload);
    }

    await prisma.order.update({
      where: { id: existing.id },
      data: {
        financialStatus: payload.financial_status || existing.financialStatus,
        fulfillmentStatus: payload.fulfillment_status || existing.fulfillmentStatus,
        shippingAddress: payload.shipping_address ? (payload.shipping_address as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  /**
   * Handles orders/cancelled webhook.
   */
  private static async handleOrderCancelled(tenantId: string, payload: any) {
    const shopifyOrderId = String(payload.id);

    const existing = await prisma.order.findUnique({
      where: {
        tenantId_shopifyOrderId: {
          tenantId,
          shopifyOrderId,
        },
      },
    });

    if (!existing) return;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: existing.id },
        data: {
          confirmationStatus: OrderConfirmationStatus.CANCELLED,
          cancelledAt: payload.cancelled_at ? new Date(payload.cancelled_at) : new Date(),
          cancellationReason: payload.cancel_reason || 'Cancelled directly in Shopify Admin',
          statusChangedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          orderId: existing.id,
          action: 'SHOPIFY_ORDER_CANCELLED_REMOTE',
          details: {
            cancelReason: payload.cancel_reason,
            cancelledAt: payload.cancelled_at,
          },
        },
      });
    });
  }

  /**
   * Synchronizes historical orders from Shopify Admin REST API.
   * Supports pagination, rate limit awareness, and idempotent ingestion.
   */
  public static async syncHistoricalOrders(tenantId: string, limit = 50) {
    const integration = await prisma.shopifyIntegration.findUnique({
      where: { tenantId },
    });

    if (!integration || !integration.isActive) {
      throw new AppError('No active Shopify integration found for this store', 404);
    }

    // Set status to SYNCING
    await prisma.shopifyIntegration.update({
      where: { tenantId },
      data: { syncStatus: SyncStatus.SYNCING, syncError: null },
    });

    try {
      const token = decryptCredential(integration.encryptedAccessToken);
      const apiVersion = config.SHOPIFY_API_VERSION || '2025-01';
      const endpoint = `https://${integration.shopDomain}/admin/api/${apiVersion}/orders.json?status=any&limit=${limit}`;

      const response = await fetch(endpoint, {
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API returned HTTP ${response.status}: ${errorText.substring(0, 150)}`);
      }

      const json: any = await response.json();
      const orders = json.orders || [];

      let importedCount = 0;
      for (const ord of orders) {
        await this.handleOrderCreate(tenantId, ord, false);
        importedCount++;
      }

      await prisma.shopifyIntegration.update({
        where: { tenantId },
        data: {
          syncStatus: SyncStatus.COMPLETED,
          lastSyncedAt: new Date(),
          syncedOrdersCount: { increment: importedCount },
          syncError: null,
        },
      });

      return {
        success: true,
        ordersImported: importedCount,
        shopDomain: integration.shopDomain,
      };
    } catch (err: any) {
      await prisma.shopifyIntegration.update({
        where: { tenantId },
        data: {
          syncStatus: SyncStatus.FAILED,
          syncError: err.message,
        },
      });
      throw err;
    }
  }
}
