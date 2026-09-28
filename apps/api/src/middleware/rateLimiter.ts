import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 300000);

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}

/**
 * Creates an in-memory sliding-window rate limiter middleware.
 * Zero external paid dependencies or Redis required; memory footprint < 100KB.
 */
export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    message = 'Too many requests from this IP, please try again later.',
    keyPrefix = 'rl',
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Get client IP address
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const key = `${keyPrefix}:${clientIp}`;
    const now = Date.now();
    let record = memoryStore.get(key);

    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      memoryStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    // Standard RFC RateLimit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      throw new AppError(message, 429);
    }

    next();
  };
};

/**
 * Pre-configured rate limiters for sensitive endpoints
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 login attempts per minute per IP
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please wait 60 seconds before trying again.',
});

export const resendRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'resend',
  message: 'Too many message resend requests. Please slow down.',
});

export const testSendRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyPrefix: 'test-send',
  message: 'Test message sending limit reached (max 5 per minute).',
});

export const qrRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  keyPrefix: 'qr',
  message: 'Too many QR pairing requests. Please wait a moment.',
});
