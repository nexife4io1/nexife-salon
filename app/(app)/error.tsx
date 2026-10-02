"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Card>
      <EmptyState
        icon="help"
        title="Something went wrong"
        description={error.digest ? `Reference: ${error.digest}` : "Please try again in a moment."}
        action={
          <Button variant="secondary" onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </Card>
  );
}
