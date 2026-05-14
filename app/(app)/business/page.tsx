import { redirect } from "next/navigation";
export default function BusinessRedirect() {
  redirect("/goals?tab=business");
}
