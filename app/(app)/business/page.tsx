import { redirect } from "next/navigation";

// Preserved for any external/old links pointing to /business — the canonical
// route is now /businesses (plural, top-level tab).
export default function BusinessRedirect() {
  redirect("/businesses");
}
