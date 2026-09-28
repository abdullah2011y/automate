import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { AppError } from '../middleware/errorHandler';
import { Role } from '@prisma/client';

const signupSchema = z.object({
  storeName: z.string().min(2, 'Store name must be at least 2 characters').max(50),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('An account with this email address already exists', 409);
    }

    // Generate unique slug for tenant
    const baseSlug = data.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

    const passwordHash = await hashPassword(data.password);

    // Atomically create Tenant and Owner user
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.storeName,
          slug,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: data.name,
          email: data.email,
          passwordHash,
          role: Role.OWNER,
        },
      });

      return { tenant, user };
    });

    const token = generateToken({
      userId: result.user.id,
      tenantId: result.tenant.id,
      email: result.user.email,
      role: result.user.role,
    });

    res.status(201).json({
      success: true,
      message: 'Account and store successfully created',
      data: {
        token,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          currency: user.tenant.currency,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          currency: user.tenant.currency,
          timezone: user.tenant.timezone,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
