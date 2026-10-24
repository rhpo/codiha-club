/**
 * Smallest thing that fails if the check-in token or the admin datetime
 * conversion breaks. Run with: npm test
 */
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { issue, verify, isWindowOpen } from "../src/lib/server/checkin-core.js";
import { localToUtcIso, tzOffsetFrom } from "../src/lib/server/datetime.js";
import {
  matchThread,
  normalizeInboundItem,
  normalizeMessageId,
  normalizeSubject,
  parseAddresses,
  parseReferences,
  replyHeaders,
  swapDomain,
  buildBrevoBody,
} from "../src/lib/server/mail-core.js";
import { secretMatches } from "../src/lib/server/webhook-auth.js";
import { missingProfileFields, profileComplete } from "../src/lib/profile.js";
import { groupGallery, isVideo } from "../src/lib/gallery.js";
import {
  humanDuration,
  resolveWindow,
  windowState,
} from "../src/lib/applications.js";
import {
  assignableRoles,
  atLeast,
  can,
  canAssignTo,
  needsFacePhoto,
  quotaState,
  rankOf,
} from "../src/lib/roles.js";
import {
  DEFAULT_THEME,
  contrastRatio,
  derive,
  normalizeHex,
  resolveTheme,
  themeCss,
} from "../src/lib/theme.js";

const SECRET = "a-test-secret-long-enough";
const W = 30;
const T0 = Date.UTC(2026, 2, 12, 13, 0, 0); // fixed clock

// --- check-in tokens -------------------------------------------------------

const { token, expiresInMs } = await issue(SECRET, "evt-1", W, T0);
assert.deepEqual(
  await verify(SECRET, token, W, T0),
  { ok: true, eventId: "evt-1" },
  "fresh token valid"
);
assert.ok(
  expiresInMs > 0 && expiresInMs <= W * 1000,
  "expiry inside the window"
);

// still valid one window later (grace for a slow scan), dead two windows later
assert.equal(
  (await verify(SECRET, token, W, T0 + W * 1000)).ok,
  true,
  "previous slot accepted"
);
assert.deepEqual(
  await verify(SECRET, token, W, T0 + 2 * W * 1000),
  { ok: false, reason: "expired" },
  "two windows later rejected"
);

// a token minted for a future slot must not be accepted early
const future = await issue(SECRET, "evt-1", W, T0 + 10 * W * 1000);
assert.equal(
  (await verify(SECRET, future.token, W, T0)).reason,
  "expired",
  "future slot rejected"
);

// tampering
assert.equal(
  (await verify(SECRET, token.replace("evt-1", "evt-2"), W, T0)).reason,
  "invalid",
  "event swap"
);
assert.equal(
  (await verify("other-secret-long-enough", token, W, T0)).reason,
  "invalid",
  "wrong secret"
);
assert.equal(
  (await verify(SECRET, "garbage", W, T0)).reason,
  "malformed",
  "malformed token"
);
assert.equal(
  (await verify(SECRET, "", W, T0)).reason,
  "malformed",
  "empty token"
);
assert.equal(
  (await verify(SECRET, "evt-1.abc.sig", W, T0)).reason,
  "malformed",
  "non-numeric slot"
);

// --- check-in time window --------------------------------------------------

const starts = "2026-03-12T14:00:00.000Z";
const ends = "2026-03-12T17:00:00.000Z";
assert.equal(
  isWindowOpen(starts, ends, Date.parse("2026-03-12T15:00:00Z")),
  true,
  "during"
);
assert.equal(
  isWindowOpen(starts, ends, Date.parse("2026-03-12T13:30:00Z")),
  true,
  "30m before"
);
assert.equal(
  isWindowOpen(starts, ends, Date.parse("2026-03-12T12:30:00Z")),
  false,
  "90m before"
);
assert.equal(
  isWindowOpen(starts, ends, Date.parse("2026-03-12T18:30:00Z")),
  false,
  "90m after"
);

// --- admin datetime → UTC --------------------------------------------------

// Algiers is UTC+1 → getTimezoneOffset() === -60, so 14:00 local is 13:00Z
assert.equal(
  localToUtcIso("2026-03-12T14:00", -60),
  "2026-03-12T13:00:00.000Z",
  "UTC+1"
);
assert.equal(
  localToUtcIso("2026-03-12T14:00", 0),
  "2026-03-12T14:00:00.000Z",
  "UTC"
);
assert.equal(
  localToUtcIso("2026-03-12T14:00", 300),
  "2026-03-12T19:00:00.000Z",
  "UTC-5"
);
assert.equal(localToUtcIso("", -60), null, "empty stays null");
assert.equal(localToUtcIso("not-a-date", -60), null, "garbage stays null");

