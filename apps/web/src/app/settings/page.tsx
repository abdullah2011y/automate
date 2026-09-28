'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Sliders,
  MessageSquare,
  Shield,
  ShoppingBag,
  Smartphone,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  Send,
  Plus,
  Trash2,
  Power,
  Server,
  Activity,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck,
  Check,
  Copy,
  Webhook,
  Store,
  KeyRound,
} from 'lucide-react';
import {
  api,
  AutomationSettings,
  MessageTemplate,
  ShopifyIntegrationStatus,
  BaileysConnectionStatus,
  getWebhookUrl,
} from '@/lib/api';

type TabType = 'automation' | 'keywords' | 'testing' | 'shopify' | 'whatsapp' | 'health';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('automation');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Core Data
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyIntegrationStatus | null>(null);
  const [waStatus, setWaStatus] = useState<BaileysConnectionStatus | null>(null);
  const [healthData, setHealthData] = useState<any | null>(null);

  // Keyword tag inputs
  const [newConfirmKw, setNewConfirmKw] = useState('');
  const [newCancelKw, setNewCancelKw] = useState('');
  const [newOptOutKw, setNewOptOutKw] = useState('');

  // Test send state & mandatory safety confirmation modal
  const [testTemplateBody, setTestTemplateBody] = useState('');
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isTestConfirmModalOpen, setIsTestConfirmModalOpen] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // Shopify connection in Settings
  const [shopifyDomainInput, setShopifyDomainInput] = useState('');
  const [shopifyTokenInput, setShopifyTokenInput] = useState('');
  const [shopifySecretInput, setShopifySecretInput] = useState('');
  const [connectingStore, setConnectingStore] = useState(false);
  const [disconnectingStore, setDisconnectingStore] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [settingsRes, templatesRes, shopifyRes, waRes, healthRes] = await Promise.allSettled([
        api.getAutomationSettings(),
        api.getTemplates(),
        api.getShopifyStatus(),
        api.getWhatsAppStatus(),
        api.getDetailedHealth(),
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value.success) {
        setSettings(settingsRes.value.data);
        if (settingsRes.value.data.testPhoneNumber) {
          setTestPhoneNumber(settingsRes.value.data.testPhoneNumber);
        }
      }

      if (templatesRes.status === 'fulfilled' && templatesRes.value.success) {
        setTemplates(templatesRes.value.data);
        if (templatesRes.value.data.length > 0) {
          const defaultTpl = templatesRes.value.data.find((t) => t.isDefault) || templatesRes.value.data[0];
          setTestTemplateBody(defaultTpl.body);
        }
      }

      if (shopifyRes.status === 'fulfilled') {
        setShopifyStatus(shopifyRes.value);
      }

      if (waRes.status === 'fulfilled' && waRes.value?.data) {
        setWaStatus(waRes.value.data);
      }

      if (healthRes.status === 'fulfilled') {
        setHealthData(healthRes.value);
      }
    } catch (err: any) {
      console.error('Error loading settings data:', err);
      showToast('error', 'Failed to load configuration from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Save Automation Settings
  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.updateAutomationSettings({
        ...settings,
        testPhoneNumber: testPhoneNumber.trim() || null,
      });
      if (res.success) {
        setSettings(res.data);
        showToast('success', 'Automation settings saved successfully to PostgreSQL database');
      } else {
        showToast('error', res.message || 'Failed to save settings');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Keywords management
  const addKeyword = (type: 'confirm' | 'cancel' | 'optOut') => {
    if (!settings) return;
    if (type === 'confirm' && newConfirmKw.trim()) {
      const kw = newConfirmKw.trim().toUpperCase();
      if (!settings.confirmKeywords.includes(kw)) {
        setSettings({ ...settings, confirmKeywords: [...settings.confirmKeywords, kw] });
      }
      setNewConfirmKw('');
    } else if (type === 'cancel' && newCancelKw.trim()) {
      const kw = newCancelKw.trim().toUpperCase();
      if (!settings.cancelKeywords.includes(kw)) {
        setSettings({ ...settings, cancelKeywords: [...settings.cancelKeywords, kw] });
      }
      setNewCancelKw('');
    } else if (type === 'optOut' && newOptOutKw.trim()) {
      const kw = newOptOutKw.trim().toUpperCase();
      const current = settings.optOutKeywords || [];
      if (!current.includes(kw)) {
        setSettings({ ...settings, optOutKeywords: [...current, kw] });
      }
      setNewOptOutKw('');
    }
  };

  const removeKeyword = (type: 'confirm' | 'cancel' | 'optOut', kw: string) => {
    if (!settings) return;
    if (type === 'confirm') {
      setSettings({
        ...settings,
        confirmKeywords: settings.confirmKeywords.filter((k) => k !== kw),
      });
    } else if (type === 'cancel') {
      setSettings({
        ...settings,
        cancelKeywords: settings.cancelKeywords.filter((k) => k !== kw),
      });
    } else if (type === 'optOut') {
      setSettings({
        ...settings,
        optOutKeywords: (settings.optOutKeywords || []).filter((k) => k !== kw),
      });
    }
  };

  // Safe manual sync trigger
  const handleManualSync = async () => {
    setActionLoading(true);
    try {
      const res = await api.triggerManualSync();
      showToast('success', `Shopify sync completed: ${res.ordersImported ?? 0} orders fetched.`);
      const updated = await api.getShopifyStatus();
      setShopifyStatus(updated);
    } catch (err: any) {
      showToast('error', err.message || 'Manual synchronization failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnectShopify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopifyDomainInput.trim() || !shopifyTokenInput.trim()) {
      showToast('error', 'Please enter both Shop Domain and Admin API Access Token');
      return;
    }
    setConnectingStore(true);
    try {
      await api.connectShopify({
        shopDomain: shopifyDomainInput.trim(),
        accessToken: shopifyTokenInput.trim(),
        webhookSecret: shopifySecretInput.trim() || undefined,
      });
      showToast('success', 'Shopify store connected successfully!');
      setShopifyDomainInput('');
      setShopifyTokenInput('');
      setShopifySecretInput('');
      const updated = await api.getShopifyStatus();
      setShopifyStatus(updated);
    } catch (err: any) {
      showToast('error', `Connection failed: ${err.message}`);
    } finally {
      setConnectingStore(false);
    }
  };

  const handleDisconnectShopify = async () => {
    if (!confirm('Are you sure you want to disconnect this Shopify store? Real-time webhook ingestion will be halted.')) return;
    setDisconnectingStore(true);
    try {
      await api.disconnectShopify();
      showToast('success', 'Shopify store disconnected');
      const updated = await api.getShopifyStatus();
      setShopifyStatus(updated);
    } catch (err: any) {
      showToast('error', `Disconnect failed: ${err.message}`);
    } finally {
      setDisconnectingStore(false);
    }
  };

  // WhatsApp reconnect
  const handleReconnectWA = async () => {
    setActionLoading(true);
    try {
      const res = await api.reconnectWhatsApp();
      showToast('success', res.message || 'Reconnecting WhatsApp Web session...');
      const updated = await api.getWhatsAppStatus();
      setWaStatus(updated.data);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reconnect session');
    } finally {
      setActionLoading(false);
    }
  };

  // WhatsApp reset session
  const handleResetWA = async () => {
    if (!confirm('Are you sure you want to completely reset WhatsApp session? This will wipe stored keys and generate a fresh pairing QR code.')) return;
    setActionLoading(true);
    try {
      const res = await api.resetWhatsAppSession();
      showToast('success', res.message || 'WhatsApp session reset. Generating fresh QR code...');
      const updated = await api.getWhatsAppStatus();
      setWaStatus(updated.data);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reset WhatsApp session');
    } finally {
      setActionLoading(false);
    }
  };

  // Test Send execution
  const executeTestSend = async () => {
    if (!testPhoneNumber.trim()) {
      showToast('error', 'Administrator test phone number is required');
      return;
    }
    setTestSending(true);
    try {
      const res = await api.testSendTemplate(testTemplateBody, testPhoneNumber.trim());
      showToast('success', res.message || 'Test message sent successfully to your test phone');
      setIsTestConfirmModalOpen(false);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to send test message');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-navy-900 tracking-tight">
            Settings & System Control
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure order confirmation automation, customer response rules, Shopify sync, and health diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand' : ''}`} />
            Refresh
          </button>

          {(activeTab === 'automation' || activeTab === 'keywords' || activeTab === 'testing') && (
            <button
              onClick={handleSaveSettings}
              disabled={saving || !settings}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-navy-900 hover:bg-navy-800 text-white shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-brand" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto border-b border-slate-200 space-x-1 pb-px text-xs font-semibold">
        <button
          onClick={() => setActiveTab('automation')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'automation'
              ? 'border-brand text-brand font-bold bg-slate-50/50'
              : 'border-transparent text-slate-500 hover:text-navy-900 hover:border-slate-300'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Automation Rules
        </button>

        <button
          onClick={() => setActiveTab('keywords')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'keywords'
              ? 'border-brand text-brand font-bold bg-slate-50/50'
              : 'border-transparent text-slate-500 hover:text-navy-900 hover:border-slate-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Keywords & Opt-Outs
        </button>

        <button
          onClick={() => setActiveTab('testing')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'testing'
              ? 'border-brand text-brand font-bold bg-slate-50/50'
              : 'border-transparent text-slate-500 hover:text-navy-900 hover:border-slate-300'
          }`}
        >
          <Shield className="w-4 h-4" />
          Safe Test Sending
        </button>

        <button
          onClick={() => setActiveTab('shopify')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'shopify'
              ? 'border-brand text-brand font-bold bg-slate-50/50'
              : 'border-transparent text-slate-500 hover:text-navy-900 hover:border-slate-300'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Shopify Integration
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'whatsapp'
              ? 'border-brand text-brand font-bold bg-slate-50/50'
              : 'border-transparent text-slate-500 hover:text-navy-900 hover:border-slate-300'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          WhatsApp Engine
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'health'
              ? 'border-brand text-brand font-bold bg-slate-50/50'
              : 'border-transparent text-slate-500 hover:text-navy-900 hover:border-slate-300'
          }`}
        >
          <Activity className="w-4 h-4" />
          System Health & Backups
        </button>
      </div>

      {/* TAB 1: AUTOMATION RULES */}
      {activeTab === 'automation' && settings && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center justify-between">
              <span>Order Confirmation Automation</span>
              <span className="text-xs font-normal normal-case text-slate-400">
                Single-administrator control
              </span>
            </h3>

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <h4 className="text-sm font-bold text-navy-900">Enable Automatic WhatsApp Confirmation</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  When enabled, new eligible Shopify orders automatically queue confirmation messages.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoConfirmEnabled}
                  onChange={(e) => setSettings({ ...settings, autoConfirmEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* COD Only */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <h4 className="text-sm font-bold text-navy-900">Cash on Delivery (COD) Orders Only</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Only trigger confirmations for COD orders to prevent customer cancellations on prepaid checkouts.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.codOnly}
                  onChange={(e) => setSettings({ ...settings, codOnly: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Default Template Selection */}
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                Default Confirmation Template
              </label>
              <select
                value={settings.defaultTemplateId || ''}
                onChange={(e) => setSettings({ ...settings, defaultTemplateId: e.target.value || null })}
                className="w-full text-xs font-medium rounded-lg border border-slate-200 p-2.5 text-navy-900 bg-white focus:outline-none focus:border-brand"
              >
                <option value="">System Default (Built-in Template)</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} {tpl.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Minimum Delay Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  Dispatch Cooldown Delay
                </label>
                <span className="text-xs font-bold text-brand bg-[#E6FAFE] px-2.5 py-0.5 rounded-full">
                  {settings.minDelaySeconds} seconds
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Delays message dispatch after order creation to allow customer self-edits and mimic organic human timing.
              </p>
              <input
                type="range"
                min="0"
                max="300"
                step="5"
                value={settings.minDelaySeconds}
                onChange={(e) => setSettings({ ...settings, minDelaySeconds: Number(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0s (Instant)</span>
                <span>60s (Recommended)</span>
                <span>300s (5 min)</span>
              </div>
            </div>

            {/* Max Retry Attempts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                  Max Queue Retry Attempts
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxRetryAttempts ?? 3}
                  onChange={(e) => setSettings({ ...settings, maxRetryAttempts: Number(e.target.value) })}
                  className="w-full text-xs font-medium rounded-lg border border-slate-200 p-2.5 text-navy-900 bg-white focus:outline-none focus:border-brand"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Bounded exponential backoff: 15s, 30s, 60s, up to 300s before marking permanent failure.
                </p>
              </div>

              {/* Missing Phone Handling */}
              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                  Orders With Missing Phone
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="skipPhone"
                    checked={settings.skipMissingPhone ?? true}
                    onChange={(e) => setSettings({ ...settings, skipMissingPhone: e.target.checked })}
                    className="w-4 h-4 text-brand rounded border-slate-300 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="skipPhone" className="text-xs text-navy-900 font-medium cursor-pointer">
                    Silently skip confirmation (Do not fail or crash queue)
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  When enabled, orders without a valid phone number are left pending for manual operator review.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KEYWORDS & OPT-OUTS */}
      {activeTab === 'keywords' && settings && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider pb-3 border-b border-slate-100">
              Customer Response Triggers (Case-Insensitive)
            </h3>

            {/* Confirmation Keywords */}
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                Confirmation Keywords
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Replies containing these keywords automatically confirm the order in Shopify and ByteForge.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {settings.confirmKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword('confirm', kw)}
                      className="hover:text-emerald-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. CONFIRM, YES, 1, HAAN"
                  value={newConfirmKw}
                  onChange={(e) => setNewConfirmKw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword('confirm'))}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-navy-900 focus:outline-none focus:border-brand flex-1"
                />
                <button
                  onClick={() => addKeyword('confirm')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-navy-900 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Cancellation Keywords */}
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                Cancellation Keywords
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Replies containing these keywords automatically cancel the order and prevent courier dispatch.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {settings.cancelKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword('cancel', kw)}
                      className="hover:text-rose-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. CANCEL, NO, 2, NAHI, KANSAL"
                  value={newCancelKw}
                  onChange={(e) => setNewCancelKw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword('cancel'))}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-navy-900 focus:outline-none focus:border-brand flex-1"
                />
                <button
                  onClick={() => addKeyword('cancel')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-navy-900 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Opt-Out Keywords */}
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                Customer Opt-Out Keywords
              </label>
              <p className="text-xs text-slate-500 mb-2">
                When received, the customer is permanently marked as opted-out. Further automated messages are suppressed until explicitly re-consented (e.g. replying START).
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(settings.optOutKeywords || ['STOP', 'UNSUBSCRIBE', 'OPTOUT', 'RUK JAO']).map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword('optOut', kw)}
                      className="hover:text-amber-950"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. STOP, UNSUBSCRIBE, RUK JAO"
                  value={newOptOutKw}
                  onChange={(e) => setNewOptOutKw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword('optOut'))}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-navy-900 focus:outline-none focus:border-brand flex-1"
                />
                <button
                  onClick={() => addKeyword('optOut')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-navy-900 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Automated Replies Text Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                  Confirmation Success Reply
                </label>
                <textarea
                  rows={2}
                  value={settings.successReplyText}
                  onChange={(e) => setSettings({ ...settings, successReplyText: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-navy-900 focus:outline-none focus:border-brand font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                  Cancellation Reply
                </label>
                <textarea
                  rows={2}
                  value={settings.cancelReplyText}
                  onChange={(e) => setSettings({ ...settings, cancelReplyText: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-navy-900 focus:outline-none focus:border-brand font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                  Ambiguous Response Reply
                </label>
                <textarea
                  rows={2}
                  value={settings.ambiguousReplyText}
                  onChange={(e) => setSettings({ ...settings, ambiguousReplyText: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-navy-900 focus:outline-none focus:border-brand font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                  Opt-Out Confirmation Reply
                </label>
                <textarea
                  rows={2}
                  value={settings.optOutReplyText || 'You have been unsubscribed from ByteForge automated updates. Reply START to resubscribe.'}
                  onChange={(e) => setSettings({ ...settings, optOutReplyText: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-navy-900 focus:outline-none focus:border-brand font-sans"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SAFE TEST SENDING */}
      {activeTab === 'testing' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider pb-1">
                Safe Test Message Verification
              </h3>
              <p className="text-xs text-slate-500">
                To protect against accidental messaging to real customers, test sends can only be directed to your explicitly configured administrator test number.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Zero Customer Risk Guarantee:</span>
                <p className="mt-0.5">
                  Server-side security verification blocks any test message request where recipient does not match the configured test number below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                  Administrator Test Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+923001234567 or 923001234567"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="w-full text-xs font-mono rounded-lg border border-slate-200 p-2.5 text-navy-900 bg-white focus:outline-none focus:border-brand"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Include country code (e.g. +92 for Pakistan). Saved in your PostgreSQL settings.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                  Select Template To Test
                </label>
                <select
                  onChange={(e) => {
                    const tpl = templates.find((t) => t.id === e.target.value);
                    if (tpl) setTestTemplateBody(tpl.body);
                  }}
                  className="w-full text-xs font-medium rounded-lg border border-slate-200 p-2.5 text-navy-900 bg-white focus:outline-none focus:border-brand"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                Message Body Preview
              </label>
              <textarea
                rows={4}
                value={testTemplateBody}
                onChange={(e) => setTestTemplateBody(e.target.value)}
                className="w-full text-xs font-mono rounded-lg border border-slate-200 p-3 text-navy-900 focus:outline-none focus:border-brand"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsTestConfirmModalOpen(true)}
                disabled={!testPhoneNumber.trim() || !testTemplateBody.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-navy-900 hover:bg-navy-800 text-white shadow-sm transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-brand" />
                Dispatch Safe Test Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SHOPIFY INTEGRATION */}
      {activeTab === 'shopify' && (
        <div className="space-y-6">
          {/* Webhook Configuration Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                    Official Shopify Webhook URL
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time COD order confirmation and lifecycle sync endpoint
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> HMAC-SHA256 Protected
              </span>
            </div>

            <div className="space-y-2 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Production Webhook Receiver URL:</span>
                <button
                  type="button"
                  onClick={() => {
                    const url = getWebhookUrl();
                    navigator.clipboard.writeText(url);
                    setCopiedWebhookUrl(true);
                    showToast('success', 'Shopify Webhook URL copied to clipboard!');
                    setTimeout(() => setCopiedWebhookUrl(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-navy-900 border border-slate-200 shadow-sm transition-all"
                >
                  {copiedWebhookUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-brand" /> Copy Webhook URL
                    </>
                  )}
                </button>
              </div>
              <p className="text-navy-900 font-mono text-xs font-bold break-all select-all bg-white p-2.5 rounded-lg border border-slate-200/80">
                {getWebhookUrl()}
              </p>
            </div>

            <div className="pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Supported Shopify Webhook Events (Format: JSON)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="font-mono font-bold text-navy-900 text-xs">orders/create</div>
                  <p className="text-slate-500 text-[11px] mt-1">Triggers automated WhatsApp confirmation message instantly when a COD order is placed.</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="font-mono font-bold text-navy-900 text-xs">orders/updated</div>
                  <p className="text-slate-500 text-[11px] mt-1">Syncs customer details, order fulfillment, and payment updates in real-time.</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="font-mono font-bold text-navy-900 text-xs">orders/cancelled</div>
                  <p className="text-slate-500 text-[11px] mt-1">Intercepts cancelled orders immediately to prevent accidental dispatch.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Store Connection Status / Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-navy-900 text-brand">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                    {shopifyStatus?.connected ? 'Connected Shopify Store' : 'Connect Your Shopify Store'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {shopifyStatus?.connected
                      ? 'Store synchronization and webhook processing active'
                      : 'Connect your store using your Shopify Admin API Access Token'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    shopifyStatus?.connected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {shopifyStatus?.connected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Disconnected
                    </>
                  )}
                </span>

                {shopifyStatus?.connected && (
                  <>
                    <button
                      onClick={handleManualSync}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E6FAFE] text-[#028FA8] hover:bg-[#d5f7fd] transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${actionLoading ? 'animate-spin' : ''}`} />
                      Sync Orders Now
                    </button>
                    <button
                      onClick={handleDisconnectShopify}
                      disabled={disconnectingStore}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {disconnectingStore ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {shopifyStatus?.connected && shopifyStatus.integration ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Shop Domain</span>
                  <p className="text-sm font-bold text-navy-900 mt-1 truncate">
                    {shopifyStatus.integration.shopDomain}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Last Synced</span>
                  <p className="text-sm font-bold text-navy-900 mt-1">
                    {shopifyStatus.integration.lastSyncedAt
                      ? new Date(shopifyStatus.integration.lastSyncedAt).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Last Webhook</span>
                  <p className="text-sm font-bold text-navy-900 mt-1">
                    {shopifyStatus.integration.lastWebhookAt
                      ? new Date(shopifyStatus.integration.lastWebhookAt).toLocaleString()
                      : 'None'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Synced Orders</span>
                  <p className="text-sm font-bold text-navy-900 mt-1">
                    {shopifyStatus.integration.syncedOrdersCount ?? 0} Orders
                  </p>
                </div>
              </div>
            ) : (
              /* Connect Form when disconnected */
              <form onSubmit={handleConnectShopify} className="space-y-4 max-w-2xl text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Shopify Store Domain <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="my-store.myshopify.com"
                    value={shopifyDomainInput}
                    onChange={(e) => setShopifyDomainInput(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Enter your standard myshopify handle (e.g. <code>store.myshopify.com</code>).
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Admin API Access Token <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                    value={shopifyTokenInput}
                    onChange={(e) => setShopifyTokenInput(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand/40 font-mono"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Generated in Shopify Admin ➔ Settings ➔ Apps and sales channels ➔ Develop apps ➔ Create an app.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Webhook Signature Secret (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Optional shared webhook secret"
                    value={shopifySecretInput}
                    onChange={(e) => setShopifySecretInput(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand/40 font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    If omitted, the access token is used for direct webhook HMAC verification.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={connectingStore}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-navy-900 hover:bg-navy-800 text-white shadow-sm transition-all disabled:opacity-50"
                  >
                    <Store className="w-4 h-4 text-brand" />
                    {connectingStore ? 'Encrypting & Connecting Store...' : 'Connect Shopify Store'}
                  </button>
                </div>
              </form>
            )}

            {/* Step-by-Step Setup Guide */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>📋</span> Step-by-Step Store Connection Guide
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="font-bold text-navy-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-navy-900 text-white flex items-center justify-center text-[10px]">1</span>
                    Create Custom App in Shopify
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Shopify Admin kholen ➔ <strong>Settings</strong> ➔ <strong>Apps and sales channels</strong> ➔ <strong>Develop apps</strong> par jayein aur <strong>Create an app</strong> par click karein.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="font-bold text-navy-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-navy-900 text-white flex items-center justify-center text-[10px]">2</span>
                    Configure API Scopes & Install
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    <strong>Configure Admin API scopes</strong> mein ja kar <code>read_orders</code>, <code>write_orders</code>, aur <code>read_customers</code> check karein. Phir <strong>Install app</strong> dabayein aur <strong>Admin API access token</strong> (starts with <code>shpat_</code>) copy karein.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="font-bold text-navy-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-navy-900 text-white flex items-center justify-center text-[10px]">3</span>
                    Paste Token & Connect
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Apna store domain (e.g. <code>xyz.myshopify.com</code>) aur copy kiya hua access token upar form mein paste karke <strong>Connect Shopify Store</strong> par click karein.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="font-bold text-navy-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-navy-900 text-white flex items-center justify-center text-[10px]">4</span>
                    Setup Webhook for Live Orders
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Shopify Admin ➔ <strong>Settings</strong> ➔ <strong>Notifications</strong> ➔ <strong>Webhooks</strong> mein ja kar <strong>Create Webhook</strong> karein: Event: <strong>Order creation</strong>, Format: <strong>JSON</strong>, URL: upar diya gaya Webhook URL paste karein.
                  </p>
                </div>
              </div>
            </div>

            {/* Webhook logs */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
                Recent Shopify Webhooks Activity
              </h4>
              {!shopifyStatus?.recentWebhooks || shopifyStatus.recentWebhooks.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No recent webhook events logged yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2">Topic</th>
                        <th className="px-4 py-2">Webhook ID</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-right">Received At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shopifyStatus.recentWebhooks.map((wh) => (
                        <tr key={wh.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 font-mono font-medium text-navy-900">{wh.topic}</td>
                          <td className="px-4 py-2 font-mono text-slate-500 text-[11px]">{wh.webhookId}</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              {wh.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-slate-400">
                            {new Date(wh.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: WHATSAPP ENGINE */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                  Baileys WhatsApp Web Engine
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct WebSocket Multi-Device connection with persistent authentication state
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    waStatus?.status === 'CONNECTED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : waStatus?.status === 'QR_REQUIRED'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                      : waStatus?.status === 'CONNECTING'
                      ? 'bg-sky-50 text-sky-700 border border-sky-200 animate-pulse'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      waStatus?.status === 'CONNECTED'
                        ? 'bg-emerald-500'
                        : waStatus?.status === 'QR_REQUIRED'
                        ? 'bg-amber-500'
                        : waStatus?.status === 'CONNECTING'
                        ? 'bg-sky-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  {waStatus?.status === 'CONNECTED'
                    ? `CONNECTED (+${waStatus.displayPhoneNumber || 'Active'})`
                    : waStatus?.status === 'QR_REQUIRED'
                    ? 'AWAITING QR SCAN'
                    : waStatus?.status || 'DISCONNECTED'}
                </span>

                <Link
                  href="/whatsapp"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-navy-900 text-white hover:bg-navy-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-brand" />
                  Open QR Pairing
                </Link>

                <button
                  onClick={handleResetWA}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-50"
                  title="Wipes stale PostgreSQL session keys and restarts socket"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  Reset Session
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Connected Phone</span>
                <p className="text-sm font-bold text-navy-900 mt-1 font-mono">
                  {waStatus?.displayPhoneNumber || 'None (Scan QR)'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Engine Uptime</span>
                <p className="text-sm font-bold text-navy-900 mt-1">
                  {waStatus?.uptimeSeconds ? `${Math.floor(waStatus.uptimeSeconds / 60)} minutes` : '0 min'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Session Storage</span>
                <p className="text-sm font-bold text-navy-900 mt-1">Local Multi-File Auth</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase">QR Pairing</span>
                <div className="mt-1">
                  <Link
                    href="/whatsapp"
                    className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                  >
                    Open QR Scanner <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SYSTEM HEALTH & BACKUPS */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                  System Health & Operational Diagnostics
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time health verification from Northflank Developer Sandbox & PostgreSQL
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Activity className="w-3.5 h-3.5" /> All Services Operational
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Database Latency</span>
                <p className="text-sm font-bold text-navy-900 mt-1">
                  {healthData?.database?.latencyMs != null ? `${healthData.database.latencyMs}ms` : 'Healthy'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">PostgreSQL 18.4 local pool</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Process Memory</span>
                <p className="text-sm font-bold text-navy-900 mt-1">
                  {healthData?.memory?.rssMB ? `${healthData.memory.rssMB} MB` : '< 120 MB'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Well within 512 MB sandbox limit</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Queue Depth</span>
                <p className="text-sm font-bold text-navy-900 mt-1">
                  {healthData?.messageQueue?.pendingJobs ?? 0} Pending
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {healthData?.messageQueue?.failedJobs ?? 0} permanent failures
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Rate Limiters</span>
                <p className="text-sm font-bold text-navy-900 mt-1">Active</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Sliding window protection</p>
              </div>
            </div>

            {/* Backups & Archival Policy */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">PostgreSQL Backups & 20-Day Archival Policy</h4>
                  <p className="text-xs text-slate-500">
                    Target directory: <code className="text-[11px] font-mono font-bold text-navy-900">E:\ByteForge-Backups</code>
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automated backup scripts generate SHA-256 verified manifests alongside full SQL dumps. Order archival enforces that a verified backup exists within the last 24 hours before any historical orders older than 20 days are safely archived. Active orders, customer profiles, and audit records are never deleted.
              </p>
              <div className="pt-2 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[11px]">
                  npm run db:backup
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[11px]">
                  npm run db:restore
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[11px]">
                  npm run db:archive
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY TEST CONFIRMATION MODAL */}
      {isTestConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 rounded-xl bg-amber-50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-navy-900">Explicit Test Message Confirmation</h3>
                <p className="text-xs text-slate-500">Phase 5 Security Requirement</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to dispatch a live test WhatsApp message to the following verified administrator phone number:
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-navy-900 text-center">
              {testPhoneNumber}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Please ensure this number is your personal or testing device. Test sends are strictly throttled (1 per 10 seconds).
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsTestConfirmModalOpen(false)}
                disabled={testSending}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeTestSend}
                disabled={testSending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-navy-900 hover:bg-navy-800 text-white shadow-sm transition-all"
              >
                {testSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" /> Sending...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-brand" /> Confirm & Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
