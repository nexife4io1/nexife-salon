import { Badge } from "@/components/ui/badge";

/** Shown when a page is rendering read-only fixtures because no DATABASE_URL is set. */
export function DemoDataBadge({ source }: { source: "database" | "demo" }) {
  if (source !== "demo") return null;
  return (
    <Badge tone="gold" dot>
      Demo data
    </Badge>
  );
}
