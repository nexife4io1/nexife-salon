import { z } from "zod";

export const inventoryItemSchema = z.object({
  id: z.string(),
  sku: z.string().nullable(),
  name: z.string(),
  unit: z.string(),
  reorderLevel: z.number().int(),
  onHand: z.number().int(),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const stockMovementReasonSchema = z.enum(["purchase", "sale", "service_use", "adjustment", "transfer"]);

export const recordStockMovementInputSchema = z.object({
  itemId: z.string().uuid(),
  quantityDelta: z.coerce.number().int().refine((n) => n !== 0, "Quantity can't be zero"),
  reason: stockMovementReasonSchema,
  note: z.string().max(200).optional(),
});
export type RecordStockMovementInput = z.infer<typeof recordStockMovementInputSchema>;
