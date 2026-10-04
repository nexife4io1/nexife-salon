import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatMoney, pluralize } from "@/lib/format";
import type { BranchOverview } from "@/server/branches/schema";
import { BranchStatusBadge } from "./branch-status-badge";

/** One location card — mirrors the Branch Card in Materials/code.html. */
export function BranchCard({ branch, currency }: { branch: BranchOverview; currency: string }) {
  const facts: Array<{ icon: IconName; text: string }> = [
    { icon: "map-pin", text: branch.addressLine },
    { icon: "user", text: pluralize(branch.staffCount, "Staff", "Staff") },
    { icon: "calendar", text: `${pluralize(branch.appointmentsToday, "Appointment")} Today` },
    { icon: "banknote", text: `${formatMoney(branch.revenueTodayCents, currency)} Today` },
  ];

  return (
    <Card interactive className="flex h-full flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h3 className="font-headline text-headline-md font-semibold text-on-surface">{branch.name}</h3>
        <BranchStatusBadge status={branch.status} />
      </div>

      <ul className="flex-1 space-y-4">
        {facts.map((fact) => (
          <li key={fact.icon} className="flex items-center gap-3 text-secondary">
            <Icon name={fact.icon} size={20} className="shrink-0" />
            <span className="text-body-sm">{fact.text}</span>
          </li>
        ))}
      </ul>

      <ButtonLink href={`/branches/${branch.id}`} variant="secondary" size="sm" fullWidth trailingIcon="arrow-right" className="mt-6 h-10">
        View Branch Details
      </ButtonLink>
    </Card>
  );
}
