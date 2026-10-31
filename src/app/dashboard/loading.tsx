export default function Loading() {
  return (
    <div className="min-h-screen">
      <div className="h-[49px] border-b border-border bg-canvas-inset" />
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="skeleton h-40" />
          <div className="skeleton h-24" />
        </div>
        <div className="space-y-3">
          <div className="skeleton h-9 w-full" />
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[76px]" />)}
        </div>
      </div>
    </div>
  );
}
