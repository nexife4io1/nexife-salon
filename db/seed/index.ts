/**
 * Seed a local / staging database with the demo fixtures.
 *
 *   npm run db:migrate && npm run db:seed
 *
 * Idempotent: rows use fixed ids and `on conflict do nothing`.
 * TODO(step 6+): seed sample customers, appointments and payments so the
 * Branches/Dashboard metrics are non-zero in database mode too.
 */
import { hashPassword } from "../../lib/password";
import { getDb, isDatabaseConfigured } from "../client";
import { branches, services, staff, tenants, users } from "../schema";
import {
  demoPassword,
  fixtureBranchActivity,
  fixtureBranches,
  fixtureServices,
  fixtureTenants,
  fixtureUsers,
} from "./fixtures";

const STAFF_FIRST_NAMES = ["Ava", "Liam", "Zoe", "Noah", "Iris", "Leo", "Nina", "Kai", "Ruby", "Eli", "Mila", "Theo", "Luca", "Jade", "Owen"];

async function main() {
  if (!isDatabaseConfigured()) {
    console.error("DATABASE_URL is not set — nothing to seed. See .env.example.");
    process.exit(1);
  }
  const db = getDb();
  const passwordHash = await hashPassword(demoPassword());

  await db.transaction(async (tx) => {
    await tx.insert(tenants).values([...fixtureTenants]).onConflictDoNothing();
    await tx.insert(branches).values([...fixtureBranches]).onConflictDoNothing();
    await tx
      .insert(users)
      .values(fixtureUsers.map((u) => ({ ...u, passwordHash })))
      .onConflictDoNothing();
    await tx.insert(services).values([...fixtureServices]).onConflictDoNothing();

    const staffRows = fixtureBranches.flatMap((branch, branchIndex) => {
      const count = fixtureBranchActivity[branch.id]?.staffCount ?? 0;
      return Array.from({ length: count }, (_, i) => {
        const name = `${STAFF_FIRST_NAMES[i % STAFF_FIRST_NAMES.length]} ${branch.name.split(" ")[0]}`;
        return {
          // Deterministic ids keep the seed idempotent: 5eed0000-…-<branch:4><staff:8>
          id: `5eed0000-0000-4000-8000-${String(branchIndex).padStart(4, "0")}${String(i).padStart(8, "0")}`,
          tenantId: branch.tenantId,
          branchId: branch.id,
          name,
          initials: name.split(" ").map((p) => p[0]).join(""),
          title: i === 0 ? "Creative Director" : "Stylist",
        };
      });
    });
    await tx.insert(staff).values(staffRows).onConflictDoNothing();
  });

  console.log(`Seeded ${fixtureTenants.length} tenants, ${fixtureBranches.length} branches, ${fixtureUsers.length} users.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
