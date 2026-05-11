"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { Settings as SettingsIcon, ArrowRight } from "lucide-react";

export default function WelcomeCard() {
  const supabase = createClient();
  const [isEmpty, setIsEmpty] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [stack, exercises, weight] = await Promise.all([
        supabase.from("supplement_stack").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
        supabase.from("exercises").select("id").eq("user_id", user.id).limit(1),
        supabase.from("weight_logs").select("id").eq("user_id", user.id).limit(1),
      ]);
      const empty = (stack.data?.length ?? 0) === 0
                 && (exercises.data?.length ?? 0) === 0
                 && (weight.data?.length ?? 0) === 0;
      setIsEmpty(empty);
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isEmpty) return null;

  return (
    <Link href="/settings">
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
            <SettingsIcon size={18} className="text-zinc-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100">Welcome to Rowan</p>
            <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
              Set up your supplements, exercises, and weight to unlock coaching.
            </p>
          </div>
          <ArrowRight size={16} className="text-zinc-500 shrink-0" />
        </div>
      </Card>
    </Link>
  );
}
