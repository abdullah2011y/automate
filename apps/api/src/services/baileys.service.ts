import crypto from 'crypto';
import makeWASocket, {
  DisconnectReason,
  jidNormalizedUser,
  WASocket,
  proto,
  delay,
  Browsers,
  decryptPollVote,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { usePostgresAuthState } from './baileys-auth.service';
import { TemplateService, PollOption, DEFAULT_POLL_OPTIONS } from './template.service';
import { AutomationService } from './automation.service';
import {
  toWhatsAppJid,
  isCodGateway,
  normalizePhoneNumber,
} from '../utils/formatters';
import {
  JobStatus,
  MessageDirection,
  MessageStatus,
  OrderConfirmationStatus,
  WhatsAppIntegrationStatus,
} from '@prisma/client';

export interface BaileysConnectionStatus {
  status: WhatsAppIntegrationStatus;
  qrCode: string | null;
  displayPhoneNumber: string | null;
  connectedAt: Date | null;
  lastError: string | null;
  uptimeSeconds: number;
  logs: Array<{ time: string; message: string; level: 'info' | 'warn' | 'error' }>;
}

export class BaileysService {
  private static sock: WASocket | null = null;
  private static status: WhatsAppIntegrationStatus = WhatsAppIntegrationStatus.DISCONNECTED;
  private static qrCodeDataUrl: string | null = null;
  private static displayPhoneNumber: string | null = null;
  private static connectedAt: Date | null = null;
  private static lastError: string | null = null;
  private static logs: Array<{ time: string; message: string; level: 'info' | 'warn' | 'error' }> = [];
  private static sseClients: Response[] = [];
  private static reconnectAttempts = 0;
  private static isExplicitlyStopped = false;
  private static reconnectTimer: NodeJS.Timeout | null = null;
  private static isSendingQueue = false;

  private static log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const entry = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      level,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    if (level === 'error') console.error(`[Baileys] ${message}`);
    else console.log(`[Baileys] ${message}`);
  }

  /**
   * Initializes the single-user Baileys WhatsApp connection.
   */
  public static async init() {
    if (this.sock) return;
    this.isExplicitlyStopped = false;
    await this.connect();
  }

  /**
   * Connects to WhatsApp Web Multi-Device using PostgreSQL auth state.
   */
  public static async connect() {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.status = WhatsAppIntegrationStatus.CONNECTING;
      this.broadcastState();
      this.log('Initializing WhatsApp Web socket connection...');

      const { state, saveCreds, clearSession } = await usePostgresAuthState('default');

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false,
      });

      // 1. Connection Updates (QR code, connect, disconnect)
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await qrcode.toDataURL(qr, {
              margin: 2,
              width: 320,
              color: { dark: '#0A192F', light: '#FFFFFF' },
            });
            this.status = WhatsAppIntegrationStatus.QR_REQUIRED;
            this.log('New pairing QR code generated. Scan from WhatsApp mobile app.');
            this.broadcastState();
          } catch (qrErr: any) {
            this.log(`Failed to render QR Code: ${qrErr.message}`, 'error');
          }
        }

        if (connection === 'open') {
          this.status = WhatsAppIntegrationStatus.CONNECTED;
          this.qrCodeDataUrl = null;
          this.connectedAt = new Date();
          this.reconnectAttempts = 0;
          this.lastError = null;

          const rawJid = this.sock?.user?.id || '';
          const normalized = jidNormalizedUser(rawJid);
          this.displayPhoneNumber = normalized.split('@')[0];

          this.log(`Connected successfully to WhatsApp as +${this.displayPhoneNumber}!`);
          await this.syncDatabaseIntegrationStatus();
          this.broadcastState();

          // Process queued message jobs that were retained while offline
          setImmediate(() => {
            this.processPendingJobs().catch((err) => {
              this.log(`Error processing queued jobs: ${err.message}`, 'error');
            });
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.isExplicitlyStopped;

          this.log(`Connection closed (statusCode: ${statusCode || 'unknown'}). Reconnect: ${shouldReconnect}`, 'warn');

          if (statusCode === DisconnectReason.loggedOut) {
            this.log('Session logged out from device. Clearing invalid credentials.', 'warn');
            await clearSession();
            this.status = WhatsAppIntegrationStatus.DISCONNECTED;
            this.displayPhoneNumber = null;
            this.connectedAt = null;
            await this.syncDatabaseIntegrationStatus();
            this.broadcastState();

            // Automatically restart to show fresh pairing QR
            if (!this.isExplicitlyStopped) {
              setTimeout(() => this.connect(), 2000);
            }
          } else if (shouldReconnect) {
            this.status = WhatsAppIntegrationStatus.RECONNECTING;
            this.reconnectAttempts++;
            const backoffMs = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1500);
            this.log(`Reconnecting in ${(backoffMs / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`);
            this.broadcastState();

            this.reconnectTimer = setTimeout(() => {
              this.connect();
            }, backoffMs);
          } else {
            this.status = WhatsAppIntegrationStatus.DISCONNECTED;
            this.broadcastState();
          }
        }
      });

      // 2. Credentials Updates
      this.sock.ev.on('creds.update', saveCreds);

      // 3. Inbound Customer Messages Listener (CONFIRM / CANCEL / POLL VOTES)
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;
          const senderJid = msg.key.remoteJid;
          if (!senderJid || senderJid.endsWith('@g.us') || senderJid === 'status@broadcast') continue;

          // Check if message is a native WhatsApp Poll vote update
          if (msg.message?.pollUpdateMessage) {
            await this.handleInboundPollVote(msg);
            continue;
          }

          await this.handleInboundCustomerMessage(msg);
        }
      });

      // 4. Message Delivery Receipts
      this.sock.ev.on('messages.update', async (updates) => {
        for (const u of updates) {
          const wamid = u.key.id;
          if (!wamid) continue;

          const status = u.update.status;
          if (!status) continue;

          // Baileys status: 2 = SERVER_ACK (sent), 3 = DELIVERY_ACK (delivered), 4 = READ (read)
          let dbStatus: MessageStatus | null = null;
          const updateData: any = {};

          if (status === proto.WebMessageInfo.Status.DELIVERY_ACK) {
            dbStatus = MessageStatus.DELIVERED;
            updateData.status = dbStatus;
            updateData.deliveredAt = new Date();
          } else if (status === proto.WebMessageInfo.Status.READ || status === proto.WebMessageInfo.Status.PLAYED) {
            dbStatus = MessageStatus.READ;
            updateData.status = dbStatus;
            updateData.readAt = new Date();
          }

          // Handle potential poll updates delivered via messages.update
          const pollUpdates = (u.update as any)?.pollUpdates;
          if (Array.isArray(pollUpdates)) {
            for (const pollUpd of pollUpdates) {
              const fakeMsg: proto.IWebMessageInfo = {
                key: u.key,
                message: {
                  pollUpdateMessage: pollUpd,
                },
              };
              await this.handleInboundPollVote(fakeMsg);
            }
          }

          if (dbStatus) {
            await prisma.whatsAppMessage.updateMany({
              where: { wamid },
              data: updateData,
            });
          }
        }
      });
    } catch (err: any) {
      this.status = WhatsAppIntegrationStatus.ERROR;
      this.lastError = err.message;
      this.log(`Failed to initialize Baileys connection: ${err.message}`, 'error');
      this.broadcastState();
    }
  }

  /**
   * Gracefully disconnects the Baileys socket.
   */
  public static async disconnect() {
    this.isExplicitlyStopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {}
      this.sock = null;
    }

    this.status = WhatsAppIntegrationStatus.DISCONNECTED;
    this.qrCodeDataUrl = null;
    this.log('WhatsApp connection disconnected manually by administrator.');
    await this.syncDatabaseIntegrationStatus();
    this.broadcastState();
    return { success: true, message: 'Disconnected successfully' };
  }

  /**
   * Reconnects and generates a fresh pairing session.
   */
  public static async reconnect() {
    await this.disconnect();
    this.isExplicitlyStopped = false;
    await this.connect();
    return { success: true, message: 'Reconnection initiated' };
  }

  /**
   * Completely purges all stored cryptographic session keys from PostgreSQL
   * and initializes a pristine, clean pairing QR code.
   */
  public static async resetSession() {
    this.log('Hard resetting WhatsApp session and purging PostgreSQL credentials...');
    await this.disconnect();

    try {
      await prisma.whatsAppSession.deleteMany({
        where: { sessionId: 'default' },
      });
      this.log('Cleared all PostgreSQL session keys for default session.');
    } catch (e: any) {
      this.log(`Error clearing session keys: ${e.message}`, 'error');
    }

    this.displayPhoneNumber = null;
    this.connectedAt = null;
    this.qrCodeDataUrl = null;
    this.status = WhatsAppIntegrationStatus.DISCONNECTED;
    await this.syncDatabaseIntegrationStatus();
    this.broadcastState();

    this.isExplicitlyStopped = false;
    await this.connect();
    return { success: true, message: 'WhatsApp session reset. Generating fresh QR code...' };
  }

  /**
   * Retrieves the current live status for the dashboard.
   */
  public static getStatus(): BaileysConnectionStatus {
    const uptime = this.connectedAt
      ? Math.floor((Date.now() - this.connectedAt.getTime()) / 1000)
      : 0;

    return {
      status: this.status,
      qrCode: this.qrCodeDataUrl,
      displayPhoneNumber: this.displayPhoneNumber,
      connectedAt: this.connectedAt,
      lastError: this.lastError,
      uptimeSeconds: uptime,
      logs: this.logs,
    };
  }

  /**
   * Handles inbound poll vote interactions from customer.
   * Decrypts voter choice using stored messageSecret and updates order status.
   */
  public static async handleInboundPollVote(msg: proto.IWebMessageInfo) {
    try {
      const pollUpdate = msg.message?.pollUpdateMessage;
      if (!pollUpdate || !pollUpdate.vote || !pollUpdate.pollCreationMessageKey) return;

      const creationKey = pollUpdate.pollCreationMessageKey;
      const pollMsgId = creationKey.id;
      const senderJid = msg.key.remoteJid!;
      const phoneDigits = senderJid.split('@')[0].replace(/\D/g, '');
      const phoneSuffix = phoneDigits.slice(-10);

      this.log(`Received poll vote from +${phoneDigits} for poll message ID: ${pollMsgId}`);

      // Locate original outbound WhatsAppMessage that contained the poll
      let dbMsg = await prisma.whatsAppMessage.findFirst({
        where: {
          OR: [
            ...(pollMsgId ? [{ wamid: pollMsgId }] : []),
            ...(pollMsgId ? [{ payload: { path: ['pollWamid'], equals: pollMsgId } }] : []),
          ],
        },
        include: { order: true },
        orderBy: { createdAt: 'desc' },
      });

      // Fallback: search by customer phone number and pending confirmation order
      if (!dbMsg || !dbMsg.order) {
        dbMsg = await prisma.whatsAppMessage.findFirst({
          where: {
            recipientPhone: { contains: phoneSuffix },
            direction: MessageDirection.OUTBOUND,
            order: {
              confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
            },
          },
          include: { order: true },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!dbMsg || !dbMsg.order) {
        this.log(`No active order found matching poll vote from +${phoneDigits}`, 'warn');
        return;
      }

      const payload = (dbMsg.payload as any) || {};
      const secretBase64 = payload.messageSecretBase64;
      const pollOptions: PollOption[] = Array.isArray(payload.pollOptions) && payload.pollOptions.length > 0
        ? payload.pollOptions
        : DEFAULT_POLL_OPTIONS;

      let selectedOption: PollOption | null = null;

      if (secretBase64 && this.sock) {
        try {
          const meIdNormalised = jidNormalizedUser(this.sock.user?.id || '');
          const pollCreatorJid = creationKey.fromMe
            ? meIdNormalised
            : (creationKey.participant || creationKey.remoteJid || meIdNormalised);
          const voterJid = msg.key.fromMe
            ? meIdNormalised
            : (msg.key.participant || msg.key.remoteJid || `${phoneDigits}@s.whatsapp.net`);

          const decryptedVote = decryptPollVote(
            pollUpdate.vote,
            {
              pollEncKey: Buffer.from(secretBase64, 'base64'),
              pollCreatorJid,
              pollMsgId: pollMsgId || creationKey.id || '',
              voterJid,
            }
          );

          const selectedBuffers = decryptedVote.selectedOptions || [];
          if (selectedBuffers.length === 0) {
            this.log(`Customer +${phoneDigits} unselected/cleared poll choice.`);
            return;
          }

          const selectedBuffer = Buffer.from(selectedBuffers[0]);

          for (const opt of pollOptions) {
            const hash = crypto.createHash('sha256').update(Buffer.from(opt.text)).digest();
            if (selectedBuffer.equals(hash)) {
              selectedOption = opt;
              break;
            }
          }
        } catch (decryptErr: any) {
          this.log(`Decryption error for poll vote: ${decryptErr.message}`, 'error');
        }
      }

      // Fallback: If decryption could not match, default to first option
      if (!selectedOption && pollOptions.length > 0) {
        this.log(`Could not directly map option hash, defaulting to first option for +${phoneDigits}`, 'warn');
        selectedOption = pollOptions[0];
      }

      if (!selectedOption) return;

      this.log(`Customer +${phoneDigits} tapped poll option: "${selectedOption.text}" (Status ID: ${selectedOption.id})`);

      const targetOrder = dbMsg.order;
      const tenantId = dbMsg.tenantId;
      const now = new Date();

      // Determine target confirmation status from option.id
      let targetStatus: OrderConfirmationStatus = OrderConfirmationStatus.CONFIRMED;
      const upperStatus = selectedOption.id.toUpperCase();
      if (upperStatus === 'CANCELLED' || upperStatus === 'CANCEL') {
        targetStatus = OrderConfirmationStatus.CANCELLED;
      } else if (upperStatus === 'CONFIRMED' || upperStatus === 'CONFIRM') {
        targetStatus = OrderConfirmationStatus.CONFIRMED;
      } else if (Object.values(OrderConfirmationStatus).includes(upperStatus as OrderConfirmationStatus)) {
        targetStatus = upperStatus as OrderConfirmationStatus;
      }

      await prisma.$transaction(async (tx) => {
        const updateData: any = {
          confirmationStatus: targetStatus,
          statusChangedAt: now,
        };

        if (targetStatus === OrderConfirmationStatus.CONFIRMED) {
          updateData.confirmedAt = now;
        } else if (targetStatus === OrderConfirmationStatus.CANCELLED) {
          updateData.cancelledAt = now;
          updateData.cancellationReason = `Customer tapped "${selectedOption!.text}" in WhatsApp Poll`;
        }

        await tx.order.update({
          where: { id: targetOrder.id },
          data: updateData,
        });

        await tx.whatsAppMessage.updateMany({
          where: { orderId: targetOrder.id, direction: MessageDirection.OUTBOUND },
          data: {
            customerResponse: selectedOption!.text,
            respondedAt: now,
          },
        });

        // Record inbound vote as a WhatsAppMessage
        await tx.whatsAppMessage.create({
          data: {
            tenantId,
            orderId: targetOrder.id,
            customerId: targetOrder.customerId,
            wamid: msg.key.id || `baileys_vote_${Date.now()}`,
            recipientPhone: phoneDigits,
            direction: MessageDirection.INBOUND,
            status: MessageStatus.READ,
            messageType: 'poll_vote',
            payload: {
              selectedOption: selectedOption!.text,
              statusId: selectedOption!.id,
              pollMsgId,
            },
            sentAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            orderId: targetOrder.id,
            action: targetStatus === OrderConfirmationStatus.CONFIRMED
              ? 'WHATSAPP_ORDER_CONFIRMED'
              : targetStatus === OrderConfirmationStatus.CANCELLED
              ? 'WHATSAPP_ORDER_CANCELLED'
              : 'WHATSAPP_ORDER_STATUS_UPDATED',
            details: {
              source: 'WHATSAPP_POLL',
              selectedOptionText: selectedOption!.text,
              statusId: selectedOption!.id,
              targetStatus,
            },
          },
        });
      });

      this.log(`Order ${targetOrder.shopifyOrderNumber} successfully updated to ${targetStatus} from WhatsApp Poll tap!`);

      // Dispatch option-specific autoReply
      if (selectedOption.autoReply && selectedOption.autoReply.trim() !== '') {
        await this.sendDirectMessage(senderJid, selectedOption.autoReply.trim()).catch((err) => {
          this.log(`Failed to send poll auto-reply: ${err.message}`, 'warn');
        });
      }
    } catch (err: any) {
      this.log(`Error handling inbound poll vote: ${err.message}`, 'error');
    }
  }

  /**
   * Handles incoming customer replies (CONFIRM, CANCEL, YES, NO).
   */
  public static async handleInboundCustomerMessage(msg: proto.IWebMessageInfo) {
    const senderJid = msg.key.remoteJid!;
    const rawText =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.buttonsResponseMessage?.selectedButtonId ||
      '';

    if (!rawText || rawText.trim() === '') return;

    const cleanText = rawText.trim().toLowerCase();
    // Normalize phone number (e.g. "923001234567@s.whatsapp.net" -> "+923001234567" or last 10 digits)
    const phoneDigits = senderJid.split('@')[0].replace(/\D/g, '');
    const phoneSuffix = phoneDigits.slice(-10);

    // Resolve tenant (single owner: default tenant)
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return;

    const settings = await AutomationService.getSettings(tenant.id);

    // 1. Opt-out handling (STOP, UNSUBSCRIBE, OPTOUT, RUK JAO, etc.)
    const isOptOut = settings.optOutKeywords.some((k) =>
      new RegExp(`\\b${k}\\b`, 'i').test(cleanText)
    );
    if (isOptOut) {
      await prisma.customer.updateMany({
        where: {
          tenantId: tenant.id,
          phoneNumber: { contains: phoneSuffix },
        },
        data: {
          isOptedOut: true,
          optedOutAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: 'CUSTOMER_WHATSAPP_OPT_OUT',
          details: { phoneDigits, rawReply: rawText },
        },
      });

      this.log(`Customer +${phoneDigits} opted out of automated WhatsApp messages.`);
      if (settings.optOutReplyText) {
        await this.sendDirectMessage(senderJid, settings.optOutReplyText).catch(() => {});
      }
      return;
    }

    // 2. Opt-in re-activation handling (START, ACTIVATE, SHURU)
    const isOptIn = ['start', 'activate', 'shuru', 'unstop'].some((k) =>
      new RegExp(`\\b${k}\\b`, 'i').test(cleanText)
    );
    if (isOptIn) {
      await prisma.customer.updateMany({
        where: {
          tenantId: tenant.id,
          phoneNumber: { contains: phoneSuffix },
        },
        data: {
          isOptedOut: false,
          optedOutAt: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: 'CUSTOMER_WHATSAPP_OPT_IN',
          details: { phoneDigits, rawReply: rawText },
        },
      });

      this.log(`Customer +${phoneDigits} re-opted in to automated WhatsApp notifications.`);
      await this.sendDirectMessage(
        senderJid,
        'Aapki automated WhatsApp notifications dobara activate kar di gayi hain. Shukriya!'
      ).catch(() => {});
      return;
    }

    // 3. Keyword matching (CONFIRM / CANCEL)
    const isConfirm = settings.confirmKeywords.some((k) =>
      new RegExp(`\\b${k}\\b`, 'i').test(cleanText)
    );
    const isCancel = settings.cancelKeywords.some((k) =>
      new RegExp(`\\b${k}\\b`, 'i').test(cleanText)
    );

    if (!isConfirm && !isCancel) {
      this.log(`Incoming message from +${phoneDigits} ("${rawText}") did not match confirmation keywords.`);
      return;
    }

    // Resolve pending orders for this phone number
    const pendingOrders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
        customer: {
          phoneNumber: { contains: phoneSuffix },
        },
      },
      orderBy: { orderCreatedAt: 'desc' },
      include: { customer: true },
    });

    if (pendingOrders.length === 0) {
      // Check if order was already confirmed
      const recentConfirmed = await prisma.order.findFirst({
        where: {
          tenantId: tenant.id,
          customer: { phoneNumber: { contains: phoneSuffix } },
        },
        orderBy: { orderCreatedAt: 'desc' },
      });

      if (recentConfirmed?.confirmationStatus === OrderConfirmationStatus.CONFIRMED) {
        await this.sendDirectMessage(senderJid, 'Aapka order pehle hi confirm ho chuka hai. Shukriya!').catch((err) => {
          this.log(`Failed to send already-confirmed reply: ${err.message}`, 'warn');
        });
      } else {
        await this.sendDirectMessage(senderJid, settings.ambiguousReplyText).catch((err) => {
          this.log(`Failed to send ambiguous reply: ${err.message}`, 'warn');
        });
      }
      return;
    }

    // If multiple orders, require specifying order number
    if (pendingOrders.length > 1) {
      const orderMatch = pendingOrders.find(
        (o) => o.shopifyOrderNumber && cleanText.includes(o.shopifyOrderNumber.toLowerCase().replace('#', ''))
      );

      if (!orderMatch) {
        const orderList = pendingOrders.map((o) => o.shopifyOrderNumber).join(', ');
        await this.sendDirectMessage(
          senderJid,
          `Aapke multiple orders pending hain (${orderList}). Barah-e-karam apna order number likh kar confirm karein (e.g. CONFIRM ${pendingOrders[0].shopifyOrderNumber}).`
        ).catch((err) => {
          this.log(`Failed to send multiple orders reply: ${err.message}`, 'warn');
        });
        return;
      }
    }

    const targetOrder = pendingOrders[0];
    const now = new Date();

    if (isConfirm) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: targetOrder.id },
          data: {
            confirmationStatus: OrderConfirmationStatus.CONFIRMED,
            confirmedAt: now,
            statusChangedAt: now,
          },
        });

        await tx.whatsAppMessage.updateMany({
          where: { orderId: targetOrder.id, direction: MessageDirection.OUTBOUND },
          data: {
            customerResponse: 'CONFIRMED',
            respondedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            orderId: targetOrder.id,
            action: 'WHATSAPP_ORDER_CONFIRMED',
            details: {
              rawReply: rawText,
              channel: 'BAILEYS_WHATSAPP_WEB',
            },
          },
        });
      });

      // Find if outbound message has an option-specific auto-reply
      const latestOutbound = await prisma.whatsAppMessage.findFirst({
        where: { orderId: targetOrder.id, direction: MessageDirection.OUTBOUND },
        orderBy: { createdAt: 'desc' },
      });
      const outboundPayload = (latestOutbound?.payload as any) || {};
      const outboundPollOpts: PollOption[] = outboundPayload.pollOptions || [];
      const confirmOpt = outboundPollOpts.find((o) => o.id === 'CONFIRMED' || o.text.toLowerCase().includes('confirm'));
      const confirmReply = confirmOpt?.autoReply?.trim() || settings.successReplyText;

      this.log(`Order ${targetOrder.shopifyOrderNumber} successfully CONFIRMED by customer (+${phoneDigits})`);
      if (confirmReply) {
        await this.sendDirectMessage(senderJid, confirmReply).catch((err) => {
          this.log(`Failed to send confirmation auto-reply: ${err.message}`, 'warn');
        });
      }
    } else if (isCancel) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: targetOrder.id },
          data: {
            confirmationStatus: OrderConfirmationStatus.CANCELLED,
            cancelledAt: now,
            cancellationReason: 'Customer requested cancellation via WhatsApp Web',
            statusChangedAt: now,
          },
        });

        await tx.whatsAppMessage.updateMany({
          where: { orderId: targetOrder.id, direction: MessageDirection.OUTBOUND },
          data: {
            customerResponse: 'CANCELLED',
            respondedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            orderId: targetOrder.id,
            action: 'WHATSAPP_ORDER_CANCELLED',
            details: {
              rawReply: rawText,
              channel: 'BAILEYS_WHATSAPP_WEB',
            },
          },
        });
      });

      const latestOutbound = await prisma.whatsAppMessage.findFirst({
        where: { orderId: targetOrder.id, direction: MessageDirection.OUTBOUND },
        orderBy: { createdAt: 'desc' },
      });
      const outboundPayload = (latestOutbound?.payload as any) || {};
      const outboundPollOpts: PollOption[] = outboundPayload.pollOptions || [];
      const cancelOpt = outboundPollOpts.find((o) => o.id === 'CANCELLED' || o.text.toLowerCase().includes('cancel'));
      const cancelReply = cancelOpt?.autoReply?.trim() || settings.cancelReplyText;

      this.log(`Order ${targetOrder.shopifyOrderNumber} CANCELLED by customer (+${phoneDigits})`);
      if (cancelReply) {
        await this.sendDirectMessage(senderJid, cancelReply).catch((err) => {
          this.log(`Failed to send cancellation auto-reply: ${err.message}`, 'warn');
        });
      }
    }
  }

  /**
   * Sends a direct text message through the active Baileys socket.
   */
  public static async sendDirectMessage(jid: string, text: string) {
    if (!this.sock || this.status !== WhatsAppIntegrationStatus.CONNECTED) {
      throw new Error('WhatsApp is not connected');
    }

    const formattedJid = toWhatsAppJid(jid);
    return this.sock.sendMessage(formattedJid, { text });
  }

  /**
   * Sends a native WhatsApp single-choice poll directly through the active Baileys socket.
   */
  public static async sendDirectPoll(jid: string, question: string, options: string[]) {
    if (!this.sock || this.status !== WhatsAppIntegrationStatus.CONNECTED) {
      throw new Error('WhatsApp is not connected');
    }

    const formattedJid = toWhatsAppJid(jid);
    return this.sock.sendMessage(formattedJid, {
      poll: {
        name: question,
        values: options,
        selectableCount: 1,
      },
    });
  }

  /**
   * Queues an automatic order confirmation message.
   */
  public static async queueOrderConfirmation(tenantId: string, orderId: string) {
    const settings = await AutomationService.getSettings(tenantId);
    if (!settings.autoConfirmEnabled) {
      return { queued: false, reason: 'Auto-confirmation is disabled in Automation Settings' };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, tenant: true, items: true },
    });

    if (!order) return { queued: false, reason: 'Order not found' };

    // Prevent automated messaging to opted-out customers
    if (order.customer.isOptedOut) {
      this.log(`Skipped auto-confirmation for order ${order.shopifyOrderNumber}: customer +${order.customer.phoneNumber} is opted out.`);
      return { queued: false, reason: 'Customer has opted out of automated WhatsApp notifications' };
    }

    if (order.confirmationStatus !== OrderConfirmationStatus.PENDING_CONFIRMATION) {
      return { queued: false, reason: `Order is already ${order.confirmationStatus}` };
    }

    const isCod = isCodGateway(order.paymentGateway);
    if (settings.eligibleOrderTypes && settings.eligibleOrderTypes.length > 0) {
      const isEligible = settings.eligibleOrderTypes.some((t) => {
        const normTarget = t.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normOrder = (order.paymentGateway || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return normTarget === normOrder || (normTarget.includes('cod') && isCod);
      });
      if (!isEligible && !isCod) {
        return { queued: false, reason: `Payment gateway "${order.paymentGateway}" is not in eligible order types` };
      }
    } else if (settings.codOnly && !isCod) {
      return { queued: false, reason: `Order gateway "${order.paymentGateway}" is not Cash on Delivery` };
    }

    const rawPhone = order.customer.phoneNumber;
    if (settings.skipMissingPhone && (!rawPhone || rawPhone.length < 8 || rawPhone === '+000000000000')) {
      return { queued: false, reason: 'Customer has no valid phone number' };
    }

    // Check if job already exists
    const existingJob = await prisma.messageJob.findUnique({
      where: { orderId },
    });
    if (existingJob) {
      return { queued: false, reason: 'Confirmation job already exists' };
    }

    let template = null;
    if (settings.defaultTemplateId) {
      template = await prisma.messageTemplate.findUnique({
        where: { id: settings.defaultTemplateId },
      });
    }
    if (!template) {
      template = await TemplateService.getDefaultTemplate('ORDER_CONFIRMATION');
    }

    const customerName = `${order.customer.firstName || 'Valued'} ${order.customer.lastName || 'Customer'}`.trim();
    const storeName = order.tenant.name || 'ByteForge Store';

    const productList = order.items && order.items.length > 0
      ? order.items.map((i) => `${i.quantity}x ${i.title}`).join(', ')
      : 'Items ordered';

    const shippingAddrObj = order.shippingAddress as any;
    const shippingAddressText = shippingAddrObj
      ? [shippingAddrObj.address1, shippingAddrObj.city, shippingAddrObj.province, shippingAddrObj.country].filter(Boolean).join(', ')
      : '';

    const totalQuantity = order.items && order.items.length > 0
      ? order.items.reduce((sum, i) => sum + (i.quantity || 1), 0).toString()
      : '1';

    const productTitle = order.items && order.items.length > 0
      ? order.items.map((i) => i.title).join(', ')
      : 'Product';

    const templateVars = {
      customer_name: customerName,
      store_name: storeName,
      order_number: order.shopifyOrderNumber,
      currency: order.currency || 'Rs.',
      order_total: order.totalPrice.toString(),
      total_amount: order.totalPrice.toString(),
      total_price: order.totalPrice.toString(),
      product_name: productTitle,
      product_list: productList,
      quantity: totalQuantity,
      total_quantity: totalQuantity,
      payment_method: 'Cash on Delivery',
      shipping_address: shippingAddressText,
    };

    const renderedBody = TemplateService.render(template.body, templateVars);
    const renderedPollQuestion = TemplateService.render(
      template.pollQuestion || 'Aapka order {{order_number}} confirm karein:',
      templateVars
    );
    const pollOptions = (template.pollOptions as any as PollOption[]) || DEFAULT_POLL_OPTIONS;

    const job = await prisma.messageJob.create({
      data: {
        tenantId,
        orderId: order.id,
        recipientPhone: rawPhone,
        templateName: template.name,
        parameters: {
          renderedBody,
          customerName,
          orderNumber: order.shopifyOrderNumber,
          hasPoll: template.hasPoll !== false,
          pollQuestion: renderedPollQuestion,
          pollOptions,
        } as any,
        status: JobStatus.PENDING,
      },
    });

    this.log(`Queued confirmation MessageJob for order ${order.shopifyOrderNumber}`);

    // If connected, dispatch immediately
    if (this.status === WhatsAppIntegrationStatus.CONNECTED) {
      setImmediate(() => {
        this.processPendingJobs().catch((err) => {
          this.log(`Queue runner error: ${err.message}`, 'error');
        });
      });
    }

    return { queued: true, jobId: job.id };
  }

  /**
   * Processes all pending MessageJobs sequentially with anti-ban delay.
   */
  public static async processPendingJobs() {
    if (this.isSendingQueue) return;
    if (!this.sock || this.status !== WhatsAppIntegrationStatus.CONNECTED) return;

    this.isSendingQueue = true;

    try {
      const pendingJobs = await prisma.messageJob.findMany({
        where: {
          status: JobStatus.PENDING,
          nextAttemptAt: { lte: new Date() },
        },
        take: 10,
        orderBy: { createdAt: 'asc' },
        include: { order: { include: { customer: true, tenant: true } } },
      });

      for (const job of pendingJobs) {
        if (!this.sock || this.status !== WhatsAppIntegrationStatus.CONNECTED) break;

        const settings = await AutomationService.getSettings(job.tenantId);
        const delayMs = (settings.minDelaySeconds || 3) * 1000;

        // Skip opted-out customers safely
        if (job.order.customer.isOptedOut) {
          await prisma.messageJob.update({
            where: { id: job.id },
            data: {
              status: JobStatus.FAILED,
              lastError: 'Customer opted out of automated WhatsApp messages',
            },
          });
          continue;
        }

        await prisma.messageJob.update({
          where: { id: job.id },
          data: { status: JobStatus.PROCESSING, attempts: { increment: 1 }, lockedAt: new Date() },
        });

        try {
          const params = job.parameters as any;
          const bodyText = params.renderedBody || 'Please confirm your order.';
          const jid = toWhatsAppJid(job.recipientPhone);
          const cleanPhone = jid.split('@')[0];

          // Anti-ban delay
          await delay(delayMs);

          let wamid: string;
          let secretBase64: string | null = null;
          const hasPoll = params.hasPoll !== false;
          const pollOptions: PollOption[] = params.pollOptions || DEFAULT_POLL_OPTIONS;

          if (hasPoll && pollOptions.length >= 2) {
            // Send EXACTLY ONE message: The WhatsApp Poll containing the full message body + tap buttons
            const pollQuestionText = params.pollQuestion ? String(params.pollQuestion).trim() : '';
            const fullPollName = pollQuestionText && !bodyText.includes(pollQuestionText)
              ? `${bodyText}\n\n${pollQuestionText}`
              : bodyText;

            const pollSent = await this.sock.sendMessage(jid, {
              poll: {
                name: fullPollName,
                values: pollOptions.map((opt: any) => opt.text),
                selectableCount: 1,
              },
            });

            wamid = pollSent?.key?.id || `baileys_poll_${Date.now()}`;
            const secretBuffer = pollSent?.message?.messageContextInfo?.messageSecret;
            if (secretBuffer) {
              secretBase64 = Buffer.from(secretBuffer).toString('base64');
            }
          } else {
            // When poll is disabled, send standard text message only
            const textSent = await this.sock.sendMessage(jid, { text: bodyText });
            wamid = textSent?.key?.id || `baileys_${Date.now()}`;
          }

          await prisma.$transaction([
            prisma.messageJob.update({
              where: { id: job.id },
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
                messageType: hasPoll ? 'poll' : 'text',
                payload: {
                  body: bodyText,
                  hasPoll,
                  pollQuestion: params.pollQuestion,
                  pollOptions,
                  pollWamid: hasPoll ? wamid : null,
                  messageSecretBase64: secretBase64,
                } as any,
                sentAt: new Date(),
              },
            }),
            prisma.order.update({
              where: { id: job.orderId },
              data: { messageSentAt: new Date() },
            }),
          ]);

          this.log(
            `Dispatched single WhatsApp confirmation ${hasPoll ? '(Interactive Poll)' : '(Text)'} to +${cleanPhone} for order ${job.order.shopifyOrderNumber}`
          );
        } catch (jobErr: any) {
          const maxRetries = settings.maxRetryAttempts || 3;
          const currentAttempts = job.attempts + 1;
          const isFinalFailure = currentAttempts >= maxRetries;
          const backoffSeconds = Math.min(300, Math.pow(2, currentAttempts) * 15);
          const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

          this.log(
            `Failed to dispatch message for job ${job.id} (attempt ${currentAttempts}/${maxRetries}): ${jobErr.message}`,
            'error'
          );

          await prisma.messageJob.update({
            where: { id: job.id },
            data: {
              status: isFinalFailure ? JobStatus.FAILED : JobStatus.PENDING,
              lastError: jobErr.message,
              nextAttemptAt,
            },
          });

          if (isFinalFailure) {
            await prisma.whatsAppMessage.create({
              data: {
                tenantId: job.tenantId,
                orderId: job.orderId,
                customerId: job.order.customerId,
                recipientPhone: job.recipientPhone,
                direction: MessageDirection.OUTBOUND,
                status: MessageStatus.FAILED,
                failedAt: new Date(),
                failureReason: jobErr.message,
              },
            });
          }
        }
      }
    } finally {
      this.isSendingQueue = false;
    }
  }

  /**
   * Manually resends confirmation for an order with rate-limiting cooldown.
   */
  public static async resendConfirmation(tenantId: string, orderId: string, userId?: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { customer: true, tenant: true },
    });

    if (!order) throw new Error('Order not found');

    if (
      order.confirmationStatus === OrderConfirmationStatus.CANCELLED ||
      order.confirmationStatus === OrderConfirmationStatus.DISPATCHED ||
      order.confirmationStatus === OrderConfirmationStatus.DELIVERED
    ) {
      throw new Error(`Cannot resend confirmation for ${order.confirmationStatus} order`);
    }

    // Cooldown check (60 seconds)
    const recent = await prisma.whatsAppMessage.findFirst({
      where: { orderId, direction: MessageDirection.OUTBOUND },
      orderBy: { createdAt: 'desc' },
    });

    if (recent && Date.now() - recent.createdAt.getTime() < 60000) {
      const wait = Math.ceil((60000 - (Date.now() - recent.createdAt.getTime())) / 1000);
      throw new Error(`Please wait ${wait} seconds before resending another confirmation message.`);
    }

    const template = await TemplateService.getDefaultTemplate('ORDER_CONFIRMATION');
    const customerName = `${order.customer.firstName || 'Valued'} ${order.customer.lastName || 'Customer'}`.trim();
    const storeName = order.tenant.name || 'ByteForge Store';

    const templateVars = {
      customer_name: customerName,
      store_name: storeName,
      order_number: order.shopifyOrderNumber,
      currency: order.currency || 'Rs.',
      order_total: order.totalPrice.toString(),
      payment_method: 'Cash on Delivery',
    };

    const renderedBody = TemplateService.render(template.body, templateVars);
    const renderedPollQuestion = TemplateService.render(
      template.pollQuestion || 'Aapka order {{order_number}} confirm karein:',
      templateVars
    );
    const pollOptions = (template.pollOptions as any as PollOption[]) || DEFAULT_POLL_OPTIONS;

    const jobParams = {
      renderedBody,
      customerName,
      orderNumber: order.shopifyOrderNumber,
      hasPoll: template.hasPoll !== false,
      pollQuestion: renderedPollQuestion,
      pollOptions,
    };

    const job = await prisma.messageJob.upsert({
      where: { orderId },
      create: {
        tenantId,
        orderId,
        recipientPhone: order.customer.phoneNumber,
        templateName: template.name,
        parameters: jobParams as any,
        status: JobStatus.PENDING,
      },
      update: {
        status: JobStatus.PENDING,
        attempts: 0,
        lastError: null,
        parameters: jobParams as any,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        orderId,
        userId: userId || null,
        action: 'WHATSAPP_CONFIRMATION_RESENT',
        details: { jobId: job.id, channel: 'BAILEYS_WHATSAPP_WEB' },
      },
    });

    if (this.status === WhatsAppIntegrationStatus.CONNECTED) {
      setImmediate(() => this.processPendingJobs());
    }

    return { success: true, message: 'Confirmation request enqueued successfully', jobId: job.id };
  }

  /**
   * Server-Sent Events (SSE) subscriber registration.
   */
  public static registerSSE(res: Response) {
    this.sseClients.push(res);
    // Send immediate initial state
    res.write(`data: ${JSON.stringify(this.getStatus())}\n\n`);

    res.on('close', () => {
      this.sseClients = this.sseClients.filter((c) => c !== res);
    });
  }

  /**
   * Broadcasts live connection state to all subscribed frontend clients.
   */
  private static broadcastState() {
    const data = JSON.stringify(this.getStatus());
    for (const client of this.sseClients) {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (err) {}
    }
  }

  /**
   * Syncs connection status with the PostgreSQL WhatsAppIntegration table.
   */
  private static async syncDatabaseIntegrationStatus() {
    try {
      const tenant = await prisma.tenant.findFirst();
      if (!tenant) return;

      await prisma.whatsAppIntegration.upsert({
        where: { tenantId: tenant.id },
        update: {
          status: this.status,
          displayPhoneNumber: this.displayPhoneNumber,
          lastConnectedAt: this.connectedAt,
          errorMessage: this.lastError,
        },
        create: {
          tenantId: tenant.id,
          status: this.status,
          displayPhoneNumber: this.displayPhoneNumber,
          lastConnectedAt: this.connectedAt,
          errorMessage: this.lastError,
        },
      });
    } catch (err) {
      console.error('[Baileys] Error syncing integration status to DB:', err);
    }
  }
}
