import type { Metadata } from "next";
import BusinessesView from "./BusinessesView";

export const metadata: Metadata = { title: "Businesses" };

// Businesses portfolio hub — server shell that owns the per-route
// metadata + delegates render to a client component (interactive state
// lives in BusinessesView).
export default function BusinessesPage() {
  return <BusinessesView />;
}
