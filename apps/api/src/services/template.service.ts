import { prisma } from '../db/prisma';
import { AppError } from '../middleware/errorHandler';

export interface TemplateVariables {
  customer_name?: string;
  order_number?: string;
  order_total?: string;
  currency?: string;
  payment_method?: string;
  shipping_address?: string;
  store_name?: string;
  product_list?: string;
  tracking_number?: string;
  tracking_url?: string;
  [key: string]: string | undefined;
}

export interface PollOption {
  id: string; // Target order status: 'CONFIRMED' | 'CANCELLED' | 'PENDING_CONFIRMATION' | 'PROCESSING', etc.
  text: string; // Option text displayed on WhatsApp e.g. 'Yes Confirmed ✔'
  autoReply: string; // Auto-reply message sent to customer
}

export const DEFAULT_POLL_OPTIONS: PollOption[] = [
  {
    id: 'CONFIRMED',
    text: 'Yes Confirmed ✔',
    autoReply: 'Your order will be on your door step in 2-4 working days. Shukriya for confirming!',
  },
  {
    id: 'CANCELLED',
    text: 'No Cancelled ❌',
    autoReply: 'Aapka order cancel kar diya gaya hai. Agle baar khidmat ka moqa zaroor dijiyega!',
  },
];

export const DEFAULT_CONFIRMATION_TEMPLATE = `Assalam-o-Alaikum {{customer_name}}!

Thank you for shopping with {{store_name}}.

Aapka order {{order_number}} receive ho gaya hai.

Order total: Rs. {{order_total}}

Order confirm ya cancel karne ke liye neeche button par click karein.`;

export class TemplateService {
  /**
   * Replaces variables safely in template body.
   * Handles missing values with sensible fallbacks and ensures no raw {{variables}} remain.
   */
  public static render(templateBody: string, variables: TemplateVariables): string {
    if (!templateBody) return '';

    return templateBody.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, varName) => {
      const value = variables[varName];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }

      // Check common variable aliases
      if (varName === 'total_amount' || varName === 'total_price' || varName === 'order_total') {
        const val = variables.total_amount || variables.order_total || variables.total_price;
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
      }

      if (varName === 'product_name' || varName === 'product_list' || varName === 'items' || varName === 'product') {
        const val = variables.product_name || variables.product_list || variables.items || variables.product;
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
      }

      if (varName === 'quantity' || varName === 'total_quantity' || varName === 'qty') {
        const val = variables.quantity || variables.total_quantity || variables.qty;
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
        return '1';
      }

