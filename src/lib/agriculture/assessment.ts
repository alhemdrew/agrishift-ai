import type { ObservationHubResult } from '@/lib/earth-data/types';
import { agriculturalSources, numericObservations, supportedCrops, type FarmProfile } from './knowledge';

export type CropAssessment = {
  crop: string;
  status: 'potentially_suitable' | 'uncertain' | 'not_in_window';
  supportingEvidence: string[];
  limitingFactors: string[];
  plantingWindow: string;
  confidence: 'low' | 'moderate';
  sources: string[];
  assumptions: string[];
};

export type AgriculturalAssessment = {
  location: { latitude: number; longitude: number };
  assessedAt: string;
  currentMonth: number;
  season: 'main_rainfed' | 'dry_season' | 'transition';
  environmentalEvidence: {
    rainfall: { totalMm: number | null; rainyDays: number | null; observationCount: number; period: { start: string; end: string } };
    temperature: { averageC: number | null; observationCount: number };
    soil: { status: string; observationCount: number };
  };
  crops: CropAssessment[];
  risks: Array<{ id: string; level: 'watch' | 'unknown'; evidence: string; limitation: string }>;
  nextSteps: string[];
  missingInformation: string[];
  sources: typeof agriculturalSources;
};

function monthName(month: number): string {
  return new Date(Date.UTC(2020, month - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
}

function windowLabel(months: number[]): string {
  return months.map(monthName).join(', ');
}

export function assessAgriculture(
  hub: ObservationHubResult,
  latitude: number,
  longitude: number,
  profile: FarmProfile = {},
  now = new Date(),
): AgriculturalAssessment {
  const rain = numericObservations(hub, 'power', 'PRECTOTCORR');
  const temperature = numericObservations(hub, 'power', 'T2M');
  const soil = hub.sources.soilgrids.result?.observations ?? [];
  const currentMonth = now.getUTCMonth() + 1;
  const hasWater = profile.waterSource && profile.waterSource !== 'none';
  const period = hub.period;
  const totalMm = rain.length ? rain.reduce((sum, value) => sum + value, 0) : null;
  const rainyDays = rain.length ? rain.filter((value) => value > 0).length : null;
  const mainRainfedMonths = [4, 5, 6, 7, 8, 9];
  const inMainRainfedSeason = mainRainfedMonths.includes(currentMonth);

  const crops = supportedCrops.map((crop): CropAssessment => {
    const inWindow = crop.rainfedPlantingMonths.includes(currentMonth);
    const supportingEvidence: string[] = [];
    const limitingFactors: string[] = [];
    const assumptions = ['This is a screening assessment, not a yield prediction or agronomic prescription.'];

    if (inWindow) supportingEvidence.push(`${crop.name} is within the documented Kaduna/Nigeria screening planting window (${windowLabel(crop.rainfedPlantingMonths)}).`);
    else limitingFactors.push(`The current month (${monthName(currentMonth)}) is outside the screening rain-fed planting window.`);
    if (rain.length) supportingEvidence.push(`NASA POWER supplied ${rain.length} precipitation observations for ${period.start} to ${period.end}.`);
    else limitingFactors.push('No valid precipitation observations were available for the selected period.');
    if (temperature.length) supportingEvidence.push(`NASA POWER supplied ${temperature.length} temperature observations.`);
    else limitingFactors.push('No valid temperature observations were available.');
    if (soil.length) supportingEvidence.push('ISRIC SoilGrids returned soil observations for this point.');
    else limitingFactors.push('No soil observations were available; a field soil test is still needed.');
    if (!hasWater && !inMainRainfedSeason) limitingFactors.push('No irrigation or other water source was supplied for a dry-season scenario.');
    if (profile.previousCrop) assumptions.push(`Previous crop supplied by farmer: ${profile.previousCrop}.`);

    const status = inWindow && rain.length > 0 && temperature.length > 0 && (hasWater || inMainRainfedSeason)
      ? 'potentially_suitable'
      : inWindow
        ? 'uncertain'
        : 'not_in_window';
    return {
      crop: crop.name,
      status,
      supportingEvidence,
      limitingFactors,
      plantingWindow: windowLabel(crop.rainfedPlantingMonths),
      confidence: status === 'potentially_suitable' && soil.length > 0 ? 'moderate' : 'low',
      sources: [...crop.sourceIds, ...(rain.length || temperature.length ? ['nasa-power'] : []), ...(soil.length ? ['isric-soilgrids'] : [])],
      assumptions,
    };
  });

  const risks: AgriculturalAssessment['risks'] = [];
  if (rain.length && rainyDays === 0) {
    risks.push({
      id: 'recent-dry-spell',
      level: 'watch',
      evidence: `No rainy days were observed in the retrieved POWER period (${period.start} to ${period.end}).`,
      limitation: 'This short observation window cannot establish seasonal drought or annual water availability.',
    });
  } else if (!rain.length) {
    risks.push({ id: 'rainfall-coverage', level: 'unknown', evidence: 'Rainfall risk could not be assessed from valid observations.', limitation: 'Retrieve a longer rainfall history or consult the relevant seasonal bulletin.' });
  }
  if (temperature.length) {
    const average = temperature.reduce((sum, value) => sum + value, 0) / temperature.length;
    if (average >= 35) risks.push({ id: 'heat-watch', level: 'watch', evidence: `The retrieved POWER temperature average is ${average.toFixed(1)} °C.`, limitation: 'Crop-specific heat thresholds and duration effects were not assessed.' });
  }

  const missingInformation = [
    !profile.farmSizeHa ? 'Farm size' : null,
    !profile.plantingDate ? 'Intended planting date' : null,
    !profile.waterSource ? 'Water source or rain-fed status' : null,
    !profile.soilType && !soil.length ? 'Soil test or known soil type' : null,
    'Local variety and extension guidance',
  ].filter((item): item is string => item !== null);

  return {
    location: { latitude, longitude },
    assessedAt: now.toISOString(),
    currentMonth,
    season: inMainRainfedSeason ? 'main_rainfed' : currentMonth <= 2 || currentMonth >= 10 ? 'dry_season' : 'transition',
    environmentalEvidence: {
      rainfall: { totalMm, rainyDays, observationCount: rain.length, period },
      temperature: { averageC: temperature.length ? temperature.reduce((sum, value) => sum + value, 0) / temperature.length : null, observationCount: temperature.length },
      soil: { status: soil.length ? 'available_from_gridded_estimate' : 'unavailable', observationCount: soil.length },
    },
    crops,
    risks,
    nextSteps: [
      'Confirm the local planting window and variety with Kaduna agricultural extension guidance.',
      profile.waterSource && profile.waterSource !== 'none' ? 'Confirm the reliability and access rights of the stated water source.' : 'Confirm whether the farm is rain-fed; do not assume irrigation is available.',
      'Add a soil test or verified soil profile before making fertilizer or crop-choice decisions.',
    ],
    missingInformation,
    sources: agriculturalSources,
  };
}
