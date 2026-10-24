// @ts-nocheck
/**
 * Role hierarchy. Mirrors role_rank() in supabase/migrations/0005_roles.sql.
 *
 * The database is the authority: every rule here is also an RLS policy, so a
 * bug in this file is a wrong menu, not a security hole. Keep the two in step.
 *
 * Plain JS so scripts/selfcheck.mjs can import it directly.
 *
 * @typedef {'member'|'staff'|'project_manager'|'admin'|'superadmin'} Role
 */

/** @type {Record<Role, number>} */
export const RANK = {
  member: 10,
  staff: 20,
  project_manager: 30,
  admin: 40,
  superadmin: 50,
};

export const ROLES = /** @type {Role[]} */ (Object.keys(RANK));

/** Human labels for the admin UI, highest first. */
export const ROLE_LABELS = {
  superadmin: "Developer",
  admin: "Admin",
  project_manager: "Project manager",
  staff: "Staff",
  member: "Member",
};

/**
 * Safe lookup for callers holding an untyped role (a database column, a form
 * field). Anything unrecognised reads as "Member", which is the floor of the
 * hierarchy and never over-states what somebody was.
 *
 * @param {string | null | undefined} role
 * @returns {string}
 */
export function roleLabel(role) {
  return (
    ROLE_LABELS[/** @type {keyof typeof ROLE_LABELS} */ (role)] ?? "Member"
  );
}

/**
 * The same roles written out for a certificate.
 *
 * Deliberately separate from ROLE_LABELS: a table cell or a <select> wants
 * "Staff", but a document somebody puts in front of a recruiter should read
 * "Staff Member". These are the only role names that leave the product, so
 * they are the ones worth writing properly.
 *
 * superadmin stays deliberately dull. It is never offered, never explained,
 * and "Platform Developer" says nothing about what the rank can do.
 */
export const CERTIFICATE_ROLE_TITLES = {
  superadmin: "Platform Developer",
  admin: "President",
  project_manager: "Project Manager",
  staff: "Staff Member",
  member: "Club Member",
};

/**
 * @param {string | null | undefined} role
 * @returns {string}
 */
export function certificateRoleTitle(role) {
  return (
    CERTIFICATE_ROLE_TITLES[
      /** @type {keyof typeof CERTIFICATE_ROLE_TITLES} */ (role)
    ] ?? "Club Member"
  );
}

/**
 * Shown in the roles legend. Developer is deliberately absent: only a Developer
 * can see or assign it, and its extra capabilities are not advertised to the
 * rest of the board. Anything without an entry here is simply not described.
 */
export const ROLE_DESCRIPTIONS = {
  admin: "Full run of the club platform.",
  project_manager:
    "Create and edit events, hackathons and votes. Award points.",
  staff: "Accept or reject applications.",
  member: "Standard membership.",
};

/** Roles that appear in the legend, highest first. */
export const DOCUMENTED_ROLES = ["admin", "project_manager", "staff", "member"];

/** @param {string|null|undefined} role */
export function rankOf(role) {
  return RANK[role] ?? 0;
}

/**
 * Rank comparison against a named tier.
 * @param {string|null|undefined} role
 * @param {Role} minimum
 */
export function atLeast(role, minimum) {
  return rankOf(role) >= rankOf(minimum);
}

/**
 * Capabilities, named after what they let you do rather than who you are, so
 * call sites read as intent.
 * @param {{role?: string|null, status?: string|null} | null | undefined} profile
 */
export function can(profile) {
  // An unapproved account has no powers whatever its role says.
  const role = profile?.status === "approved" ? profile?.role : null;
  const rank = rankOf(role);
  return {
    rank,
    role,
    /** See the /admin area at all. */
    openAdmin: rank >= RANK.staff,
    /** Accept or reject hackathon applications and membership requests. */
    reviewApplications: rank >= RANK.staff,
    /** CRUD events, hackathons, polls; award and deduct points. */
    manageContent: rank >= RANK.project_manager,
    /** Add users, assign roles, send bulk campaigns, change the palette. */
    manageUsers: rank >= RANK.admin,
    manageSettings: rank >= RANK.admin,
    sendCampaigns: rank >= RANK.admin,
    /**
     * Have a club mailbox at all. Ordinary members do not: the club has a
     * limited daily send quota and a small inbound domain, so addresses are
     * for people acting on the club's behalf.
     */
    useMailbox: rank >= RANK.staff,
    /** Read a mailbox that is not your own. Admin deliberately cannot. */
    readAnyMailbox: rank >= RANK.superadmin,
  };
}

/**
 * Which roles `actor` is allowed to hand out.
 *
 * You can never grant a rank above your own, which is what stops an admin
 * promoting themselves to superadmin. Enforced again by the
 * profiles_protect trigger, because this list is only the UI.
 *
 * @param {string|null|undefined} actorRole
 * @returns {Role[]}
 */
export function assignableRoles(actorRole) {
  const rank = rankOf(actorRole);
  if (rank < RANK.admin) return [];
  return ROLES.filter((r) => RANK[r] <= rank).sort((a, b) => RANK[b] - RANK[a]);
}

/**
 * Whether `actor` may change `target`'s role at all. Someone who outranks you,
 * or matches you, is off limits; otherwise two admins could demote each other.
 * @param {string|null|undefined} actorRole
 * @param {string|null|undefined} targetRole
 */
export function canAssignTo(actorRole, targetRole) {
  const actor = rankOf(actorRole);
  return actor >= RANK.admin && actor >= rankOf(targetRole);
}

/** Default outbound messages per day. null means unlimited. */
export const DEFAULT_DAILY_SEND_LIMIT = 5;

/**
 * @param {{used?: number, daily_send_limit?: number|null}} quota
 * @returns {{unlimited: boolean, used: number, limit: number|null, remaining: number|null, exceeded: boolean}}
 */
export function quotaState(quota) {
  const used = Number(quota?.used ?? 0);
  const limit = quota?.daily_send_limit ?? null;
  if (limit === null || limit === undefined) {
    return {
      unlimited: true,
      used,
      limit: null,
      remaining: null,
      exceeded: false,
    };
  }
  const remaining = Math.max(0, limit - used);
  return { unlimited: false, used, limit, remaining, exceeded: used >= limit };
}

/**
 * Whether this person must upload a photo of their face before they can use
 * the member area.
 *
 * The Developer is exempt: they are the one who has to be able to get in and
 * fix things when the face check itself is what is broken. Everyone else,
 * every role, is asked once and not again.
 *
 * @param {{role?: string|null, status?: string|null, avatar_face_verified?: boolean|null} | null | undefined} profile
 */
export function needsFacePhoto(profile) {
  if (!profile) return false;
  // Deliberately not gated on status: the photo is the second half of signing
  // up, so a member who is still pending review has already been asked for it.
  if (rankOf(profile.role) >= RANK.superadmin) return false;
  return !profile.avatar_face_verified;
}
