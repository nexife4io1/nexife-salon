import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { BranchStatus } from "@/server/branches/schema";

const STATUS: Record<BranchStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  opening_soon: { label: "Opening soon", tone: "warning" },
};

export function BranchStatusBadge({ status }: { status: BranchStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
