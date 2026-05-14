"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function DataRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab");

  useEffect(() => {
    if (tab === "fitness") router.replace("/gym");
    else if (tab === "finances") router.replace("/goals?tab=business");
    else router.replace("/schedule");
  }, [tab, router]);

  return null;
}

export default function DataPage() {
  return (
    <Suspense>
      <DataRedirect />
    </Suspense>
  );
}
