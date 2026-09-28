'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  AlertCircle,
  ShieldAlert,
  Send,
  CheckCheck,
  Check,
  MessageSquare,
} from 'lucide-react';
import { api, OrderSummary, DetailedOrder } from '@/lib/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Order Details Modal / Drawer State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DetailedOrder | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusActionNote, setStatusActionNote] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('Customer changed mind');
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (pageToFetch = pagination.page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOrders({
        page: pageToFetch,
        limit: 10,
        search: searchTerm,
        status: statusFilter,
      });
      setOrders(res.orders);
      setPagination(res.pagination);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      setError(err.message || 'Failed to fetch orders from database');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, searchTerm, statusFilter]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const openOrderDetails = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setLoadingDetails(true);
    try {
      const details = await api.getOrderById(orderId);
      setSelectedOrder(details);
    } catch (err: any) {
      alert(`Error fetching order details: ${err.message}`);
      setSelectedOrderId(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStatusChange = async (newStatus: string, reason?: string) => {
    if (!selectedOrderId) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await api.updateOrderStatus(
        selectedOrderId,
        newStatus,
        reason,
        statusActionNote || 'Manual update via SaaS dashboard'
      );
      setSelectedOrder(updated);
      setStatusActionNote('');
      setCancelModalOpen(false);
      setNotification({ type: 'success', message: `Order status updated to ${newStatus}` });
      setTimeout(() => setNotification(null), 4000);
      fetchOrders(pagination.page);
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleResendWhatsApp = async (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setResendingId(orderId);
    try {
      await api.resendWhatsAppConfirmation(orderId);
      setNotification({ type: 'success', message: 'WhatsApp confirmation message enqueued successfully!' });
      setTimeout(() => setNotification(null), 4000);
      if (selectedOrderId === orderId) {
        openOrderDetails(orderId);
      }
      fetchOrders(pagination.page);
    } catch (err: any) {
      alert(`Resend failed: ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

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

  const getWhatsAppDeliveryBadge = (order: OrderSummary) => {
    const msg = order.latestWhatsAppMessage;
    if (!msg) {
      return (
        <span className="text-[11px] text-slate-400 italic">Not queued</span>
      );
    }

    if (msg.status === 'READ') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#04D3F7]">
          <CheckCheck className="w-3.5 h-3.5" /> Read
        </span>
      );
    }

    if (msg.status === 'DELIVERED') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
          <CheckCheck className="w-3.5 h-3.5" /> Delivered
        </span>
      );
    }

    if (msg.status === 'SENT') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <Check className="w-3.5 h-3.5" /> Sent
        </span>
      );
    }

    if (msg.status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600" title={msg.failureReason || 'Failed'}>
          <AlertCircle className="w-3.5 h-3.5" /> Failed
        </span>
      );
    }

    return (
      <span className="text-[11px] text-slate-500 font-semibold">{msg.status}</span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-navy-900 tracking-tight">
            Orders Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Browse, inspect, resend WhatsApp confirmation, and manually adjust order statuses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchOrders(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {notification && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by order ID, customer, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-16 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold bg-navy-900 text-white rounded"
          >
            Find
          </button>
        </form>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand/40 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_CONFIRMATION">Pending Confirmation</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="PROCESSING">Processing</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="DELIVERED">Delivered</option>
              <option value="RETURNED">Returned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
            Fetching orders from PostgreSQL...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-xs text-rose-600">
            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No orders match the current filter criteria.
          </div>
        ) : (
          <>
            {/* MOBILE CARD LIST (Phones & narrow screens < 768px) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {orders.map((order) => {
                const customerName = `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Anonymous';
                const isResendDisabled =
                  order.confirmationStatus === 'CANCELLED' ||
                  order.confirmationStatus === 'DISPATCHED' ||
                  order.confirmationStatus === 'DELIVERED';

                return (
                  <div
                    key={order.id}
                    onClick={() => openOrderDetails(order.id)}
                    className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-navy-900 text-sm">{order.shopifyOrderNumber}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(order.orderCreatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="font-extrabold text-navy-900 text-sm">Rs. {order.totalPrice}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-navy-900">{customerName}</p>
                        <p className="font-mono text-slate-500 text-[11px]">{order.customer.phoneNumber}</p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(order.confirmationStatus)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">WA:</span>
                        {getWhatsAppDeliveryBadge(order)}
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={isResendDisabled || resendingId === order.id}
                          onClick={(e) => handleResendWhatsApp(order.id, e)}
                          title={isResendDisabled ? 'Order already closed' : 'Resend WhatsApp confirmation'}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors disabled:opacity-40"
                        >
                          <Send className={`w-3 h-3 text-emerald-600 ${resendingId === order.id ? 'animate-spin' : ''}`} />
                          Resend
                        </button>

                        <button
                          onClick={() => openOrderDetails(order.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP DATA TABLE (Screens >= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Order #</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Phone Number</th>
                    <th className="px-5 py-3.5">Total Amount</th>
                    <th className="px-5 py-3.5">Confirmation Status</th>
                    <th className="px-5 py-3.5">WhatsApp Delivery</th>
                    <th className="px-5 py-3.5">Customer Response</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-navy-900 font-medium">
                  {orders.map((order) => {
                    const customerName = `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Anonymous';
                    const isResendDisabled =
                      order.confirmationStatus === 'CANCELLED' ||
                      order.confirmationStatus === 'DISPATCHED' ||
                      order.confirmationStatus === 'DELIVERED';

                    return (
                      <tr
                        key={order.id}
                        onClick={() => openOrderDetails(order.id)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-navy-900">{order.shopifyOrderNumber}</span>
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {new Date(order.orderCreatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">{customerName}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-600">{order.customer.phoneNumber}</td>
                        <td className="px-5 py-3.5 font-bold text-navy-900">Rs. {order.totalPrice}</td>
                        <td className="px-5 py-3.5">{getStatusBadge(order.confirmationStatus)}</td>
                        <td className="px-5 py-3.5">{getWhatsAppDeliveryBadge(order)}</td>
                        <td className="px-5 py-3.5">
                          {order.confirmedAt ? (
                            <span className="text-[11px] text-emerald-700 font-semibold block">
                              Confirmed {new Date(order.confirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : order.cancelledAt ? (
                            <span className="text-[11px] text-rose-600 font-semibold block">
                              Cancelled {new Date(order.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Awaiting</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={isResendDisabled || resendingId === order.id}
                              onClick={(e) => handleResendWhatsApp(order.id, e)}
                              title={isResendDisabled ? 'Order already confirmed or closed' : 'Resend WhatsApp confirmation'}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                              <Send className={`w-3 h-3 text-emerald-600 ${resendingId === order.id ? 'animate-spin' : ''}`} />
                              Resend
                            </button>

                            <button
                              onClick={() => openOrderDetails(order.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                            >
                              <Eye className="w-3 h-3" /> Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {!loading && orders.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
            <span>
              {orders.length} of {pagination.total} orders
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fetchOrders(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchOrders(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ORDER DETAILS MODAL / DRAWER (Responsive Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-900/60 backdrop-blur-sm animate-fadeIn safe-area-bottom">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-navy-900 text-brand">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-navy-900">
                    Order {selectedOrder ? selectedOrder.shopifyOrderNumber : 'Details'}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    Shopify ID: {selectedOrder?.shopifyOrderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderId(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-navy-900 hover:bg-slate-100 touch-target flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {loadingDetails || !selectedOrder ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
                  Loading order details...
                </div>
              ) : (
                <>
                  {/* Status Banner */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Current Confirmation State
                      </span>
                      <div className="mt-1">{getStatusBadge(selectedOrder.confirmationStatus)}</div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        disabled={resendingId === selectedOrder.id}
                        onClick={() => handleResendWhatsApp(selectedOrder.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E6FAFE] text-[#028FA8] border border-[#04D3F7]/30 hover:bg-[#D5F7FD] shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Resend WhatsApp
                      </button>

                      {selectedOrder.confirmationStatus !== 'CONFIRMED' && (
                        <button
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusChange('CONFIRMED')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
                        >
                          Confirm Order
                        </button>
                      )}

                      {selectedOrder.confirmationStatus !== 'CANCELLED' && (
                        <button
                          disabled={isUpdatingStatus}
                          onClick={() => setCancelModalOpen(true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors disabled:opacity-50"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5">
                      Customer & Delivery Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                      <div className="flex items-center gap-2.5">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{selectedOrder.customer.firstName} {selectedOrder.customer.lastName}</span>
                      </div>
                      <div className="flex items-center gap-2.5 font-mono text-slate-700">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{selectedOrder.customer.phoneNumber}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span>{selectedOrder.customer.email || 'No email provided'}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>
                          {selectedOrder.shippingAddress?.address1
                            ? `${selectedOrder.shippingAddress.address1}, ${selectedOrder.shippingAddress.city}`
                            : 'Standard Delivery Address'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Message Activity Timeline */}
                  <div>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-[#04D3F7]" />
                      WhatsApp Confirmation History
                    </h4>
                    <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      {!selectedOrder.whatsappMessages || selectedOrder.whatsappMessages.length === 0 ? (
                        <p className="text-slate-400 text-center py-2">No WhatsApp messages dispatched yet.</p>
                      ) : (
                        selectedOrder.whatsappMessages.map((msg: any) => (
                          <div key={msg.id} className="text-[11px] py-2 border-b border-slate-100 last:border-none space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-navy-900 flex items-center gap-1.5">
                                {msg.status === 'READ' ? (
                                  <span className="text-[#04D3F7] flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Read by Customer</span>
                                ) : msg.status === 'DELIVERED' ? (
                                  <span className="text-emerald-600 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Delivered to Phone</span>
                                ) : msg.status === 'SENT' ? (
                                  <span className="text-slate-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Dispatched</span>
                                ) : (
                                  <span className="text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {msg.status}</span>
                                )}
                              </span>
                              <span className="text-slate-400">{new Date(msg.createdAt).toLocaleString()}</span>
                            </div>

                            {msg.customerResponse && (
                              <div className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded inline-block">
                                Customer Action: {msg.customerResponse}
                              </div>
                            )}

                            {msg.failureReason && (
                              <div className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                Error: {msg.failureReason}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Line Items */}
                  <div>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5">
                      Purchased Items ({selectedOrder.items.length})
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50">
                          <div>
                            <p className="font-semibold text-navy-900">{item.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">SKU: {item.sku || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-navy-900">${item.unitPrice}</span>
                            <span className="text-[11px] text-slate-400 block">Qty: {item.quantity}</span>
                          </div>
                        </div>
                      ))}
                      <div className="p-3.5 bg-slate-50/80 flex items-center justify-between font-bold text-navy-900">
                        <span>Total Cash on Delivery Amount</span>
                        <span className="text-sm">${selectedOrder.totalPrice}</span>
                      </div>
                    </div>
                  </div>

                  {/* Audit Logs Trail */}
                  <div>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Audit Trail & Status History
                    </h4>
                    <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      {!selectedOrder.auditLogs || selectedOrder.auditLogs.length === 0 ? (
                        <p className="text-slate-400 text-center py-2">No audit log entries recorded yet.</p>
                      ) : (
                        selectedOrder.auditLogs.map((log) => (
                          <div key={log.id} className="text-[11px] py-1.5 border-b border-slate-100 last:border-none">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-navy-900">{log.action}</span>
                              <span className="text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-500 mt-0.5">
                              By: {log.user?.name || log.details?.updatedByEmail || 'System'}
                              {log.details?.note && ` — "${log.details.note}"`}
                              {log.details?.reason && ` — Reason: "${log.details.reason}"`}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedOrderId(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Prompt Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-navy-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Cancel Order
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Please specify the cancellation reason. This will be stored in the order record and written to the audit log.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Reason</label>
                <select
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                >
                  <option value="Customer changed mind">Customer changed mind</option>
                  <option value="Customer unreachable via phone">Customer unreachable via phone</option>
                  <option value="Ordered duplicate item by mistake">Ordered duplicate item by mistake</option>
                  <option value="Delivery address invalid">Delivery address invalid</option>
                  <option value="Suspicious / Fake order">Suspicious / Fake order</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Staff Note (Optional)</label>
                <input
                  type="text"
                  placeholder="Additional context..."
                  value={statusActionNote}
                  onChange={(e) => setStatusActionNote(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Dismiss
              </button>
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleStatusChange('CANCELLED', cancellationReason)}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                {isUpdatingStatus ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
