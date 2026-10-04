"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentsOverview } from "@/components/views/appointments/appointments-overview";
import { fetchJson } from "@/components/views/shared/fetch-json";
import { queryKeys } from "@/components/views/shared/query-keys";
import type { Appointment } from "@/server/appointments/schema";

type AppointmentResponse = Omit<Appointment, "startsAt"> & { startsAt: string };

async function loadTodaysAppointments() {
  return fetchJson<AppointmentResponse[]>("/api/appointments/today");
}

function toAppointments(rows: AppointmentResponse[]): Appointment[] {
  return rows.map((row) => ({
    ...row,
    startsAt: new Date(row.startsAt),
  }));
}

export function Appointments() {
  const { data, error, isPending } = useQuery({
    queryKey: queryKeys.appointmentsToday,
    queryFn: loadTodaysAppointments,
  });

  if (isPending) {
    return (
      <div className="space-y-3 rounded-card border border-outline-variant/20 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <EmptyState
          icon="calendar"
          title="Appointments unavailable"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      </Card>
    );
  }

  return <AppointmentsOverview appointments={toAppointments(data ?? [])} />;
}
