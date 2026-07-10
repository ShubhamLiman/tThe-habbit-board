import "server-only";

// Knowledge-base interface — the enrichment branch (a later phase) will implement these.
// Defined now ONLY to lock the module boundary; the classify slice does not call them.

// Look up a distilled playbook for a sub_domain. Returns the playbook, or null on a miss.
export async function lookup(subDomain) {
  throw new Error("kb.lookup: not implemented");
}

// Enrich a sub_domain: source + synthesize + write to the SHARED KB (service-role).
export async function enrich(subDomain) {
  throw new Error("kb.enrich: not implemented");
}
