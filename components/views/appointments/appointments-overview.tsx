import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import type { Appointment } from "@/server/appointments/schema";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const FILTER_LABELS = ["All", "Booked", "Checked in", "In service", "Completed"];

function toLabel(value: string) {
  return value.replaceAll("_", " ");
}

function toneForStatus(status: Appointment["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "error" as const;
  return "neutral" as const;
}

const APPOINTMENT_COLUMNS: TableColumn<Appointment>[] = [
  {
    key: "time",
    header: "Time",
    cellClassName: "font-semibold text-on-surface",
    renderCell: (appointment) => timeFmt.format(appointment.startsAt),
  },
  {
    key: "client",
    header: "Client",
    renderCell: (appointment) => appointment.customerName ?? "Walk-in",
  },
  {
    key: "service",
    header: "Service",
    cellClassName: "text-secondary",
    renderCell: (appointment) => appointment.serviceName ?? "-",
  },
  {
    key: "stylist",
    header: "Stylist",
    cellClassName: "text-secondary",
    renderCell: (appointment) => appointment.staffName ?? "Unassigned",
  },
  {
    key: "type",
    header: "Type",
    cellClassName: "text-secondary capitalize",
    renderCell: (appointment) => toLabel(appointment.type),
  },
  {
    key: "status",
    header: "Status",
    renderCell: (appointment) => <Badge tone={toneForStatus(appointment.status)}>{toLabel(appointment.status)}</Badge>,
  },
];

export function AppointmentsOverview({ appointments }: { appointments: Appointment[] }) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTER_LABELS.map((label, index) => (
          <Badge key={label} tone={index === 0 ? "gold" : "neutral"}>
            {label}
          </Badge>
        ))}
      </div>

      <TableShell
        columns={APPOINTMENT_COLUMNS}
        rows={appointments}
        rowKey={(appointment) => appointment.id}
        empty={<EmptyState icon="calendar" title="No appointments today" description="Bookings for today will be listed here." />}
      />
    </>
  );
}
