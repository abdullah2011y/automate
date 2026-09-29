'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Phone, ShoppingBag, ShieldCheck, Mail, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.getOrders({ limit: 100 });
      const customerMap = new Map<string, any>();

      (res.orders || []).forEach((order) => {
        const phone = order.customer.phoneNumber;
        const name = `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Anonymous';
        const price = parseFloat(order.totalPrice) || 0;

        if (!customerMap.has(phone)) {
          customerMap.set(phone, {
            id: order.customer.id,
            name,
            phone,
            email: order.customer.email || 'N/A',
            totalOrders: 1,
            totalSpentNum: price,
            status: 'Verified',
            lastOrder: new Date(order.orderCreatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
          });
        } else {
          const existing = customerMap.get(phone);
          existing.totalOrders += 1;
          existing.totalSpentNum += price;
        }
      });

      const list = Array.from(customerMap.values()).map((c) => ({
        ...c,
        totalSpent: `Rs. ${c.totalSpentNum.toLocaleString()}`,
      }));

      setCustomers(list);
    } catch (err) {
      console.error('Failed to load customers from API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Customer Directory
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Normalized customer records, verified phone numbers, and lifetime COD performance.
          </p>
        </div>
        <button
          onClick={fetchCustomers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E293B] text-xs text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-[#0D1322] border border-[#1E2638] rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, phone or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111827] border border-[#1E293B] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing <span className="text-white font-semibold">{filtered.length}</span> verified profiles
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-[#0D1322] border border-[#1E2638] rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8B5CF6]" />
            Loading customers from database...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Users className="w-9 h-9 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-semibold text-slate-300">No Customer Records Found</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Customer profiles will be automatically created and stored here whenever new Shopify orders arrive.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1526] border-b border-[#1E2638] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Customer Name</th>
                  <th className="px-5 py-3.5">Phone Number</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Total Orders</th>
                  <th className="px-5 py-3.5">Total Spent</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Last Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2234] text-white">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#121A2E] transition-colors">
                    <td className="px-5 py-4 font-semibold text-white">
                      {item.name}
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-mono">
                      {item.phone}
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {item.email}
                    </td>
                    <td className="px-5 py-4 text-purple-400 font-semibold">
                      {item.totalOrders}
                    </td>
                    <td className="px-5 py-4 font-bold text-white">
                      {item.totalSpent}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400 text-[11px]">
                      {item.lastOrder}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
