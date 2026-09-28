import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyToken, TokenPayload } from '../utils/auth';
import { prisma } from '../db/prisma';
import { AppError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        email: string;
        role: Role;
        name: string;
      };
      tenantId?: string;
    }
  }
}

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      throw new AppError('Authentication required: Missing or invalid token', 401);
    }
    let payload: TokenPayload;

    try {
      payload = verifyToken(token);
    } catch (err: any) {
      throw new AppError('Invalid or expired authentication token', 401);
    }

    // Verify user exists and belongs to active tenant
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new AppError('User account not found or has been deactivated', 401);
    }

    if (!user.tenant) {
      throw new AppError('Tenant store not found or has been deactivated', 403);
    }

    // Attach strict tenant isolation identifiers
    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    req.tenantId = user.tenantId;

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('Forbidden: Insufficient permissions for this action', 403)
      );
    }

    next();
  };
};
