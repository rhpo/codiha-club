import { error, redirect } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import type { Profile, Role } from "$lib/types";
import { atLeast, can } from "$lib/roles.js";

/** Logged in + onboarded + approved, or redirected to the right waiting room. */
/**
 * Signed in and past the details form, but not necessarily approved yet.
 *
 * The face-photo step sits between "filled the form" and "submitted for
 * review", so it has to let a pending member through where requireMember
 * would redirect them to /pending.
 */
export async function requireOnboarded(event: RequestEvent): Promise<Profile> {
  const profile = await event.locals.getProfile();
  if (!profile) {
    throw redirect(
      303,
      `/login?next=${encodeURIComponent(event.url.pathname)}`
    );
  }
  if (!profile.onboarded_at) throw redirect(303, "/onboarding");
  return profile;
}

export async function requireMember(event: RequestEvent): Promise<Profile> {
  const profile = await event.locals.getProfile();
  if (!profile) {
    throw redirect(
      303,
      `/login?next=${encodeURIComponent(event.url.pathname)}`
    );
  }
  if (!profile.onboarded_at) throw redirect(303, "/onboarding");
  if (profile.status !== "approved") throw redirect(303, "/pending");
  return profile;
}

/**
 * Minimum rank, or a 403.
 *
 * This is a second line of defence, not the only one: every table is also
 * guarded by RLS, so a missing check here shows data the database would have
 * refused anyway. Routes still call it so the failure is a clean 403 rather
 * than a confusing empty page.
 */
export async function requireRole(
  event: RequestEvent,
  minimum: Role
): Promise<Profile> {
  const profile = await requireMember(event);
  if (!atLeast(profile.role, minimum)) {
    throw error(403, "You do not have access to this area");
  }
  return profile;
}

/** Anyone who can open /admin at all: staff and above. */
export async function requireStaff(event: RequestEvent): Promise<Profile> {
  return requireRole(event, "staff");
}

/** Events, hackathons, polls, points. */
export async function requireContentManager(
  event: RequestEvent
): Promise<Profile> {
  return requireRole(event, "project_manager");
}

export async function requireAdmin(event: RequestEvent): Promise<Profile> {
  return requireRole(event, "admin");
}

/** Reading a mailbox that is not your own. Plain admins deliberately cannot. */
export async function requireSuperadmin(event: RequestEvent): Promise<Profile> {
  return requireRole(event, "superadmin");
}

/** Same as requireRole but for API endpoints: 401/403 instead of redirects. */
export async function requireRoleApi(
  event: RequestEvent,
  minimum: Role
): Promise<Profile> {
  const profile = await event.locals.getProfile();
  if (!profile) throw error(401, "Not signed in");
  if (profile.status !== "approved" || !atLeast(profile.role, minimum)) {
    throw error(403, "Forbidden");
  }
  return profile;
}

export async function requireAdminApi(event: RequestEvent): Promise<Profile> {
  return requireRoleApi(event, "admin");
}

/** Capability flags for the signed-in member, for branching inside a load. */
export async function abilities(event: RequestEvent) {
  return can(await event.locals.getProfile());
}
