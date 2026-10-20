import { Skeleton } from "@/components/ui/skeleton";

export default function PlatformLoading() {
  return (
    <div role="status" aria-label="Loading tenants">
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-5 w-80 max-w-full" />
      <Skeleton className="mb-8 h-10 w-full max-w-md rounded-full" />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  );
}
