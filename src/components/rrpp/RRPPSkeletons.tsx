import { Skeleton } from "@/components/ui/skeleton";

export function ContactGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-24 mt-3 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="kpi-card">
      <div className="flex items-start gap-4 flex-wrap">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="flex-1 min-w-[200px] space-y-3">
          <Skeleton className="h-7 w-64" />
          <div className="flex gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

export function TabContentSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="kpi-card space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
