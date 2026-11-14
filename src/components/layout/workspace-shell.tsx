'use client';

import { ChevronDown, Home, Map, MapPin, Menu, MessageCircle, Sparkles, X } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useLocationContext } from '@/components/providers/location-context';
import { advancedWorkspaceNavItems, workspaceNavItems } from '@/data/mock/navigation';
import { cn } from '@/lib/utils';

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { location } = useLocationContext();
  const navIcons = [Home, MessageCircle, Map, MapPin];

  const renderNavItem = (item: (typeof workspaceNavItems)[number], Icon?: typeof Home) => {
    const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href as Route}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-muted',
        )}
      >
        {Icon && <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />}
        <span className="min-w-0">
          <span className="block text-sm font-medium">{item.label}</span>
          <span className={cn('mt-0.5 block text-[11px]', active ? 'text-primary/80' : 'text-muted-foreground')}>
            {item.description}
          </span>
        </span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1600px] gap-4 px-3 py-4 md:px-6 xl:px-8">
        <aside className="hidden min-h-[calc(100vh-2rem)] w-72 shrink-0 flex-col rounded-[28px] border border-border bg-card p-4 shadow-soft md:flex">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold">AgriShif AI</div>
                <div className="text-[11px] text-muted-foreground">Your farm, understood</div>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <nav aria-label="Main navigation" className="mt-6 space-y-1">
            {workspaceNavItems.map((item, index) => renderNavItem(item, navIcons[index]))}
            <details className="group mt-3 border-t border-border pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                More tools
                <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <nav aria-label="Advanced tools" className="mt-1 space-y-1">
                {advancedWorkspaceNavItems.map((item) => renderNavItem(item))}
              </nav>
            </details>
          </nav>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block font-medium text-foreground">Your place</span>
              <span className="block truncate text-muted-foreground">
                {location.confirmed ? location.name : `Choose or confirm ${location.name}`}
              </span>
            </span>
          </div>

          <div className="mt-auto rounded-2xl bg-secondary p-4">
            <div className="text-sm font-semibold">A little more clarity</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your local observations, explained simply.
            </p>
            <Link className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary" href="/assistant">
              Ask AgriShif AI <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shell-surface sticky top-0 z-20 mb-4 flex items-center justify-between rounded-2xl px-4 py-3 md:hidden">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
                aria-label="Toggle navigation"
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
              <div>
                <div className="text-sm font-semibold">AgriShif AI</div>
                <div className="text-[10px] text-muted-foreground">Your farm, understood</div>
              </div>
            </div>
            <ThemeToggle />
          </header>

          {mobileOpen ? (
            <div className="shell-surface mb-4 rounded-2xl p-3 md:hidden">
              <nav aria-label="Main navigation" className="space-y-1">
                {workspaceNavItems.map((item, index) => renderNavItem(item, navIcons[index]))}
                <details className="group mt-3 border-t border-border pt-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                    More tools
                    <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <nav aria-label="Advanced tools" className="mt-1 space-y-1">
                    {advancedWorkspaceNavItems.map((item) => renderNavItem(item))}
                  </nav>
                </details>
              </nav>
            </div>
          ) : null}

          <main className="min-w-0 flex-1 pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
