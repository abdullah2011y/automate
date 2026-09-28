'use client';

import React from 'react';
import { Users, Phone, DollarSign, ShoppingBag } from 'lucide-react';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-extrabold text-navy-900 tracking-tight">
          Customer Directory
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Normalized customer records, verified phone numbers, order histories, and lifetime value.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-brand/10 text-[#028FA8] mx-auto flex items-center justify-center mb-3">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-navy-900">Customer Profiles Schema Ready</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5">
          E.164 phone normalization, tenant isolation, and direct relationship to WhatsApp messaging history are mapped in Prisma.
        </p>
      </div>
    </div>
  );
}
