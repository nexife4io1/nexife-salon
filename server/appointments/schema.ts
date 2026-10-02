import { z } from "zod";

export const appointmentStatusSchema = z.enum(["booked", "checked_in", "in_service", "completed", "cancelled", "no_show"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  customerName: z.string().nullable(),
  serviceName: z.string().nullable(),
  staffName: z.string().nullable(),
  startsAt: z.date(),
  type: z.enum(["booking", "walk_in"]),
  status: appointmentStatusSchema,
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const bookAppointmentInputSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  startsAt: z.coerce.date(),
  type: z.enum(["booking", "walk_in"]).default("booking"),
  notes: z.string().max(500).optional(),
});
export type BookAppointmentInput = z.infer<typeof bookAppointmentInputSchema>;
