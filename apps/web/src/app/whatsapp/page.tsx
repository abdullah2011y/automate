'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Smartphone,
  RefreshCw,
  Power,
  Send,
  FileText,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  MessageSquare,
  Copy,
  Check,
  Eye,
  Plus,
  Trash2,
  Edit3,
  Save,
  ShieldCheck,
  Terminal,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  api,
  BaileysConnectionStatus,
  MessageTemplate,
  AutomationSettings,
  WhatsAppMessageRecord,
} from '@/lib/api';

export default function WhatsAppPage() {
  const [activeTab, setActiveTab] = useState<'connection' | 'templates' | 'automation' | 'history'>('connection');

  // Connection State
  const [statusData, setStatusData] = useState<BaileysConnectionStatus | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Templates State
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    event: 'ORDER_CONFIRMATION',
    body: '',
    isDefault: false,
    isEnabled: true,
  });
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({
    customer_name: 'Muhammad Ali',
    store_name: 'ByteForge Apparel',
    order_number: '#1042',
    order_total: '4,500',
    currency: 'Rs.',
    payment_method: 'Cash on Delivery',
  });
  const [testPhone, setTestPhone] = useState('');
  const [isTestingTemplate, setIsTestingTemplate] = useState(false);

  // Automation Settings State
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newConfirmKeyword, setNewConfirmKeyword] = useState('');
  const [newCancelKeyword, setNewCancelKeyword] = useState('');

  // Messages History State
  const [messages, setMessages] = useState<WhatsAppMessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');

  const eventSourceRef = useRef<EventSource | null>(null);

  // 1. Establish SSE Connection for real-time QR Code & Connection Status updates
  useEffect(() => {
    let sse: EventSource | null = null;

    const setupSSE = () => {
      try {
        const streamUrl = api.getWhatsAppQrStreamUrl();
        sse = new EventSource(streamUrl);
        eventSourceRef.current = sse;

        sse.onmessage = (event) => {
          try {
            const data: BaileysConnectionStatus = JSON.parse(event.data);
            setStatusData(data);
          } catch (e) {
            console.error('Failed to parse SSE payload:', e);
          }
        };

        sse.onerror = () => {
          // SSE will automatically retry in browsers
        };
      } catch (err) {
        console.error('Error establishing SSE:', err);
      }
    };

    setupSSE();

    // Fallback polling every 5s if SSE fails
    const interval = setInterval(() => {
      api.getWhatsAppStatus().then((res) => {
        if (res.data) setStatusData(res.data);
      }).catch(() => {});
    }, 5000);

    return () => {
      if (sse) sse.close();
      clearInterval(interval);
    };
  }, []);

  // Fetch Templates
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.getTemplates();
      setTemplates(res.data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Fetch Settings
  const fetchSettings = async () => {
    try {
      const res = await api.getAutomationSettings();
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Fetch Messages
  const fetchMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await api.getWhatsAppMessages({
        search: historySearch || undefined,
        status: historyStatusFilter || undefined,
      });
      setMessages(res.data.messages);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'automation') fetchSettings();
    if (activeTab === 'history') fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Handlers for Connection
  const handleReconnect = async () => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await api.reconnectWhatsApp();
      setActionMessage({ type: 'success', text: res.message });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to reconnect' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp Web? Orders will be retained in queue.')) return;
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const res = await api.disconnectWhatsApp();
      setActionMessage({ type: 'success', text: res.message });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to disconnect' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handlers for Template Management
  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      description: '',
      event: 'ORDER_CONFIRMATION',
      body: `Assalam-o-Alaikum {{customer_name}}!

Thank you for shopping with {{store_name}}.

Aapka order {{order_number}} receive ho gaya hai.

Order total: Rs. {{order_total}}

Order confirm karne ke liye CONFIRM reply karein.
Cancel karne ke liye CANCEL reply karein.`,
      isDefault: false,
      isEnabled: true,
    });
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tmpl: MessageTemplate) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      name: tmpl.name,
      description: tmpl.description || '',
      event: tmpl.event,
      body: tmpl.body,
      isDefault: tmpl.isDefault,
      isEnabled: tmpl.isActive,
    });
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, {
          name: templateForm.name,
          description: templateForm.description,
          event: templateForm.event,
          body: templateForm.body,
          isDefault: templateForm.isDefault,
          isActive: templateForm.isEnabled,
        });
      } else {
        await api.createTemplate(templateForm);
      }
      setIsTemplateModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      fetchTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete template');
    }
  };

  const handleTestSend = async () => {
    if (!testPhone) {
      alert('Please enter a recipient phone number (e.g. +923001234567)');
      return;
    }
    setIsTestingTemplate(true);
    try {
      const res = await api.testSendTemplate(templateForm.body, testPhone, previewVars);
      alert(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to send test message');
    } finally {
      setIsTestingTemplate(false);
    }
  };

  // Handlers for Automation Settings
  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await api.updateAutomationSettings(settings);
      setSettings(res.data);
      alert('Automation settings updated successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Helper for rendering preview text dynamically
  const renderPreview = (text: string) => {
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, varName) => {
      return previewVars[varName] !== undefined ? previewVars[varName] : `{{${varName}}}`;
    });
  };

  // Status Styling Helper
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected & Ready
          </span>
        );
      case 'QR_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Scan QR Code Required
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {status === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...'}
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Connection Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">WhatsApp Web Automation</h1>
              <p className="text-sm text-slate-400">
                Single-owner Baileys Web connection, dynamic templates & automated COD confirmation
              </p>
            </div>
          </div>
        </div>

        {/* Global Live Status Badge */}
        <div className="flex items-center gap-3">
          {getStatusBadge(statusData?.status)}
          <button
            onClick={handleReconnect}
            disabled={isActionLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
            Refresh QR
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('connection')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'connection'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4" />
          QR Connection & Pairing
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'templates'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Message Templates
        </button>
        <button
          onClick={() => setActiveTab('automation')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'automation'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Automation & Anti-Ban
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Delivery History & Responses
        </button>
      </div>

      {/* TAB 1: QR CONNECTION & PAIRING */}
      {activeTab === 'connection' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: QR Code Display or Connected State */}
          <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Live Pairing Channel</span>
            </div>

            {statusData?.status === 'CONNECTED' ? (
              <div className="py-8 px-4 flex flex-col items-center max-w-sm">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">WhatsApp Web Active</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Connected to WhatsApp as{' '}
                  <span className="font-semibold text-emerald-300">+{statusData.displayPhoneNumber}</span>. Automated confirmations are running smoothly.
                </p>

                <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-left space-y-2 mb-6">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Connected Phone</span>
                    <span className="font-mono text-slate-200">+{statusData.displayPhoneNumber}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Active Uptime</span>
                    <span className="font-mono text-emerald-400">
                      {Math.floor((statusData.uptimeSeconds || 0) / 3600)}h {Math.floor(((statusData.uptimeSeconds || 0) % 3600) / 60)}m {((statusData.uptimeSeconds || 0) % 60)}s
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Storage Backend</span>
                    <span className="font-mono text-indigo-400">PostgreSQL (AES-256 Encrypted)</span>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleReconnect}
                    disabled={isActionLoading}
                    className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate Session
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={isActionLoading}
                    className="flex-1 py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2"
                  >
                    <Power className="w-4 h-4" />
                    Disconnect
                  </button>
                </div>
              </div>
            ) : statusData?.qrCode ? (
              <div className="py-6 flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl shadow-2xl mb-4 border-4 border-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={statusData.qrCode}
                    alt="WhatsApp Web Pairing QR Code"
                    className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-400 font-medium mb-4">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  QR refreshes automatically via Baileys multi-device protocol
                </div>
                <button
                  onClick={handleReconnect}
                  disabled={isActionLoading}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-emerald-900/30"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Force New QR
                </button>
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-4 animate-pulse">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <h4 className="text-base font-semibold text-white mb-1">Generating Secure QR Code...</h4>
                <p className="text-xs text-slate-400 max-w-xs mb-4">
                  Initializing WhatsApp socket and loading Signal cryptographic keys from PostgreSQL.
                </p>
                <button
                  onClick={handleReconnect}
                  className="text-xs text-emerald-400 hover:underline font-medium"
                >
                  Click to reinitialize
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Scan Instructions & Live Console Logs */}
          <div className="lg:col-span-6 space-y-6">
            {/* Scan Instructions Panel */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                How to Connect WhatsApp
              </h3>
              <ol className="space-y-3.5 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Open WhatsApp on your mobile phone.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Tap <strong>Menu (⋮)</strong> on Android or <strong>Settings</strong> on iPhone.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Select <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                    4
                  </span>
                  <span>Point your phone camera at the QR code on the left to pair.</span>
                </li>
              </ol>

              <div className="mt-5 p-3.5 bg-indigo-950/30 border border-indigo-900/50 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-200/80 leading-relaxed">
                  <strong>Persistent Encrypted Session:</strong> Your WhatsApp credentials and encryption keys are stored securely inside PostgreSQL using AES-256-GCM. Session persists automatically across Northflank container restarts.
                </p>
              </div>
            </div>

            {/* Live Connection Logs */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  Connection Event Logs
                </h4>
                <span className="text-[10px] uppercase font-mono text-slate-500">Last 50 events</span>
              </div>
              <div className="bg-slate-950 rounded-xl p-3 h-48 overflow-y-auto font-mono text-xs text-slate-400 space-y-1.5 border border-slate-800/80">
                {statusData?.logs && statusData.logs.length > 0 ? (
                  statusData.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 leading-tight">
                      <span className="text-slate-600 select-none">[{log.time}]</span>
                      <span
                        className={
                          log.level === 'error'
                            ? 'text-rose-400 font-semibold'
                            : log.level === 'warn'
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-600 italic">No events logged yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MESSAGE TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Customizable Message Templates</h2>
              <p className="text-xs text-slate-400">
                Application-level templates for WhatsApp Web. Fully customizable with dynamic order variables.
              </p>
            </div>
            <button
              onClick={handleOpenCreateTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-emerald-900/20"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>

          {loadingTemplates ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
              Loading templates...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-base font-bold text-white">{tmpl.name}</h3>
                        <p className="text-xs text-slate-400">{tmpl.description || 'No description'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {tmpl.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            DEFAULT
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tmpl.isActive
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {tmpl.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap mb-4 max-h-52 overflow-y-auto">
                      {tmpl.body}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {tmpl.variables.map((v, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-indigo-300 border border-slate-700"
                        >
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                    <button
                      onClick={() => handleOpenEditTemplate(tmpl)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit & Preview
                    </button>
                    {!tmpl.isDefault && (
                      <button
                        onClick={() => handleDeleteTemplate(tmpl.id)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEMPLATE CREATE / EDIT MODAL WITH LIVE PREVIEW */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingTemplate ? 'Edit Message Template' : 'Create New Message Template'}
              </h3>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form inputs */}
              <form id="template-form" onSubmit={handleSaveTemplate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Template Name</label>
                  <input
                    type="text"
                    required
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="e.g. Standard COD Confirmation"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Internal)</label>
                  <input
                    type="text"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder="e.g. Sent automatically when customer places COD order"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">Message Body</label>
                    <span className="text-[10px] text-slate-500">Supports Roman Urdu, Urdu & English</span>
                  </div>
                  <textarea
                    required
                    rows={8}
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-400 block">Available Dynamic Variables:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'customer_name',
                      'store_name',
                      'order_number',
                      'order_total',
                      'currency',
                      'payment_method',
                      'shipping_address',
                      'product_list',
                      'tracking_number',
                    ].map((varName) => (
                      <button
                        key={varName}
                        type="button"
                        onClick={() =>
                          setTemplateForm({
                            ...templateForm,
                            body: `${templateForm.body} {{${varName}}}`,
                          })
                        }
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs font-mono border border-slate-700 transition"
                      >
                        + {`{{${varName}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.isDefault}
                      onChange={(e) => setTemplateForm({ ...templateForm, isDefault: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-xs font-medium text-slate-300">Set as Default Template</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.isEnabled}
                      onChange={(e) => setTemplateForm({ ...templateForm, isEnabled: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-xs font-medium text-slate-300">Enabled</span>
                  </label>
                </div>
              </form>

              {/* Live Preview Column */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    Customer WhatsApp Live Preview
                  </h4>

                  {/* Simulated WhatsApp Bubble */}
                  <div className="bg-[#0b141a] p-4 rounded-2xl border border-[#202c33] max-w-sm mx-auto shadow-inner">
                    <div className="bg-[#005c4b] text-[#e9edef] p-3.5 rounded-2xl rounded-tr-none text-xs leading-relaxed whitespace-pre-wrap shadow-md">
                      {renderPreview(templateForm.body)}
                      <div className="text-right text-[10px] text-[#8696a0] mt-1.5">12:45 PM ✓✓</div>
                    </div>
                  </div>
                </div>

                {/* Test Send Section */}
                <div className="pt-4 border-t border-slate-800 mt-4">
                  <span className="text-xs font-semibold text-slate-300 block mb-2">Test Send to WhatsApp:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="+923001234567"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleTestSend}
                      disabled={isTestingTemplate || statusData?.status !== 'CONNECTED'}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      Test
                    </button>
                  </div>
                  {statusData?.status !== 'CONNECTED' && (
                    <span className="text-[10px] text-amber-400 mt-1 block">
                      Connect WhatsApp on tab 1 to enable test sending.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="template-form"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATION & ANTI-BAN SETTINGS */}
      {activeTab === 'automation' && (
        <div className="max-w-4xl space-y-6">
          {settings ? (
            <div className="space-y-6">
              {/* Core Toggles Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-emerald-400" />
                  Confirmation Rules & Automation
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white block">Automatic Confirmation</span>
                      <span className="text-xs text-slate-400">Queue confirmation immediately on new Shopify order</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoConfirmEnabled}
                      onChange={(e) => setSettings({ ...settings, autoConfirmEnabled: e.target.checked })}
                      className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white block">COD Orders Only</span>
                      <span className="text-xs text-slate-400">Skip prepaid orders (Credit Card, JazzCash, etc.)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.codOnly}
                      onChange={(e) => setSettings({ ...settings, codOnly: e.target.checked })}
                      className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Anti-Ban Rate Limit */}
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-semibold text-white block">Anti-Ban Delay Between Messages</span>
                      <span className="text-xs text-slate-400">
                        Configurable cooldown delay between consecutive outbound WhatsApp messages to prevent number blocking
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-400">{settings.minDelaySeconds} seconds</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={settings.minDelaySeconds}
                    onChange={(e) => setSettings({ ...settings, minDelaySeconds: parseInt(e.target.value, 10) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1s (High Throughput)</span>
                    <span>5s (Recommended)</span>
                    <span>30s (Maximum Safety)</span>
                  </div>
                </div>
              </div>

              {/* Keywords Configuration */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  Customer Inbound Reply Keywords
                </h3>

                {/* Confirm Keywords */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Confirmation Keywords (Case-insensitive matching)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {settings.confirmKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              confirmKeywords: settings.confirmKeywords.filter((k) => k !== kw),
                            })
                          }
                          className="hover:text-emerald-200"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 max-w-sm">
                    <input
                      type="text"
                      placeholder="Add keyword (e.g. YES, HAAN)"
                      value={newConfirmKeyword}
                      onChange={(e) => setNewConfirmKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newConfirmKeyword.trim()) {
                          e.preventDefault();
                          setSettings({
                            ...settings,
                            confirmKeywords: [...settings.confirmKeywords, newConfirmKeyword.trim().toLowerCase()],
                          });
                          setNewConfirmKeyword('');
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newConfirmKeyword.trim()) {
                          setSettings({
                            ...settings,
                            confirmKeywords: [...settings.confirmKeywords, newConfirmKeyword.trim().toLowerCase()],
                          });
                          setNewConfirmKeyword('');
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Cancel Keywords */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Cancellation Keywords (Case-insensitive matching)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {settings.cancelKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-semibold"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              cancelKeywords: settings.cancelKeywords.filter((k) => k !== kw),
                            })
                          }
                          className="hover:text-rose-200"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 max-w-sm">
                    <input
                      type="text"
                      placeholder="Add keyword (e.g. NO, NAHI)"
                      value={newCancelKeyword}
                      onChange={(e) => setNewCancelKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCancelKeyword.trim()) {
                          e.preventDefault();
                          setSettings({
                            ...settings,
                            cancelKeywords: [...settings.cancelKeywords, newCancelKeyword.trim().toLowerCase()],
                          });
                          setNewCancelKeyword('');
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCancelKeyword.trim()) {
                          setSettings({
                            ...settings,
                            cancelKeywords: [...settings.cancelKeywords, newCancelKeyword.trim().toLowerCase()],
                          });
                          setNewCancelKeyword('');
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Automated Replies */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-400" />
                  Automated Customer Response Messages
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    On Successful Confirmation Reply
                  </label>
                  <input
                    type="text"
                    value={settings.successReplyText}
                    onChange={(e) => setSettings({ ...settings, successReplyText: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    On Cancellation Reply
                  </label>
                  <input
                    type="text"
                    value={settings.cancelReplyText}
                    onChange={(e) => setSettings({ ...settings, cancelReplyText: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    On Ambiguous / Unmatched Reply
                  </label>
                  <input
                    type="text"
                    value={settings.ambiguousReplyText}
                    onChange={(e) => setSettings({ ...settings, ambiguousReplyText: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-lg shadow-emerald-900/30"
                >
                  <Save className="w-4 h-4" />
                  {savingSettings ? 'Saving Settings...' : 'Save Automation Settings'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">Loading automation settings...</div>
          )}
        </div>
      )}

      {/* TAB 4: MESSAGE HISTORY & INBOUND RESPONSES */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">WhatsApp Delivery & Response History</h2>
              <p className="text-xs text-slate-400">
                Full audit trail of outbound confirmations, delivery timestamps, and customer replies.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search phone or order #"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchMessages()}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
              <button
                onClick={fetchMessages}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Search
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Direction</th>
                    <th className="py-3.5 px-4">Recipient / Sender</th>
                    <th className="py-3.5 px-4">Shopify Order</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Customer Reply</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {loadingMessages ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        Loading message logs...
                      </td>
                    </tr>
                  ) : messages.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        No messages logged yet. Confirmation messages will appear here when orders are placed.
                      </td>
                    </tr>
                  ) : (
                    messages.map((msg) => (
                      <tr key={msg.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4">
                          {msg.direction === 'OUTBOUND' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <ArrowUpRight className="w-3.5 h-3.5" /> Outbound
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-400">
                              <ArrowDownLeft className="w-3.5 h-3.5" /> Inbound
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-white">
                          {msg.recipientPhone}
                        </td>
                        <td className="py-3 px-4">
                          {msg.order ? (
                            <span className="font-semibold text-indigo-400">
                              {msg.order.shopifyOrderNumber}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              msg.status === 'DELIVERED' || msg.status === 'READ'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : msg.status === 'SENT'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : msg.status === 'FAILED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {msg.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {msg.customerResponse ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                                msg.customerResponse === 'CONFIRMED'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {msg.customerResponse}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-sans">Pending Reply</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
