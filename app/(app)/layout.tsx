import TopHeader from "@/components/layout/TopHeader";
import BottomNav from "@/components/layout/BottomNav";
import SideNav  from "@/components/layout/SideNav";
import ProactiveCheck from "@/components/layout/ProactiveCheck";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { ToastProvider } from "@/components/ui/Toast";

// Responsive nav: SideNav is the left rail on lg+ (≥1024px); BottomNav
// is the floating pill on smaller screens. Each component self-hides on
// the opposite breakpoint. The main content area gets a left padding
// on desktop equal to the SideNav width so it doesn't slide under the
// rail.

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SideNav />
      <div className="flex flex-col h-full lg:pl-[92px]" style={{ background: "transparent" }}>
        <TopHeader />
        <ProactiveCheck />
        <PullToRefresh>
          <div
            className="max-w-2xl mx-auto px-4 pt-4 space-y-5"
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
