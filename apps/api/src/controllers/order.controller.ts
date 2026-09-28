import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { OrderConfirmationStatus, Prisma } from '@prisma/client';

const listOrdersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(OrderConfirmationStatus).or(z.literal('ALL')).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderConfirmationStatus),
  reason: z.string().optional(),
  note: z.string().optional(),
});

const createOrderSchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(8),
  customerEmail: z.string().email().optional(),
  shopifyOrderNumber: z.string().min(1),
  totalPrice: z.coerce.number().positive(),
  shippingAddress: z.record(z.any()).optional(),
  items: z.array(
    z.object({
      title: z.string().min(1),
      sku: z.string().optional(),
      quantity: z.number().int().positive().default(1),
      unitPrice: z.coerce.number().positive(),
    })
  ).min(1, 'At least one item is required'),
});

export const getOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const query = listOrdersQuerySchema.parse(req.query);

    const where: Prisma.OrderWhereInput = {
      tenantId,
      archivedAt: null,
    };

    if (query.status && query.status !== 'ALL') {
      where.confirmationStatus = query.status;
    }

    if (query.search && query.search.trim() !== '') {
      const s = query.search.trim();
      where.OR = [
        { shopifyOrderNumber: { contains: s, mode: 'insensitive' } },
        { customer: { firstName: { contains: s, mode: 'insensitive' } } },
        { customer: { lastName: { contains: s, mode: 'insensitive' } } },
        { customer: { phoneNumber: { contains: s } } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.orderCreatedAt = {};
      if (query.startDate) where.orderCreatedAt.gte = new Date(query.startDate);
      if (query.endDate) where.orderCreatedAt.lte = new Date(query.endDate);
    }

    const skip = (query.page - 1) * query.limit;

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { orderCreatedAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              email: true,
            },
          },
          items: true,
          whatsappMessages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              messageType: true,
              customerResponse: true,
              failureReason: true,
              sentAt: true,
              deliveredAt: true,
              readAt: true,
              failedAt: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders: orders.map((order) => ({
          id: order.id,
          shopifyOrderId: order.shopifyOrderId,
          shopifyOrderNumber: order.shopifyOrderNumber,
          currency: order.currency,
          totalPrice: order.totalPrice.toString(),
          subtotalPrice: order.subtotalPrice.toString(),
          confirmationStatus: order.confirmationStatus,
          orderCreatedAt: order.orderCreatedAt,
          confirmedAt: order.confirmedAt,
          cancelledAt: order.cancelledAt,
          cancellationReason: order.cancellationReason,
          customer: order.customer,
          itemsCount: order.items.length,
          items: order.items.map((i) => ({
            id: i.id,
            title: i.title,
            sku: i.sku,
            quantity: i.quantity,
            unitPrice: i.unitPrice.toString(),
          })),
          latestWhatsAppMessage: order.whatsappMessages[0] || null,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        items: true,
        whatsappMessages: {
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        ...order,
        totalPrice: order.totalPrice.toString(),
        subtotalPrice: order.subtotalPrice.toString(),
        items: order.items.map((i) => ({
          ...i,
          unitPrice: i.unitPrice.toString(),
          totalDiscount: i.totalDiscount.toString(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const { id } = req.params;
    const body = updateOrderStatusSchema.parse(req.body);

    const existingOrder = await prisma.order.findFirst({
      where: { id, tenantId },
    });

    if (!existingOrder) {
      throw new AppError('Order not found', 404);
    }

    const previousStatus = existingOrder.confirmationStatus;
    const now = new Date();

    const updateData: Prisma.OrderUpdateInput = {
      confirmationStatus: body.status,
      statusChangedAt: now,
    };

    if (body.status === OrderConfirmationStatus.CONFIRMED && !existingOrder.confirmedAt) {
      updateData.confirmedAt = now;
    }

    if (body.status === OrderConfirmationStatus.CANCELLED) {
      updateData.cancelledAt = now;
      if (body.reason) {
        updateData.cancellationReason = body.reason;
      }
    }

    // Atomic update with audit log
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: updateData,
        include: { customer: true, items: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          orderId: order.id,
          userId,
          action: 'ORDER_STATUS_MANUAL_UPDATE',
          details: {
            previousStatus,
            newStatus: body.status,
            reason: body.reason,
            note: body.note,
            updatedByEmail: req.user!.email,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
        },
      });

      return order;
    });

    res.status(200).json({
      success: true,
      message: `Order status updated to ${body.status}`,
      data: {
        ...updatedOrder,
        totalPrice: updatedOrder.totalPrice.toString(),
        subtotalPrice: updatedOrder.subtotalPrice.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const data = createOrderSchema.parse(req.body);

    // Normalize phone number (remove spaces/dashes, ensure + prefix)
    let phone = data.customerPhone.replace(/[\s-]/g, '');
    if (!phone.startsWith('+')) {
      phone = `+${phone}`;
    }

    const order = await prisma.$transaction(async (tx) => {
      // Find or create customer scoped to tenant
      const customer = await tx.customer.upsert({
        where: {
          tenantId_phoneNumber: {
            tenantId,
            phoneNumber: phone,
          },
        },
        update: {
          firstName: data.customerName.split(' ')[0] || data.customerName,
          lastName: data.customerName.split(' ').slice(1).join(' ') || undefined,
          email: data.customerEmail || undefined,
          totalOrders: { increment: 1 },
          totalSpent: { increment: data.totalPrice },
        },
        create: {
          tenantId,
          firstName: data.customerName.split(' ')[0] || data.customerName,
          lastName: data.customerName.split(' ').slice(1).join(' ') || undefined,
          phoneNumber: phone,
          email: data.customerEmail,
          totalOrders: 1,
          totalSpent: data.totalPrice,
        },
      });

      const shopifyOrderId = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const createdOrder = await tx.order.create({
        data: {
          tenantId,
          customerId: customer.id,
          shopifyOrderId,
          shopifyOrderNumber: data.shopifyOrderNumber,
          currency: 'USD',
          totalPrice: data.totalPrice,
          subtotalPrice: data.totalPrice,
          paymentGateway: 'cash_on_delivery',
          confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
          shippingAddress: data.shippingAddress ? (data.shippingAddress as Prisma.InputJsonValue) : Prisma.JsonNull,
          items: {
            create: data.items.map((i) => ({
              title: i.title,
              sku: i.sku || null,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
        },
        include: {
          customer: true,
          items: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          orderId: createdOrder.id,
          userId,
          action: 'ORDER_CREATED_MANUALLY',
          details: { orderNumber: data.shopifyOrderNumber },
        },
      });

      return createdOrder;
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        ...order,
        totalPrice: order.totalPrice.toString(),
        subtotalPrice: order.subtotalPrice.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
