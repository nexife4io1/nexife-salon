import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-3 h-10 w-56" />
      <Skeleton className="mb-10 h-5 w-96 max-w-full" />
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 rounded-card" />
        ))}
      </div>
    </div>
  );
}
