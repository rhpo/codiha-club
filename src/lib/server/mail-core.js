// @ts-nocheck
/**
 * Pure email threading logic: no env, no I/O, so it is directly testable.
 *
 * Brevo's inbound webhook hands us one parsed message at a time. Turning a
 * stream of those into Gmail-style conversations is the only non-obvious part
 * of the mail feature, so it lives here on its own.
 */

/** `Re:`, `Fwd:`, `RE :`, `[EXT]`, and the French/Spanish variants mail clients add. */
const PREFIX =
  /^\s*(?:\[[^\]]{1,20}\]\s*)?(?:(?:re|fw|fwd|rv|tr|aw|sv|antw|res)\s*(?:\[\d+\])?\s*:\s*)+/i;

/**
 * Subject with every reply/forward prefix stripped, lowercased and whitespace
 * collapsed. Used only as a last-resort thread key.
 * @param {string} subject
 */
export function normalizeSubject(subject) {
  let s = String(subject ?? "");
  // Loop: "Re: Fwd: Re: x" needs more than one pass.
  for (let i = 0; i < 10; i++) {
    const next = s.replace(PREFIX, "");
    if (next === s) break;
    s = next;
  }
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Pulls bare addresses out of a header value.
 * Handles `A <a@b.c>`, `a@b.c`, comma-separated lists, and Brevo's
 * `[{Name, Address}]` object form.
 * @param {unknown} value
 * @returns {string[]} lowercased addresses, de-duplicated, order preserved
 */
export function parseAddresses(value) {
  if (value == null) return [];

  /** @type {string[]} */
  const out = [];
  const push = (raw) => {
    const addr = String(raw ?? "")
      .trim()
      .replace(/^.*<([^>]+)>.*$/, "$1")
      .replace(/^[<"']+|[>"']+$/g, "")
      .trim()
      .toLowerCase();
    // Cheap sanity check; a malformed header must not create a junk account.
    if (addr && addr.includes("@") && !addr.includes(" ")) out.push(addr);
  };

  if (Array.isArray(value)) {
    for (const v of value) {
      if (v && typeof v === "object") push(v.Address ?? v.address ?? v.email);
      else push(v);
    }
  } else if (typeof value === "object") {
    push(value.Address ?? value.address ?? value.email);
  } else {
    for (const part of String(value).split(",")) push(part);
  }

  return [...new Set(out)];
}

/** `<a@b>` → `a@b`. Message-IDs are compared bare so angle brackets never matter. */
export function normalizeMessageId(id) {
  const s = String(id ?? "").trim();
  if (!s) return null;
  return s.replace(/^<|>$/g, "").trim() || null;
}

/**
 * The `References` header is a space-separated chain of Message-IDs, oldest
 * first. Clients vary wildly in what they send, so parse defensively.
 * @param {unknown} value
 * @returns {string[]}
 */
export function parseReferences(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(" ") : String(value);
  const ids = raw.match(/<[^>\s]+>/g) ?? raw.split(/\s+/);
  return [...new Set(ids.map(normalizeMessageId).filter(Boolean))];
}

/** Thirty days: long enough for a slow reply, short enough that an annual
 *  "Workshop" subject does not glue two unrelated years together. */
export const SUBJECT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Decides which existing thread a message belongs to.
 *
 * Header-based matching is authoritative; the subject fallback exists because
 * some clients (and most "contact us" forms) send neither In-Reply-To nor
 * References.
 *
 * @param {{inReplyTo?: string|null, references?: string[], subject?: string, sentAt?: number}} message
 * @param {Array<{id: string, messageIds: string[], normalizedSubject: string, lastMessageAt: number}>} threads
 * @returns {{threadId: string, reason: 'in-reply-to'|'references'|'subject'} | null}
 */
export function matchThread(message, threads) {
  if (!Array.isArray(threads) || threads.length === 0) return null;

  const inReplyTo = normalizeMessageId(message?.inReplyTo);
  if (inReplyTo) {
    const hit = threads.find((t) => t.messageIds?.includes(inReplyTo));
    if (hit) return { threadId: hit.id, reason: "in-reply-to" };
  }

  const refs = message?.references ?? [];
  for (let i = refs.length - 1; i >= 0; i--) {
    const ref = normalizeMessageId(refs[i]);
    const hit = threads.find((t) => t.messageIds?.includes(ref));
    if (hit) return { threadId: hit.id, reason: "references" };
  }

  const subject = normalizeSubject(message?.subject);
  // An empty normalized subject ("Re:" and nothing else) would match every
  // other subject-less thread, so refuse to group on it.
  if (!subject) return null;

  const sentAt = Number.isFinite(message?.sentAt) ? message.sentAt : Date.now();
  const hit = threads
    .filter((t) => t.normalizedSubject === subject)
    .filter((t) => Math.abs(sentAt - t.lastMessageAt) <= SUBJECT_WINDOW_MS)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0];

  return hit ? { threadId: hit.id, reason: "subject" } : null;
}

/**
 * Headers that make a reply thread correctly in the recipient's client.
 * Brevo passes custom headers straight through on send.
 * @param {{messageId?: string|null, references?: string[]}} parent
 * @returns {Record<string, string>}
 */
export function replyHeaders(parent) {
  const parentId = normalizeMessageId(parent?.messageId);
  if (!parentId) return /** @type {Record<string, string>} */ ({});

  // RFC 5322: References is the parent's chain plus the parent itself, and
  // is capped in practice so the header cannot grow without bound.
  const chain = [
    ...(parent.references ?? []).map(normalizeMessageId).filter(Boolean),
    parentId,
  ];
  const trimmed = chain.length > 20 ? [chain[0], ...chain.slice(-19)] : chain;

  return {
    "In-Reply-To": `<${parentId}>`,
    References: trimmed.map((id) => `<${id}>`).join(" "),
  };
}

/** Brevo flags spam with a score; anything at or above this is filed as junk. */
export const SPAM_THRESHOLD = 5;

/**
 * Normalises one entry of Brevo's inbound `items` array into our own shape.
 * @param {Record<string, any>} item
 */
export function normalizeInboundItem(item) {
  const from = parseAddresses(item?.From)[0] ?? null;
  const fromName =
    (item?.From &&
      typeof item.From === "object" &&
      (item.From.Name ?? item.From.name)) ||
    null;

  const sentAtMs = Date.parse(item?.SentAtDate ?? "");
  const spamScore = Number(item?.SpamScore);

  return {
    brevoUuid: item?.Uuid ?? null,
    messageId: normalizeMessageId(item?.MessageId),
    inReplyTo: normalizeMessageId(item?.InReplyTo),
    references: parseReferences(item?.Headers?.References ?? item?.References),
    fromEmail: from,
    fromName,
    to: parseAddresses(item?.To),
    cc: parseAddresses(item?.Cc),
    replyTo: parseAddresses(item?.ReplyTo)[0] ?? null,
    recipients: parseAddresses(item?.Recipients),
    subject: String(item?.Subject ?? "").slice(0, 500),
    normalizedSubject: normalizeSubject(item?.Subject),
    textBody: item?.RawTextBody ?? item?.ExtractedMarkdownMessage ?? null,
    htmlBody: item?.RawHtmlBody ?? null,
    spamScore: Number.isFinite(spamScore) ? spamScore : null,
    isSpam: Number.isFinite(spamScore) && spamScore >= SPAM_THRESHOLD,
    sentAt: Number.isFinite(sentAtMs) ? new Date(sentAtMs).toISOString() : null,
    attachments: Array.isArray(item?.Attachments)
      ? item.Attachments.map((a) => ({
          name: String(a?.Name ?? "attachment").slice(0, 255),
          contentType: a?.ContentType ?? "application/octet-stream",
          size: Number(a?.ContentLength) || 0,
          contentId: a?.ContentID ?? null,
          downloadToken: a?.DownloadToken ?? null,
        }))
      : [],
  };
}

/**
 * Same local part, different domain: `ramy@inbox.x` + `team.x` -> `ramy@team.x`.
 *
 * A member sends from the authenticated domain and receives on the inbound one,
 * because Brevo refuses to do both on a single domain. Keeping the local part
 * identical is what makes those two halves read as one identity.
 *
 * @param {string} address
 * @param {string} domain
 * @returns {string|null} null when either side is unusable
 */
export function swapDomain(address, domain) {
  const local = String(address ?? "")
    .split("@")[0]
    ?.trim();
  const host = String(domain ?? "")
    .trim()
    .replace(/^@/, "");
  if (!local || !host || !host.includes(".")) return null;
  return `${local}@${host}`.toLowerCase();
}

/**
 * Builds the Brevo /v3/smtp/email payload for one batch.
 *
 * Pulled out of brevo.ts so it can be tested: brevo.ts imports
 * $env/dynamic/private and cannot be loaded outside Vite.
 *
 * Brevo's messageVersions carry a body per recipient, so a personalised batch
 * ("Hi Ramy", "Hi Bouchra") is still one HTTP call. The top-level subject and
 * htmlContent double as the default for any version that does not override
 * them, which is why the first recipient's copy goes there.
 *
 * @param {{
 *   group: Array<{email: string, name?: string, html?: string, subject?: string}>,
 *   subject: string,
 *   html: string,
 *   sender: {email: string, name?: string},
 *   replyTo: string,
 *   headers?: Record<string, string>,
 *   attachments?: Array<{content: string, name: string}>
 * }} input
 */
export function buildBrevoBody({
  group,
  subject,
  html,
  sender,
  replyTo,
  headers,
  attachments,
}) {
  const first = group[0];
  const personalised = group.some((r) => r.html || r.subject);

  /** @type {Record<string, unknown>} */
  const body = {
    sender,
    replyTo: { email: replyTo },
    subject: first.subject ?? subject,
    htmlContent: first.html ?? html,
    // Brevo requires a top-level `to`; it is overridden per version.
    to: [{ email: first.email, name: first.name || undefined }],
  };

  if (group.length > 1 || personalised) {
    body.messageVersions = group.map((r) => {
      /** @type {Record<string, unknown>} */
      const version = { to: [{ email: r.email, name: r.name || undefined }] };
      if (r.html) version.htmlContent = r.html;
      if (r.subject) version.subject = r.subject;
      return version;
    });
  }

  if (headers && Object.keys(headers).length) {
    body.headers = headers;
  }
  if (attachments?.length) {
    body.attachment = attachments.map((a) => ({
      content: a.content,
      name: a.name,
    }));
  }
  return body;
}
