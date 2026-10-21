import Membership from "./Membership.svelte";
import Participation from "./Participation.svelte";
import Winner from "./Winner.svelte";

/**
 * Every certificate design the club issues, keyed by the `kind` column on
 * public.certificates.
 *
 * To add one: copy a design file next to these, add it here, and add the
 * matching kind to the certificates_kind_check constraint in a migration.
 * Nothing else needs touching. See ./README.md.
 */
export const CERTIFICATE_DESIGNS = {
  membership: Membership,
  participation: Participation,
  winner: Winner,
};

/** Falls back to participation so an unknown kind still renders something. */
export function designFor(kind) {
  return CERTIFICATE_DESIGNS[kind] ?? Participation;
}

/**
 * Filename for the downloaded PDF.
 *
 * @param {{kind: string, contextTitle?: string, code: string}} data
 */
export function certificateFileName(data) {
  const safe = (s) =>
    String(s ?? "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  const what = safe(data.contextTitle).slice(0, 40);
  return `codiha-${data.kind}${what ? "-" + what : ""}-${data.code}.pdf`;
}
