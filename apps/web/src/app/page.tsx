'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Percent,
  ArrowUpRight,
  RefreshCw,
  Send,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { api, OverviewAnalytics } from '@/lib/api';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  badgeColor?: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, badgeColor }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${badgeColor || 'bg-slate-100 text-slate-600'}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3">
        <span className="text-2xl font-extrabold text-navy-900 tracking-tight">{value}</span>
        {subtitle && (
          <p className="text-[11px] font-medium text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  const fetchAnalytics = async (range = dateRange, showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    setError(null);
    try {
      const res = await api.getOverviewAnalytics({ range });
      setData(res);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.message || 'Unable to load real-time analytics from PostgreSQL database.');
    } finally {
      setLoading(false);
      if (showRefreshIndicator) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  };

  useEffect(() => {
    fetchAnalytics(dateRange);
  }, [dateRange]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Confirmed
          </span>
        );
      case 'PENDING_CONFIRMATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3 h-3" /> Processing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const maxTrendOrder = Math.max(
    ...(data?.trends?.map((t) => Math.max(t.totalOrders, t.confirmedOrders, t.messagesSent)) || [1]),
    1
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions / Date Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-navy-900 tracking-tight">
            Order Confirmation Analytics
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time PostgreSQL metrics for Cash on Delivery orders, delivery rates, and customer decisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80 text-xs font-semibold">
            <button
              onClick={() => setDateRange('today')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateRange === 'today'
                  ? 'bg-white text-navy-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRange('7d')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateRange === '7d'
                  ? 'bg-white text-navy-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDateRange('30d')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateRange === '30d'
                  ? 'bg-white text-navy-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDateRange('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateRange === 'all'
                  ? 'bg-white text-navy-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={() => fetchAnalytics(dateRange, true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50"
            title="Refresh database queries"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-navy-900 hover:bg-navy-800 text-white shadow-sm transition-all"
          >
            Orders
            <ArrowUpRight className="w-3.5 h-3.5 text-brand" />
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-700">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchAnalytics(dateRange, true)}
            className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Velocity Stats (Today, This Week, This Month) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white border border-slate-200 text-navy-900 shadow-2xs">
            <Clock className="w-4 h-4 text-brand" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today&apos;s Orders</p>
            <p className="text-lg md:text-xl font-extrabold text-navy-900">
              {loading ? '...' : (data?.summary.ordersToday ?? 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
          <div className="p-2 rounded-lg bg-white border border-slate-200 text-navy-900 shadow-2xs">
            <TrendingUp className="w-4 h-4 text-[#028FA8]" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Week</p>
            <p className="text-lg md:text-xl font-extrabold text-navy-900">
              {loading ? '...' : (data?.summary.ordersThisWeek ?? 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
          <div className="p-2 rounded-lg bg-white border border-slate-200 text-navy-900 shadow-2xs">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">This Month</p>
            <p className="text-lg md:text-xl font-extrabold text-navy-900">
              {loading ? '...' : (data?.summary.ordersThisMonth ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 md:gap-4">
        <MetricCard
          title="Orders in Range"
          value={loading ? '...' : (data?.summary.totalOrdersInRange ?? data?.summary.totalOrders ?? 0)}
          subtitle={`Lifetime: ${data?.summary.totalShopifyOrdersLifetime ?? 0}`}
          icon={ShoppingBag}
          badgeColor="bg-slate-100 text-slate-800"
        />
        <MetricCard
          title="Pending Confirmation"
          value={loading ? '...' : (data?.summary.pendingConfirmation ?? 0)}
          subtitle="Awaiting response"
          icon={Clock}
          badgeColor="bg-amber-50 text-amber-600"
        />
        <MetricCard
          title="Confirmed"
          value={loading ? '...' : (data?.summary.confirmed ?? 0)}
          subtitle={loading ? '' : `Revenue: Rs. ${data?.summary.confirmedTotalValue || '0'}`}
          icon={CheckCircle2}
          badgeColor="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          title="Cancelled"
          value={loading ? '...' : (data?.summary.cancelled ?? 0)}
          subtitle={loading ? '' : `RTO Saved: Rs. ${data?.summary.savedFromReturnsValue || '0'}`}
          icon={XCircle}
          badgeColor="bg-rose-50 text-rose-600"
        />
        <MetricCard
          title="Confirmation Rate"
          value={loading ? '...' : (data?.summary.confirmationRate ?? '0.0%')}
          subtitle="Confirmed / Decided"
          icon={Percent}
          badgeColor="bg-[#E6FAFE] text-[#028FA8]"
        />
      </div>

      {/* Speed & Delivery Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Average Confirmation Time */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Avg Confirmation Speed
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-navy-900 tracking-tight">
              {loading ? '...' : (data?.summary.avgConfirmationTime || 'N/A')}
            </span>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              From Shopify order placement to customer confirmation reply
            </p>
          </div>
        </div>

        {/* WhatsApp Protocol Delivery Health */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              WhatsApp Delivery Rate
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-navy-900 tracking-tight">
              {loading ? '...' : (data?.summary.messageDeliveryRate || '0.0%')}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2 font-mono">
              <span title="Read receipts">Read: {data?.summary.readMessages ?? 0}</span>
              <span>•</span>
              <span title="Delivered receipts">Delivered: {data?.summary.deliveredMessages ?? 0}</span>
              <span>•</span>
              <span title="Sent attempts">Sent: {data?.summary.sentMessages ?? 0}</span>
              {Boolean(data?.summary.failedMessages) && (
                <>
                  <span>•</span>
                  <span className="text-rose-600 font-bold" title="Failed messages">
                    Failed: {data?.summary.failedMessages}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Single Tenant Security & Protection */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Infrastructure Security
            </span>
            <div className="p-2 rounded-lg bg-[#E6FAFE] text-[#028FA8]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-base font-bold text-navy-900">
              Hardened & Monitored
            </span>
            <p className="text-[11px] font-medium text-slate-500 mt-1">
              Encrypted session state, sliding window rate limits, and automated safe archival.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Daily Trends & Cancellation Reasons Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Daily Order & Confirmation Trends</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time daily activity from PostgreSQL</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" /> Total Orders
              </span>
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Confirmed
              </span>
              <span className="flex items-center gap-1 text-[#028FA8]">
                <span className="w-2.5 h-2.5 rounded-xs bg-brand inline-block" /> WhatsApp Sent
              </span>
            </div>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-brand mr-2" /> Loading trends...
            </div>
          ) : !data?.trends || data.trends.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No trend data available for this range.
            </div>
          ) : (
            <div className="pt-5 overflow-x-auto">
              <div className="flex items-end gap-2 min-w-[500px] h-44 pb-6">
                {data.trends.map((t, idx) => {
                  const totalHeight = Math.max(12, Math.round((t.totalOrders / maxTrendOrder) * 100));
                  const confirmedHeight = Math.max(0, Math.round((t.confirmedOrders / maxTrendOrder) * 100));
                  const messagesHeight = Math.max(0, Math.round((t.messagesSent / maxTrendOrder) * 100));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-navy-900 text-white text-[10px] p-2 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                        <p className="font-bold text-slate-200">{t.label}</p>
                        <p>Orders: {t.totalOrders}</p>
                        <p className="text-emerald-400">Confirmed: {t.confirmedOrders}</p>
                        <p className="text-rose-300">Cancelled: {t.cancelledOrders}</p>
                        <p className="text-cyan-300">Sent: {t.messagesSent}</p>
                      </div>

                      {/* Bar Group */}
                      <div className="w-full flex items-end justify-center gap-0.5 h-36">
                        <div
                          style={{ height: `${totalHeight}%` }}
                          className="w-1.5 md:w-2 bg-slate-300 hover:bg-slate-400 rounded-t-xs transition-all"
                        />
                        <div
                          style={{ height: `${confirmedHeight}%` }}
                          className="w-1.5 md:w-2 bg-emerald-500 hover:bg-emerald-600 rounded-t-xs transition-all"
                        />
                        <div
                          style={{ height: `${messagesHeight}%` }}
                          className="w-1.5 md:w-2 bg-brand hover:bg-[#028FA8] rounded-t-xs transition-all"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                        {t.label.split(' ')[1] || t.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cancellation Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-navy-900">Cancellation Reasons</h3>
            <p className="text-xs text-slate-400 mt-0.5">Top reasons provided by customers</p>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-xs text-slate-400">Loading reasons...</p>
            ) : !data?.cancellationReasons || data.cancellationReasons.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Zero cancellations recorded in this time range.
              </p>
            ) : (
              data.cancellationReasons.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-600 font-medium truncate max-w-[180px]" title={item.reason}>
                    {item.reason}
                  </span>
                  <span className="px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {item.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Live Table from PostgreSQL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-navy-900">Recent COD Orders</h3>
            <p className="text-xs text-slate-400 mt-0.5">Live records queried from PostgreSQL</p>
          </div>
          <Link
            href="/orders"
            className="text-xs font-semibold text-[#028FA8] hover:underline flex items-center gap-1"
          >
            View all orders <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand" />
            Loading real orders from database...
          </div>
        ) : !data?.recentOrders || data.recentOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No orders found for this store.
          </div>
        ) : (
          <>
            {/* Mobile Card List View (block md:hidden) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {data.recentOrders.map((order) => (
                <div key={order.id} className="p-4 space-y-2.5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-navy-900 text-sm">
                      {order.shopifyOrderNumber}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{order.customerName}</span>
                    <span className="font-bold text-navy-900">{order.totalPrice}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono">{order.customerPhone}</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                      {order.whatsappStatus}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    {formatTimeAgo(order.time)}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Order</th>
                    <th className="px-6 py-3.5">Customer</th>
                    <th className="px-6 py-3.5">Phone Number</th>
                    <th className="px-6 py-3.5">Total Amount</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">WhatsApp State</th>
                    <th className="px-6 py-3.5 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-navy-900 font-medium">
                  {data.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="font-bold text-navy-900">{order.shopifyOrderNumber}</span>
                      </td>
                      <td className="px-6 py-3.5">{order.customerName}</td>
                      <td className="px-6 py-3.5 font-mono text-slate-600">{order.customerPhone}</td>
                      <td className="px-6 py-3.5 font-bold text-navy-900">{order.totalPrice}</td>
                      <td className="px-6 py-3.5">{getStatusBadge(order.status)}</td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                          {order.whatsappStatus}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-400">
                        {formatTimeAgo(order.time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
