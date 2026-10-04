import { Skeleton } from "@/components/ui/skeleton";

export default function BranchesLoading() {
  return (
    <div role="status" aria-label="Loading branches">
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-5 w-80 max-w-full" />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  );
}
