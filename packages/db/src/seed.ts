/**
 * Seed script — run with: npm run db:seed -w @repo/db
 *
 * Requires DATABASE_URL env var pointing to a running Postgres instance.
 * Example: DATABASE_URL=postgres://localhost:5432/realestate_dev npm run db:seed -w @repo/db
 */
import { getDb, closeDb, schema } from "./index";

async function seed() {
  const db = getDb();

  console.log("Seeding tenants...");
  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      name: "Acme Realty",
      slug: "acme-realty",
    })
    .returning();

  console.log(`Created tenant: ${tenant.id} (${tenant.slug})`);

  console.log("Seeding deals...");
  const [deal] = await db
    .insert(schema.deals)
    .values({
      tenantId: tenant.id,
      title: "123 Main St — Buyer Representation",
      contactName: "Jane Smith",
      contactEmail: "jane.smith@example.com",
      value: "425000",
      stage: "qualified",
    })
    .returning();

  console.log(`Created deal: ${deal.id} (${deal.title})`);

  console.log("Seeding activities...");
  await db.insert(schema.activities).values({
    tenantId: tenant.id,
    dealId: deal.id,
    type: "deal_created",
    metadata: { source: "seed" },
  });

  console.log("Seed complete.");
  await closeDb();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
