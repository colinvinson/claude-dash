import TopRail from "@/components/layout/TopRail";
import BottomNav from "@/components/layout/BottomNav";
import ProactiveCheck from "@/components/layout/ProactiveCheck";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { ToastProvider } from "@/components/ui/Toast";

// Nav: TopRail is the universal header (brand + tabs + ticker + clock +
// avatar) on desktop. On mobile the tabs collapse out of the rail and
// BottomNav handles tab switching. SideNav is retired — kept in the
// repo for fallback, but not mounted.
//
// Content area: wider max-width (5xl) so the multi-column Home grid + the
// Finance asset tiles can spread out properly. Centered with px-6.

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex flex-col h-full" style={{ background: "transparent" }}>
        <TopRail />
        <ProactiveCheck />
        <PullToRefresh>
          <div
            className="max-w-6xl mx-auto px-4 lg:px-6 pt-5 space-y-5"
            style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
          >
            {children}
          </div>
        </PullToRefresh>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
