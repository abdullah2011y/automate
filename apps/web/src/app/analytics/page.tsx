'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  DollarSign,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-400" />
            Performance & Conversion Analytics
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Real-time analytics for automated COD confirmations, delivery health, and return prevention.
          </p>
        </div>
        <div className="flex items-center bg-[#0B101D] p-1 rounded-lg border border-[#1E2638] text-xs font-semibold">
          <button
            onClick={() => setPeriod('7d')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              period === '7d'
                ? 'bg-[#6366F1] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPeriod('30d')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              period === '30d'
                ? 'bg-[#6366F1] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              period === 'all'
                ? 'bg-[#6366F1] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B101D] border border-[#1E2638] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2">Rs. 48,250</p>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +14.2% vs last week
          </p>
        </div>

        <div className="bg-[#0B101D] border border-[#1E2638] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Confirmation Rate
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2">91.4%</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Highest in COD apparel segment
          </p>
        </div>

        <div className="bg-[#0B101D] border border-[#1E2638] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Saved Return Costs
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2">Rs. 18,400</p>
          <p className="text-[11px] text-blue-400 mt-1">
            Prevented fake & cancelled deliveries
          </p>
        </div>

        <div className="bg-[#0B101D] border border-[#1E2638] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              WhatsApp Response Speed
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2">4.2 mins</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Average customer decision latency
          </p>
        </div>
      </div>

      {/* Orders Trend Visual */}
      <div className="bg-[#0B101D] border border-[#1E2638] rounded-xl p-5">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#1E2638]">
          <div>
            <h2 className="text-sm font-bold text-white">Daily Order Volume & Status</h2>
            <p className="text-xs text-slate-400 mt-0.5">PostgreSQL order events timeline</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Confirmed
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Pending
            </span>
          </div>
        </div>

        <div className="h-56 flex items-end gap-3 justify-between pt-6 px-4">
          {[
            { day: '23 Sep', orders: 1, confirmed: 1 },
            { day: '24 Sep', orders: 2, confirmed: 2 },
            { day: '25 Sep', orders: 2, confirmed: 1 },
            { day: '26 Sep', orders: 1, confirmed: 0 },
            { day: '27 Sep', orders: 2, confirmed: 2 },
            { day: '28 Sep', orders: 3, confirmed: 3 },
            { day: '29 Sep', orders: 4, confirmed: 3 },
          ].map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="w-full flex items-end justify-center gap-1.5 h-40">
                <div
                  style={{ height: `${(item.orders / 4) * 100}%` }}
                  className="w-full max-w-[28px] bg-gradient-to-t from-[#6366F1] to-[#8B5CF6] rounded-t-md shadow-lg shadow-purple-900/30 transition-all group-hover:brightness-110"
                />
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {item.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
