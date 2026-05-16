import type { Metadata } from "next";
import FinancesView from "./FinancesView";

export const metadata: Metadata = { title: "Finances" };

// Finances tab — strategy layer (not aggregation). Server shell owns
// per-route metadata; FinancesView is the client component with state.
//
// Why this exists: Sir's directive — "Business tab = make money,
// Finances tab = multiply / spend / save." ChatGPT owns the raw
// account-aggregation game (Truist + Discover + brokerage). Rowan
// owns the decision layer because it sees his businesses, goals,
// training, and life — ChatGPT doesn't.
export default function FinancesPage() {
  return <FinancesView />;
}
