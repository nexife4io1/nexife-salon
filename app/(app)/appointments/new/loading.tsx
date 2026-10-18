import { Skeleton } from "@/components/ui/skeleton";

export default function NewAppointmentLoading() {
  return (
    <div role="status" aria-label="Loading booking form" className="mx-auto max-w-5xl">
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-5 w-96 max-w-full" />
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-72" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-80 lg:col-span-4" />
      </div>
    </div>
  );
}
