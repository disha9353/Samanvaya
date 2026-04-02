export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="h-56 bg-white/5" />
      <div className="p-4">
        <div className="h-4 w-3/4 bg-white/10 rounded" />
        <div className="mt-3 h-3 w-1/2 bg-white/10 rounded" />
        <div className="mt-4 h-9 w-full bg-white/10 rounded" />
      </div>
    </div>
  )
}

