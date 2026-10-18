import "server-only";
import { AppError } from "@/server/shared/errors";
import * as repo from "./repository";
import type { CustomerWrite } from "./repository";
import {
  CUSTOMERS_PAGE_SIZE,
  customerSearchSchema,
  type CustomerDirectory,
  type CustomerFilters,
  type CustomerInput,
  type CustomerProfile,
  type CustomerSearch,
} from "./schema";

/** Public customer API for other domains (appointments uses this to offer customers in the booking form). */
export function searchCustomers(tenantId: string, params: Partial<CustomerSearch> = {}) {
  const { q, sort, page, limit } = customerSearchSchema.parse(params);
  return repo.search(tenantId, { q, sort, limit, offset: (page - 1) * limit });
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getDirectory(tenantId: string, filters: CustomerFilters, now = new Date()): Promise<CustomerDirectory> {
  const offsetFor = (page: number) => (page - 1) * CUSTOMERS_PAGE_SIZE;
  const [stats, first] = await Promise.all([
    repo.stats(tenantId, startOfUtcMonth(now)),
    repo.list(tenantId, { q: filters.q, sort: filters.sort, limit: CUSTOMERS_PAGE_SIZE, offset: offsetFor(filters.page) }),
  ]);
  const pageCount = Math.max(1, Math.ceil(first.matching / CUSTOMERS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  // A stale link past the last page (e.g. after deletions) shows the last page instead of an empty one.
  const { rows } =
    page === filters.page
      ? first
      : await repo.list(tenantId, { q: filters.q, sort: filters.sort, limit: CUSTOMERS_PAGE_SIZE, offset: offsetFor(page) });
  return {
    customers: rows,
    stats,
    matching: first.matching,
    page,
    pageCount,
    pageSize: CUSTOMERS_PAGE_SIZE,
    source: repo.dataSource(),
    filtered: Boolean(filters.q),
  };
}

export async function getProfile(tenantId: string, customerId: string): Promise<CustomerProfile> {
  const profile = await repo.findById(tenantId, customerId);
  if (!profile) throw new AppError("NOT_FOUND", "Customer not found.");
  return profile;
}

function toWrite(input: CustomerInput): CustomerWrite {
  return {
    name: input.name,
    phone: input.phone.phone,
    phoneKey: input.phone.key,
    email: input.email ?? null,
    birthday: input.birthday ?? null,
    gender: input.gender ?? null,
    notes: input.notes ?? null,
  };
}

const duplicatePhone = () =>
  new AppError("VALIDATION", "Please fix the highlighted fields.", { phone: ["A customer with this phone number already exists"] });

export async function createCustomer(tenantId: string, input: CustomerInput): Promise<{ id: string }> {
  const result = await repo.insert(tenantId, toWrite(input));
  if (!result.ok) throw duplicatePhone();
  return { id: result.id };
}

export async function updateCustomer(tenantId: string, customerId: string, input: CustomerInput): Promise<{ id: string }> {
  const result = await repo.update(tenantId, customerId, toWrite(input));
  if (result.ok) return { id: result.id };
  if (result.reason === "duplicate_phone") throw duplicatePhone();
  throw new AppError("NOT_FOUND", "Customer not found.");
}

export function dataSource() {
  return repo.dataSource();
}
