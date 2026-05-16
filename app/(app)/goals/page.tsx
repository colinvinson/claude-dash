import { redirect } from "next/navigation";

// Goals split into /life + /businesses top-level tabs. This route preserves
// any old links — /goals → /life by default, /goals?tab=business → /businesses.
// Next 16: searchParams is async, hence the await.
export default async function GoalsRedirect({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  redirect(params.tab === "business" ? "/businesses" : "/life");
}
