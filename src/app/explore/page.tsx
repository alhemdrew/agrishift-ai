import type { Metadata } from "next";
import { ExploreClient } from "@/components/explore/explore-client";

export const metadata: Metadata = {
  title: "Explorer | AgriShift",
  description: "Explore recent weather and satellite imagery for any place on Earth. No account needed.",
};

export default function ExplorePage() {
  return <ExploreClient />;
}
