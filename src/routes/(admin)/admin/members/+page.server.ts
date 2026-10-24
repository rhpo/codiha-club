import { fail } from "@sveltejs/kit";
import {
  requireAdmin,
  requireContentManager,
  requireStaff,
} from "$lib/server/guards";
import {
  ROLES,
  ROLE_LABELS,
  assignableRoles,
  canAssignTo,
  atLeast,
} from "$lib/roles.js";
import { loadApplicationWindow } from "$lib/server/settings";
import { windowState } from "$lib/applications.js";
import type { Role } from "$lib/types";
import { loadTheme } from "$lib/server/settings";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";
import {
  notifyApproved,
  notifyRejected,
  notifyRoleChanged,
} from "$lib/server/notify";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const actor = await requireStaff(event);
  const sb = event.locals.supabase;

  const status = event.url.searchParams.get("status") ?? "all";
  const q = (event.url.searchParams.get("q") ?? "").trim();

  // PostgREST `or()` is comma/paren delimited, so strip those out of user input
  const safeQ = q.replace(/[,()*%\\]/g, " ").trim();

  let query = sb
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  // "incomplete" is not a stored status: it is somebody who signed in with
  // Google or Discord (which creates the row) and then abandoned the form, so
  // they have no university, field or year. They are not waiting on a
  // decision, so they do not belong in the approval queue.
  if (status === "incomplete") query = query.is("onboarded_at", null);
  else if (status === "pending")
    query = query.eq("status", "pending").not("onboarded_at", "is", null);
  else if (status !== "all") query = query.eq("status", status);
  if (safeQ) {
    query = query.or(
      `full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%,university.ilike.%${safeQ}%`
    );
  }

  const [members, points, counts] = await Promise.all([
    query.limit(400),
    sb.from("my_points").select("member_id,semester_points,total_points"),
    sb.from("profiles").select("status,onboarded_at"),
  ]);

  const pointsBy: Record<string, { semester: number; total: number }> = {};
  for (const p of points.data ?? []) {
    pointsBy[p.member_id] = {
      semester: p.semester_points ?? 0,
      total: p.total_points ?? 0,
    };
  }

  const tally = {
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    incomplete: 0,
  } as Record<string, number>;
  for (const row of counts.data ?? []) {
    tally.all++;
    if (!row.onboarded_at) {
      tally.incomplete++;
      continue; // counted once, as incomplete rather than pending
    }
    tally[row.status] = (tally[row.status] ?? 0) + 1;
  }

  return {
    members: members.data ?? [],
    // Staff see the list but get no role control; assignableRoles() is empty
    // for them, which is what hides the dropdown.
    assignable: assignableRoles(actor.role),
    actorRole: actor.role,
    actorId: actor.id,
    pointsBy,
    tally,
    filter: { status, q },
    applications: windowState(await loadApplicationWindow(sb), Date.now()),
    // Staff review applications but do not decide when intake runs.
    canSetWindow: atLeast(actor.role, "admin"),
  };
};

