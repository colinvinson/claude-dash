import TopHeader from "@/components/layout/TopHeader";
import BottomNav from "@/components/layout/BottomNav";
import ProactiveCheck from "@/components/layout/ProactiveCheck";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "transparent" }}>
      <TopHeader />
      <ProactiveCheck />
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
