import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BaileysService } from '../services/baileys.service';
import { TemplateService } from '../services/template.service';
import { AutomationService } from '../services/automation.service';
import { prisma } from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { MessageDirection, MessageStatus } from '@prisma/client';

// -------------------------------------------------------------
// WhatsApp Connection & Pairing Endpoints
// -------------------------------------------------------------

/**
 * Server-Sent Events (SSE) stream for live Baileys QR code and connection updates.
 */
export const getQrStream = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  BaileysService.registerSSE(res);
};

/**
 * Get current Baileys WhatsApp connection status, uptime, and display phone.
 */
export const getStatus = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = BaileysService.getStatus();
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

/**
 * Reconnect and regenerate a fresh pairing QR code.
 */
export const reconnect = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await BaileysService.reconnect();
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect active WhatsApp Web socket.
 */
export const disconnect = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await BaileysService.disconnect();
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

/**
 * Hard-reset WhatsApp session, purge PostgreSQL keys, and start fresh QR pairing.
 */
export const resetSession = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await BaileysService.resetSession();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Request an 8-character pairing code for phone-number based linking.
 */
export const requestPairingCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      res.status(400).json({ success: false, message: 'Valid phone number with country code is required (e.g. 923001234567)' });
      return;
    }
    const code = await BaileysService.requestPairingCode(phoneNumber);
    res.status(200).json({ success: true, pairingCode: code });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend confirmation message for an order.
 */
export const resendConfirmation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!orderId) {
      throw new AppError('Order ID is required', 400);
    }

    const result = await BaileysService.resendConfirmation(tenantId, orderId, userId);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// Message Template Management Endpoints
// -------------------------------------------------------------
const pollOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  autoReply: z.string().optional().default(''),
});

const templateCreateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  description: z.string().optional(),
  body: z.string().min(5, 'Template body must be at least 5 characters'),
  event: z.string().default('ORDER_CONFIRMATION'),
  isDefault: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  hasPoll: z.boolean().optional(),
  pollQuestion: z.string().optional(),
  pollOptions: z.array(pollOptionSchema).optional(),
});

const templateUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  body: z.string().min(5).optional(),
  event: z.string().optional(),
  isDefault: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  hasPoll: z.boolean().optional(),
  pollQuestion: z.string().optional(),
  pollOptions: z.array(pollOptionSchema).optional(),
});

export const listTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const templates = await TemplateService.listTemplates(tenantId);
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const data = templateCreateSchema.parse(req.body);
    const template = await TemplateService.createTemplate({ tenantId, ...data });
    res.status(201).json({ success: true, data: template, message: 'Template created successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = templateUpdateSchema.parse(req.body);
    const template = await TemplateService.updateTemplate(id, data);
    res.status(200).json({ success: true, data: template, message: 'Template updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await TemplateService.deleteTemplate(id);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

export const previewTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { body, variables } = req.body;
    if (!body) throw new AppError('Template body is required', 400);

    const sampleVars = variables || TemplateService.getSampleVariables();
    const rendered = TemplateService.render(body, sampleVars);
    const extracted = TemplateService.extractVariables(body);

    res.status(200).json({
      success: true,
      data: {
        rendered,
        detectedVariables: extracted,
        sampleVariables: sampleVars,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const testSendTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { body, recipientPhone, variables, confirmed, hasPoll, pollQuestion, pollOptions } = req.body;
    if (!body) throw new AppError('Template body is required', 400);
    if (!recipientPhone) throw new AppError('Recipient phone number is required', 400);

    const settings = await AutomationService.getSettings(tenantId);

    // Enforce configured admin test phone number if set
    if (settings.testPhoneNumber && recipientPhone.replace(/\D/g, '') !== settings.testPhoneNumber.replace(/\D/g, '')) {
      throw new AppError(
        `Test messages are restricted to the configured Administrator Test Number: ${settings.testPhoneNumber}`,
        400
      );
    }

    if (!confirmed) {
      throw new AppError('Explicit confirmation required before dispatching real test WhatsApp message', 400);
    }

    const sampleVars = variables || TemplateService.getSampleVariables();
    const rendered = TemplateService.render(body, sampleVars);

    const isPoll = hasPoll !== false && Array.isArray(pollOptions) && pollOptions.length >= 2;

    if (isPoll) {
      // Unified single message: send ONLY the interactive confirmation poll
      const renderedPollQuestion = pollQuestion
        ? TemplateService.render(pollQuestion, sampleVars).trim()
        : '';

      const safeQuestion = TemplateService.formatSinglePollQuestion(rendered, renderedPollQuestion);

      await BaileysService.sendDirectPoll(
        recipientPhone,
        safeQuestion,
        pollOptions.map((o: any) => o.text)
      );
    } else {
      // Standard single text message only
      await BaileysService.sendDirectMessage(recipientPhone, rendered);
    }

    res.status(200).json({
      success: true,
      message: `Test message ${isPoll ? '(Interactive Poll) ' : ''}sent to ${recipientPhone}`,
      data: { rendered },
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// Automation Settings Endpoints
// -------------------------------------------------------------

const automationSettingsSchema = z.object({
  autoConfirmEnabled: z.boolean().optional(),
  codOnly: z.boolean().optional(),
  minDelaySeconds: z.number().min(1).max(60).optional(),
  confirmKeywords: z.array(z.string()).optional(),
  cancelKeywords: z.array(z.string()).optional(),
  optOutKeywords: z.array(z.string()).optional(),
  successReplyText: z.string().optional(),
  cancelReplyText: z.string().optional(),
  ambiguousReplyText: z.string().optional(),
  optOutReplyText: z.string().optional(),
  testPhoneNumber: z.string().optional(),
  eligibleOrderTypes: z.array(z.string()).optional(),
  maxRetryAttempts: z.number().min(1).max(10).optional(),
  skipMissingPhone: z.boolean().optional(),
});

export const getAutomationSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const settings = await AutomationService.getSettings(tenantId);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateAutomationSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const body = automationSettingsSchema.parse(req.body);
    const updated = await AutomationService.updateSettings(tenantId, body);
    res.status(200).json({
      success: true,
      message: 'Automation settings updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// Message History & Delivery Status
// -------------------------------------------------------------

export const listMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const { orderId, status, direction, search } = req.query;

    const where: any = { tenantId };

    if (orderId) where.orderId = orderId as string;
    if (status) where.status = status as MessageStatus;
    if (direction) where.direction = direction as MessageDirection;
    if (search) {
      where.OR = [
        { recipientPhone: { contains: search as string } },
        { customerResponse: { contains: search as string } },
        { order: { shopifyOrderNumber: { contains: search as string } } },
      ];
    }

    const [total, messages] = await Promise.all([
      prisma.whatsAppMessage.count({ where }),
      prisma.whatsAppMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              shopifyOrderNumber: true,
              totalPrice: true,
              currency: true,
              confirmationStatus: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