export const actions: Actions = {
  approve: async (event) => {
    const admin = await requireStaff(event);
    const form = await event.request.formData();
    const id = String(form.get("id") ?? "");
    if (!id) return fail(400, { error: "Missing member id" });

    const { data, error } = await event.locals.supabase
      .from("profiles")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: admin.id,
        reject_reason: null,
      })
      .eq("id", id)
      .select("email,full_name")
      .maybeSingle();

    if (error) return fail(400, { error: error.message });
    if (data) {
      await notifyApproved([data], {
        origin: event.url.origin,
        theme: await loadTheme(event.locals.supabase),
      });
    }
    return { success: `${data?.full_name || "Member"} approved.` };
  },

  bulkApprove: async (event) => {
    const admin = await requireStaff(event);
    const form = await event.request.formData();
    const ids = form.getAll("ids").map(String).filter(Boolean);
    if (!ids.length) return fail(400, { error: "Select at least one member." });

    const { data, error } = await event.locals.supabase
      .from("profiles")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: admin.id,
        reject_reason: null,
      })
      .in("id", ids)
      .select("email,full_name");

    if (error) return fail(400, { error: error.message });

    // One request for the whole batch rather than one per member: these
    // run inside a serverless function with a short budget.
    await notifyApproved(data ?? [], {
      origin: event.url.origin,
      theme: await loadTheme(event.locals.supabase),
    });
    return { success: `${data?.length ?? 0} members approved.` };
  },

  /**
   * Opens or closes intake. Admin and above only: staff review applications
   * but do not decide when the club is taking them.
   */
  applicationWindow: async (event) => {
    await requireAdmin(event);
    const form = await event.request.formData();

    const parse = (k: string) => {
      const raw = String(form.get(k) ?? "").trim();
      if (!raw) return null;
      // <input type="datetime-local"> carries no timezone, so it arrives as
      // the admin's wall clock and is stored normalised to UTC.
      const t = Date.parse(raw);
      if (!Number.isFinite(t)) return "bad";
      return new Date(t).toISOString();
    };

    const opens_at = parse("opens_at");
    const closes_at = parse("closes_at");
    if (opens_at === "bad" || closes_at === "bad") {
      return fail(400, { error: "Those dates could not be read." });
    }
    if (
      opens_at &&
      closes_at &&
      Date.parse(closes_at) <= Date.parse(opens_at)
    ) {
      return fail(400, {
        error: "The closing date has to be after the opening date.",
      });
    }

    const { error } = await event.locals.supabase.from("site_settings").upsert(
      {
        key: "applications",
        value: { opens_at, closes_at },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) return fail(400, { error: error.message });

    if (!opens_at && !closes_at) {
      return { success: "Applications are open, with no closing date." };
    }
    return { success: "Application window saved." };
  },

  reject: async (event) => {
    await requireStaff(event);
    const form = await event.request.formData();
    const id = String(form.get("id") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    if (!id) return fail(400, { error: "Missing member id" });
    if (!reason) return fail(400, { error: "A rejection reason is required." });

    const { data, error } = await event.locals.supabase
      .from("profiles")
      .update({ status: "rejected", reject_reason: reason })
      .eq("id", id)
      .select("email,full_name")
      .maybeSingle();

    if (error) return fail(400, { error: error.message });
    // Being turned down with no word at all is the part people complain
    // about, and the board has already typed the reason.
    if (data) {
      await notifyRejected([data], reason, {
        origin: event.url.origin,
        theme: await loadTheme(event.locals.supabase),
      });
    }
    return { success: "Member rejected." };
  },

  points: async (event) => {
    const admin = await requireContentManager(event);
    const form = await event.request.formData();
    const id = String(form.get("id") ?? "");
    const amount = Number(form.get("amount"));
    const reason = String(form.get("reason") ?? "").trim();

    if (!id) return fail(400, { error: "Missing member id" });
    if (!Number.isInteger(amount) || amount === 0) {
      return fail(400, { error: "Points must be a non-zero whole number." });
    }
    if (reason.length < 3)
      return fail(400, { error: "A reason is required for every adjustment." });

    const { error } = await event.locals.supabase.from("points_ledger").insert({
      member_id: id,
      amount,
      reason,
      source: "manual",
      created_by: admin.id,
    });

    if (error) return fail(400, { error: error.message });
    return { success: `${amount > 0 ? "+" : ""}${amount} points recorded.` };
  },

  /**
   * Manual override for the face check.
   *
   * Detection runs in the browser and gets it wrong: poor light, a headscarf,
   * glasses, an unusual angle. Without a way for a human to say "that is
   * clearly them", a false negative would lock a member out of the whole
   * member area permanently.
   */
  verifyPhoto: async (event) => {
    await requireStaff(event);
    const form = await event.request.formData();
    const id = String(form.get("id") ?? "");
    const verified = String(form.get("verified") ?? "") === "1";
    if (!id) return fail(400, { error: "Missing member id" });

    // The profiles_protect trigger blocks this column for anyone below
    // admin, so it goes through the service role after the staff check.
    const { data, error } = await supabaseAdmin()
      .from("profiles")
      .update({
        avatar_face_verified: verified,
        avatar_verified_at: verified ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("full_name")
      .maybeSingle();

    if (error) return fail(400, { error: error.message });
    return {
      success: verified
        ? `${data?.full_name || "Member"}'s photo approved.`
        : `${data?.full_name || "Member"} will be asked for a new photo.`,
    };
  },

  setRole: async (event) => {
    const actor = await requireAdmin(event);
    const form = await event.request.formData();
    const id = String(form.get("id") ?? "");
    const role = String(form.get("role") ?? "");

    if (!ROLES.includes(role as Role))
      return fail(400, { error: "Invalid role" });
    if (id === actor.id) {
      return fail(400, { error: "You cannot change your own role." });
    }

    // Read the target first: the rules below depend on who they already are.
    const { data: target } = await event.locals.supabase
      .from("profiles")
      .select("role,full_name")
      .eq("id", id)
      .maybeSingle();
    if (!target) return fail(404, { error: "Member not found." });

    // No granting a rank above your own, and no touching someone who already
    // outranks you. Without this an admin could make themselves superadmin and
    // read every mailbox. The profiles_protect trigger enforces this again in
    // the database; this is the friendly error.
    if (!assignableRoles(actor.role).includes(role as Role)) {
      return fail(403, {
        error: `You cannot assign the ${ROLE_LABELS[role as Role]} role.`,
      });
    }
    if (!canAssignTo(actor.role, target.role)) {
      return fail(403, { error: "That member outranks you." });
    }

    const { data: updated, error } = await event.locals.supabase
      .from("profiles")
      .update({ role })
      .eq("id", id)
      .select("email,full_name")
      .maybeSingle();
    if (error) return fail(400, { error: error.message });
    // Only when the role actually moved, so re-saving the same role does
    // not mail somebody their own job title again.
    if (updated && target.role !== role) {
      await notifyRoleChanged([updated], role, {
        origin: event.url.origin,
        theme: await loadTheme(event.locals.supabase),
      });
    }
    return {
      success: `${target.full_name || "Member"} is now ${
        ROLE_LABELS[role as Role]
      }.`,
    };
  },
};
