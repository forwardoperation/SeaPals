import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { PRIVATE_ROOT } from "./orders.mjs";
const flags = process.argv.slice(2),
  checks = [];
const record = (name, ready, note) => checks.push({ name, ready, note });
try {
  const config = JSON.parse(
    await readFile(path.join(PRIVATE_ROOT, "printers.json"), "utf8"),
  );
  record(
    "printer profiles confirmed",
    config.calibrationConfirmed === true,
    "Confirm the intended Letter, actual-size, single-sided printer profiles and paper. A separate alignment-check print is optional.",
  );
  try {
    await access(config.sumatraPath);
    record("PDF print helper", true);
  } catch {
    record(
      "PDF print helper",
      false,
      "Set an absolute installed SumatraPDF path.",
    );
  }
} catch {
  record(
    "printer profile",
    false,
    "Copy printer-config.example.json to .private/manufacturing/printers.json.",
  );
}
record(
  "device credential",
  Boolean(process.env.MANUFACTURING_AGENT_TOKEN),
  "Load .private/manufacturing/agent.env.",
);
record(
  "Figma read credential",
  Boolean(process.env.FIGMA_ACCESS_TOKEN),
  "Needed for unattended versioned exports, not on the Worker.",
);
try {
  const map = JSON.parse(
    await readFile(path.join(PRIVATE_ROOT, "source-map.json"), "utf8"),
  );
  record(
    "Figma source mappings",
    map.missing.length === 0,
    `${map.sources.length - map.missing.length}/${map.sources.length} mapped; ${map.missing.map((s) => s.id).join(", ")}`,
  );
} catch {
  record("Figma source mappings", false, "Run sync-figma.mjs --check.");
}
if (flags.includes("--online")) {
  const { createClient } = await import("@supabase/supabase-js");
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    record(
      "online storage",
      false,
      "Load the server environment for this read-only check.",
    );
  else {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const [schema, bucket, dispatch] = await Promise.all([
      db
        .from("manufacturing_settings")
        .select("active_release")
        .eq("id", true)
        .maybeSingle(),
      db.storage.getBucket("searealm-manufacturing-private"),
      db.from("manufacturing_orders").select("print_requested_at").limit(1),
    ]);
    record(
      "database migration",
      !schema.error,
      schema.error
        ? "Apply supabase/manufacturing.sql in the project SQL editor."
        : undefined,
    );
    record(
      "active private artwork release",
      Boolean(schema.data?.active_release),
    );
    record("private artwork bucket", bucket.data?.public === false);
    record(
      "manual print dispatch migration",
      !dispatch.error,
      dispatch.error
        ? "Apply manufacturing.sql, manufacturing-inventory.sql, then manufacturing-dispatch.sql."
        : undefined,
    );
  }
}
console.log(JSON.stringify(checks, null, 2));
if (checks.some((c) => !c.ready)) process.exitCode = 1;
