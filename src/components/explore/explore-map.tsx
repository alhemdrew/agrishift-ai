"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  selected: { lat: number; lon: number } | null;
  focus: { lat: number; lon: number; nonce: number } | null; // set by search: fly the map there
  onSelect: (lat: number, lon: number) => void;
};

// NASA GIBS serves daily satellite imagery with no key. Imagery for the most recent days can
// be incomplete, so we ask for a date a few days back.
function gibsDate() {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString().slice(0, 10);
}

export default function ExploreMap({ selected, focus, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      worldCopyJump: true,
    });

    L.tileLayer(
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      {
        maxNativeZoom: 9,
        maxZoom: 9,
        attribution: "Imagery © NASA GIBS (MODIS Terra)",
      },
    ).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onSelectRef.current(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Move the map when a place is searched for
  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.flyTo([focus.lat, focus.lon], 7, { duration: 1.2 });
  }, [focus]);

  // Show a marker for the selected point
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (selected) {
      markerRef.current = L.circleMarker([selected.lat, selected.lon], {
        radius: 9,
        color: "#f59e0b",
        weight: 3,
        fillColor: "#0f3a2b",
        fillOpacity: 0.9,
      }).addTo(map);
    }
  }, [selected]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-2xl sm:h-[520px]" aria-label="Interactive satellite map" />;
}
