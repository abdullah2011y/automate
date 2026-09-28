'use client';

import React, { useState, useEffect } from 'react';
import {
  Store,
  ShieldCheck,
  Webhook,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  KeyRound,
  Calendar,
  Layers,
  ArrowRight,
  Radio,
  Clock,
  Check,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { api, ShopifyIntegrationStatus, getWebhookUrl } from '@/lib/api';

export default function ShopifyPage() {
  const [statusData, setStatusData] = useState<ShopifyIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Connect form state
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Disconnect dialog
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getShopifyStatus();
      setStatusData(data);
    } catch (err: any) {
      console.error('Failed to load Shopify status:', err);
      setError(err.message || 'Failed to fetch Shopify integration status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopDomain || !accessToken) {
      alert('Please fill in both Shop Domain and Admin API Access Token');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.connectShopify({
        shopDomain,
        accessToken,
        webhookSecret: webhookSecret || undefined,
      });
      setSuccessMessage('Shopify store connected successfully!');
      setConnectModalOpen(false);
      setShopDomain('');
      setAccessToken('');
      setWebhookSecret('');
      await fetchStatus();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncOrders = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const result = await api.syncShopifyOrders(50);
      setSuccessMessage(`Synchronized ${result.ordersImported} orders from Shopify!`);
      await fetchStatus();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await api.disconnectShopify();
      setDisconnectModalOpen(false);
      setSuccessMessage('Shopify store successfully disconnected');
      await fetchStatus();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Disconnect failed: ${err.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-navy-900 tracking-tight">
            Shopify Store Integration
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Connect your Shopify store, verify HMAC-SHA256 webhooks, and manage automatic Cash on Delivery synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand' : ''}`} />
            Refresh Status
          </button>

          {!statusData?.connected && (
            <button
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-navy-900 hover:bg-navy-800 text-white shadow-sm transition-all"
            >
              <Store className="w-4 h-4 text-brand" />
              Connect Shopify Store
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800 font-semibold animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main Connection Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-navy-900 flex items-center justify-center text-brand text-2xl shadow-sm">
              🛍️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-navy-900">
                  {statusData?.connected ? statusData.integration?.shopDomain : 'No Store Connected'}
                </h3>
                {statusData?.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                    Disconnected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {statusData?.connected
                  ? 'Official Shopify Webhook Ingestion & REST/GraphQL Sync Active'
                  : 'Connect your store using custom app credentials or Shopify OAuth'}
              </p>
            </div>
          </div>

          {statusData?.connected && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncOrders}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#E6FAFE] hover:bg-[#d0f5fc] text-[#028FA8] border border-brand/30 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Synchronizing...' : 'Sync Orders Now'}
              </button>

              <button
                onClick={() => setDisconnectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Store Metadata Grid */}
        {statusData?.connected && statusData.integration && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Last Successful Sync
              </span>
              <span className="text-xs font-bold text-navy-900 mt-1 block">
                {formatDate(statusData.integration.lastSyncedAt)}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Status: {statusData.integration.syncStatus}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Last Webhook Received
              </span>
              <span className="text-xs font-bold text-navy-900 mt-1 block">
                {formatDate(statusData.integration.lastWebhookAt)}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                HMAC-SHA256 Authenticated
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Synced Orders Count
              </span>
              <span className="text-xs font-bold text-navy-900 mt-1 block">
                {statusData.integration.syncedOrdersCount} Orders
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Idempotent & Deduped
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Encryption at Rest
              </span>
              <span className="text-xs font-bold text-navy-900 mt-1 block">
                AES-256-GCM
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Credentials never logged
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Webhook Configuration Guide & Endpoints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-navy-900">Configured Webhook Receiver</h4>
              <p className="text-xs text-slate-400">Endpoint ready for Shopify Notifications</p>
            </div>
          </div>
          <div className="space-y-2 mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-bold text-slate-500">Public Webhook URL:</span>
              <button
                type="button"
                onClick={() => {
                  const url = getWebhookUrl();
                  navigator.clipboard.writeText(url);
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2500);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-white hover:bg-slate-100 text-navy-900 border border-slate-200 shadow-sm transition-all"
              >
                {copiedWebhook ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-brand" /> Copy URL
                  </>
                )}
              </button>
            </div>
            <p className="text-navy-900 font-mono text-xs font-bold break-all select-all">
              {getWebhookUrl()}
            </p>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-slate-500 list-disc list-inside">
            <li><strong>orders/create:</strong> Real-time COD confirmation trigger</li>
            <li><strong>orders/updated:</strong> Fulfillment & payment sync (preserves status)</li>
            <li><strong>orders/cancelled:</strong> Intercepts cancelled orders before courier dispatch</li>
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#E6FAFE] text-[#028FA8]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-navy-900">Security & Idempotency Guarantee</h4>
              <p className="text-xs text-slate-400">Zero duplicate orders or tampered requests</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every webhook is validated using the exact raw request byte buffer against the <code>X-Shopify-Hmac-Sha256</code> signature. Inbound events are indexed by <code>X-Shopify-Webhook-Id</code> to drop duplicate deliveries automatically without re-processing.
          </p>
        </div>
      </div>

      {/* Webhook Activity Stream Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-navy-900">Recent Webhook Deliveries</h4>
            <p className="text-xs text-slate-400 mt-0.5">Live audit trail of received Shopify webhook events</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Tenant Isolated
          </span>
        </div>

        {!statusData?.recentWebhooks || statusData.recentWebhooks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No webhooks received yet for this store.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Topic</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Webhook ID</th>
                  <th className="px-6 py-3 text-right">Received At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-navy-900 font-medium">
                {statusData.recentWebhooks.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3 font-mono font-bold text-navy-900">{w.topic}</td>
                    <td className="px-6 py-3">
                      {w.status === 'PROCESSED' ? (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          PROCESSED
                        </span>
                      ) : w.status === 'FAILED' ? (
                        <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          FAILED
                        </span>
                      ) : (
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {w.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-500">{w.webhookId}</td>
                    <td className="px-6 py-3 text-right text-slate-400">{formatDate(w.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CONNECT SHOPIFY STORE MODAL                                               */}
      {/* ========================================================================= */}
      {connectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-navy-900 text-brand flex items-center justify-center text-lg">
                  🛍️
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-navy-900">Connect Shopify Store</h3>
                  <p className="text-[11px] text-slate-400">Custom App Admin API or Partner App</p>
                </div>
              </div>
              <button
                onClick={() => setConnectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-navy-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Shopify Store Domain <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="my-boutique.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your standard myshopify.com handle (e.g. <code>store.myshopify.com</code>)
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Admin API Access Token <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand/40 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Generated in Shopify Admin → Settings → Apps → App Development → Create Custom App.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Webhook Signature Secret (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Optional shared webhook secret"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand/40 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  If omitted, the token is used for direct webhook validation.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-navy-900 hover:bg-navy-800 text-white shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Encrypting & Connecting...' : 'Connect Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DISCONNECT CONFIRMATION MODAL                                             */}
      {/* ========================================================================= */}
      {disconnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Disconnect Shopify Store?
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to disconnect <strong>{statusData?.integration?.shopDomain}</strong>? Real-time Cash on Delivery webhook ingestion will be halted. Existing order history will remain preserved.
            </p>

            <div className="mt-6 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setDisconnectModalOpen(false)}
                className="px-4 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100"
              >
                Keep Store
              </button>
              <button
                disabled={isDisconnecting}
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-lg font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
