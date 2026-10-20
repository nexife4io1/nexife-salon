"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodType } from "zod";
import { getPlatformAdmin, getTenantContext } from "@/server/shared/context";
import { notImplemented, AppError, validationError } from "@/server/shared/errors";
import { ok, toActionError, type ActionResult } from "@/server/shared/result";
import {
  addTenantServicesInputSchema,
  createServiceTemplateInputSchema,
  onboardTenantInputSchema,
  setServiceTemplateActiveInputSchema,
  updateServiceTemplateInputSchema,
  updateTenantServiceInputSchema,
} from "./schema";
import * as service from "./service";

/** Placeholder entry point for Users & Access → "Invite user". Wire in step 10. */
export async function inviteUserAction(_prev: ActionResult | undefined, _formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("users");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to manage users."));
  return toActionError(notImplemented("Inviting users"));
}

// ---------------------------------------------------------------------------
// Platform administration — every action checks for a platform admin first.
// ---------------------------------------------------------------------------

const forbidden = () => toActionError(new AppError("FORBIDDEN", "Only platform admins can manage tenants."));

/** Form field "owner.username" → { owner: { username } }. Plain keys stay top-level. */
function nestFormData(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const path = key.split(".");
    let node = out;
    for (const part of path.slice(0, -1)) node = (node[part] ??= {}) as Record<string, unknown>;
    node[path[path.length - 1]!] = value;
  }
  return out;
}

/** Parse a JSON string; malformed JSON becomes null so zod reports it as a validation error, not a 500. */
function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** The `services` hidden field carries a JSON array. */
function withServices(raw: Record<string, unknown>): Record<string, unknown> {
  return "services" in raw ? { ...raw, services: parseJson(raw.services) } : raw;
}

const numberField = (value: FormDataEntryValue | null) => (typeof value === "string" && value.trim() !== "" ? Number(value) : undefined);
const booleanField = (value: FormDataEntryValue | null) => value === "true";

/** Run a platform-admin form action: authz → zod → service. Resolves to the parsed-then-handled result. */
async function runPlatformAction<T>(
  schema: ZodType<T>,
  raw: (formData: FormData) => unknown,
  formData: FormData,
  handler: (input: T) => Promise<void>,
  revalidate: () => void,
): Promise<ActionResult> {
  if (!(await getPlatformAdmin())) return forbidden();
  const parsed = schema.safeParse(raw(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  try {
    await handler(parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  revalidate();
  return ok(undefined);
}

/** Onboard a tenant (tenant + owner + branch + services), then redirect to its detail page. */
export async function onboardTenantAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  if (!(await getPlatformAdmin())) return forbidden();

  const raw = withServices(nestFormData(formData));
  const branch = raw.branch as Record<string, unknown> | undefined;
  if (branch) branch.offeredTemplateIds = parseJson(branch.offeredTemplateIds ?? "[]");
  const parsed = onboardTenantInputSchema.safeParse(raw);
  if (!parsed.success) return toActionError(validationError(parsed.error));

  let tenantId: string;
  try {
    tenantId = await service.onboardTenant(parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/platform");
  redirect(`/platform/${tenantId}`); // outside try: redirect() works by throwing
}

export async function addTenantServicesAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runPlatformAction(
    addTenantServicesInputSchema,
    (fd) => withServices({ tenantId: fd.get("tenantId"), services: fd.get("services") }),
    formData,
    (input) => service.addTenantServices(input),
    () => {
      revalidatePath("/platform");
      revalidatePath("/platform/[tenantId]", "page");
    },
  );
}

export async function updateTenantServiceAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runPlatformAction(
    updateTenantServiceInputSchema,
    (fd) => ({
      tenantId: fd.get("tenantId"),
      serviceId: fd.get("serviceId"),
      priceCents: numberField(fd.get("priceCents")),
      durationMinutes: numberField(fd.get("durationMinutes")),
      active: booleanField(fd.get("active")),
    }),
    formData,
    async (input) => void (await service.updateTenantService(input)),
    () => revalidatePath("/platform/[tenantId]", "page"),
  );
}

const refreshCatalog = () => {
  revalidatePath("/platform/services");
  revalidatePath("/platform/new");
  revalidatePath("/platform/[tenantId]", "page");
};

export async function createServiceTemplateAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runPlatformAction(
    createServiceTemplateInputSchema,
    (fd) => ({
      name: fd.get("name"),
      category: fd.get("category") ?? undefined,
      audience: fd.get("audience") ?? undefined,
      defaultDurationMinutes: numberField(fd.get("defaultDurationMinutes")),
      defaultPriceCents: numberField(fd.get("defaultPriceCents")),
    }),
    formData,
    async (input) => void (await service.createServiceTemplate(input)),
    refreshCatalog,
  );
}

export async function updateServiceTemplateAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runPlatformAction(
    updateServiceTemplateInputSchema,
    (fd) => ({
      id: fd.get("id"),
      name: fd.get("name"),
      category: fd.get("category") ?? undefined,
      audience: fd.get("audience") ?? undefined,
      defaultDurationMinutes: numberField(fd.get("defaultDurationMinutes")),
      defaultPriceCents: numberField(fd.get("defaultPriceCents")),
    }),
    formData,
    async (input) => void (await service.updateServiceTemplate(input)),
    refreshCatalog,
  );
}

export async function toggleServiceTemplateAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runPlatformAction(
    setServiceTemplateActiveInputSchema,
    (fd) => ({ id: fd.get("id"), active: booleanField(fd.get("active")) }),
    formData,
    async (input) => void (await service.setServiceTemplateActive(input.id, input.active)),
    refreshCatalog,
  );
}
