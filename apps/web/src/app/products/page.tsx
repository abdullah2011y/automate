'use client';

import React, { useState } from 'react';
import { Package, Search, Plus, Filter, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function ProductsPage() {
  const [search, setSearch] = useState('');

  // Sample catalog data matching ByteForge dark theme
  const products = [
    {
      id: 'prod_1',
      title: 'Premium Wireless Noise-Cancelling Headphones',
      sku: 'BF-HEAD-01',
      price: 'Rs. 7,499',
      stock: 42,
      status: 'Active',
      category: 'Electronics',
    },
    {
      id: 'prod_2',
      title: 'Leather Minimalist Slim Cardholder Wallet',
      sku: 'BF-WALL-02',
      price: 'Rs. 2,199',
      stock: 120,
      status: 'Active',
      category: 'Accessories',
    },
    {
      id: 'prod_3',
      title: 'Smart Fitness Tracker & Heart Rate Watch',
      sku: 'BF-WAT-03',
      price: 'Rs. 5,299',
      stock: 18,
      status: 'Low Stock',
      category: 'Wearables',
    },
    {
      id: 'prod_4',
      title: 'Ergonomic Memory Foam Lumbar Cushion',
      sku: 'BF-CUSH-04',
      price: 'Rs. 3,850',
      stock: 0,
      status: 'Out of Stock',
      category: 'Office',
    },
  ];

  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-purple-400" />
            Products & Inventory
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Manage your synchronized Shopify product catalog and stock levels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/shopify"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#111827] border border-[#1E293B] text-slate-300 text-xs font-medium hover:bg-[#1E293B] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            Sync Catalog
          </Link>
          <a
            href="https://tnxqmz-gb.myshopify.com/admin/products"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#4F46E5] shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add in Shopify
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
          </a>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-[#0B101D] border border-[#1E2638] rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111827] border border-[#1E293B] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E293B] text-xs text-slate-300 hover:text-white transition-colors">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Filter
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#0B101D] border border-[#1E2638] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0E1526] border-b border-[#1E2638] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Product Title</th>
                <th className="px-5 py-3.5">SKU</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Stock</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2234] text-white">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#121A2E] transition-colors">
                  <td className="px-5 py-4 font-semibold text-white">
                    {item.title}
                  </td>
                  <td className="px-5 py-4 text-purple-400 font-mono">
                    {item.sku}
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    {item.category}
                  </td>
                  <td className="px-5 py-4 font-bold text-white">
                    {item.price}
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    {item.stock} in stock
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        item.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : item.status === 'Low Stock'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
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
