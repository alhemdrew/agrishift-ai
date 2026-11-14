"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/app/landing.css";
import "@/app/landing-drama.css";

type Theme = "light" | "dark";
const THEME_KEY = "agrishift-theme";

export function LandingPage() {
  // Light is the default, matching the design. The toggle switches to dark.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  return (
    <div className="agrishift-landing" data-theme={theme}>
      <main className="page">
        <header className="header">
          <div className="header-inner">
            <a className="brand" href="#top" aria-label="AgriShift home">
              <img className="brand-mark" src="/assets/brand-mark.webp" alt="" />
              <span>AgriShift</span>
            </a>

            <nav className="desktop-nav" aria-label="Main navigation">
              <a href="#data">Explore Earth <span aria-hidden="true">⌄</span></a>
              <a href="#intelligence">Intelligence <span aria-hidden="true">⌄</span></a>
              <a href="#data">Environmental Data <span aria-hidden="true">⌄</span></a>
              <a href="#about">About</a>
            </nav>

            <div className="header-actions">
              <button
                className="theme-toggle"
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                title="Toggle color theme"
              >
                <svg className="sun-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
                </svg>
                <svg className="moon-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
                </svg>
              </button>
              <Link className="auth-link" href="/login">Sign in</Link>
              <Link className="auth-register" href="/signup">Register</Link>
              <Link className="button header-cta" href="/explore">
                Launch Explorer <span aria-hidden="true">→</span>
              </Link>
              <details className="mobile-navigation">
                <summary aria-label="Open navigation">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </summary>
                <nav className="mobile-menu-panel" aria-label="Mobile navigation">
                  <a href="#data">Explore Earth</a>
                  <a href="#intelligence">Intelligence</a>
                  <a href="#data">Environmental Data</a>
                  <a href="#about">About</a>
                  <Link href="/login">Sign in</Link>
                  <Link href="/signup">Register</Link>
                  <Link className="button mobile-menu-cta" href="/explore">
                    Launch Explorer <span aria-hidden="true">→</span>
                  </Link>
                </nav>
              </details>
            </div>
          </div>
        </header>

        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">Earth systems · Agriculture · Intelligence</p>
              <h1 className="hero-title" id="hero-title">
                See the Earth <span>Differently<span className="title-period">.</span></span>
              </h1>
              <p className="hero-description">
                Turn Earth observation into meaningful agricultural intelligence. Explore environmental
                changes, understand emerging risks, and discover smarter ways to adapt.
              </p>
              <div className="hero-actions">
                <Link className="button primary-button" href="/explore">
                  Explore the Earth <span aria-hidden="true">→</span>
                </Link>
                <a className="secondary-button" href="#how-it-works">
                  <span className="play-icon" aria-hidden="true">▶</span>
                  Discover How It Works
                </a>
              </div>
              <p className="hero-footnote">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 3.5C12 3.5 5 6.7 5 13.1c0 3.3 2.2 5.4 5.1 5.4 6.1 0 9.9-7.5 10.4-15Z" />
                  <path d="M3 21c2.4-5.3 6.4-8.5 12-10" />
                </svg>
                Earth observation data, made easier to explore with AI.
              </p>
            </div>
            <figure className="hero-visual">
              <img
                className="hero-globe"
                src="/assets/hero-earth-scene-feathered.webp"
                alt="Illustrative globe with agricultural intelligence and environmental monitoring markers"
              />
              <figcaption className="hero-caption">Illustrative visualization · Not live data</figcaption>
            </figure>
          </div>
        </section>

        <section className="capability-band" id="intelligence" aria-label="Platform capabilities">
          <div className="capability-inner">
            <article className="capability">
              <span className="capability-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 21s8-4 8-11V5l-8-3-8 3v5c0 7 8 11 8 11Z" />
                  <path d="M12 8v5m0 3h.01" />
                </svg>
              </span>
              <span><h2>Earth Observation</h2><p>Real satellite data. Global coverage.</p></span>
            </article>
            <article className="capability">
              <span className="capability-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M11 20A8 8 0 0 1 3 12c0-4.4 3.6-8 8-8 5 0 9 4 9 9 0 3.9-2.7 7-6.2 7-1.8 0-2.8-1-2.8-2.4 0-.8.4-1.3.8-1.8.4-.5.8-1 .8-1.8 0-1.1-.9-2-2-2H8" />
                  <path d="M7.5 10.5h.01M10 7.5h.01M14 8.5h.01M16.5 12h.01" />
                </svg>
              </span>
              <span><h2>Environmental Intelligence</h2><p>Track change. Assess risk.</p></span>
            </article>
            <article className="capability">
              <span className="capability-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-5 5" />
                </svg>
              </span>
              <span><h2>AI-Assisted Decisions</h2><p>Turn insight into action.</p></span>
            </article>
          </div>
        </section>

        <section className="workflow" id="how-it-works" aria-label="How AgriShift works">
          <div className="workflow-inner">
            <article className="workflow-step"><span className="step-number">01</span><span><h2>Explore</h2><p>View Earth observation data across the globe.</p></span></article>
            <article className="workflow-step"><span className="step-number">02</span><span><h2>Understand</h2><p>Uncover environmental trends, risks and opportunities.</p></span></article>
            <article className="workflow-step"><span className="step-number">03</span><span><h2>Adapt</h2><p>Make informed decisions for more resilient agriculture.</p></span></article>
          </div>
        </section>

        <section className="data-section" id="data" aria-labelledby="data-title">
          <div className="data-heading">
            <div className="data-title-group">
              <img className="nasa-logo" src="/assets/nasa-logo.svg" alt="NASA" />
              <div><p className="data-eyebrow">Earth observation sources</p><h2 id="data-title">NASA data beyond POWER.</h2></div>
            </div>
            <p>Five NASA data products bring weather, rainfall, soil moisture, vegetation and fire context together for agricultural intelligence.</p>
          </div>
          <div className="data-grid">
            <article className="data-card"><span className="source-number">01</span><h3>NASA POWER</h3><p>Daily weather and solar radiation</p><small>POWER Daily Point API</small></article>
            <article className="data-card"><span className="source-number">02</span><h3>NASA GPM IMERG</h3><p>Global precipitation estimates</p><small>GPM_3IMERGDF.07</small></article>
            <article className="data-card"><span className="source-number">03</span><h3>NASA SMAP L4</h3><p>Surface and root-zone soil moisture</p><small>SPL4SMGP.008</small></article>
            <article className="data-card"><span className="source-number">04</span><h3>NASA MODIS</h3><p>Vegetation health indices</p><small>MOD13Q1.061</small></article>
            <article className="data-card"><span className="source-number">05</span><h3>NASA FIRMS</h3><p>Near-real-time fire detections</p><small>VIIRS_NOAA21_NRT</small></article>
          </div>
          <p className="disclaimer">
            Data availability varies by source; some products require NASA Earthdata or FIRMS credentials.
            Built for the NASA Space Apps Challenge 2026 using NASA data. Not endorsed by NASA. The globe above is illustrative, not live data.
          </p>
        </section>

        <section className="landscape-band" aria-hidden="true">
          <img src="/assets/landscape-banner.webp" alt="" />
          <div className="landscape-band-copy">
            <p>Real fields · Real data</p>
            <h2>Built for the people who work the land</h2>
          </div>
        </section>

        <section className="ai-teaser" aria-labelledby="ai-teaser-title">
          <div className="ai-teaser-copy">
            <p className="eyebrow">AgriShift AI · Coming soon</p>
            <h2 id="ai-teaser-title">Ask why the land is changing.</h2>
            <p>Plain-language explanations of every indicator, grounded in the NASA observations behind it.</p>
            <div className="ai-chips" aria-hidden="true">
              <span>What does this pattern indicate?</span>
              <span>Should farmers be concerned?</span>
            </div>
          </div>
          <img className="ai-robot" src="/assets/ai-robot.webp" alt="" />
        </section>

        <section className="cta-section" id="about">
          <p className="cta-eyebrow">A more informed point of view</p>
          <h2>Your Next Agricultural Insight Starts Here.</h2>
          <p>Explore environmental conditions across the Earth and discover what the data can tell you.</p>
          <Link className="button cta-button" href="/explore">
            Launch AgriShift Explorer <span aria-hidden="true">→</span>
          </Link>
        </section>

        <footer className="footer">
          <Link className="footer-brand" href="/" aria-label="AgriShift home">
            <img src="/assets/brand-mark.webp" alt="" />
            <span>AgriShift</span>
          </Link>
          <p>Geospatial agricultural intelligence for a more resilient planet.</p>
          <nav aria-label="Footer navigation">
            <a href="#data">Explore</a>
            <a href="#data">Five NASA Data Sources</a>
            <a href="#about">About</a>
          </nav>
          <p className="footer-note">
            Earth observation data: NASA POWER, GPM, SMAP, MODIS and FIRMS. <span>Not endorsed by NASA.</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
