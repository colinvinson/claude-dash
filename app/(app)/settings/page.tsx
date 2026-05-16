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
import { PALETTE, TINT, BORDER, TYPE } from "@/lib/design-tokens";
import pkg from "@/package.json";
import PushSubscriber from "@/components/home/PushSubscriber";

// Settings — grouped into 4 sections separated by SectionLabel so the page
// has visual rhythm rather than reading as 5 stacked editors. Each editor
// retains its own in-card "— X" label; the SectionLabel above sets the
// group context.

export default function SettingsPage() {
  const { signOut } = useSettings();

  return (
    <div className="space-y-3">
      <SectionLabel>Profile</SectionLabel>
      <ProfileEditor />

      <div className="pt-4"><SectionLabel>Training setup</SectionLabel></div>
      <SupplementStackEditor />
      <ExerciseLibraryEditor />
      <GymEditor />

      <div className="pt-4"><SectionLabel>Goal templates</SectionLabel></div>
      <GoalTemplatesEditor />

      <div className="pt-4"><SectionLabel>Notifications</SectionLabel></div>
      <PushSubscriber />

      <div className="pt-4"><SectionLabel>Account</SectionLabel></div>
      <Card style={{ background: TINT.danger, border: `1px solid ${BORDER.danger}` }}>
        <button
          onClick={signOut}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          style={{ color: PALETTE.danger, background: "transparent" }}
        >
          <LogOut size={14} />
          Sign out
        </button>
        <p className="text-[10px] text-zinc-600 text-center mt-2">
          You&apos;ll need to enter your 4-digit passcode again.
        </p>
      </Card>

      <div className="pt-4"><SectionLabel>About</SectionLabel></div>
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-800">
            <span className="text-lg font-bold text-zinc-100" style={{ letterSpacing: "-0.04em" }}>R</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-zinc-100">Rowan</div>
            <div className={TYPE.label}>v{pkg.version} · personal performance dashboard</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
