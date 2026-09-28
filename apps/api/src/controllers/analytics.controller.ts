import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { MessageDirection, MessageStatus, OrderConfirmationStatus } from '@prisma/client';

export interface DateRangeFilter {
  start: Date;
  end: Date;
  rangeType: 'today' | '7d' | '30d' | 'custom' | 'all';
}

function resolveDateRange(query: any): DateRangeFilter {
  const rangeType = (query.range as any) || '30d';
  const now = new Date();

  let start: Date;
  let end: Date = new Date();

  switch (rangeType) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    }
    case '7d': {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    }
    case '30d': {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    }
    case 'custom': {
      if (query.startDate) {
        start = new Date(query.startDate as string);
      } else {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (query.endDate) {
        end = new Date(query.endDate as string);
        // Set to end of the day if it was provided as a date string
        end.setHours(23, 59, 59, 999);
      }
      break;
    }
    case 'all':
    default: {
      start = new Date(2020, 0, 1);
      break;
    }
  }

  return { start, end, rangeType };
}

export const getOverviewAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { start, end, rangeType } = resolveDateRange(req.query);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // Parallel aggregate queries with isolated tenantId and active non-archived constraints
    const [
      // Lifetime / Temporal overview cards
      totalShopifyOrdersLifetime,
      ordersToday,
      ordersThisWeek,
      ordersThisMonth,

      // Filtered range metrics
      ordersInRange,
      pendingOrders,
      confirmedOrders,
      cancelledOrders,
      processingOrders,
      dispatchedOrders,
      deliveredOrders,

      // Filtered WhatsApp metrics
      messagesInRange,

      // Recent orders sample
      recentOrders,
    ] = await Promise.all([
      prisma.order.count({ where: { tenantId, archivedAt: null } }),
      prisma.order.count({
        where: { tenantId, archivedAt: null, orderCreatedAt: { gte: startOfToday } },
      }),
      prisma.order.count({
        where: { tenantId, archivedAt: null, orderCreatedAt: { gte: startOfWeek } },
      }),
      prisma.order.count({
        where: { tenantId, archivedAt: null, orderCreatedAt: { gte: startOfMonth } },
      }),

      // Orders inside selected date range
      prisma.order.findMany({
        where: {
          tenantId,
          archivedAt: null,
          orderCreatedAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          totalPrice: true,
          confirmationStatus: true,
          orderCreatedAt: true,
          confirmedAt: true,
          cancelledAt: true,
          cancellationReason: true,
        },
      }),

      prisma.order.count({
        where: {
          tenantId,
          archivedAt: null,
          confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
          orderCreatedAt: { gte: start, lte: end },
        },
      }),
      prisma.order.count({
        where: {
          tenantId,
          archivedAt: null,
          confirmationStatus: OrderConfirmationStatus.CONFIRMED,
          orderCreatedAt: { gte: start, lte: end },
        },
      }),
      prisma.order.count({
        where: {
          tenantId,
          archivedAt: null,
          confirmationStatus: OrderConfirmationStatus.CANCELLED,
          orderCreatedAt: { gte: start, lte: end },
        },
      }),
      prisma.order.count({
        where: {
          tenantId,
          archivedAt: null,
          confirmationStatus: OrderConfirmationStatus.PROCESSING,
          orderCreatedAt: { gte: start, lte: end },
        },
      }),
      prisma.order.count({
        where: {
          tenantId,
          archivedAt: null,
          confirmationStatus: OrderConfirmationStatus.DISPATCHED,
          orderCreatedAt: { gte: start, lte: end },
        },
      }),
      prisma.order.count({
        where: {
          tenantId,
          archivedAt: null,
          confirmationStatus: OrderConfirmationStatus.DELIVERED,
          orderCreatedAt: { gte: start, lte: end },
        },
      }),

      // WhatsApp Messages in range
      prisma.whatsAppMessage.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          direction: true,
          status: true,
          createdAt: true,
        },
      }),

      // Recent 6 orders
      prisma.order.findMany({
        where: { tenantId, archivedAt: null },
        take: 6,
        orderBy: { orderCreatedAt: 'desc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true, phoneNumber: true },
          },
          items: true,
          whatsappMessages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { status: true, customerResponse: true },
          },
        },
      }),
    ]);

    // Financial totals in range
    let confirmedValue = 0;
    let savedFromReturnsValue = 0;
    let totalConfirmationDurationMs = 0;
    let confirmedCountForDuration = 0;
    const cancellationReasonsMap: Record<string, number> = {};

    for (const ord of ordersInRange) {
      const price = Number(ord.totalPrice);
      if (
        ord.confirmationStatus === OrderConfirmationStatus.CONFIRMED ||
        ord.confirmationStatus === OrderConfirmationStatus.PROCESSING ||
        ord.confirmationStatus === OrderConfirmationStatus.DISPATCHED ||
        ord.confirmationStatus === OrderConfirmationStatus.DELIVERED
      ) {
        confirmedValue += price;
      } else if (ord.confirmationStatus === OrderConfirmationStatus.CANCELLED) {
        savedFromReturnsValue += price;
        const reason = ord.cancellationReason || 'Customer requested via WhatsApp';
        cancellationReasonsMap[reason] = (cancellationReasonsMap[reason] || 0) + 1;
      }

      // Calculate time from order creation to customer confirmation
      if (ord.confirmedAt) {
        const diffMs = ord.confirmedAt.getTime() - ord.orderCreatedAt.getTime();
        if (diffMs > 0) {
          totalConfirmationDurationMs += diffMs;
          confirmedCountForDuration++;
        }
      }
    }

    // Average confirmation time calculation
    let avgConfirmationTime = 'N/A';
    if (confirmedCountForDuration > 0) {
      const avgMinutes = Math.round(totalConfirmationDurationMs / confirmedCountForDuration / 60000);
      if (avgMinutes < 60) {
        avgConfirmationTime = `${avgMinutes}m`;
      } else {
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        avgConfirmationTime = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      }
    }

    // Confirmation Rate (confirmed / (confirmed + cancelled))
    const decidedOrders = confirmedOrders + cancelledOrders;
    const confirmationRate =
      decidedOrders > 0 ? ((confirmedOrders / decidedOrders) * 100).toFixed(1) : '0.0';

    // WhatsApp Message delivery breakdown
    let sentCount = 0;
    let deliveredCount = 0;
    let readCount = 0;
    let failedCount = 0;
    let queuedCount = 0;

    for (const msg of messagesInRange) {
      if (msg.direction === MessageDirection.OUTBOUND) {
        if (msg.status === MessageStatus.QUEUED) queuedCount++;
        else if (msg.status === MessageStatus.SENT) sentCount++;
        else if (msg.status === MessageStatus.DELIVERED) {
          sentCount++;
          deliveredCount++;
        } else if (msg.status === MessageStatus.READ) {
          sentCount++;
          deliveredCount++;
          readCount++;
        } else if (msg.status === MessageStatus.FAILED) {
          failedCount++;
        }
      }
    }

    // Accurate Delivery rate from actual protocol delivery receipts
    const totalOutboundDeliberated = deliveredCount + failedCount;
    const messageDeliveryRate =
      totalOutboundDeliberated > 0
        ? ((deliveredCount / totalOutboundDeliberated) * 100).toFixed(1) + '%'
        : deliveredCount > 0
        ? '100.0%'
        : '0.0%';

    // Generate timeseries trend data (Daily buckets for range)
    const trendBucketsMap = new Map<string, {
      date: string;
      label: string;
      totalOrders: number;
      confirmedOrders: number;
      cancelledOrders: number;
      messagesSent: number;
    }>();

    // Determine bucket step (days)
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const stepCount = Math.min(diffDays, 30); // Max 30 points on chart for crisp rendering

    for (let i = stepCount - 1; i >= 0; i--) {
      const bucketDate = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = bucketDate.toISOString().split('T')[0];
      const label = bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trendBucketsMap.set(dateKey, {
        date: dateKey,
        label,
        totalOrders: 0,
        confirmedOrders: 0,
        cancelledOrders: 0,
        messagesSent: 0,
      });
    }

    // Populate order buckets
    for (const ord of ordersInRange) {
      const dateKey = ord.orderCreatedAt.toISOString().split('T')[0];
      const bucket = trendBucketsMap.get(dateKey);
      if (bucket) {
        bucket.totalOrders++;
        if (ord.confirmationStatus === OrderConfirmationStatus.CONFIRMED) {
          bucket.confirmedOrders++;
        } else if (ord.confirmationStatus === OrderConfirmationStatus.CANCELLED) {
          bucket.cancelledOrders++;
        }
      }
    }

    // Populate message buckets
    for (const msg of messagesInRange) {
      if (msg.direction === MessageDirection.OUTBOUND) {
        const dateKey = msg.createdAt.toISOString().split('T')[0];
        const bucket = trendBucketsMap.get(dateKey);
        if (bucket) {
          bucket.messagesSent++;
        }
      }
    }

    const trends = Array.from(trendBucketsMap.values());

    // Format cancellation reasons
    const cancellationReasons = Object.entries(cancellationReasonsMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    res.status(200).json({
      success: true,
      data: {
        filter: {
          rangeType,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        summary: {
          totalOrders: ordersInRange.length,
          totalShopifyOrdersLifetime,
          totalOrdersInRange: ordersInRange.length,
          ordersToday,
          ordersThisWeek,
          ordersThisMonth,
          pendingConfirmation: pendingOrders,
          confirmed: confirmedOrders,
          cancelled: cancelledOrders,
          processing: processingOrders,
          dispatched: dispatchedOrders,
          delivered: deliveredOrders,
          confirmationRate: `${confirmationRate}%`,
          avgConfirmationTime,
          confirmedTotalValue: confirmedValue.toFixed(2),
          savedFromReturnsValue: savedFromReturnsValue.toFixed(2),
          // WhatsApp Delivery Analytics
          totalWhatsAppMessages: messagesInRange.length,
          queuedMessages: queuedCount,
          sentMessages: sentCount,
          deliveredMessages: deliveredCount,
          readMessages: readCount,
          failedMessages: failedCount,
          messageDeliveryRate,
        },
        trends,
        cancellationReasons,
        recentOrders: recentOrders.map((ord) => ({
          id: ord.id,
          shopifyOrderNumber: ord.shopifyOrderNumber,
          customerName: `${ord.customer.firstName || ''} ${ord.customer.lastName || ''}`.trim() || 'Customer',
          customerPhone: ord.customer.phoneNumber,
          totalPrice: Number(ord.totalPrice).toFixed(2),
          itemsCount: ord.items.reduce((acc, item) => acc + item.quantity, 0),
          status: ord.confirmationStatus,
          time: ord.orderCreatedAt.toISOString(),
          whatsappStatus: ord.whatsappMessages[0]?.status || 'NOT_SENT',
          customerResponse: ord.whatsappMessages[0]?.customerResponse || null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
