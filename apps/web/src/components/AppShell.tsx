'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Package,
  ShoppingBag,
  Users,
  MessageSquare,
  BarChart3,
  Tag,
  Settings,
  Menu,
  X,
  Search,
  Database,
  Bell,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  Download,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  api,
  TenantProfile,
  UserProfile,
  getApiBaseUrl,
  BaileysConnectionStatus,
  ShopifyIntegrationStatus,
} from '@/lib/api';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Orders', href: '/orders', icon: Package },
  { label: 'WhatsApp', href: '/whatsapp', icon: MessageSquare, badge: '1' },
  { label: 'Shopify', href: '/shopify', icon: ShoppingBag },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Products', href: '/products', icon: Tag },
  { label: 'Settings', href: '/settings', icon: Settings },
];

// Primary bottom tabs on iPhone (5 items matching screenshot)
const mobileBottomTabs: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Orders', href: '/orders', icon: Package },
  { label: 'Products', href: '/products', icon: Tag },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiHealth, setApiHealth] = useState<'checking' | 'healthy' | 'offline'>('healthy');
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [waStatus, setWaStatus] = useState<BaileysConnectionStatus | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyIntegrationStatus | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Online / Offline connectivity listener
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA install prompt capture
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      try {
        if (localStorage.getItem('byteforge_hide_install_prompt') !== 'true') {
          setShowInstallPrompt(true);
        }
      } catch (err) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
      try {
        localStorage.setItem('byteforge_hide_install_prompt', 'true');
      } catch (err) {}
    }
    setDeferredPrompt(null);
  };

  const handleDismissInstall = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowInstallPrompt(false);
    try {
      localStorage.setItem('byteforge_hide_install_prompt', 'true');
    } catch (err) {}
  };

  // Live health, WhatsApp, and Store Profile fetch
  useEffect(() => {
    let isMounted = true;

    const checkSystem = async () => {
      try {
        const apiUrl = getApiBaseUrl();
        const res = await fetch(`${apiUrl}/api/v1/health`, { cache: 'no-store' });
        if (res.ok) {
          if (isMounted) setApiHealth('healthy');
          try {
            const [meRes, waRes, shopifyRes] = await Promise.allSettled([
              api.getMe(),
              api.getWhatsAppStatus(),
              api.getShopifyStatus(),
            ]);
            if (isMounted) {
              if (meRes.status === 'fulfilled') {
                setTenant(meRes.value.tenant);
                setCurrentUser(meRes.value.user);
              }
              if (waRes.status === 'fulfilled' && waRes.value?.data) {
                setWaStatus(waRes.value.data);
              }
              if (shopifyRes.status === 'fulfilled') {
                setShopifyStatus(shopifyRes.value);
              }
            }
          } catch (e) {
            // Handshake in progress
          }
        } else {
          if (isMounted) setApiHealth('offline');
        }
      } catch (err) {
        if (isMounted) setApiHealth('offline');
      }
    };

    checkSystem();
    const interval = setInterval(checkSystem, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const userInitial = currentUser?.name
    ? currentUser.name.charAt(0).toUpperCase()
    : 'A';
  const userName = currentUser?.name || 'Abdullah Admin';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#090D16] text-white font-sans safe-area-left safe-area-right">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md safe-area-top">
          <WifiOff className="w-4 h-4 text-slate-950 flex-shrink-0 animate-pulse" />
          <span>
            Offline Mode: Backend connection unavailable. Real-time order sync and WhatsApp dispatches are paused.
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR                                                           */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#151D2D] bg-[#0B0F19] sticky top-0 h-screen select-none z-30">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#151D2D]">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="ByteForge Logo"
              className="w-8 h-8 rounded-lg object-contain shadow-md"
            />
            <div>
              <span className="font-extrabold text-white tracking-tight text-base block leading-none">
                BYTEFORGE
              </span>
              <span className="text-[9px] tracking-widest uppercase font-semibold text-slate-400 block mt-1">
                OMNI-COMMERCE
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#2B1B54] text-[#A78BFA] border border-[#4C2889]">
            PROD
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-[#2E2164] text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-[#131929]'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-white' : 'text-slate-400'
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[11px] font-bold w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Install PWA Prompt (if available) */}
        {showInstallPrompt && (
          <div className="mx-3 mb-2 p-3 rounded-xl bg-[#141B2D] border border-purple-500/30 relative">
            <div className="flex items-center justify-between text-xs font-bold text-purple-300">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-purple-400" />
                <span>Install Desktop App</span>
              </div>
              <button
                type="button"
                onClick={handleDismissInstall}
                className="p-1 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-white transition"
                title="Dismiss"
                aria-label="Dismiss install prompt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Add ByteForge to your system for one-click access.
            </p>
            <button
              onClick={handleInstallClick}
              className="mt-2 w-full py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-xs"
            >
              Install Now
            </button>
          </div>
        )}

        {/* Bottom Section: Connected Store & User Profile */}
        <div className="p-3 space-y-2 border-t border-[#151D2D]">
          {/* Store Switcher Card */}
          <Link
            href="/shopify"
            className="p-2.5 rounded-xl bg-[#101524] hover:bg-[#141B2D] border border-[#1D263B] flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-lg bg-[#0E3A2B] text-emerald-400 border border-[#165A42] flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {shopifyStatus?.connected && shopifyStatus.integration
                    ? shopifyStatus.integration.shopDomain
                    : 'tnxqmz-gb.myshopify.com'}
                </p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
          </Link>

          {/* User Profile Card */}
          <Link
            href="/settings"
            className="p-2.5 rounded-xl bg-[#101524] hover:bg-[#141B2D] border border-[#1D263B] flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-[#5B21B6] text-white font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-sm">
                {userInitial}
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {userName}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Owner</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
          </Link>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE HEADER & DRAWER (iPhone / Capacitor Viewports)                     */}
      {/* ========================================================================= */}
      <header className="md:hidden sticky top-0 z-40 bg-[#090D16]/95 backdrop-blur-md border-b border-[#151D2D] safe-area-top shadow-sm">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="ByteForge Logo"
              className="w-7 h-7 rounded-lg object-contain shadow-sm"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-white tracking-tight text-sm leading-none">
                BYTEFORGE
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block mt-0.5">
                OMNI-COMMERCE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              className="relative p-2 rounded-xl bg-[#101524] border border-[#1D263B] text-slate-300 hover:text-white"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#5B21B6] text-white font-bold flex items-center justify-center text-xs">
              {userInitial}
            </div>
          </div>
        </div>

        {/* Mobile Slide-over Drawer with Backdrop */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-16 z-50 flex flex-col bg-[#0B0F19] animate-fadeIn safe-area-bottom">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* Tenant context card in mobile menu */}
              <div className="p-3.5 rounded-xl bg-[#101524] border border-[#1D263B] mb-3">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Store</p>
                <h4 className="text-sm font-extrabold text-white mt-0.5">
                  {tenant ? tenant.name : 'ByteForge Store'}
                </h4>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Single-Owner Admin Mode</span>
                </div>
              </div>

              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-[#2E2164] text-white shadow-sm'
                        : 'text-slate-300 hover:bg-[#131929] bg-[#101524]/60 border border-[#1D263B]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-slate-400')} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="text-[11px] font-bold w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </Link>
                );
              })}

              {/* Install PWA Prompt on mobile */}
              {showInstallPrompt && (
                <div className="mt-4 p-4 rounded-xl bg-[#141B2D] border border-purple-500/30 relative">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      <span>Install iPhone / Mobile App</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissInstall}
                      className="p-1 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-white transition"
                      title="Dismiss"
                      aria-label="Dismiss install prompt"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Install ByteForge to your home screen for full standalone experience.
                  </p>
                  <button
                    onClick={handleInstallClick}
                    className="mt-3 w-full py-2.5 rounded-lg bg-purple-600 text-white text-xs font-bold shadow-sm"
                  >
                    Add to Home Screen
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Footer Status */}
            <div className="p-4 border-t border-[#151D2D] bg-[#090D16] text-xs text-slate-500 flex items-center justify-between">
              <span>ByteForge v1.0.0</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Baileys Engine Active
              </span>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Top Header Bar for Desktop */}
        <div className="hidden md:flex h-16 border-b border-[#151D2D] bg-[#090D16]/80 backdrop-blur-md px-8 items-center justify-between sticky top-0 z-20">
          {/* Search Bar */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search orders, customers, or products..."
              className="bg-[#101524] border border-[#1D263B] text-xs text-white placeholder-slate-500 rounded-xl pl-10 pr-16 py-2.5 w-80 lg:w-96 focus:outline-none focus:border-purple-500 transition"
            />
            <div className="absolute right-2.5 px-1.5 py-0.5 rounded bg-[#182034] border border-[#25304B] text-[10px] text-slate-400 font-mono">
              Ctrl K
            </div>
          </div>

          {/* Status Pills & Actions */}
          <div className="flex items-center gap-3">
            {/* PostgreSQL Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#101524] border border-[#1D263B] text-xs">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-300 font-medium">PostgreSQL</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
              <span className="text-slate-300 font-medium">Connected</span>
            </div>

            {/* WhatsApp Web Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#101524] border border-[#1D263B] text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 font-medium">WhatsApp Web</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
              <span className="text-slate-300 font-medium">Online</span>
            </div>

            {/* Notification Bell */}
            <button
              className="relative p-2 rounded-xl bg-[#101524] hover:bg-[#161D2E] border border-[#1D263B] text-slate-300 hover:text-white transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#101524]" />
            </button>

            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#5B21B6] text-white font-bold flex items-center justify-center text-xs shadow-sm cursor-pointer hover:opacity-90 transition">
              {userInitial}
            </div>
          </div>
        </div>

        {/* Page Inner Container */}
        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR (iPhone Tab Bar matching Screenshot 2)      */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F19]/95 backdrop-blur-lg border-t border-[#161D2B] safe-area-bottom px-2 py-1 flex items-center justify-around">
        {mobileBottomTabs.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center py-2 px-3 text-[11px] font-medium transition-colors',
                isActive ? 'text-[#A78BFA]' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-[#A78BFA] rounded-full" />
              )}
              <Icon className={cn('w-5 h-5 mb-0.5', isActive ? 'text-[#A78BFA]' : 'text-slate-400')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