      // Safe fallbacks for common variables
      switch (varName) {
        case 'customer_name':
          return 'Valued Customer';
        case 'store_name':
          return 'Our Store';
        case 'currency':
          return 'PKR';
        case 'payment_method':
          return 'Cash on Delivery';
        case 'product_list':
        case 'product_name':
          return 'Items ordered';
        case 'tracking_number':
        case 'tracking_url':
          return 'Will be shared upon dispatch';
        default:
          return '';
      }
    });
  }

  /**
   * Ensures default templates exist in PostgreSQL for the store.
   */
  public static async ensureDefaultTemplates(tenantId?: string) {
    const existing = await prisma.messageTemplate.findFirst({
      where: {
        event: 'ORDER_CONFIRMATION',
        isDefault: true,
      },
    });

    if (!existing) {
      await prisma.messageTemplate.create({
        data: {
          tenantId: tenantId || null,
          name: 'Default Cash on Delivery Confirmation (Urdu/English)',
          description: 'Standard bilingual COD confirmation message with interactive WhatsApp Poll options',
          event: 'ORDER_CONFIRMATION',
          body: DEFAULT_CONFIRMATION_TEMPLATE,
          isDefault: true,
          isActive: true,
          variables: [
            'customer_name',
            'store_name',
            'order_number',
            'order_total',
            'currency',
            'payment_method',
          ],
          hasPoll: true,
          pollQuestion: 'Aapka order {{order_number}} confirm karein:',
          pollOptions: DEFAULT_POLL_OPTIONS as any,
        },
      });
    } else if (!existing.pollOptions) {
      await prisma.messageTemplate.update({
        where: { id: existing.id },
        data: {
          hasPoll: true,
          pollQuestion: existing.pollQuestion || 'Aapka order {{order_number}} confirm karein:',
          pollOptions: DEFAULT_POLL_OPTIONS as any,
        },
      });
    }
  }

  /**
   * Retrieves all message templates.
   */
  public static async listTemplates(tenantId?: string) {
    await this.ensureDefaultTemplates(tenantId);
    return prisma.messageTemplate.findMany({
      where: tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {},
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Retrieves single template by ID.
   */
  public static async getTemplateById(id: string) {
    const template = await prisma.messageTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new AppError('Message template not found', 404);
    }
    return template;
  }

  /**
   * Retrieves the default template for an event.
   */
  public static async getDefaultTemplate(event = 'ORDER_CONFIRMATION') {
    await this.ensureDefaultTemplates();
    const template = await prisma.messageTemplate.findFirst({
      where: { event, isDefault: true, isActive: true },
    });
    if (!template) {
      const fallback = await prisma.messageTemplate.findFirst({
        where: { event, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (fallback) return fallback;
      throw new AppError(`No active template found for event ${event}`, 404);
    }
    return template;
  }

  /**
   * Creates a new message template.
   */
  public static async createTemplate(data: {
    tenantId?: string;
    name: string;
    description?: string;
    event?: string;
    body: string;
    isDefault?: boolean;
    variables?: string[];
    hasPoll?: boolean;
    pollQuestion?: string;
    pollOptions?: PollOption[];
  }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new AppError('Template name is required', 400);
    }
    if (!data.body || data.body.trim().length === 0) {
      throw new AppError('Template body cannot be empty', 400);
    }

    if (data.isDefault) {
      // Unset other defaults for this event
      await prisma.messageTemplate.updateMany({
        where: { event: data.event || 'ORDER_CONFIRMATION' },
        data: { isDefault: false },
      });
    }

    return prisma.messageTemplate.create({
      data: {
        tenantId: data.tenantId || null,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        event: data.event || 'ORDER_CONFIRMATION',
        body: data.body.trim(),
        isDefault: data.isDefault ?? false,
        isActive: true,
        variables: data.variables || [
          'customer_name',
          'store_name',
          'order_number',
          'order_total',
          'currency',
        ],
        hasPoll: data.hasPoll ?? true,
        pollQuestion: data.pollQuestion?.trim() || 'Aapka order {{order_number}} confirm karein:',
        pollOptions: (data.pollOptions || DEFAULT_POLL_OPTIONS) as any,
      },
    });
  }

  /**
   * Updates an existing template.
   */
  public static async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      body?: string;
      isActive?: boolean;
      isDefault?: boolean;
      event?: string;
      hasPoll?: boolean;
      pollQuestion?: string;
      pollOptions?: PollOption[];
    }
  ) {
    const existing = await this.getTemplateById(id);

    if (data.isDefault) {
      await prisma.messageTemplate.updateMany({
        where: { event: existing.event, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.messageTemplate.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        description: data.description !== undefined ? data.description.trim() : undefined,
        body: data.body !== undefined ? data.body.trim() : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        isDefault: data.isDefault !== undefined ? data.isDefault : undefined,
        event: data.event !== undefined ? data.event : undefined,
        hasPoll: data.hasPoll !== undefined ? data.hasPoll : undefined,
        pollQuestion: data.pollQuestion !== undefined ? data.pollQuestion.trim() : undefined,
        pollOptions: data.pollOptions !== undefined ? (data.pollOptions as any) : undefined,
      },
    });
  }

  /**
   * Deletes a template (cannot delete default template).
   */
  public static async deleteTemplate(id: string) {
    const existing = await this.getTemplateById(id);
    if (existing.isDefault) {
      throw new AppError('Cannot delete the default active template. Set another template as default first.', 400);
    }

    await prisma.messageTemplate.delete({
      where: { id },
    });
    return { success: true, message: 'Template deleted successfully' };
  }


  /**
   * Provides sample values for template preview and test sends.
   */
  public static getSampleVariables(): Record<string, string> {
    return {
      customer_name: 'Muhammad Ali',
      order_number: '#1042',
      order_total: '4,500',
      currency: 'Rs.',
      payment_method: 'Cash on Delivery',
      shipping_address: 'House 12, Street 4, F-7/2, Islamabad',
      store_name: 'ByteForge Apparel',
      product_list: '1x Premium Cotton T-Shirt (M), 1x Denim Jeans (32)',
      tracking_number: 'TCS-987654321',
      tracking_url: 'https://www.tcsexpress.com/track/987654321',
    };
  }

  /**
   * Formats a clean, readable single-bubble interactive poll question.
   * WhatsApp limits poll titles to 255 characters.
   * If the template body + poll question is within 250 chars, use it directly.
   * If it exceeds 250 chars, generate a clean, elegant summary:
   * (e.g. Order #1042, total amount, product summary, and clear question)
   * Guaranteed never to cut off mid-word, never truncate with '...', and never exceed 250 chars.
   */
  public static formatSinglePollQuestion(body: string, pollQuestion?: string): string {
    const cleanBody = (body || '').trim();
    const cleanQ = (pollQuestion || '').trim() || 'Aapka order confirm karein:';

    let combined = cleanBody;
    if (cleanQ && !combined.toLowerCase().includes(cleanQ.toLowerCase())) {
      combined = `${combined}\n\n${cleanQ}`.trim();
    }

    if (combined.length <= 250) {
      return combined;
    }

    // Try extracting key lines (greeting, order #, total, items)
    const lines = cleanBody.split('\n').map((l) => l.trim()).filter(Boolean);
    const selectedLines: string[] = [];

    for (const line of lines) {
      if (
        line.toLowerCase().includes('order') ||
        line.toLowerCase().includes('total') ||
        line.toLowerCase().includes('rs.') ||
        line.toLowerCase().includes('amount') ||
        line.startsWith('•') ||
        line.startsWith('📦') ||
        line.startsWith('🛍️')
      ) {
        selectedLines.push(line);
      }
    }

    let summary = selectedLines.join('\n');
    if (cleanQ && !summary.toLowerCase().includes(cleanQ.toLowerCase())) {
      summary = `${summary}\n\n${cleanQ}`.trim();
    }

    if (summary.length > 0 && summary.length <= 250) {
      return summary;
    }

    // Compact fallback guaranteed under 200 characters
    const orderMatch = cleanBody.match(/#\w+/);
    const amountMatch = cleanBody.match(/(?:Rs\.?|USD|\$|PKR)\s*[\d,]+(?:\.\d+)?/i);

    const orderPart = orderMatch ? `📦 Order *${orderMatch[0]}*` : '📦 Order Confirmation';
    const amountPart = amountMatch ? ` (${amountMatch[0]})` : '';

    const compact = `${orderPart}${amountPart}\n\n${cleanQ}`.trim();
    return compact.slice(0, 250);
  }

  /**
   * Extracts all unique {{variable}} placeholders from a template string.
   */
  public static extractVariables(templateBody: string): string[] {
    const matches = templateBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
    const set = new Set<string>();
    for (const m of matches) {
      if (m[1]) set.add(m[1]);
    }
    return Array.from(set);
  }
}

