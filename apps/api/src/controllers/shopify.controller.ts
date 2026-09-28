import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ShopifyService } from '../services/shopify.service';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import crypto from 'crypto';

const connectSchema = z.object({
  shopDomain: z.string().min(3),
  accessToken: z.string().min(8),
  webhookSecret: z.string().optional(),
  scopes: z.string().optional(),
});

const syncSchema = z.object({
  limit: z.coerce.number().min(1).max(250).default(50),
});

export const getStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const status = await ShopifyService.getStoreStatus(tenantId);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

export const connect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const body = connectSchema.parse(req.body);

    const result = await ShopifyService.connectStore(tenantId, body, userId);
    res.status(200).json({
      success: true,
      message: 'Shopify store successfully connected',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const disconnect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;

    const result = await ShopifyService.disconnectStore(tenantId, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const triggerSync = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { limit } = syncSchema.parse(req.body || {});

    const result = await ShopifyService.syncHistoricalOrders(tenantId, limit);
    res.status(200).json({
      success: true,
      message: `Successfully synchronized ${result.ordersImported} orders from Shopify`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const headers = {
      topic: req.headers['x-shopify-topic'] as string | undefined,
      shopDomain: req.headers['x-shopify-shop-domain'] as string | undefined,
      hmac: req.headers['x-shopify-hmac-sha256'] as string | undefined,
      webhookId: req.headers['x-shopify-webhook-id'] as string | undefined,
    };

    const result = await ShopifyService.processWebhook(
      headers,
      req.rawBody,
      req.body
    );

    res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
};

/**
 * Public OAuth authorization initiation.
 */
export const initiateOAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const rawShop = req.query.shop as string;
    if (!rawShop) {
      throw new AppError('Missing "shop" query parameter', 400);
    }

    const apiKey = process.env.SHOPIFY_API_KEY || 'shopify_api_key_placeholder';
    const scopes = process.env.SHOPIFY_SCOPES || 'read_orders,write_orders,read_customers';
    const redirectUri = `${config.FRONTEND_URL || 'http://localhost:3000'}/api/shopify/callback`;
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = `https://${rawShop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${state}`;

    res.status(200).json({ success: true, data: { authUrl, state } });
  } catch (error) {
    next(error);
  }
};
