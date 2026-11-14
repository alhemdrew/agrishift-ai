import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Crop, Leaf, ShieldAlert, Sprout, Plus } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";

export const metadata = { title: "Reports | AgriShift" };

const categories = [
  { title: "Environmental Overview", body: "A summary of recent environmental conditions for a chosen place.", icon: Leaf, tone: "from-emerald-400 to-teal-500", href: "/app/reports/create?type=environmental", live: true },
  { title: "Risk Assessment", body: "Heat, dry-spell and heavy-rain indicators, with their evidence and limits.", icon: ShieldAlert, tone: "from-amber-400 to-orange-500", href: "/app/reports/create?type=risk", live: true },
  { title: "Farm Intelligence", body: "Insights for a saved farm. Available once farms can be saved.", icon: Sprout, tone: "from-lime-400 to-green-600", href: undefined, live: false },
  { title: "Crop & Rotation Insights", body: "Crop options and rotation strategies. Needs validated agronomic rules first.", icon: Crop, tone: "from-violet-400 to-fuchsia-500", href: undefined, live: false },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Reports"
        title="Turn observations into a clear story."
        subtitle="Field briefs that combine NASA evidence, indicators and their limits, ready to print or save as a PDF."
        image="/assets/landscape-banner.webp"
        imagePosition="object-right"
        aside={<img src="/assets/ai-robot.webp" alt="" className="mx-auto hidden h-60 w-auto rounded-3xl drop-shadow-2xl lg:block" />}
      >
        <Link href="/app/reports/create" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 py-3 text-sm font-semibold text-brand-950 shadow-lg shadow-emerald-500/30 hover:brightness-110">
          <Plus className="h-4 w-4" /> Generate new report
        </Link>
      </PageHero>

      <section className="grid gap-5 md:grid-cols-2">
        {categories.map(({ title, body, icon: Icon, tone, href, live }) => {
          const card = (
            <div className={`group relative h-full overflow-hidden rounded-3xl border border-brand-200 bg-white p-6 shadow-sm transition duration-300 dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none ${live ? "hover:-translate-y-1 hover:shadow-xl" : "opacity-75"}`}>
              <div className={`absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br ${tone} opacity-20 blur-2xl transition group-hover:opacity-40`} />
              <span className={`relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-lg`}><Icon className="h-6 w-6" /></span>
              <h2 className="relative mt-4 text-lg font-semibold text-brand-900 dark:text-white">{title}</h2>
              <p className="relative mt-1 text-sm text-brand-700 dark:text-brand-200/80">{body}</p>
              <p className={`relative mt-5 flex items-center gap-1.5 text-sm font-semibold ${live ? "text-emerald-700 dark:text-emerald-300" : "text-brand-500 dark:text-brand-300/60"}`}>
                {live ? (<>Create brief <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></>) : "Coming soon"}
              </p>
            </div>
          );
          return live && href ? <Link key={title} href={href as Route} className="block">{card}</Link> : <div key={title} aria-disabled="true">{card}</div>;
        })}
      </section>
    </div>
  );
}
