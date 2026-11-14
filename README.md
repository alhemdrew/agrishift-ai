# AGRISHIFT AI

### From Earth observations to smarter agricultural decisions.

**Turning satellite intelligence into actionable insights for agriculture.**

AgriShift AI is an Earth-observation-powered agricultural intelligence platform that helps farmers and agricultural decision-makers understand changing environmental conditions, explore satellite-derived data, and make more informed decisions.

By bringing together NASA Earth observation datasets, geospatial technologies, and AI-powered interpretation, AgriShift AI aims to make complex environmental data easier to understand and more useful for real-world agriculture.

<br/>

<p align="center">
  <a href="#overview"><img src="https://img.shields.io/badge/PROJECT-AGRICULTURAL%20INTELLIGENCE-166534?style=for-the-badge" alt="Agricultural Intelligence"></a>
  <a href="#data-sources"><img src="https://img.shields.io/badge/DATA-NASA%20EARTH%20OBSERVATIONS-0B5CAB?style=for-the-badge" alt="NASA Earth Observations"></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/POWERED%20BY-AI%20%2B%20GEOSPATIAL-7C3AED?style=for-the-badge" alt="AI and Geospatial"></a>
</p>

<p align="center">
  <strong>Built by Team Miva-AlphaOne</strong> · NASA Space Apps Challenge 2026
</p>

---

## Overview

Agriculture is deeply connected to environmental conditions. Rainfall patterns, soil moisture, temperature, vegetation health, and other environmental factors influence agricultural productivity.

However, valuable Earth observation data is often difficult to access, interpret, and translate into practical decisions.

**AgriShift AI bridges that gap.**

The platform brings together environmental datasets from multiple Earth observation and scientific data providers, processes observations for selected locations, and presents the results through an accessible geospatial interface and AI-assisted intelligence layer.

> NASA provides the observations. AgriShift AI helps translate those observations into agricultural decisions.

## What AgriShift AI Does

| Capability | Description |
|---|---|
| **Earth Explorer** | Explore geographic locations and retrieve environmental observations for selected coordinates. |
| **Satellite Intelligence** | Access environmental information from multiple Earth observation datasets. |
| **Agricultural Insights** | Translate environmental observations into understandable agricultural context. |
| **AI Assistant** | Ask questions about environmental conditions and receive context-aware explanations. |
| **Environmental Layers** | Explore available geospatial and environmental data layers. |
| **Location Intelligence** | Search for locations and use geographic coordinates as the basis for analysis. |
| **Data Provenance** | Preserve information about data sources, timestamps, units, and availability. |

## The Platform

AgriShift AI is designed around three connected layers:

### 01 — Earth Observation

Retrieve environmental observations from scientific data providers, including NASA satellite and Earth science services.

### 02 — Intelligence Engine

Process, normalize, and organize retrieved observations into structured environmental context. The intelligence layer handles incomplete datasets and communicates uncertainty rather than inventing missing information.

### 03 — Decision Support

Present the resulting information through interactive maps, environmental dashboards, and an AI-assisted interface.

---

## Technology Stack

The platform combines modern web technologies, geospatial data processing, scientific APIs, and generative AI.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React-149ECA?style=for-the-badge&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Google Gemini">
  <img src="https://img.shields.io/badge/NASA_APIs-0B3D91?style=for-the-badge&logo=nasa&logoColor=white" alt="NASA APIs">
  <img src="https://img.shields.io/badge/Geospatial_Data-16A34A?style=for-the-badge" alt="Geospatial Data">
</p>

| Technology | Purpose |
|---|---|
| Next.js | Application framework and API routes |
| React | Interactive user interface |
| TypeScript | Type-safe application development |
| Tailwind CSS | Interface styling |
| Google Gemini | AI-powered interpretation and assistance |
| NASA Earthdata | Access to Earth observation datasets |
| NASA POWER | Meteorological and solar data |
| NASA FIRMS | Active fire and thermal anomaly information |
| NASA GPM IMERG | Satellite-derived precipitation estimates |
| NASA SMAP | Soil moisture observations |
| NASA MODIS / AppEEARS | Satellite-derived environmental products |
| ISRIC SoilGrids | Global soil information |
| CHIRPS | Historical precipitation datasets |

---

## Earth Observation Data Sources

AgriShift AI is designed to work with multiple complementary environmental datasets.

| Data Provider | Dataset | Agricultural Relevance |
|---|---|---|
| NASA | POWER | Temperature, precipitation, humidity and solar-related variables |
| NASA | GPM IMERG | Satellite precipitation estimates |
| NASA | SMAP | Surface and root-zone soil moisture products |
| NASA | MODIS / AppEEARS | Vegetation and land-surface observations |
| NASA | FIRMS | Active fire and thermal anomaly detections |
| ISRIC | SoilGrids | Soil properties and characteristics |
| Climate Hazards Center | CHIRPS | Historical rainfall estimates |

**Data integrity matters.**

Not every provider is guaranteed to be available at every moment. Some datasets require asynchronous processing, authentication, or additional retrieval steps.

AgriShift AI distinguishes between successfully retrieved observations, pending requests, unavailable providers, and incomplete datasets.

It does not treat missing data as zero or present simulated observations as real satellite measurements.

---

## System Architecture

