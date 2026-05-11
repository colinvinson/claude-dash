import { redirect } from "next/navigation";

// Overseer chat lives as a floating bubble on /home now.
export default function CoachPage() {
  redirect("/home");
}
