/**
 * ByteForge Omni-Commerce Frontend API Client
 * Provides strictly typed access to versioned backend endpoints (/api/v1).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const TOKEN_KEY = 'byteforge_auth_token';
const USER_KEY = 'byteforge_user';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  currency?: string;
  timezone?: string;
}

export interface OrderItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: string;
}

export interface CustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
  email: string | null;
}

export interface OrderSummary {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string;
  currency: string;
  totalPrice: string;
  subtotalPrice: string;
  confirmationStatus: string;
  orderCreatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  customer: CustomerSummary;
  itemsCount: number;
  items: OrderItem[];
  latestWhatsAppMessage: {
    id: string;
    status: string;
    messageType: string;
    customerResponse?: string | null;
    failureReason?: string | null;
    sentAt?: string | null;
    deliveredAt?: string | null;
    readAt?: string | null;
    failedAt?: string | null;
    createdAt: string;
  } | null;
}

export interface OverviewAnalytics {
  filter?: {
    rangeType: string;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalShopifyOrdersLifetime?: number;
    totalOrdersInRange?: number;
    ordersToday?: number;
    ordersThisWeek?: number;
    ordersThisMonth?: number;
    totalOrders?: number;
    pendingConfirmation: number;
    confirmed: number;
    cancelled: number;
    processing: number;
    dispatched: number;
    delivered?: number;
    confirmationRate: string;
    avgConfirmationTime?: string;
    confirmedTotalValue: string;
    savedFromReturnsValue: string;
    totalWhatsAppMessages?: number;
    totalConfirmationMessages?: number;
    queuedMessages?: number;
    sentMessages?: number;
    deliveredMessages?: number;
    readMessages?: number;
    failedMessages?: number;
    messageDeliveryRate?: string;
  };
  trends?: Array<{
    date: string;
    label: string;
    totalOrders: number;
    confirmedOrders: number;
    cancelledOrders: number;
    messagesSent: number;
  }>;
  cancellationReasons?: Array<{
    reason: string;
    count: number;
  }>;
  recentOrders: Array<{
    id: string;
    shopifyOrderNumber: string;
    customerName: string;
    customerPhone: string;
    totalPrice: string;
    itemsCount: number;
    status: string;
    time: string;
    whatsappStatus: string;
    customerResponse?: string | null;
  }>;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  details: any;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface DetailedOrder extends OrderSummary {
  shippingAddress: any;
  auditLogs: AuditLogEntry[];
  whatsappMessages?: WhatsAppRecentMessage[];
}

export const authStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken: (token: string): void => {
    if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
  },
  getUser: (): UserProfile | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user: UserProfile): void => {
    if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },
};

/**
 * Ensures an active session is established.
 * In development, automatically authenticates with the seeded development account.
 */
