export interface MapLayerConfig {
  id: string;
  sourceId: 'base' | 'gpm' | 'smap' | 'modis' | 'firms';
  label: string;
  productId: string;
  description: string;
  unit: string;
  temporalResolution: string;
  spatialResolution: string;
  gibsLayerId: string;
  visibleByDefault: boolean;
  attribution: string;
}

export const GIBS_CAPABILITIES_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml';

export const GIBS_WMS_ENDPOINT = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';

export const mapLayerConfigs: MapLayerConfig[] = [
  {
    id: 'base',
    sourceId: 'base',
    label: 'NASA satellite imagery',
    productId: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    description: 'Terra MODIS daily corrected-reflectance true-color browse imagery.',
    unit: 'RGB reflectance composite; not a quantitative index',
    temporalResolution: 'Daily imagery',
    spatialResolution: 'GIBS tile imagery up to 250 m',
    gibsLayerId: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    visibleByDefault: true,
    attribution: 'NASA EOSDIS Global Imagery Browse Services (GIBS); MODIS/Terra',
  },
  {
    id: 'gpm-rain-rate',
    sourceId: 'gpm',
    label: 'Precipitation rate',
    productId: 'NASA GIBS IMERG 30-minute browse visualization',
    description: 'NASA GPM IMERG half-hour precipitation-rate map layer.',
    unit: 'mm/hr',
    temporalResolution: '30-minute observation',
    spatialResolution: '0.1 degree native grid; GIBS display tiles reprojected to Web Mercator',
    gibsLayerId: 'IMERG_Precipitation_Rate_30min',
    visibleByDefault: true,
    attribution: 'NASA GPM IMERG; NASA EOSDIS GIBS',
  },
  {
    id: 'smap-surface',
    sourceId: 'smap',
    label: 'Surface soil moisture',
    productId: 'SPL4SMGP.008',
    description: 'SMAP L4 analyzed surface soil moisture, top 0-5 cm.',
    unit: 'm^3/m^3',
    temporalResolution: '12z instantaneous browse field',
    spatialResolution: '9 km EASE-Grid 2.0 native product',
    gibsLayerId: 'SMAP_L4_Analyzed_Surface_Soil_Moisture',
    visibleByDefault: false,
    attribution: 'NASA SMAP L4; NSIDC DAAC; NASA EOSDIS GIBS',
  },
  {
    id: 'smap-rootzone',
    sourceId: 'smap',
    label: 'Root-zone soil moisture',
    productId: 'SPL4SMGP.008',
    description: 'SMAP L4 analyzed root-zone soil moisture, 0-100 cm.',
    unit: 'm^3/m^3',
    temporalResolution: '12z instantaneous browse field',
    spatialResolution: '9 km EASE-Grid 2.0 native product',
    gibsLayerId: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture',
    visibleByDefault: false,
    attribution: 'NASA SMAP L4; NSIDC DAAC; NASA EOSDIS GIBS',
  },
  {
    id: 'modis-ndvi',
    sourceId: 'modis',
    label: 'NDVI',
    productId: 'MOD13Q1.061 / GIBS MODIS Terra NDVI',
    description: 'Terra MODIS 16-day normalized difference vegetation index browse layer.',
    unit: 'unitless index; MOD13Q1 scale factor 0.0001',
    temporalResolution: '16-day composite',
    spatialResolution: '250 m native product',
    gibsLayerId: 'MODIS_Terra_L3_NDVI_16Day',
    visibleByDefault: true,
    attribution: 'NASA MODIS/Terra; LP DAAC; NASA EOSDIS GIBS',
  },
  {
    id: 'modis-evi',
    sourceId: 'modis',
    label: 'EVI',
    productId: 'MOD13Q1.061 / GIBS MODIS Terra EVI',
    description: 'Terra MODIS 16-day enhanced vegetation index browse layer.',
    unit: 'unitless index; MOD13Q1 scale factor 0.0001',
    temporalResolution: '16-day composite',
    spatialResolution: '250 m native product',
    gibsLayerId: 'MODIS_Terra_L3_EVI_16Day',
    visibleByDefault: false,
    attribution: 'NASA MODIS/Terra; LP DAAC; NASA EOSDIS GIBS',
  },
  {
    id: 'firms-fire',
    sourceId: 'firms',
    label: 'Active fires and thermal anomalies',
    productId: 'VIIRS_NOAA21_NRT browse visualization',
    description: 'NOAA-21 VIIRS 375 m active fire and thermal anomaly browse layer.',
    unit: 'Active detection locations; not a continuous temperature surface',
    temporalResolution: 'Near real-time daily browse product',
    spatialResolution: '375 m VIIRS I-band nominal footprint',
    gibsLayerId: 'VIIRS_NOAA21_Thermal_Anomalies_375m_All',
    visibleByDefault: false,
    attribution: 'NASA FIRMS, part of LANCE and ESDIS; NOAA-21 VIIRS; NASA EOSDIS GIBS',
  },
];