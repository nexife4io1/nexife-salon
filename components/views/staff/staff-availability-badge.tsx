import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { AvailabilityState, StaffListItem } from "@/server/staff/schema";

const TONE: Record<AvailabilityState, BadgeTone> = {
  available: "success",
  on_break: "warning",
  off_shift: "neutral",
  day_off: "neutral",
  unscheduled: "neutral",
  inactive: "neutral",
};

const HEADLINE: Record<AvailabilityState, string> = {
  available: "Available",
  on_break: "On break",
  off_shift: "Off shift",
  day_off: "Day off",
  unscheduled: "No schedule",
  inactive: "Inactive",
};

/** Status chip + the derived "right now" line. Both come from persisted status/schedule, never guessed. */
export function StaffAvailabilityBadge({ availability }: { availability: StaffListItem["availability"] }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={TONE[availability.state]} dot>
        {HEADLINE[availability.state]}
      </Badge>
      <span className="text-label-sm text-secondary">{availability.label}</span>
    </div>
  );
}