```text
                 AGRISHIFT AI
                       |
          +------------+------------+
          |                         |
     USER INTERFACE           LOCATION INPUT
          |                         |
          +------------+------------+
                       |
              APPLICATION API
                       |
          +------------+------------+
          |                         |
    EARTH DATA HUB           INTELLIGENCE API
          |                         |
     +----+----+                    |
     |         |                    |
  NASA APIs  External              |
     |       Datasets               |
     |         |                    |
     +----+----+                    |
          |                         |
    DATA NORMALIZATION              |
          |                         |
    OBSERVATION CONTEXT ------------+
                       |
                 GEMINI AI
                       |
             AGRICULTURAL INSIGHTS
                       |
              DASHBOARDS & MAPS
```

The architecture separates data retrieval, observation processing, intelligence generation, and presentation.

This allows individual data providers to fail or become unavailable without necessarily bringing down the entire application.

---

## Getting Started

### Prerequisites

Make sure you have:

- Node.js (LTS recommended)
- npm
- Git
- Access to the required external API credentials

### 1. Clone the repository

```bash
git clone https://github.com/alhemdrew/agrishift-ai.git
cd agrishift-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local environment file:

```bash
cp .env.example .env.local
```

If `.env.example` is not present, create `.env.local` and configure the variables documented by the project.

Typical integrations may require:

- Google Gemini API credentials
- NASA Earthdata credentials
- Provider-specific API configuration

Keep all secrets server-side. Never commit `.env.local` or expose API keys in client-side code.

### 4. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### 5. Build for production

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

---

## API Overview

The application exposes API endpoints for retrieving environmental information and generating agricultural intelligence.

| Endpoint | Purpose |
|---|---|
| `/api/earth/observations` | Retrieve environmental observations from configured data providers. |
| `/api/earth/layers` | Retrieve available environmental layer information. |
| `/api/assistant` | Generate AI-assisted responses using available intelligence context. |

The Explorer also uses supporting location-search and point-analysis endpoints.

API contracts and request schemas should be treated as the source of truth for request parameters and response structures.

---

## Data Integrity & Responsible AI

AgriShift AI is built around a simple principle:

**Useful intelligence must be grounded in trustworthy observations.**

The platform prioritizes:

- Source attribution and data provenance.
- Observation timestamps and measurement units.
- Transparent provider availability.
- Honest handling of incomplete datasets.
- Clear communication of uncertainty.
- Separation of observed measurements from AI-generated interpretation.
- No fabricated satellite observations.
- No unsupported agricultural recommendations presented as scientific certainty.

AI-generated explanations are intended to support understanding and decision-making. They should not replace professional agronomic advice or verified field assessments.

---

## Project Structure

The application is organized around its main responsibilities:

```text
PHANTOMGREEN/
│
├── public/                 # Static assets
│
├── src/
│   ├── app/                # Application pages and API routes
│   │   └── api/            # Server-side API endpoints
│   │
│   ├── components/         # Reusable UI components
│   │
│   └── lib/
│       ├── earth-data/     # Earth observation integrations
│       │   ├── sources/    # Individual data providers
│       │   ├── hub.ts      # Data retrieval orchestration
│       │   ├── catalog.ts  # Environmental data catalog
│       │   └── types.ts    # Shared data contracts
│       │
│       └── intelligence/   # AI and observation context
│
├── package.json
├── package-lock.json
└── README.md
```

*The structure above is a high-level overview; individual files and directories may evolve as development progresses.*

---

## Development & Quality

AgriShift AI emphasizes maintainability, reliability, and verifiable data retrieval.

Run the available quality checks:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Contributions should preserve existing data contracts, test coverage, and provider-specific error handling.

---

## Roadmap

AgriShift AI is being developed as an extensible agricultural intelligence platform.

| Area | Direction |
|---|---|
| Earth Observation | Improve reliability and coverage across all integrated providers. |
| Geospatial Explorer | Expand location-based exploration and environmental visualization. |
| Agricultural Intelligence | Develop more contextual and useful agricultural insights. |
| AI Assistant | Improve grounded reasoning, multilingual support, and uncertainty communication. |
| Data Visualization | Expand interactive environmental dashboards and map layers. |
| Accessibility | Make satellite-derived information easier to understand and use. |
| Global Coverage | Extend beyond initial Nigerian pilot locations. |

---

## Team

**Miva-AlphaOne**

Built for the NASA Space Apps Challenge 2026.

We believe Earth observation data should be more accessible, understandable, and useful to the people whose decisions depend on the environment.

---

## Acknowledgements

AgriShift AI builds on the work of organizations and scientific communities making Earth observation and environmental data openly accessible.

- [NASA](https://www.nasa.gov/)
- [NASA POWER](https://power.larc.nasa.gov/)
- [NASA Earthdata](https://www.earthdata.nasa.gov/)
- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/)
- [NASA GES DISC](https://disc.gsfc.nasa.gov/)
- [NASA AppEEARS](https://appeears.earthdatacloud.nasa.gov/)
- [ISRIC SoilGrids](https://soilgrids.org/)
- [CHIRPS](https://www.chc.ucsb.edu/data/chirps)
- [Google Gemini](https://ai.google.dev/)

---

<p align="center">
  <strong>AGRISHIFT AI</strong>
  <br/>
  <sub>Observe the Earth. Understand the environment. Make smarter agricultural decisions.</sub>
  <br/><br/>
  <sub>Built by Miva-AlphaOne · NASA Space Apps Challenge 2026</sub>
</p>
