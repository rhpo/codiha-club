/**
 * Every automatic email the club sends, in one place.
 *
 * Three rules hold for all of them:
 *
 *  - They never block the thing that triggered them. An approval, a decision
 *    or a registration must not fail because Brevo is down, so each helper
 *    swallows its own errors.
 *  - A batch is one API call. Brevo's messageVersions carry a body per
 *    recipient, so approving thirty members costs one request rather than
 *    thirty, which matters inside a serverless function with a short budget.
 *  - Nobody is mailed twice for the same thing. The callers pass only the rows
 *    the database actually changed, so a no-op update sends nothing.
 */
import { sendMail, wrapHtml, type MailRecipient } from "$lib/server/brevo";
import { derive, type Theme } from "$lib/theme";
import { certificateRoleTitle } from "$lib/roles.js";

export interface NotifyTarget {
  email: string | null;
  full_name?: string | null;
}

interface Ctx {
  origin: string;
  theme: Theme;
}

const firstName = (name?: string | null) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)[0] || "there";

/** Accent-coloured call to action, matching the approval mail already in use. */
function button(label: string, href: string, theme: Theme) {
  const { accent, onAccent } = derive(theme);
  return `<p style="margin:24px 0;">
	  <a href="${href}"
	     style="background:${accent};color:${onAccent};padding:12px 20px;border-radius:10px;
	            text-decoration:none;font-weight:700;">${label}</a>
	</p>`;
}

/**
 * Sends one batch, personalised per recipient, and never throws.
 *
 * @param build returns the body for a single member
 */
async function blast(
  targets: NotifyTarget[],
  subject: string,
  build: (t: NotifyTarget) => string,
  ctx: Ctx
): Promise<void> {
  const recipients: MailRecipient[] = targets
    .filter((t): t is NotifyTarget & { email: string } => !!t.email)
    .map((t) => ({
      email: t.email,
      name: t.full_name ?? undefined,
      html: wrapHtml(build(t), ctx.origin, ctx.theme),
    }));

  if (!recipients.length) return;

  await sendMail({
    recipients,
    subject,
    // Used only as the fallback for the first version; every recipient has
    // their own body above.
    html: recipients[0].html as string,
  }).catch(() => {
    /* notifications are best-effort by design */
  });
}

/** Membership approved. */
export function notifyApproved(targets: NotifyTarget[], ctx: Ctx) {
  return blast(
    targets,
    "Welcome to CODIHA Club, your membership is approved 🎉",
    (t) =>
      `<p>Hi ${firstName(t.full_name)},</p>
			 <p>Your CODIHA Club membership has been <strong>approved</strong>. Your member dashboard is
			 live: points, event registrations, hackathon applications and certificates are all
			 unlocked.</p>
			 ${button("Open my dashboard", `${ctx.origin}/dashboard`, ctx.theme)}
			 <p>See you at the next event!<br/>The CODIHA Club board</p>`,
    ctx
  );
}

/**
 * Membership rejected.
 *
 * The reason is always included: being turned down with no explanation is the
 * part people actually complain about, and the board has already typed one.
 */
export function notifyRejected(
  targets: NotifyTarget[],
  reason: string,
  ctx: Ctx
) {
  return blast(
    targets,
    "About your CODIHA Club application",
    (t) =>
      `<p>Hi ${firstName(t.full_name)},</p>
			 <p>Thank you for applying to CODIHA Club. We are not able to offer you a place this time.</p>
			 <p style="padding:12px 16px;border-left:3px solid #999;background:rgba(0,0,0,0.04);">
			   ${escapeHtml(reason)}
			 </p>
			 <p>If you think this was a mistake, or your situation changes, you are welcome to apply
			 again at the next intake.</p>
			 <p>The CODIHA Club board</p>`,
    ctx
  );
}

/**
 * Membership ended.
 *
 * Worth sending because the alternative is somebody discovering it by being
 * locked out of their own dashboard with no explanation.
 */
export function notifyAlumni(targets: NotifyTarget[], ctx: Ctx) {
  return blast(
    targets,
    "Your CODIHA Club membership has ended",
    (t) =>
      `<p>Hi ${firstName(t.full_name)},</p>
			 <p>Your active membership of CODIHA Club has ended, and you are now listed as an
			 <strong>alumnus</strong> of the club.</p>
			 <p>Nothing you earned has been deleted. Your certificates stay valid, and the links you
			 have already shared keep working.</p>
			 <p>Thanks for everything you put in. If you would like to come back, the board can
			 reactivate your membership at any time.</p>
			 <p>The CODIHA Club board</p>`,
    ctx
  );
}

/** Promoted or moved to a different role. */
export function notifyRoleChanged(
  targets: NotifyTarget[],
  role: string,
  ctx: Ctx
) {
  const title = certificateRoleTitle(role);
  return blast(
    targets,
    `You are now ${title} at CODIHA Club`,
    (t) =>
      `<p>Hi ${firstName(t.full_name)},</p>
			 <p>Your role at CODIHA Club is now <strong>${title}</strong>. Anything that comes with it
			 is already unlocked on your dashboard.</p>
			 ${button("Open my dashboard", `${ctx.origin}/dashboard`, ctx.theme)}
			 <p>The CODIHA Club board</p>`,
    ctx
  );
}

/** Registered for a workshop or event. */
export function notifyEventRegistered(
  target: NotifyTarget,
  ev: {
    title: string;
    slug: string;
    starts_at: string;
    location?: string | null;
  },
  ctx: Ctx
) {
  const when = new Date(ev.starts_at).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return blast(
    [target],
    `You're registered: ${ev.title}`,
    (t) =>
      `<p>Hi ${firstName(t.full_name)},</p>
			 <p>You have a place at <strong>${escapeHtml(ev.title)}</strong>.</p>
			 <p><strong>When:</strong> ${when}${
        ev.location
          ? `<br/><strong>Where:</strong> ${escapeHtml(ev.location)}`
          : ""
      }</p>
			 <p>Scan the QR code on the screen when you arrive and your points land automatically.</p>
			 ${button("Event details", `${ctx.origin}/events/${ev.slug}`, ctx.theme)}
			 <p>See you there!<br/>The CODIHA Club board</p>`,
    ctx
  );
}

const PLACE = {
  1: "first place",
  2: "second place",
  3: "third place",
} as const;

/** Placed on a hackathon podium. */
export function notifyWinner(
  target: NotifyTarget,
  place: number,
  hackathonTitle: string,
  ctx: Ctx
) {
  const label = PLACE[place as 1 | 2 | 3] ?? "a podium place";
  return blast(
    [target],
    `Congratulations — ${label} at ${hackathonTitle}`,
    (t) =>
      `<p>Hi ${firstName(t.full_name)},</p>
			 <p>You took <strong>${label}</strong> at <strong>${escapeHtml(
        hackathonTitle
      )}</strong>.
			 Your winner certificate is ready to download, and the points are already on your
			 account.</p>
			 ${button("Get my certificate", `${ctx.origin}/dashboard`, ctx.theme)}
			 <p>Well done.<br/>The CODIHA Club board</p>`,
    ctx
  );
}

/**
 * Anything an admin typed goes through here before it reaches a mail client.
 * A rejection reason or an event title with a stray `<` must not be able to
 * change the shape of the message.
 */
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
