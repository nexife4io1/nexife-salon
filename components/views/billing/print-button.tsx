"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" icon="receipt" onClick={() => window.print()}>
      Print receipt
    </Button>
  );
}
