import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div role="status" aria-label="Loading customers">
      <Skeleton className="mb-3 h-9 w-48" />
      <Skeleton className="mb-8 h-5 w-80 max-w-full" />
      <div className="mb-8 grid gap-gutter sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="mb-6 h-16" />
      <Skeleton className="h-80" />
    </div>
  );
}
