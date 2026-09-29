'use client';

import React, { useState } from 'react';
import { Users, Search, Phone, ShoppingBag, ShieldCheck, Mail } from 'lucide-react';

export default function CustomersPage() {
  const [search, setSearch] = useState('');

  const sampleCustomers = [
    {
      id: 'cust_1',
      name: 'Ali Raza',
      phone: '+92 300 1234567',
      email: 'aliraza.pk@example.com',
      totalOrders: 3,
      totalSpent: 'Rs. 7,499',
      status: 'Verified',
      lastOrder: '29 Sep 2025',
    },
    {
      id: 'cust_2',
      name: 'Usman Khan',
      phone: '+92 321 9876543',
      email: 'usman.k@example.com',
      totalOrders: 1,
      totalSpent: 'Rs. 1,899',
      status: 'Verified',
      lastOrder: '28 Sep 2025',
    },
    {
      id: 'cust_3',
      name: 'Hassan Ahmed',
      phone: '+92 333 4567890',
      email: 'hassan.ahmed@example.com',
      totalOrders: 2,
      totalSpent: 'Rs. 4,398',
      status: 'Verified',
      lastOrder: '27 Sep 2025',
    },
  ];

  const filtered = sampleCustomers.filter(
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
      </div>
    </div>
  );
}
