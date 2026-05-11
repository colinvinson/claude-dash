"use client";

import { useSettings } from "@/hooks/useSettings";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/layout/SectionLabel";
import ProfileEditor from "@/components/settings/ProfileEditor";
import SupplementStackEditor from "@/components/settings/SupplementStackEditor";
import ExerciseLibraryEditor from "@/components/settings/ExerciseLibraryEditor";
import GymEditor from "@/components/settings/GymEditor";
import GoalTemplatesEditor from "@/components/settings/GoalTemplatesEditor";
import { LogOut } from "lucide-react";

export default function SettingsPage() {
  const { signOut } = useSettings();

  return (
    <div className="space-y-4">
      <SectionLabel>Settings</SectionLabel>

      <ProfileEditor />
      <SupplementStackEditor />
      <ExerciseLibraryEditor />
      <GymEditor />
      <GoalTemplatesEditor />

      <Card>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Account</span>
        <button
          onClick={signOut}
          className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-sm font-semibold text-red-300 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={14} />
          Sign out
        </button>
        <p className="text-[10px] text-zinc-600 text-center mt-2">
          You&apos;ll need to enter your 4-digit passcode again.
        </p>
      </Card>
    </div>
  );
}
