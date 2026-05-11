import TopHeader from "@/components/layout/TopHeader";
import BottomNav from "@/components/layout/BottomNav";
import ProactiveCheck from "@/components/layout/ProactiveCheck";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { ToastProvider } from "@/components/ui/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex flex-col h-full" style={{ background: "transparent" }}>
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
