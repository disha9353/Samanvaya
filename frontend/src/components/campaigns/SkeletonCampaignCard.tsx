export default function SkeletonCampaignCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden animate-pulse">
      <div className="h-52 bg-white/10" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-2/3 bg-white/10 rounded" />
            <div className="h-3 w-1/2 bg-white/10 rounded" />
          </div>
          <div className="h-5 w-16 bg-white/10 rounded-full" />
        </div>
        <div className="h-3 w-full bg-white/10 rounded" />
        <div className="h-3 w-5/6 bg-white/10 rounded" />
        <div className="h-2 w-full bg-white/10 rounded-full" />
        <div className="flex gap-2 pt-1">
          <div className="h-8 flex-1 bg-white/10 rounded-xl" />
          <div className="h-8 flex-1 bg-white/10 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

