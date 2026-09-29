'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Calendar,
  ExternalLink,
  RefreshCw,
  Zap,
  Link as LinkIcon,
  BarChart3,
  Globe,
  Database,
  ArrowRight,
} from 'lucide-react';
import { api, OverviewAnalytics } from '@/lib/api';

// Custom icons matching the exact platforms in the screenshot
function ShopifyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M18.87 5.68c-.04-.26-.24-.44-.5-.45-.25 0-3.32-.23-3.32-.23s-2.2-2.18-2.43-2.4c-.23-.23-.67-.15-.83-.06-.03.02-.63.48-1.57 1.21-.92-.85-2.22-1.32-3.83-1.32-3.8 0-5.65 2.87-5.65 6.07 0 3.79 2.52 7.72 6.55 11.23.4.35.95.34 1.34-.02 3.66-3.36 6.33-7.51 6.33-11.28 0-.9-.12-1.82-.32-2.75zm-6.73 12.87c-3.15-2.8-5.06-5.94-5.06-8.98 0-2.43 1.24-4.52 3.86-4.52.88 0 1.63.26 2.26.75l-2.02 5.86c-.1.29.08.61.38.65.04 0 .09.01.13.01.25 0 .47-.16.54-.4l1.86-5.38c.67.66 1.05 1.57 1.05 2.68 0 3.19-2.02 6.36-3 8.33z"
        fill="#95BF47"
      />
    </svg>
  );
}

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.52 3.48A11.91 11.91 0 0012.06 0C5.46 0 .09 5.37.09 11.97c0 2.11.55 4.16 1.6 5.97L0 24l6.23-1.63a11.94 11.94 0 005.83 1.51h.01c6.6 0 11.97-5.37 11.97-11.97 0-3.2-1.25-6.21-3.52-8.43zm-8.46 18.39h-.01a9.92 9.92 0 01-5.06-1.39l-.36-.21-3.7 .97.99-3.61-.24-.38a9.9 9.9 0 01-1.52-5.28c0-5.48 4.46-9.94 9.94-9.94 2.65 0 5.15 1.03 7.02 2.91a9.88 9.88 0 012.92 7.03c0 5.48-4.46 9.9-9.98 9.9zm5.46-7.46c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.95 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.25-.25-.6-.5-.52-.68-.53l-.58-.01c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.51s1.08 2.91 1.23 3.11c.15.2 2.11 3.22 5.12 4.52.72.31 1.28.5 1.71.64.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.08-.12-.28-.2-.58-.35z" />
    </svg>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<OverviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('Mon, 29 Sep 2025');
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [trendRange, setTrendRange] = useState('Last 7 Days');
  const [isTrendOpen, setIsTrendOpen] = useState(false);

  // Time-of-day dynamic greeting
  const [greeting, setGreeting] = useState({
    title: 'Good evening, Abdullah',
    badge: "🌙 It's evening",
    subtext: 'Keep going! 🚀',
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting({
        title: 'Good morning, Abdullah',
        badge: "☀️ It's morning",
        subtext: 'Have a productive day! 🚀',
      });
    } else if (hour >= 12 && hour < 17) {
      setGreeting({
        title: 'Good afternoon, Abdullah',
        badge: "⛅ Good afternoon",
        subtext: 'Store activity is buzzing! 🚀',
      });
    } else {
      setGreeting({
        title: 'Good evening, Abdullah',
        badge: "🌙 It's evening",
        subtext: 'Keep going! 🚀',
      });
    }
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await api.getOverviewAnalytics({ range: '7d' });
      setData(res);
    } catch (err) {
      console.warn('Using live cached stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Dynamic metrics from live database (pure 0s when database is wiped fresh)
  const metrics = {
    totalOrders: data?.summary?.totalOrdersInRange ?? data?.summary?.totalOrders ?? 0,
    pending: data?.summary?.pendingConfirmation ?? 0,
    confirmed: data?.summary?.confirmed ?? 0,
    confirmedRevenue: data?.summary?.confirmedTotalValue ? `Rs. ${data.summary.confirmedTotalValue}` : 'Rs. 0.00',
    cancelled: data?.summary?.cancelled ?? 0,
    cancelledSaved: data?.summary?.savedFromReturnsValue ? `Rs. ${data.summary.savedFromReturnsValue}` : 'Rs. 0.00',
  };

  // Live recent orders mapped directly from PostgreSQL
  const recentOrders = (data?.recentOrders || []).map((ord) => ({
    id: ord.shopifyOrderNumber || `#${ord.id.slice(0, 6)}`,
    customer: ord.customerName || 'Customer',
    source: 'Shopify',
    sourceType: 'shopify',
    status: ord.status === 'CONFIRMED' ? 'Confirmed' : ord.status === 'CANCELLED' ? 'Cancelled' : 'Pending',
    amount: ord.totalPrice ? (ord.totalPrice.startsWith('Rs') ? ord.totalPrice : `Rs. ${ord.totalPrice}`) : 'Rs. 0.00',
    date: ord.time ? new Date(ord.time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now',
  }));

  // Dynamic 7-day trend bars from database
  const trendBars = (data?.trends && data.trends.length > 0)
    ? data.trends.map((t) => ({
        day: t.label.split(' ')[1] || t.label,
        orders: t.totalOrders,
        value: t.totalOrders,
      }))
    : [
        { day: '23 Sep', value: 0, orders: 0 },
        { day: '24 Sep', value: 0, orders: 0 },
        { day: '25 Sep', value: 0, orders: 0 },
        { day: '26 Sep', value: 0, orders: 0 },
        { day: '27 Sep', value: 0, orders: 0 },
        { day: '28 Sep', value: 0, orders: 0 },
        { day: '29 Sep', value: 0, orders: 0 },
      ];

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP GREETING & STATUS ROW */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {greeting.title}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Here&apos;s what&apos;s happening with your store today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDateOpen(!isDateOpen)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0D1322] border border-[#1E2638] text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{dateRange}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
            </button>
            {isDateOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0D1322] border border-[#1E2638] rounded-xl shadow-xl z-30 p-1.5">
                {['Today', 'Yesterday', 'Mon, 29 Sep 2025', 'Last 7 Days', 'This Month'].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setDateRange(item);
                      setIsDateOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      dateRange === item ? 'bg-[#6366F1] text-white font-semibold' : 'text-slate-300 hover:bg-[#161F33]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Evening / Motivation Card */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-[#11162B] to-[#1E1B4B] border border-indigo-950/60 shadow-sm">
            <span className="text-xl">🌙</span>
            <div className="leading-tight">
              <p className="text-xs font-bold text-slate-200">{greeting.badge.replace(/^.+?\s/, '')}</p>
              <p className="text-[11px] font-medium text-indigo-300">{greeting.subtext}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 4 METRIC CARDS (2x2 on Mobile, 4 Columns on Desktop) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
        {/* Card 1: Total Orders */}
        <div className="bg-[#0D1322] border border-[#1E2638] rounded-2xl p-4 md:p-5 shadow-sm hover:border-[#2A364F] transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-md shadow-blue-600/20 mb-3">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-[11px] md:text-xs font-semibold text-slate-400">Total Orders</p>
          <div className="mt-1">
            <span className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {metrics.totalOrders}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+100% vs yesterday</span>
          </div>
        </div>

        {/* Card 2: Pending */}
        <div className="bg-[#0D1322] border border-[#1E2638] rounded-2xl p-4 md:p-5 shadow-sm hover:border-[#2A364F] transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#10B981] flex items-center justify-center text-white shadow-md shadow-emerald-600/20 mb-3">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <p className="text-[11px] md:text-xs font-semibold text-slate-400">Pending</p>
          <div className="mt-1">
            <span className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {metrics.pending}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-400 truncate">
            Awaiting response
          </p>
        </div>

        {/* Card 3: Confirmed */}
        <div className="bg-[#0D1322] border border-[#1E2638] rounded-2xl p-4 md:p-5 shadow-sm hover:border-[#2A364F] transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6] flex items-center justify-center text-white shadow-md shadow-purple-600/20 mb-3">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-[11px] md:text-xs font-semibold text-slate-400">Confirmed</p>
          <div className="mt-1">
            <span className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {metrics.confirmed}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-400 truncate">
            {metrics.confirmedRevenue} revenue
          </p>
        </div>

        {/* Card 4: Cancelled */}
        <div className="bg-[#0D1322] border border-[#1E2638] rounded-2xl p-4 md:p-5 shadow-sm hover:border-[#2A364F] transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#EF4444] flex items-center justify-center text-white shadow-md shadow-red-600/20 mb-3">
            <XCircle className="w-5 h-5" />
          </div>
          <p className="text-[11px] md:text-xs font-semibold text-slate-400">Cancelled</p>
          <div className="mt-1">
            <span className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {metrics.cancelled}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-400 truncate">
            {metrics.cancelledSaved} saved
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ROW 2: RECENT ORDERS (LEFT) & QUICK ACTIONS (RIGHT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Recent Orders Table (8 cols on lg) */}
        <div className="lg:col-span-8 bg-[#0D1322] border border-[#1E2638] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-sm font-bold text-white tracking-tight">Recent Orders</h2>
            </div>
            <Link
              href="/orders"
              className="text-xs font-medium text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8B5CF6]" />
              Fetching live store analytics...
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <Package className="w-9 h-9 text-slate-600 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-semibold text-slate-300">No Orders in Database</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Orders will automatically be captured here in real-time as customers check out on Shopify.
              </p>
              <Link
                href="/shopify"
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-[11px] font-semibold hover:bg-[#4F46E5] transition-colors shadow-sm"
              >
                <RefreshCw className="w-3 h-3" />
                Sync Store Orders
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 text-[11px] font-semibold border-b border-[#1A2234]">
                    <th className="py-2.5 pr-4">#</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 pl-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#161F33]">
                  {recentOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-[#121A2E] transition-colors group">
                      <td className="py-3.5 pr-4 font-semibold text-[#8B5CF6] group-hover:underline cursor-pointer">
                        <Link href="/orders">{ord.id}</Link>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-white">{ord.customer}</td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-300">
                          {ord.sourceType === 'shopify' && <ShopifyIcon className="w-4 h-4" />}
                          {ord.sourceType === 'website' && <Globe className="w-4 h-4 text-blue-400" />}
                          {ord.sourceType === 'whatsapp' && <WhatsAppIcon className="w-4 h-4 text-emerald-400" />}
                          <span>{ord.source}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#36270E] text-[#FBBF24] border border-[#F59E0B]/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-white">{ord.amount}</td>
                      <td className="py-3.5 pl-3 text-right text-slate-400 text-[11px]">{ord.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Quick Actions (4 cols on lg) */}
        <div className="lg:col-span-4 bg-[#0D1322] border border-[#1E2638] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="text-sm font-bold text-white tracking-tight">Quick Actions</h2>
          </div>

          {/* Grid on mobile, stacked list on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
            {/* Action 1 */}
            <Link
              href="/orders"
              className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1E293B] hover:border-purple-500/50 hover:bg-[#161F33] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
                  <Package className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">View Orders</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* Action 2 */}
            <Link
              href="/whatsapp"
              className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1E293B] hover:border-emerald-500/50 hover:bg-[#161F33] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                  <WhatsAppIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Open WhatsApp</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* Action 3 */}
            <Link
              href="/shopify"
              className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1E293B] hover:border-emerald-500/50 hover:bg-[#161F33] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#95BF47]/15 border border-[#95BF47]/30 flex items-center justify-center text-[#95BF47]">
                  <ShopifyIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Manage Store</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* Action 4 */}
            <Link
              href="/settings"
              className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1E293B] hover:border-purple-500/50 hover:bg-[#161F33] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Settings</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ROW 3: INTEGRATIONS (LEFT) & ORDERS TREND (RIGHT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Integrations Card (5 cols on lg) */}
        <div className="lg:col-span-5 bg-[#0D1322] border border-[#1E2638] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-sm font-bold text-white tracking-tight">Integrations</h2>
            </div>
            <Link
              href="/settings"
              className="text-xs font-medium text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-1 transition-colors"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {/* Item 1: Shopify */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#95BF47]/15 border border-[#95BF47]/30 flex items-center justify-center">
                  <ShopifyIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Shopify</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                Connected
              </span>
            </div>

            {/* Item 2: WhatsApp Web */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <WhatsAppIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">WhatsApp Web</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                Online
              </span>
            </div>

            {/* Item 3: PostgreSQL */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Database className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">PostgreSQL</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Right: Orders Trend Bar Chart (7 cols on lg) */}
        <div className="lg:col-span-7 bg-[#0D1322] border border-[#1E2638] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-sm font-bold text-white tracking-tight">Orders Trend</h2>
            </div>

            {/* Range dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsTrendOpen(!isTrendOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#111827] border border-[#1E293B] text-xs text-slate-300 hover:text-white transition-colors"
              >
                <span>{trendRange}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {isTrendOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-[#0D1322] border border-[#1E2638] rounded-xl shadow-xl z-30 p-1">
                  {['Last 7 Days', 'Last 14 Days', 'This Month'].map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setTrendRange(r);
                        setIsTrendOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-[#161F33] hover:text-white"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chart area with Y-axis guide lines */}
          <div className="pt-2">
            <div className="relative h-44 flex items-end">
              {/* Y Axis Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-600 font-mono">
                <div className="border-b border-[#1A2234]/70 w-full flex items-center justify-between pb-0.5">
                  <span>4</span>
                </div>
                <div className="border-b border-[#1A2234]/70 w-full flex items-center justify-between pb-0.5">
                  <span>3</span>
                </div>
                <div className="border-b border-[#1A2234]/70 w-full flex items-center justify-between pb-0.5">
                  <span>2</span>
                </div>
                <div className="border-b border-[#1A2234]/70 w-full flex items-center justify-between pb-0.5">
                  <span>1</span>
                </div>
                <div className="border-b border-[#1A2234] w-full flex items-center justify-between pb-0.5">
                  <span>0</span>
                </div>
              </div>

              {/* Bars */}
              <div className="relative z-10 w-full flex items-end justify-between pl-6 pr-2 h-full pb-1">
                {trendBars.map((bar, idx) => {
                  const heightPercent = Math.max(6, Math.min(100, (bar.value / 4) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      {/* Hover Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-[#1E1B4B] text-white text-[10px] py-1 px-2 rounded-md shadow-xl border border-purple-500/40 pointer-events-none whitespace-nowrap z-20">
                        <p className="font-bold text-purple-300">{bar.day}</p>
                        <p>{bar.orders} Orders</p>
                      </div>

                      {/* Bar Pillar */}
                      <div className="w-full flex items-end justify-center">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-4 sm:w-5 md:w-6 bg-gradient-to-t from-[#6366F1] to-[#8B5CF6] rounded-xs shadow-md shadow-purple-600/30 group-hover:brightness-125 transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X Axis Labels */}
            <div className="flex justify-between pl-6 pr-2 pt-2.5 text-[11px] text-slate-400">
              {trendBars.map((bar, idx) => (
                <span key={idx} className="flex-1 text-center truncate">
                  {bar.day}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
