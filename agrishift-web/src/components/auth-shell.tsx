import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Satellite, Sprout } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo className="[&_span]:text-white" />
        <div className="max-w-md space-y-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Satellite className="h-6 w-6 text-accent-400" />
          </div>
          <h2 className="text-4xl font-semibold leading-tight">
            Turn Earth observation into field decisions.
          </h2>
          <p className="text-brand-200">
            AgriShift combines NASA satellite data with AI explanations so farmers and planners can see
            risk early and act with confidence.
          </p>
          <div className="flex items-center gap-3 text-sm text-brand-200">
            <Sprout className="h-4 w-4 text-accent-400" />
            Powered by NASA POWER, GPM IMERG, SMAP, MODIS and FIRMS
          </div>
        </div>
        <p className="text-xs text-brand-300">
          AgriShift is not endorsed by, nor affiliated with, NASA.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-brand-900 dark:text-brand-50">{title}</h1>
              {subtitle && <p className="text-brand-600 dark:text-brand-300">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="text-center text-sm text-brand-600 dark:text-brand-300">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