const fd = new FormData();
fd.set("tz_offset", "-60");
assert.equal(tzOffsetFrom(fd), -60, "offset read from form");
fd.set("tz_offset", "99999");
assert.equal(tzOffsetFrom(fd), 0, "absurd offset falls back to UTC");

// --- theme palette ---------------------------------------------------------

// Anything that is not a hex colour must fall back, or a bad settings row
// would be injected verbatim into the <style> block in <head>.
assert.equal(normalizeHex("#ABC"), "#aabbcc", "short hex expands");
assert.equal(normalizeHex("294230"), "#294230", "missing # is tolerated");
assert.equal(normalizeHex("red"), null, "colour names rejected");
assert.equal(
  normalizeHex("#294230;}body{display:none"),
  null,
  "css injection rejected"
);
assert.equal(normalizeHex(null), null, "null rejected");

assert.deepEqual(
  resolveTheme({ primary: "nope", accent: "#fff" }),
  {
    primary: DEFAULT_THEME.primary,
    accent: "#ffffff",
    text: DEFAULT_THEME.text,
  },
  "bad field falls back on its own"
);

// The gradient shades are derived, so the saved colour has to sit between them.
const d = derive({ primary: "#294230", accent: "#fa9200", text: "#ffffff" });
assert.equal(d.primary, "#294230", "primary is kept as given");
for (const key of ["light", "dark", "deeper", "accent", "onAccent", "text"]) {
  assert.match(d[key], /^#[0-9a-f]{6}$/, `${key} is a hex colour`);
}
assert.notEqual(d.light, d.dark, "gradient ends differ");
assert.equal(d.onAccent, d.dark, "dark brand text on the bright orange accent");
assert.equal(
  derive({ primary: "#294230", accent: "#111111" }).onAccent,
  "#ffffff",
  "white on dark"
);

// Contrast drives the admin warning, so the extremes have to be right.
assert.equal(contrastRatio("#ffffff", "#000000"), 21, "black on white is 21:1");
assert.equal(
  contrastRatio("#294230", "#294230"),
  1,
  "a colour against itself is 1:1"
);
assert.ok(d.textContrast > 4.5, "the shipped palette passes WCAG body text");
assert.ok(
  derive({ primary: "#294230", accent: "#fa9200", text: "#2b4432" })
    .textContrast < 4.5,
  "text too close to the background is flagged"
);

// Every variable the stylesheets read must be present in the injected block.
const css = themeCss({ primary: "#1e293b", accent: "#38bdf8" });
for (const v of [
  "--branding-primary-light",
  "--branding-primary",
  "--branding-primary-dark",
  "--branding-primary-deeper",
  "--accent",
  "--accent-rgb",
  "--accent-soft",
  "--accent-line",
  "--accent-glow",
  "--on-accent",
  "--surface-nav",
  "--surface",
  "--surface-strong",
  "--color-text",
  "--text-rgb",
  "--muted",
  "--muted-2",
  "--glass",
  "--glass-strong",
  "--glass-border",
  "--glass-border-strong",
]) {
  assert.ok(css.includes(v + ":"), `themeCss defines ${v}`);
}
assert.ok(css.startsWith(":root:root{"), "outranks the base.css defaults");
assert.ok(
  !themeCss({ primary: "#000;}x{", accent: "#fff" }).includes("}x{"),
  "no css injection"
);

// --- mail threading --------------------------------------------------------

assert.equal(
  normalizeSubject("Re: Workshop"),
  "workshop",
  "single Re: stripped"
);
assert.equal(
  normalizeSubject("RE: Fwd: Re: Workshop"),
  "workshop",
  "nested prefixes stripped"
);
assert.equal(
  normalizeSubject("[EXTERNAL] Re: Workshop"),
  "workshop",
  "tag + prefix stripped"
);
assert.equal(
  normalizeSubject("Re[2]: Workshop"),
  "workshop",
  "numbered reply stripped"
);
assert.equal(
  normalizeSubject("  Workshop   A  "),
  "workshop a",
  "whitespace collapsed"
);
assert.equal(normalizeSubject("Re:"), "", "prefix-only subject is empty");
assert.equal(normalizeSubject(undefined), "", "missing subject is empty");
// "Research" must not lose its first three letters to the Re: pattern.
assert.equal(
  normalizeSubject("Research results"),
  "research results",
  "Re is not a prefix here"
);

assert.deepEqual(
  parseAddresses("Ramy <A@B.com>"),
  ["a@b.com"],
  "display name stripped"
);
assert.deepEqual(
  parseAddresses("a@b.com, c@d.com"),
  ["a@b.com", "c@d.com"],
  "list split"
);
assert.deepEqual(
  parseAddresses([{ Address: "A@B.com" }]),
  ["a@b.com"],
  "Brevo object form"
);
assert.deepEqual(
  parseAddresses("a@b.com, A@B.COM"),
  ["a@b.com"],
  "de-duplicated"
);
assert.deepEqual(parseAddresses("not an address"), [], "garbage rejected");
assert.deepEqual(parseAddresses(null), [], "null is empty");

assert.deepEqual(
  parseReferences("<a@x> <b@x>"),
  ["a@x", "b@x"],
  "chain parsed"
);
assert.equal(normalizeMessageId("<a@x>"), "a@x", "angle brackets stripped");

// Threading: headers beat subject, and a stale subject must not match.
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const threads = [
  {
    id: "t1",
    messageIds: ["m1@x"],
    normalizedSubject: "workshop",
    lastMessageAt: NOW - 1000,
  },
  {
    id: "t2",
    messageIds: ["m9@x"],
    normalizedSubject: "workshop",
    lastMessageAt: NOW - 400 * 24 * 3600 * 1000,
  },
];
assert.equal(
  matchThread(
    { inReplyTo: "<m1@x>", subject: "anything", sentAt: NOW },
    threads
  ).reason,
  "in-reply-to",
  "In-Reply-To wins"
);
assert.equal(
  matchThread({ references: ["<m1@x>"], subject: "x", sentAt: NOW }, threads)
    .reason,
  "references",
  "References matches"
);
assert.equal(
  matchThread({ subject: "Re: Workshop", sentAt: NOW }, threads).threadId,
  "t1",
  "subject falls back to the recent thread, not the year-old one"
);
assert.equal(
  matchThread({ subject: "Re:", sentAt: NOW }, threads),
  null,
  "empty subject never groups"
);
assert.equal(
  matchThread({ subject: "Brand new", sentAt: NOW }, threads),
  null,
  "no match"
);
assert.equal(
  matchThread({ subject: "Workshop", sentAt: NOW }, []),
  null,
  "no threads yet"
);

// Reply headers have to carry the whole chain or clients break the thread.
const rh = replyHeaders({ messageId: "<p@x>", references: ["<a@x>"] });
assert.equal(rh["In-Reply-To"], "<p@x>", "In-Reply-To set");
assert.equal(rh.References, "<a@x> <p@x>", "parent appended to chain");
assert.deepEqual(
  replyHeaders({ messageId: null }),
  {},
  "no parent, no headers"
);
const long = replyHeaders({
  messageId: "<p@x>",
  references: Array.from({ length: 50 }, (_, i) => `<r${i}@x>`),
});
assert.ok(
  long.References.split(" ").length <= 20,
  "References chain is capped"
);
assert.ok(
  long.References.startsWith("<r0@x>"),
  "the root of the chain is kept"
);

// Spam scoring drives whether a message lands in the inbox at all.
const parsed = normalizeInboundItem({
  Uuid: "u1",
  MessageId: "<m@x>",
  From: { Name: "Ramy", Address: "R@Example.com" },
  To: [{ Address: "Hi@team.codiha.com" }],
  Subject: "Re: Hello",
  RawTextBody: "hi",
  SpamScore: 7,
  SentAtDate: "2026-10-18T10:00:00Z",
  Attachments: [
    {
      Name: "cv.pdf",
      ContentType: "application/pdf",
      ContentLength: 12,
      DownloadToken: "tok",
    },
  ],
});
assert.equal(parsed.fromEmail, "r@example.com", "from lowercased");
assert.deepEqual(parsed.to, ["hi@team.codiha.com"], "to lowercased");
assert.equal(parsed.normalizedSubject, "hello", "subject normalized");
assert.equal(parsed.isSpam, true, "score over threshold is spam");
assert.equal(
  parsed.attachments[0].downloadToken,
  "tok",
  "attachment token kept"
);
assert.equal(
  normalizeInboundItem({ SpamScore: 1 }).isSpam,
  false,
  "low score is not spam"
);
assert.equal(
  normalizeInboundItem({}).fromEmail,
  null,
  "empty item does not throw"
);

// --- webhook shared secret -------------------------------------------------

// Brevo does not sign its inbound webhook, so this comparison is the whole
// authentication story for /api/mail/inbound.
assert.equal(
  await secretMatches("abc", "abc"),
  true,
  "matching secret accepted"
);
assert.equal(await secretMatches("abc", "abd"), false, "wrong secret rejected");
assert.equal(
  await secretMatches("abc", "abcd"),
  false,
  "different length rejected, not thrown"
);
assert.equal(await secretMatches("", ""), false, "empty never authenticates");
assert.equal(
  await secretMatches("abc", ""),
  false,
  "unset expected never authenticates"
);
assert.equal(await secretMatches(null, "abc"), false, "null rejected");
assert.equal(
  await secretMatches(undefined, undefined),
  false,
  "undefined rejected"
);

// --- role hierarchy --------------------------------------------------------
// These mirror RLS policies. A bug here is a wrong menu; a matching bug in SQL
// is a security hole, so keep migration 0005 in step with src/lib/roles.js.

assert.ok(rankOf("superadmin") > rankOf("admin"), "superadmin outranks admin");
assert.ok(rankOf("admin") > rankOf("project_manager"), "admin outranks PM");
assert.ok(rankOf("project_manager") > rankOf("staff"), "PM outranks staff");
assert.ok(rankOf("staff") > rankOf("member"), "staff outranks member");
assert.equal(rankOf("nonsense"), 0, "unknown role has no rank");
assert.equal(rankOf(null), 0, "null has no rank");
assert.equal(atLeast("admin", "staff"), true, "admin clears the staff bar");
assert.equal(
  atLeast("staff", "admin"),
  false,
  "staff does not clear the admin bar"
);

const approved = (role) => can({ role, status: "approved" });

// The headline rule: admin runs the club but cannot read mailboxes.
assert.equal(
  approved("admin").readAnyMailbox,
  false,
  "ADMIN CANNOT READ MAILBOXES"
);
assert.equal(approved("superadmin").readAnyMailbox, true, "superadmin can");
assert.equal(approved("admin").manageUsers, true, "admin manages users");
assert.equal(
  approved("project_manager").manageUsers,
  false,
  "PM does not manage users"
);
assert.equal(
  approved("project_manager").manageContent,
  true,
  "PM manages content"
);
assert.equal(
  approved("staff").manageContent,
  false,
  "staff does not manage content"
);
assert.equal(
  approved("staff").reviewApplications,
  true,
  "staff reviews applications"
);
assert.equal(approved("member").openAdmin, false, "members never open /admin");
assert.equal(approved("staff").openAdmin, true, "staff opens /admin");

// Role means nothing until the account is approved.
assert.equal(
  can({ role: "superadmin", status: "pending" }).readAnyMailbox,
  false,
  "pending superadmin has no powers"
);
assert.equal(
  can({ role: "admin", status: "rejected" }).openAdmin,
  false,
  "rejected admin is locked out"
);
assert.equal(can(null).rank, 0, "signed out has no rank");

// Privilege escalation: the whole point of the hierarchy.
assert.ok(
  !assignableRoles("admin").includes("superadmin"),
  "ADMIN CANNOT GRANT SUPERADMIN"
);
assert.ok(assignableRoles("admin").includes("admin"), "admin can grant admin");
assert.ok(
  assignableRoles("superadmin").includes("superadmin"),
  "superadmin can grant superadmin"
);
assert.deepEqual(assignableRoles("project_manager"), [], "PM grants nothing");
assert.deepEqual(assignableRoles("member"), [], "member grants nothing");
assert.equal(
  canAssignTo("admin", "superadmin"),
  false,
  "admin cannot demote a superadmin"
);
assert.equal(canAssignTo("admin", "member"), true, "admin can change a member");
assert.equal(canAssignTo("admin", "admin"), true, "equal rank is allowed");
assert.equal(
  canAssignTo("staff", "member"),
  false,
  "staff cannot assign roles at all"
);

// --- mail send quota -------------------------------------------------------
assert.deepEqual(
  quotaState({ used: 2, daily_send_limit: 5 }).remaining,
  3,
  "remaining counted"
);
assert.equal(
  quotaState({ used: 5, daily_send_limit: 5 }).exceeded,
  true,
  "at the limit is exceeded"
);
assert.equal(
  quotaState({ used: 6, daily_send_limit: 5 }).remaining,
  0,
  "never negative"
);
assert.equal(
  quotaState({ used: 999, daily_send_limit: null }).unlimited,
  true,
  "null is unlimited"
);
assert.equal(
  quotaState({ used: 999, daily_send_limit: null }).exceeded,
  false,
  "unlimited never exceeds"
);
assert.equal(quotaState({}).used, 0, "missing usage counts as zero");

// --- sending vs receiving address -----------------------------------------
// Brevo will not let one domain both send and receive, so a member sends from
// the authenticated domain and receives on the inbound one. Same local part,
// or the two halves stop reading as one person.
assert.equal(
  swapDomain("ramy@inbox.codiha.com", "team.codiha.com"),
  "ramy@team.codiha.com",
  "domain swapped"
);
assert.equal(
  swapDomain("Ramy@Inbox.X.com", "Team.X.com"),
  "ramy@team.x.com",
  "lowercased"
);
assert.equal(
  swapDomain("ramy@inbox.x.com", "@team.x.com"),
  "ramy@team.x.com",
  "leading @ tolerated"
);
assert.equal(swapDomain("", "team.x.com"), null, "no local part");
assert.equal(swapDomain("ramy@inbox.x.com", ""), null, "no domain");
assert.equal(
  swapDomain("ramy@inbox.x.com", "localhost"),
  null,
  "domain needs a dot"
);
assert.equal(swapDomain(null, null), null, "null is safe");

// --- profile completeness gate --------------------------------------------
// Both gates run site-wide, so a bug here either locks everyone out or lets
// half-finished accounts browse freely.

const full = {
  full_name: "Ramy Hadid",
  university: "ESST d'Alger",
  field: "Computer Science",
  year: "M1",
  bio: "I want to build things with other people.",
  onboarded_at: "2026-10-18T00:00:00Z",
};

assert.equal(profileComplete(full), true, "a filled profile passes");
assert.deepEqual(missingProfileFields(full), [], "nothing missing");

// The row the signup trigger creates: no fields, no onboarded_at.
assert.equal(profileComplete({}), false, "a bare trigger row is incomplete");
assert.equal(
  missingProfileFields({}).length,
  5,
  "every field reported missing"
);
assert.equal(profileComplete(null), false, "no profile is incomplete");

// Submitted the form before a field became required.
assert.equal(
  profileComplete({ ...full, bio: null }),
  false,
  "onboarded but missing the new field is still incomplete"
);
assert.deepEqual(
  missingProfileFields({ ...full, university: "   " }).map((f) => f.key),
  ["university"],
  "whitespace does not count as filled"
);

// Length floors, so "a" and "x" cannot satisfy a name or a motivation.
assert.deepEqual(
  missingProfileFields({ ...full, full_name: "Ra" }).map((f) => f.key),
  ["full_name"],
  "name has a floor"
);
assert.deepEqual(
  missingProfileFields({ ...full, bio: "hi" }).map((f) => f.key),
  ["bio"],
  "motivation has a floor"
);

// Filled in, but never submitted: still incomplete.
assert.equal(
  profileComplete({ ...full, onboarded_at: null }),
  false,
  "unsubmitted form is incomplete"
);

// --- deployable asset sizes -------------------------------------------------

// Cloudflare Pages refuses to upload any single file over 25 MiB, and it does
// so at the UPLOAD step, long after the build has reported success. A 25.3 MiB
// video got all the way to a failed deploy that way.
const PAGES_MAX_ASSET_BYTES = 25 * 1024 * 1024;

const oversized = [];
for (const entry of readdirSync("static", {
  recursive: true,
  withFileTypes: true,
})) {
  if (!entry.isFile()) continue;
  const full = join(entry.parentPath ?? entry.path, entry.name);
  const { size } = statSync(full);
  if (size > PAGES_MAX_ASSET_BYTES) {
    oversized.push(`${full} is ${(size / 1048576).toFixed(1)} MiB`);
  }
}
assert.deepEqual(
  oversized,
  [],
  "static/ files must stay under 25 MiB or Cloudflare Pages rejects the deploy"
);

// --- face photo requirement ------------------------------------------------

// The photo is the second half of signing up, so somebody still waiting on
// review has already been asked for it. Gating this on status === 'approved'
// meant a new member never saw the step until an admin let them in.
assert.equal(
  needsFacePhoto({
    role: "member",
    status: "pending",
    avatar_face_verified: false,
  }),
  true,
  "a pending member is still asked for a face photo"
);
assert.equal(
  needsFacePhoto({
    role: "member",
    status: "approved",
    avatar_face_verified: false,
  }),
  true,
  "an approved member without a verified photo is asked"
);
assert.equal(
  needsFacePhoto({
    role: "member",
    status: "approved",
    avatar_face_verified: true,
  }),
  false,
  "a verified photo is not asked for twice"
);
assert.equal(
  needsFacePhoto({
    role: "admin",
    status: "approved",
    avatar_face_verified: false,
  }),
  true,
  "every role is asked, not just members"
);
// The Developer is the one who has to be able to get in and fix the face
// check when the face check itself is what is broken.
assert.equal(
  needsFacePhoto({
    role: "superadmin",
    status: "approved",
    avatar_face_verified: false,
  }),
  false,
  "the Developer rank is exempt"
);
assert.equal(needsFacePhoto(null), false, "no profile, nothing to ask for");

// --- application intake window ---------------------------------------------

const T0b = Date.parse("2026-03-10T12:00:00Z");
const day = 86400000;

// Nothing configured is how the club started: always accepting.
assert.deepEqual(
  windowState({ opens_at: null, closes_at: null }, T0b).state,
  "always",
  "no dates set means intake is open"
);
assert.equal(
  windowState({ opens_at: null, closes_at: null }, T0b).accepting,
  true,
  "no dates set accepts applications"
);

// Before the start, after the end, and the window in between.
const soon = new Date(T0b + 2 * day).toISOString();
const past = new Date(T0b - 2 * day).toISOString();
assert.equal(
  windowState({ opens_at: soon, closes_at: null }, T0b).state,
  "before",
  "a start in the future has not opened yet"
);
assert.equal(
  windowState({ opens_at: soon, closes_at: null }, T0b).accepting,
  false,
  "an unopened window refuses applications"
);
assert.equal(
  windowState({ opens_at: past, closes_at: soon }, T0b).state,
  "open",
  "between the two dates it is open"
);
assert.equal(
  windowState({ opens_at: past, closes_at: soon }, T0b).msUntilClose,
  2 * day,
  "the countdown measures to the closing date"
);
assert.equal(
  windowState({ opens_at: past, closes_at: past }, T0b).state,
  "after",
  "past the closing date it is shut"
);

// A closing date on its own still shuts intake: the board may never have
// set a start, and an end with no start must not read as "always open".
assert.equal(
  windowState({ opens_at: null, closes_at: past }, T0b).accepting,
  false,
  "an elapsed end closes intake even with no start"
);

// The boundary belongs to the closed side, so a deadline is a deadline.
const exact = new Date(T0b).toISOString();
assert.equal(
  windowState({ opens_at: null, closes_at: exact }, T0b).accepting,
  false,
  "the closing instant itself is closed"
);
assert.equal(
  windowState({ opens_at: exact, closes_at: null }, T0b).accepting,
  true,
  "the opening instant itself is open"
);

// Anything unparseable is dropped rather than locking people out.
assert.deepEqual(
  resolveWindow({ opens_at: "not a date", closes_at: "" }),
  { opens_at: null, closes_at: null },
  "junk dates fall back to always open"
);
assert.deepEqual(
  resolveWindow(null),
  { opens_at: null, closes_at: null },
  "a missing settings row falls back to always open"
);

assert.equal(humanDuration(2 * day + 4 * 3600000), "2 days and 4 hours");
assert.equal(humanDuration(45 * 60000), "45 minutes");
assert.equal(humanDuration(-5), "moments", "a past deadline reads as moments");

// --- outbound mail batching -------------------------------------------------

const SENDER = { email: "club@example.com", name: "CODIHA" };
const base = {
  subject: "Default subject",
  html: "<p>default</p>",
  sender: SENDER,
  replyTo: "club@example.com",
};

// One plain recipient needs no versions at all.
const single = buildBrevoBody({
  ...base,
  group: [{ email: "a@example.com", name: "A" }],
});
assert.equal(
  single.messageVersions,
  undefined,
  "a single plain recipient needs no versions"
);
assert.equal(single.htmlContent, "<p>default</p>", "it uses the shared body");
assert.deepEqual(single.to, [{ email: "a@example.com", name: "A" }]);

// The point of the exercise: three personalised mails, one request.
const batch = buildBrevoBody({
  ...base,
  group: [
    { email: "a@example.com", name: "A", html: "<p>Hi A</p>" },
    { email: "b@example.com", name: "B", html: "<p>Hi B</p>" },
    { email: "c@example.com", name: "C", html: "<p>Hi C</p>" },
  ],
});
assert.equal(batch.messageVersions.length, 3, "one version per recipient");
assert.deepEqual(
  batch.messageVersions.map((v) => v.htmlContent),
  ["<p>Hi A</p>", "<p>Hi B</p>", "<p>Hi C</p>"],
  "each recipient keeps their own body"
);
// The top level is the fallback for any version that omits one, so it has
// to be the first recipient's copy rather than the shared default.
assert.equal(
  batch.htmlContent,
  "<p>Hi A</p>",
  "the top-level body is the first recipient's, not the default"
);

// Recipients must never see each other: every version addresses one person.
assert.ok(
  batch.messageVersions.every((v) => v.to.length === 1),
  "no version addresses more than one recipient"
);

// A lone recipient with their own body still needs a version, because the
// subject override lives there.
const lonePersonal = buildBrevoBody({
  ...base,
  group: [{ email: "a@example.com", subject: "Just for you" }],
});
assert.equal(
  lonePersonal.messageVersions.length,
  1,
  "a personalised single still gets a version"
);
assert.equal(
  lonePersonal.subject,
  "Just for you",
  "its subject wins at the top level"
);

// Threading headers and attachments survive the move into the builder.
const withExtras = buildBrevoBody({
  ...base,
  group: [{ email: "a@example.com" }],
  headers: { "In-Reply-To": "<x@y>" },
  attachments: [{ name: "cert.pdf", content: "Zm9v" }],
});
assert.deepEqual(
  withExtras.headers,
  { "In-Reply-To": "<x@y>" },
  "reply headers are kept"
);
assert.deepEqual(
  withExtras.attachment,
  [{ name: "cert.pdf", content: "Zm9v" }],
  "attachments are kept"
);

// --- gallery ordering -------------------------------------------------------

const shots = [
  { id: "c", url: "/c.jpg", section: "Members", position: 5 },
  { id: "a", url: "/a.jpg", section: "Workshop", position: 1 },
  { id: "b", url: "/b.jpg", section: "Workshop", position: 0 },
  { id: "d", url: "/d.jpg", section: "Members", position: 4 },
];
const grouped = groupGallery(shots);

// A section sorts by its earliest photo, so moving one photo to the top
// carries its whole section up with it.
assert.deepEqual(
  grouped.map((g) => g.title),
  ["Workshop", "Members"],
  "sections order by their lowest position"
);
assert.deepEqual(
  grouped[0].items.map((i) => i.id),
  ["b", "a"],
  "photos inside a section keep their own order"
);
assert.deepEqual(
  grouped[1].items.map((i) => i.id),
  ["d", "c"],
  "and so does the second section"
);

// An empty section is the untitled run at the top of the page, not a
// section literally called "".
const untitled = groupGallery([
  { id: "x", url: "/x.jpg", section: "", position: 0 },
]);
assert.equal(untitled[0].title, "", "an empty section keeps an empty title");
assert.equal(untitled.length, 1, "and is still one group");

assert.deepEqual(groupGallery([]), [], "nothing in, nothing out");
assert.deepEqual(groupGallery(null), [], "a missing list is not a crash");

// Videos need a <video>; the kind column decides, and the extension is the
// fallback for rows written before the column existed.
assert.equal(
  isVideo({ kind: "video", url: "/x" }),
  true,
  "the kind column decides"
);
assert.equal(isVideo({ url: "/clip.mp4" }), true, "an mp4 is a video");
assert.equal(isVideo({ url: "/shot.jpg" }), false, "a jpg is not");

console.log("selfcheck: all assertions passed");
