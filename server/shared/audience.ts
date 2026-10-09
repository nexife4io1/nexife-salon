import { z } from "zod";

/** Who a service is for. Mirrors the `service_audience` enum in db/schema/operations.ts. */
export const SERVICE_AUDIENCES = ["unisex", "women", "men", "kids"] as const;
export const serviceAudienceSchema = z.enum(SERVICE_AUDIENCES);
export type ServiceAudience = z.infer<typeof serviceAudienceSchema>;

export const AUDIENCE_LABELS: Record<ServiceAudience, string> = {
  unisex: "Unisex",
  women: "Women",
  men: "Men",
  kids: "Kids",
};
