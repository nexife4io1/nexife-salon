"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppointmentsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Card>
      <EmptyState
        icon="calendar"
        title="Appointments unavailable"
        description={error.digest ? `We couldn't load the schedule. Reference: ${error.digest}` : "We couldn't load the schedule. Please try again in a moment."}
        action={
          <Button variant="secondary" onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </Card>
  );
}
