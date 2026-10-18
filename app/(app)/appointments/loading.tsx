import { Skeleton } from "@/components/ui/skeleton";

export default function AppointmentsLoading() {
  return (
    <div role="status" aria-label="Loading appointments">
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-5 w-96 max-w-full" />
      <Skeleton className="mb-4 h-20" />
      <Skeleton className="mb-6 h-12" />
      <div className="flex gap-6 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-[19rem] shrink-0 space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ))}
      </div>
    </div>
  );
}
