import type { ObservationHubResult } from '@/lib/earth-data/types';

export type FarmProfile = {
  farmSizeHa?: number;
  previousCrop?: string;
  plantingDate?: string;
  waterSource?: 'none' | 'rainfall' | 'well' | 'river' | 'irrigation';
  productionObjective?: 'food' | 'commercial' | 'livestock_feed';
  soilType?: string;
  preferredCrops?: string[];
};

export type AgriculturalSource = {
  name: string;
  url: string;
  geographicApplicability: string;
  subject: string;
  limitation: string;
};

export type CropProfile = {
  id: string;
  name: string;
  supportedRegions: string;
  rainfedPlantingMonths: number[];
  harvestMonths: number[];
  sourceIds: string[];
  evidenceNote: string;
};

export const agriculturalSources: AgriculturalSource[] = [
  {
    name: 'FAO Crop Calendar',
    url: 'https://cropcalendar.apps.fao.org/',
    geographicApplicability: 'Country and crop calendar records; use with local extension advice for Kaduna.',
    subject: 'Planting, growing and harvest periods',
    limitation: 'Calendar windows are not a field-level recommendation and may vary by agroecological zone and rainfall onset.',
  },
  {
    name: 'FAO Nigeria agricultural calendar',
    url: 'https://data-in-emergencies.fao.org/documents/bc77ee36347a46549f927cf7bb3e5501/about',
    geographicApplicability: 'Nigeria',
    subject: 'Agricultural calendar context',
    limitation: 'The application does not treat the national calendar as a precise Kaduna farm schedule.',
  },
  {
    name: 'NiMet Seasonal Climate Prediction',
    url: 'https://nimet.gov.ng/scp',
    geographicApplicability: 'Nigeria, with state-level seasonal climate products where published',
    subject: 'Seasonal rainfall, temperature and growing-season outlook',
    limitation: 'The current assessment does not substitute a forecast when a current NiMet bulletin is unavailable.',
  },
  {
    name: 'ISRIC SoilGrids',
    url: 'https://soilgrids.org/',
    geographicApplicability: 'Global gridded soil estimates',
    subject: 'Soil properties and uncertainty',
    limitation: 'Gridded estimates are not a soil test and may not represent a specific field.',
  },
];

export const supportedCrops: CropProfile[] = [
  {
    id: 'maize',
    name: 'Maize',
    supportedRegions: 'Nigeria; calendar screening for Kaduna and the Southern Guinea Savanna context',
    rainfedPlantingMonths: [3, 4, 5, 6],
    harvestMonths: [9, 10],
    sourceIds: ['fao-crop-calendar', 'fao-nigeria-calendar'],
    evidenceNote: 'Calendar screening only. Variety duration, rainfall onset, soil fertility and pest pressure still need local confirmation.',
  },
  {
    id: 'sorghum',
    name: 'Sorghum',
    supportedRegions: 'Nigeria; calendar screening for Kaduna and northern Guinea Savanna context',
    rainfedPlantingMonths: [5, 6, 7],
    harvestMonths: [10, 11, 12],
    sourceIds: ['fao-crop-calendar', 'fao-nigeria-calendar'],
    evidenceNote: 'Calendar screening only. Variety, rainfall onset and field soil conditions still need local confirmation.',
  },
];

export function numericObservations(hub: ObservationHubResult, sourceId: string, variable: string): number[] {
  return (hub.sources[sourceId as keyof ObservationHubResult['sources']]?.result?.observations ?? [])
    .filter((observation) => observation.variable === variable && typeof observation.value === 'number')
    .map((observation) => observation.value as number);
}