export async function ensureAuthenticated(): Promise<string> {
  const existing = authStorage.getToken();
  if (existing) {
    return existing;
  }

  // Automatic dev fallback to seeded credentials
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@byteforge.io',
      password: 'Password123!',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to auto-authenticate with backend');
  }

  const json = await res.json();
  authStorage.setToken(json.data.token);
  authStorage.setUser(json.data.user);
  return json.data.token;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await ensureAuthenticated();

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}/api/v1${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}: Request failed`;
    throw new Error(message);
  }

  const result = await response.json();
  return result.data;
}

export const api = {
  // Overview & Analytics
  getOverviewAnalytics: (params?: {
    range?: 'today' | '7d' | '30d' | 'custom' | 'all';
    startDate?: string;
    endDate?: string;
  }): Promise<OverviewAnalytics> => {
    const query = new URLSearchParams();
    if (params?.range) query.set('range', params.range);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return request<OverviewAnalytics>(`/analytics/overview${qs ? `?${qs}` : ''}`);
  },

  // System Diagnostics & Health Monitoring
  getDetailedHealth: (): Promise<any> => {
    return request('/health/detailed');
  },

  // Orders
  getOrders: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ orders: OrderSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.search) query.set('search', params.search);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);

    return request(`/orders?${query.toString()}`);
  },

  getOrderById: (id: string): Promise<DetailedOrder> => {
    return request<DetailedOrder>(`/orders/${id}`);
  },

  updateOrderStatus: (
    id: string,
    status: string,
    reason?: string,
    note?: string
  ): Promise<DetailedOrder> => {
    return request<DetailedOrder>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason, note }),
    });
  },

  // Auth & Profile
  getMe: (): Promise<{ user: UserProfile; tenant: TenantProfile }> => {
    return request<{ user: UserProfile; tenant: TenantProfile }>('/auth/me');
  },

  // Shopify Integration
  getShopifyStatus: (): Promise<ShopifyIntegrationStatus> => {
    return request<ShopifyIntegrationStatus>('/shopify/status');
  },

  connectShopify: (data: {
    shopDomain: string;
    accessToken: string;
    webhookSecret?: string;
    scopes?: string;
  }): Promise<any> => {
    return request('/shopify/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  disconnectShopify: (): Promise<any> => {
    return request('/shopify/disconnect', {
      method: 'DELETE',
    });
  },

  syncShopifyOrders: (limit = 50): Promise<{ success: boolean; ordersImported: number; shopDomain: string }> => {
    return request('/shopify/sync', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  },

  triggerManualSync: (limit = 50): Promise<{ success: boolean; ordersImported: number; shopDomain: string }> => {
    return request('/shopify/sync', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  },

  // WhatsApp Baileys Web Integration (Phase 4)
  getWhatsAppStatus: (): Promise<{ success: boolean; data: BaileysConnectionStatus }> => {
    return request('/whatsapp/status');
  },

  getWhatsAppQrStreamUrl: (): string => {
    const token = authStorage.getToken();
    return `${API_BASE}/api/v1/whatsapp/qr-stream?token=${encodeURIComponent(token || '')}`;
  },

  reconnectWhatsApp: (): Promise<{ success: boolean; message: string }> => {
    return request('/whatsapp/reconnect', {
      method: 'POST',
    });
  },

  disconnectWhatsApp: (): Promise<{ success: boolean; message: string }> => {
    return request('/whatsapp/disconnect', {
      method: 'POST',
    });
  },

  resendWhatsAppConfirmation: (orderId: string): Promise<any> => {
    return request(`/whatsapp/resend/${orderId}`, {
      method: 'POST',
    });
  },

  // WhatsApp Message Templates
  getTemplates: (): Promise<{ success: boolean; data: MessageTemplate[] }> => {
    return request('/whatsapp/templates');
  },

  createTemplate: (data: {
    name: string;
    description?: string;
    body: string;
    event?: string;
    isDefault?: boolean;
    isEnabled?: boolean;
  }): Promise<{ success: boolean; data: MessageTemplate; message: string }> => {
    return request('/whatsapp/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateTemplate: (
    id: string,
    data: {
      name?: string;
      description?: string;
      body?: string;
      event?: string;
      isDefault?: boolean;
      isActive?: boolean;
    }
  ): Promise<{ success: boolean; data: MessageTemplate; message: string }> => {
    return request(`/whatsapp/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteTemplate: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/whatsapp/templates/${id}`, {
      method: 'DELETE',
    });
  },

  previewTemplate: (
    body: string,
    variables?: Record<string, string>
  ): Promise<{
    success: boolean;
    data: {
      rendered: string;
      detectedVariables: string[];
      sampleVariables: Record<string, string>;
    };
  }> => {
    return request('/whatsapp/templates/preview', {
      method: 'POST',
      body: JSON.stringify({ body, variables }),
    });
  },

  testSendTemplate: (
    body: string,
    recipientPhone: string,
    variables?: Record<string, string>
  ): Promise<{ success: boolean; message: string; data: { rendered: string } }> => {
    return request('/whatsapp/templates/test-send', {
      method: 'POST',
      body: JSON.stringify({ body, recipientPhone, variables }),
    });
  },

  // Automation Settings
  getAutomationSettings: (): Promise<{ success: boolean; data: AutomationSettings }> => {
    return request('/whatsapp/automation-settings');
  },

  updateAutomationSettings: (
    data: Partial<AutomationSettings>
  ): Promise<{ success: boolean; message: string; data: AutomationSettings }> => {
    return request('/whatsapp/automation-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Message History
  getWhatsAppMessages: (params?: {
    page?: number;
    limit?: number;
    orderId?: string;
    status?: string;
    direction?: string;
    search?: string;
  }): Promise<{
    success: boolean;
    data: {
      messages: WhatsAppMessageRecord[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
  }> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.orderId) query.set('orderId', params.orderId);
    if (params?.status) query.set('status', params.status);
    if (params?.direction) query.set('direction', params.direction);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return request(`/whatsapp/messages${qs ? `?${qs}` : ''}`);
  },
};

export interface BaileysConnectionStatus {
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_REQUIRED' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';
  qrCode: string | null;
  displayPhoneNumber: string | null;
  connectedAt: string | null;
  lastError: string | null;
  uptimeSeconds: number;
  logs: Array<{ time: string; message: string; level: 'info' | 'warn' | 'error' }>;
}

export interface MessageTemplate {
  id: string;
  name: string;
  description: string | null;
  event: string;
  body: string;
  isDefault: boolean;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationSettings {
  id: string;
  autoConfirmEnabled: boolean;
  codOnly: boolean;
  defaultTemplateId?: string | null;
  minDelaySeconds: number;
  confirmKeywords: string[];
  cancelKeywords: string[];
  optOutKeywords?: string[];
  successReplyText: string;
  cancelReplyText: string;
  ambiguousReplyText: string;
  optOutReplyText?: string;
  testPhoneNumber?: string | null;
  eligibleOrderTypes?: string[];
  maxRetryAttempts?: number;
  skipMissingPhone?: boolean;
}

export interface WhatsAppMessageRecord {
  id: string;
  tenantId: string;
  orderId: string | null;
  customerId: string | null;
  wamid: string | null;
  recipientPhone: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  messageType: string;
  payload: any;
  customerResponse: string | null;
  respondedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  order?: {
    id: string;
    shopifyOrderNumber: string;
    totalPrice: string;
    currency: string;
    confirmationStatus: string;
  } | null;
  customer?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string;
  } | null;
}

export interface WhatsAppIntegrationData {
  id: string;
  phoneNumberId: string;
  businessAccountId: string;
  displayPhoneNumber: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONFIGURATION_REQUIRED' | 'ERROR';
  isActive: boolean;
  autoConfirmEnabled: boolean;
  codOnly: boolean;
  templateName: string;
  templateLanguage: string;
  lastVerifiedAt: string | null;
  errorMessage: string | null;
}

export interface WhatsAppStats {
  totalMessages: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  deliveryRate: string;
}

export interface WhatsAppRecentMessage {
  id: string;
  wamid: string | null;
  recipientPhone: string;
  status: string;
  customerResponse: string | null;
  orderNumber: string;
  orderTotal: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface WhatsAppStatusResponse {
  integration: WhatsAppIntegrationData | null;
  stats: WhatsAppStats;
  recentMessages: WhatsAppRecentMessage[];
}

export interface ShopifyIntegrationStatus {
  connected: boolean;
  integration: {
    id: string;
    shopDomain: string;
    isActive: boolean;
    scopes: string | null;
    installedAt: string;
    lastSyncedAt: string | null;
    lastWebhookAt: string | null;
    syncStatus: 'IDLE' | 'SYNCING' | 'COMPLETED' | 'FAILED';
    syncError: string | null;
    syncedOrdersCount: number;
  } | null;
  recentWebhooks: Array<{
    id: string;
    topic: string;
    status: string;
    webhookId: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
}
