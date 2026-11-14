import { ReactNode } from "react";

// The banner used at the top of each app page: a photo, a dark gradient for legibility, and room for text and actions.
export function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  imagePosition = "object-center",
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  image: string;
  imagePosition?: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-brand-950 shadow-2xl shadow-brand-950/30">
      <img src={image} alt="" className={`absolute inset-0 -z-10 h-full w-full object-cover ${imagePosition} opacity-75`} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950 via-brand-950/80 to-brand-950/10" />
      <div className="relative grid items-center gap-8 p-8 sm:p-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">{eyebrow}</p>
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-5xl">{title}</h1>
          {subtitle && <p className="max-w-xl text-base text-brand-100/90">{subtitle}</p>}
          {children && <div className="flex flex-wrap items-center gap-3 pt-3">{children}</div>}
        </div>
        {aside}
      </div>
    </section>
  );
}
