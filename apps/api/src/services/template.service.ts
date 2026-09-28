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

export const DEFAULT_CONFIRMATION_TEMPLATE = `Assalam-o-Alaikum {{customer_name}}!

Thank you for shopping with {{store_name}}.

Aapka order {{order_number}} receive ho gaya hai.

Order total: Rs. {{order_total}}

Order confirm karne ke liye CONFIRM reply karein.

Cancel karne ke liye CANCEL reply karein.`;

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
          description: 'Standard bilingual COD confirmation message with CONFIRM and CANCEL keyword instructions',
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
   * Resolves the default template for an event.
   */
  public static async getDefaultTemplate(event = 'ORDER_CONFIRMATION') {
    const defaultTemplate = await prisma.messageTemplate.findFirst({
      where: { event, isDefault: true, isActive: true },
    });

    if (defaultTemplate) {
      return defaultTemplate;
    }

    const fallback = await prisma.messageTemplate.findFirst({
      where: { event, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (fallback) {
      return fallback;
    }

    return {
      id: 'hardcoded_default',
      name: 'Default Confirmation Template',
      body: DEFAULT_CONFIRMATION_TEMPLATE,
      event: 'ORDER_CONFIRMATION',
      isDefault: true,
      isActive: true,
      variables: ['customer_name', 'store_name', 'order_number', 'order_total', 'currency'],
    };
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
