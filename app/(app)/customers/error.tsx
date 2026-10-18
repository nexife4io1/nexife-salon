"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function CustomersError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Card>
      <EmptyState
        icon="users"
        title="Customers unavailable"
        description={error.digest ? `We couldn't load customers. Reference: ${error.digest}` : "We couldn't load customers. Please try again in a moment."}
        action={
          <Button variant="secondary" onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </Card>
  );
}
