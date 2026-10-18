import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <div role="status" aria-label="Loading billing">
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-5 w-96 max-w-full" />
      <Skeleton className="mb-6 h-28" />
      <Skeleton className="h-64" />
    </div>
  );
}
