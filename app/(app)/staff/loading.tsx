import { Skeleton } from "@/components/ui/skeleton";

export default function StaffLoading() {
  return (
    <div role="status" aria-label="Loading staff">
      <Skeleton className="mb-3 h-9 w-40" />
      <Skeleton className="mb-8 h-5 w-80 max-w-full" />
      <Skeleton className="mb-6 h-16" />
      <Skeleton className="h-80" />
    </div>
  );
}
