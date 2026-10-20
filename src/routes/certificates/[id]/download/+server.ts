import { error } from "@sveltejs/kit";
import {
  buildCertificatePdf,
  certificateFileName,
} from "$lib/server/certificate";
import { roleLabel } from "$lib/roles.js";
import type { RequestHandler } from "./$types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public by unguessable UUID so a member can forward the PDF to a recruiter.
 * Revoked certificates stop downloading.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  if (!UUID.test(params.id)) throw error(404, "Certificate not found");

  const { data } = await locals.supabase.rpc("verify_certificate", {
    p_id: params.id,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw error(404, "Certificate not found");
  if (row.revoked) throw error(410, "This certificate has been revoked");

  // A membership certificate has no event or hackathon behind it, so the role
  // takes the place of the context title: "served the club as Project Manager".
  const cert = {
    id: row.id,
    code: row.code,
    kind: row.kind,
    place: row.place,
    memberName: row.member_name,
    memberUniversity: row.member_university,
    contextTitle:
      row.kind === "membership"
        ? roleLabel(row.role)
        : row.context_title ?? row.title,
    contextDate: row.context_date,
    issuedAt: row.issued_at,
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };

  const pdf = await buildCertificatePdf(cert, `${url.origin}/verify/${row.id}`);

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${certificateFileName(
        cert
      )}"`,
      "cache-control": "public, max-age=3600",
    },
  });
};
