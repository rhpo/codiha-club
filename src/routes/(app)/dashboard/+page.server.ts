import { fail } from "@sveltejs/kit";
import { requireMember } from "$lib/server/guards";
import { roleLabel } from "$lib/roles.js";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const profile = await requireMember(event);
  const sb = event.locals.supabase;
  const now = new Date().toISOString();

  const [
    points,
    me,
    badges,
    ledger,
    regs,
    apps,
    certs,
    attendance,
    polls,
    myBallots,
    semester,
    membership,
  ] = await Promise.all([
    sb.from("my_points").select("*").eq("member_id", profile.id).maybeSingle(),
    sb
      .from("leaderboard")
      .select("rank,points")
      .eq("id", profile.id)
      .maybeSingle(),
    sb
      .from("member_badges")
      .select("awarded_at,badges(slug,name,description,icon,color)")
      .eq("member_id", profile.id)
      .order("awarded_at", { ascending: false }),
    sb
      .from("points_ledger")
      .select("*")
      .eq("member_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(40),
    sb
      .from("event_registrations")
      .select(
        "status,created_at,events(id,slug,title,starts_at,ends_at,location,cover_url,checkin_points)"
      )
      .eq("member_id", profile.id)
      .order("created_at", { ascending: false }),
    sb
      .from("hackathon_applications")
      .select(
        "status,team_name,created_at,hackathons(id,slug,title,theme,starts_at,ends_at)"
      )
      .eq("member_id", profile.id)
      .order("created_at", { ascending: false }),
    sb
      .from("certificates")
      .select("*,events(title,slug),hackathons(title,slug)")
      .eq("member_id", profile.id)
      .is("revoked_at", null)
      .order("issued_at", { ascending: false }),
    sb
      .from("event_attendance")
      .select("event_id", { count: "exact", head: true })
      .eq("member_id", profile.id),
    sb
      .from("polls")
      .select("id,title,description,opens_at,closes_at")
      .eq("status", "published")
      .lte("opens_at", now)
      .gte("closes_at", now),
    sb.from("poll_ballots").select("poll_id").eq("voter_id", profile.id),
    sb.rpc("semester_bounds").maybeSingle(),
    sb
      .rpc("membership_certificate_status", { p_member: profile.id })
      .maybeSingle(),
  ]);

  const votedPolls = new Set(
    (myBallots.data ?? []).map((b: { poll_id: string }) => b.poll_id)
  );
  const openPolls = (polls.data ?? []).filter(
    (p: { id: string }) => !votedPolls.has(p.id)
  );

  const registrations = (regs.data ?? []).filter((r: any) => r.events);
  const nowMs = Date.now();

  return {
    points: {
      semester: points.data?.semester_points ?? 0,
      total: points.data?.total_points ?? 0,
    },
    rank: me.data?.rank ?? null,
    badges: (badges.data ?? []).map((b: any) => ({
      ...b.badges,
      awarded_at: b.awarded_at,
    })),
    ledger: ledger.data ?? [],
    upcomingRegistrations: registrations.filter(
      (r: any) => new Date(r.events.ends_at).getTime() >= nowMs
    ),
    pastRegistrations: registrations.filter(
      (r: any) => new Date(r.events.ends_at).getTime() < nowMs
    ),
    applications: (apps.data ?? []).filter((a: any) => a.hackathons),
    certificates: certs.data ?? [],
    attendanceCount: attendance.count ?? 0,
    openPolls,
    semester: semester.data ?? null,
    membership: membershipCard(membership.data, certs.data ?? []),
  };
};

/**
 * Everything the "certificate of membership" card needs, resolved server-side
 * so the markup stays a dumb render.
 *
 * `claimed` matters because the certificate is claimed, not awarded: a member
 * who is already holding one should see a download button, not a second
 * "claim" button that would silently refresh the same row.
 */
function membershipCard(status: any, certificates: any[]) {
  if (!status?.role) return null;

  const existing = certificates.find(
    (c) => c.kind === "membership" && c.role === status.role
  );

  return {
    role: status.role as string,
    roleLabel: roleLabel(status.role),
    eligible: !!status.eligible,
    daysHeld: status.days_held ?? 0,
    daysRemaining: status.days_remaining ?? 0,
    eventsAttended: status.events_attended ?? 0,
    since: status.since ?? null,
    certificateId: existing?.id ?? null,
  };
}

export const actions: Actions = {
  /**
   * Claims the membership certificate. Eligibility is enforced inside
   * issue_membership_certificate(), not here, so a hand-rolled POST cannot
   * skip the waiting period.
   */
  claimMembership: async ({ locals }) => {
    const { data, error } = await locals.supabase.rpc(
      "issue_membership_certificate"
    );
    if (error) return fail(400, { claimError: error.message });
    return { claimedId: data as string };
  },
};
