import "server-only";
import * as repo from "./repository";

/** Public staff API for other domains (e.g. branches uses countActiveByBranch). */

export function countActiveByBranch(tenantId: string) {
  return repo.countActiveByBranch(tenantId);
}

export function listStaff(tenantId: string) {
  return repo.listStaff(tenantId);
}

export function listServices(tenantId: string) {
  return repo.listServices(tenantId);
}

// TODO(step 4): createStaff(), assignToBranch(), working hours; service catalog CRUD.
