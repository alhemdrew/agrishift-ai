"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft, FileText, Globe2, Layers, LayoutDashboard, Sparkles, BarChart3 } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/app/app/logout-button";

type NavItem = {
  label: string;
  href: Route;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean; // false = shown but not built yet
};

const items: NavItem[] = [
  { label: "Dashboard", href: "/app", icon: LayoutDashboard, ready: true },
  { label: "Earth Explorer", href: "/explore", icon: Globe2, ready: true },
  { label: "Intelligence", href: "/app/intelligence", icon: BarChart3, ready: true },
  { label: "Environmental Layers", href: "/app/layers", icon: Layers, ready: true },
  { label: "Reports", href: "/app/reports", icon: FileText, ready: true },
  { label: "AI Assistant", href: "/app/assistant", icon: Sparkles, ready: true },
];

export function AppNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const onDashboard = pathname === "/app";

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/app");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-brand-200 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-brand-950/90">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          {!onDashboard && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 text-brand-800 hover:bg-brand-100 dark:border-white/10 dark:text-brand-100 dark:hover:bg-brand-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Logo />
        </div>

        <nav aria-label="Main navigation" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {items.map(({ label, href, icon: Icon, ready }) => {
            const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
            const base = "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition";

            if (!ready) {
              return (
                <span
                  key={label}
                  aria-disabled="true"
                  title="Coming soon"
                  className={`${base} cursor-not-allowed text-brand-400 dark:text-brand-300/50`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              );
            }

            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${base} ${
                  active
                    ? "bg-brand-800 text-white dark:bg-brand-700"
                    : "text-brand-700 hover:bg-brand-100 dark:text-brand-100 dark:hover:bg-brand-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-sm text-brand-700 md:inline dark:text-brand-200">{userName}</span>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
