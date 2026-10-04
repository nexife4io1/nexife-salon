import "server-only";
import * as repo from "./repository";
import { customerSearchSchema, type CustomerSearch } from "./schema";

export function searchCustomers(tenantId: string, params: Partial<CustomerSearch> = {}) {
  return repo.search(tenantId, customerSearchSchema.parse(params));
}

// TODO(step 5): createCustomer() with phone de-duplication, customer profile + visit history.
