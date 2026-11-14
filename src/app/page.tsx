import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import {
  ArrowRight,
  BarChart3,
  Leaf,
  Menu,
  Satellite,
  Sparkles,
} from 'lucide-react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { sourceCatalog } from '@/lib/earth-data/catalog';
import type { SourceId } from '@/lib/earth-data/types';

import assistantGuide from '../../ux/Agrishif AI Explores Earth (0.75x).gif';
import styles from './home.module.css';

const capabilities = [
  {
    title: 'Earth Observation',
    description: 'Real satellite data. Global coverage.',
    icon: Satellite,
  },
  {
    title: 'Environmental Intelligence',
    description: 'Track change. Assess risk.',
    icon: Leaf,
  },
  {
    title: 'AI-Assisted Decisions',
    description: 'Turn insight into action.',
    icon: BarChart3,
  },
];

const workflow = [
  {
    title: 'Explore',
    description: 'View Earth observation data across the globe.',
  },
  {
    title: 'Understand',
    description: 'Uncover environmental trends, risks and opportunities.',
  },
  {
    title: 'Adapt',
    description: 'Make informed decisions for more resilient agriculture.',
  },
];

const sourceSummaries: Record<SourceId, string> = {
  power: 'Daily weather and solar radiation',
  gpm: 'Global precipitation estimates',
  smap: 'Surface and root-zone soil moisture',
  modis: 'Vegetation health indices',
  firms: 'Near-real-time fire detections',
  soilgrids: 'Static soil properties and textures',
  chirps: 'Daily rainfall estimates and anomalies',
};

const starterQuestions = [
  'Check farming conditions in my area.',
  'Understand rainfall around my farm.',
  'Explore the health of vegetation.',
  'Find out what is happening around my land.',
];

function assistantHref(question?: string): Route {
  return question
    ? `/assistant?question=${encodeURIComponent(question)}` as Route
    : '/assistant';
}

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="AgriShif AI home">
            <Image
              className={styles.brandMark}
              src="/brand-mark.webp"
              alt=""
              width={360}
              height={331}
              priority
            />
            <span className={styles.brandName}>AgriShif AI</span>
          </Link>

          <nav className={styles.desktopNav} aria-label="Main navigation">
            <Link href="/">Home</Link>
            <Link href="/assistant">Ask AI</Link>
            <Link href="/explorer">Explore</Link>
            <Link href="/locations">My Area</Link>
          </nav>

          <div className={styles.headerActions}>
            <div className={styles.themeToggle}>
              <ThemeToggle />
            </div>
            <Link className={styles.headerCta} href="/assistant">
              Ask about my farm <ArrowRight aria-hidden="true" />
            </Link>
            <details className={styles.mobileNavigation}>
              <summary aria-label="Open navigation">
                <Menu aria-hidden="true" />
              </summary>
              <nav className={styles.mobileMenuPanel} aria-label="Mobile navigation">
                <Link href="/">Home</Link>
                <Link href="/assistant">Ask AI</Link>
                <Link href="/explorer">Explore</Link>
                <Link href="/locations">My Area</Link>
                <Link className={styles.mobileMenuCta} href="/assistant">
                  Ask about my farm <ArrowRight aria-hidden="true" />
                </Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <section className={styles.welcomeHero} aria-labelledby="hero-title">
        <div className={styles.welcomeInner}>
          <div className={styles.welcomeCopy}>
            <p className={styles.eyebrow}><Sparkles aria-hidden="true" /> Your agricultural companion</p>
            <h1 id="hero-title">Hello! How can I help you today?</h1>
            <p className={styles.welcomeDescription}>
              Understand your farm, explore your land and discover what’s happening around your area.
            </p>
            <div className={styles.welcomeActions}>
              <Link className={styles.primaryButton} href="/assistant">
                Ask about my farm <ArrowRight aria-hidden="true" />
              </Link>
              <Link className={styles.secondaryButton} href="/explorer">
                Explore my area
              </Link>
            </div>
            <div aria-label="Try asking AgriShif AI" className={styles.starterList}>
              {starterQuestions.map((question) => (
                <Link className={styles.starterLink} href={assistantHref(question)} key={question}>
                  <span>{question}</span><ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <Link aria-label="Start a conversation with AgriShif AI" className={styles.guideLink} href="/assistant">
            <Image
              className={styles.guideImage}
              src={assistantGuide}
              alt="AgriShif AI's animated guide exploring Earth"
              width={540}
              height={390}
              unoptimized
              priority
            />
            <span className={styles.guideCaption}>Meet your AgriShif AI guide</span>
          </Link>
        </div>
      </section>

      <section className={styles.capabilityBand} id="intelligence" aria-label="Platform capabilities">
        <div className={styles.capabilityInner}>
          {capabilities.map(({ title, description, icon: Icon }) => (
            <article className={styles.capability} key={title}>
              <span className={styles.capabilityIcon}>
                <Icon aria-hidden="true" />
              </span>
              <span>
                <h2>{title}</h2>
                <p>{description}</p>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.workflow} id="how-it-works" aria-label="How AgriShif works">
        <div className={styles.workflowInner}>
          {workflow.map(({ title, description }, index) => (
            <article className={styles.workflowStep} key={title}>
              <span className={styles.stepNumber}>0{index + 1}</span>
              <span>
                <h2>{title}</h2>
                <p>{description}</p>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.dataSection} id="data" aria-labelledby="data-title">
        <div className={styles.dataHeading}>
          <div className={styles.dataTitleGroup}>
            <Image className={styles.nasaLogo} src="/nasa-logo.svg" alt="NASA" width={58} height={49} />
            <div>
              <p className={styles.dataEyebrow}>Earth observation sources</p>
              <h2 id="data-title">NASA data beyond POWER.</h2>
            </div>
          </div>
          <p>
            Five NASA data products bring weather, rainfall, soil moisture, vegetation and fire
            context together for agricultural intelligence.
          </p>
        </div>
        <div className={styles.dataGrid}>
          {sourceCatalog.map((source, index) => (
            <article className={styles.dataCard} key={source.id}>
              <span className={styles.sourceNumber}>0{index + 1}</span>
              <h3>{source.name}</h3>
              <p>{sourceSummaries[source.id]}</p>
              <small>{source.productId}</small>
            </article>
          ))}
        </div>
        <p className={styles.disclaimer}>
          Data availability varies by source; some products require NASA Earthdata or FIRMS
          credentials. NASA does not endorse AgriShif. The globe above is illustrative, not live data.
        </p>
      </section>

      <section className={styles.ctaSection} id="about">
        <p className={styles.ctaEyebrow}>A more informed point of view</p>
        <h2>Your Next Agricultural Insight Starts Here.</h2>
        <p>Explore environmental conditions across the Earth and discover what the data can tell you.</p>
        <Link className={styles.ctaButton} href="/explorer">
          Launch AgriShif Explorer <ArrowRight aria-hidden="true" />
        </Link>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.footerBrand} href="/" aria-label="AgriShif AI home">
          <Image src="/brand-mark.webp" alt="" width={360} height={331} />
          <span>AgriShif AI</span>
        </Link>
        <p>Geospatial agricultural intelligence for a more resilient planet.</p>
        <nav aria-label="Footer navigation">
          <Link href="/explorer">Explore</Link>
          <a href="#data">Five NASA Data Sources</a>
          <a href="#about">About</a>
        </nav>
        <p className={styles.footerNote}>
          Earth observation data: NASA POWER, GPM, SMAP, MODIS and FIRMS.
          {' '}<span>NASA does not endorse AgriShif.</span>
        </p>
      </footer>
    </main>
  );
}
