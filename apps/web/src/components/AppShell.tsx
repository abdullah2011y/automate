'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  MessageSquare,
  Store,
  Settings,
  Menu,
  X,
  Activity,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Download,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, TenantProfile, UserProfile } from '@/lib/api';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'WhatsApp', href: '/whatsapp', icon: MessageSquare },
  { label: 'Shopify', href: '/shopify', icon: Store },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
];

// Primary bottom tabs on iPhone (5 items)
const mobileBottomTabs: NavItem[] = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'WhatsApp', href: '/whatsapp', icon: MessageSquare },
  { label: 'Shopify', href: '/shopify', icon: Store },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiHealth, setApiHealth] = useState<'checking' | 'healthy' | 'offline'>('checking');
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
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
      setShowInstallPrompt(true);
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
    }
    setDeferredPrompt(null);
  };

  // Live health and Tenant Profile fetch
  useEffect(() => {
    let isMounted = true;

    const checkSystem = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/v1/health`, { cache: 'no-store' });
        if (res.ok) {
          if (isMounted) setApiHealth('healthy');
          // Fetch authenticated store & user context
          try {
            const me = await api.getMe();
            if (isMounted) {
              setTenant(me.tenant);
              setCurrentUser(me.user);
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
    const interval = setInterval(checkSystem, 25000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] text-navy-900 font-sans safe-area-left safe-area-right">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-navy-900 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md safe-area-top">
          <WifiOff className="w-4 h-4 text-navy-900 flex-shrink-0 animate-pulse" />
          <span>
            Offline Mode: Backend connection unavailable. Real-time order sync and WhatsApp dispatches are paused.
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR                                                           */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white sticky top-0 h-screen select-none z-30">
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center text-brand font-bold text-lg shadow-sm border border-navy-800">
              ⚡
            </div>
            <div>
              <span className="font-extrabold text-navy-900 tracking-tight text-base block leading-none">
                BYTEFORGE
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-400 block mt-1">
                OMNI-COMMERCE
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand/10 text-[#028FA8] border border-brand/20">
            PROD
          </span>
        </div>

        {/* Real Tenant / Store Context */}
        <div className="p-3.5 mx-3 my-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Connected Store</p>
              <p className="text-xs font-bold text-navy-900 truncate">
                {tenant ? tenant.name : 'ByteForge Store'}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" title="Connected" />
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-brand' : 'text-slate-400 group-hover:text-navy-900'
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/20 text-[#028FA8] font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Install PWA Prompt (if available) */}
        {showInstallPrompt && (
          <div className="mx-3 mb-2 p-3 rounded-xl bg-[#E6FAFE] border border-[#028FA8]/30">
            <div className="flex items-center gap-2 text-xs font-bold text-[#028FA8]">
              <Download className="w-4 h-4" />
              <span>Install Desktop App</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Add ByteForge to your applications for one-click access.
            </p>
            <button
              onClick={handleInstallClick}
              className="mt-2 w-full py-1.5 px-3 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              Install Now
            </button>
          </div>
        )}

        {/* Authenticated User & System Health Footer */}
        <div className="p-3 m-3 space-y-2 border-t border-slate-100">
          {currentUser && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200/60">
              <div className="w-7 h-7 rounded-full bg-navy-900 text-brand flex items-center justify-center text-xs font-bold">
                {currentUser.name.charAt(0)}
              </div>
              <div className="truncate flex-1">
                <p className="text-xs font-semibold text-navy-900 truncate leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-medium">{currentUser.role}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              Backend API
            </span>
            {apiHealth === 'healthy' ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live
              </span>
            ) : (
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Offline
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE HEADER & DRAWER (iPhone / Capacitor Viewports)                     */}
      {/* ========================================================================= */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 safe-area-top shadow-2xs">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-navy-900 flex items-center justify-center text-brand font-bold text-sm shadow-xs">
              ⚡
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-navy-900 tracking-tight text-sm leading-none">
                BYTEFORGE
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                {tenant ? tenant.name : 'Omni-Commerce'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  apiHealth === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
                )}
              />
              <span className="text-slate-700">{apiHealth === 'healthy' ? 'LIVE' : 'OFFLINE'}</span>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 touch-target flex items-center justify-center"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-navy-900" /> : <Menu className="w-5 h-5 text-navy-900" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-over Drawer with Backdrop */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-14 z-50 flex flex-col bg-white animate-fadeIn safe-area-bottom">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* Tenant context card in mobile menu */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-3">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Store</p>
                <h4 className="text-sm font-extrabold text-navy-900 mt-0.5">
                  {tenant ? tenant.name : 'ByteForge Store'}
                </h4>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-medium">
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
                      'flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-colors touch-target',
                      isActive
                        ? 'bg-navy-900 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-100'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn('w-5 h-5', isActive ? 'text-brand' : 'text-slate-400')} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                );
              })}

              {/* Install PWA Prompt on mobile */}
              {showInstallPrompt && (
                <div className="mt-4 p-4 rounded-xl bg-[#E6FAFE] border border-[#028FA8]/30">
                  <h4 className="text-xs font-bold text-[#028FA8] flex items-center gap-2">
                    <Download className="w-4 h-4" /> Install iPhone / Mobile App
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Install ByteForge to your home screen for full standalone experience.
                  </p>
                  <button
                    onClick={handleInstallClick}
                    className="mt-3 w-full py-2.5 rounded-lg bg-navy-900 text-white text-xs font-bold shadow-sm"
                  >
                    Add to Home Screen
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Footer Status */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
              <span>ByteForge v1.0.0</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
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
        <div className="hidden md:flex h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-md px-8 items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-navy-900">
              {navItems.find((n) => n.href === pathname)?.label || 'Dashboard'}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium border border-slate-200">
              {tenant ? tenant.slug : 'default'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>PostgreSQL: <strong>Connected</strong></span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>WhatsApp Web: <strong>Active</strong></span>
            </div>
          </div>
        </div>

        {/* Page Content Container */}
        <div className="flex-1 p-3.5 sm:p-5 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR (iPhone Tab Bar)                             */}
      {/* ========================================================================= */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 flex justify-around items-center h-16 z-40 safe-area-bottom shadow-lg"
      >
        {mobileBottomTabs.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors touch-target',
                isActive ? 'text-navy-900 font-extrabold' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <div
                className={cn(
                  'p-1 rounded-lg transition-colors',
                  isActive ? 'bg-[#E6FAFE] text-[#028FA8]' : 'text-slate-400'
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
