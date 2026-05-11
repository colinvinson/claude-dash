// Shown while any (app)/* route's data is loading. The shell (TopHeader + BottomNav)
// stays mounted around this, so the user sees a stable frame with skeleton content
// rather than a blank page flash.

export default function AppLoading() {
  return (
    <div className="space-y-4">
      <Skeleton h={64} />
      <Skeleton h={56} />
      <div className="grid grid-cols-4 gap-2">
        <Skeleton h={28} />
        <Skeleton h={28} />
        <Skeleton h={28} />
        <Skeleton h={28} />
      </div>
      <Skeleton h={120} />
      <Skeleton h={180} />
      <Skeleton h={96} />
    </div>
  );
}

function Skeleton({ h }: { h: number }) {
  return (
    <div
      className="shimmer"
      style={{
        height: h,
        border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 16,
      }}
    />
  );
}
