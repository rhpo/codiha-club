<script>
  // @ts-nocheck
  import Fa from "svelte-fa";
  import Coin from "$lib/components/Coin.svelte";
  import {
    faRankingStar,
    faMedal,
    faCalendarCheck,
    faCertificate,
    faDownload,
    faQrcode,
    faCheckToSlot,
    faUserPen,
    faClockRotateLeft,
    faLaptopCode,
    faHourglassHalf,
    faAward,
  } from "@fortawesome/free-solid-svg-icons";
  import Avatar from "$lib/components/Avatar.svelte";
  import {
    dateRange,
    formatDate,
    formatDateTime,
    isLive,
    relative,
    PLACE_LABEL,
  } from "$lib/utils.js";

  export let data;
  export let form;
  $: p = data.profile;

  $: m = data.membership;
  /** Days are capped so the bar cannot overshoot once a member passes seven. */
  $: progress = m
    ? Math.min(100, Math.round((Math.min(m.daysHeld, 7) / 7) * 100))
    : 0;
  /** The membership one has its own card above, so keep it out of the grid. */
  $: otherCerts = data.certificates.filter((c) => c.kind !== "membership");

  const sourceLabel = {
    event_checkin: "Event check-in",
    hackathon_participation: "Hackathon",
    hackathon_winner: "Hackathon podium",
    manual: "Admin adjustment",
  };

  const appPill = {
    pending: "warn",
    accepted: "ok",
    rejected: "bad",
    withdrawn: "",
  };
</script>

<svelte:head><title>My dashboard | CODIHA Club</title></svelte:head>

<div class="page">
  {#if !p.avatar_url}
    <!-- Nudge, not a block: a member with no picture can still use everything.
		     It simply stops appearing once they have one. -->
    <a class="notice warn pfp-nudge" href="/onboarding?edit=1">
      <Avatar src={null} name={p.full_name} size={40} />
      <span>
        <strong>Add a profile picture.</strong>
        Right now you show up as initials on the leaderboard and in the member list.
      </span>
      <span class="pfp-cta">Add one</span>
    </a>
  {/if}

  <div class="hero-card panel">
    <Avatar src={p.avatar_url} name={p.full_name} size={64} />
    <div class="who-block">
      <span class="eyebrow">Member dashboard</span>
      <h1>{p.full_name}</h1>
      <p class="tiny muted">
        {[p.university, p.field, p.year].filter(Boolean).join(" · ")}
        {#if p.role === "admin"}&nbsp;· <span class="pill accent">Admin</span
          >{/if}
      </p>
    </div>
    <div class="hero-actions">
      <a class="btn ghost sm" href="/onboarding?edit=1"
        ><Fa icon={faUserPen} /> Edit profile</a
      >
      <form method="POST" action="/logout">
        <button class="btn ghost sm" type="submit">Sign out</button>
      </form>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <span class="value">{data.points.semester}</span>
      <span class="label"><Coin /> Coins this year</span>
    </div>
    <div class="stat">
      <span class="value">{data.rank ? "#" + data.rank : "-"}</span>
      <span class="label"><Fa icon={faRankingStar} /> Current rank</span>
    </div>
    <div class="stat">
      <span class="value">{data.badges.length}</span>
      <span class="label"><Fa icon={faMedal} /> Badges</span>
    </div>
    <div class="stat">
      <span class="value">{data.attendanceCount}</span>
      <span class="label"><Fa icon={faCalendarCheck} /> Events attended</span>
    </div>
  </div>

  {#if data.semester?.starts_on}
    <p class="tiny muted center">
      Counting {data.semester.name}: {formatDate(data.semester.starts_on)} → {formatDate(
        data.semester.ends_on
      )}
      · all-time total {data.points.total}
      <Coin />
    </p>
  {/if}

  {#if data.openPolls.length}
    <div class="panel vote-nudge">
      <div>
        <h3>
          <Fa icon={faCheckToSlot} />
          {data.openPolls.length} vote{data.openPolls.length > 1 ? "s" : ""} open
        </h3>
        <p class="tiny muted">
          {data.openPolls.map((x) => x.title).join(" · ")}
        </p>
      </div>
      <a class="btn" href="/vote">Cast my vote</a>
    </div>
  {/if}

  <!-- Badges -->
  <section class="stack">
    <div class="section-head"><h2><Fa icon={faMedal} /> Badges</h2></div>
    {#if data.badges.length}
      <div class="badges">
        {#each data.badges as b (b.slug)}
          <div class="badge" style="--bc: {b.color}" title={b.description}>
            <span class="ico">{b.icon}</span>
            <strong>{b.name}</strong>
            <span class="tiny muted">{formatDate(b.awarded_at)}</span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">No badges yet. Your first event check-in unlocks one.</p>
    {/if}
  </section>

  <!-- Events -->
  <section class="stack">
    <div class="section-head">
      <h2><Fa icon={faCalendarCheck} /> My events</h2>
      <a href="/events">Find more →</a>
    </div>

    {#if data.upcomingRegistrations.length}
      <div class="grid cols-2">
        {#each data.upcomingRegistrations as r (r.events.id)}
          <a class="panel item" href="/events/{r.events.slug}">
            <div class="row">
              {#if isLive(r.events.starts_at, r.events.ends_at)}
                <span class="pill ok">● Live, check in now</span>
              {:else}
                <span class="pill accent">{relative(r.events.starts_at)}</span>
              {/if}
              <span class="pill {r.status === 'waitlist' ? 'warn' : 'ok'}"
                >{r.status}</span
              >
            </div>
            <strong>{r.events.title}</strong>
            <span class="tiny muted"
              >{dateRange(r.events.starts_at, r.events.ends_at)}</span
            >
            {#if r.events.location}<span class="tiny muted"
                >{r.events.location}</span
              >{/if}
            {#if isLive(r.events.starts_at, r.events.ends_at)}
              <span class="tiny accent-text"
                ><Fa icon={faQrcode} /> Scan the on-screen QR to earn {r.events
                  .checkin_points}
                <Coin /></span
              >
            {/if}
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty">You're not registered for any upcoming event yet.</p>
    {/if}

    {#if data.pastRegistrations.length}
      <details class="panel">
        <summary>Past events ({data.pastRegistrations.length})</summary>
        <ul class="plain">
          {#each data.pastRegistrations as r (r.events.id)}
            <li>
              <a href="/events/{r.events.slug}">{r.events.title}</a>
              <span class="tiny muted">{formatDate(r.events.starts_at)}</span>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  </section>

  <!-- Hackathons -->
  <section class="stack">
    <div class="section-head">
      <h2><Fa icon={faLaptopCode} /> My hackathons</h2>
      <a href="/hackathons">Apply to one →</a>
    </div>
    {#if data.applications.length}
      <div class="grid cols-2">
        {#each data.applications as a (a.hackathons.id)}
          <a class="panel item" href="/hackathons/{a.hackathons.slug}">
            <div class="row">
              <span class="pill {appPill[a.status]}">{a.status}</span>
              {#if a.team_name}<span class="pill">Team {a.team_name}</span>{/if}
            </div>
            <strong>{a.hackathons.title}</strong>
            {#if a.hackathons.theme}<span class="tiny accent-text"
                >{a.hackathons.theme}</span
              >{/if}
            <span class="tiny muted"
              >{dateRange(a.hackathons.starts_at, a.hackathons.ends_at)}</span
            >
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty">No hackathon applications yet.</p>
    {/if}
  </section>

  <!-- Certificates -->
  <section class="stack">
    <div class="section-head">
      <h2><Fa icon={faCertificate} /> My certificates</h2>
    </div>

    {#if m}
      <!-- The membership certificate is claimed rather than awarded, so it gets
			     its own card ahead of the automatic ones. -->
      <div class="panel membership" class:ready={m.eligible}>
        <div class="m-head">
          <span class="m-icon"
            ><Fa icon={m.eligible ? faAward : faHourglassHalf} /></span
          >
          <div class="m-title">
            <strong>Certificate of Membership</strong>
            <span class="tiny muted">
              CODIHA Club proudly certifies that {p.full_name} served as
              <b>{m.roleLabel}</b>{#if m.since}, from {formatDate(m.since)} to present{/if}.
            </span>
          </div>
        </div>

        {#if form?.claimError}
          <p class="notice bad tiny">{form.claimError}</p>
        {/if}

        {#if m.certificateId}
          <div class="btn-row">
            <a class="btn sm" href="/certificates/{m.certificateId}">
              <Fa icon={faDownload} /> Download PDF
            </a>
            <a class="btn sm ghost" href="/verify/{m.certificateId}"
              >Verify page</a
            >
          </div>
          <span class="tiny muted">
            Claim it again any time to refresh the dates on your copy.
          </span>
        {:else if m.eligible}
          <form method="POST" action="?/claimMembership">
            <button class="btn sm" type="submit">
              <Fa icon={faAward} /> Claim my certificate
            </button>
          </form>
          <span class="tiny muted">
            {#if m.eventsAttended}
              Unlocked by attending {m.eventsAttended}
              {m.eventsAttended === 1 ? "workshop" : "workshops"}.
            {:else}
              Unlocked after {m.daysHeld} days in the club.
            {/if}
          </span>
        {:else}
          <div class="m-bar"><span style="width:{progress}%" /></div>
          <span class="tiny muted">
            Available in <b>{m.daysRemaining}</b>
            {m.daysRemaining === 1 ? "day" : "days"}
            ({m.daysHeld} of 7 done). Attend a single workshop or event and you can
            claim it straight away.
          </span>
        {/if}
      </div>
    {/if}

    {#if otherCerts.length}
      <div class="grid cols-2">
        {#each otherCerts as c (c.id)}
          <div class="panel cert" class:winner={c.kind === "winner"}>
            <div class="row">
              <span class="pill {c.kind === 'winner' ? 'accent' : 'ok'}">
                {c.kind === "winner"
                  ? PLACE_LABEL[c.place] ?? "Winner"
                  : "Participation"}
              </span>
            </div>
            <strong>{c.events?.title ?? c.hackathons?.title ?? c.title}</strong>
            <span class="tiny muted"
              >Issued {formatDate(c.issued_at)} · {c.code}</span
            >
            <div class="btn-row">
              <a class="btn sm" href="/certificates/{c.id}">
                <Fa icon={faDownload} /> PDF
              </a>
              <a class="btn sm ghost" href="/verify/{c.id}">Verify page</a>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">
        Certificates appear here automatically once you check in to an event or
        get accepted into a hackathon.
      </p>
    {/if}
  </section>

  <!-- Points history -->
  <section class="stack">
    <div class="section-head">
      <h2><Fa icon={faClockRotateLeft} /> Points history</h2>
    </div>
    {#if data.ledger.length}
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr
              ><th>When</th><th>Reason</th><th>Source</th><th class="right"
                >Points</th
              ></tr
            >
          </thead>
          <tbody>
            {#each data.ledger as l (l.id)}
              <tr>
                <td class="muted tiny">{formatDateTime(l.created_at)}</td>
                <td>{l.reason}</td>
                <td class="muted tiny">{sourceLabel[l.source] ?? l.source}</td>
                <td
                  class="right num"
                  class:plus={l.amount > 0}
                  class:minus={l.amount < 0}
                >
                  {l.amount > 0 ? "+" : ""}{l.amount}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="empty">
        No points yet. Showing up is the fastest way to start.
      </p>
    {/if}
  </section>
</div>

<style>
  /* Membership certificate card */
  .membership {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-left: 3px solid var(--glass-border);
  }
  .membership.ready {
    border-left-color: var(--accent);
  }
  .m-head {
    display: flex;
    align-items: flex-start;
    gap: 0.8rem;
  }
  .m-icon {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--glass);
    border: 1px solid var(--glass-border);
    font-size: 1rem;
  }
  .membership.ready .m-icon {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .m-title {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .m-bar {
    height: 6px;
    border-radius: 999px;
    background: var(--glass);
    border: 1px solid var(--glass-border);
    overflow: hidden;
  }
  .m-bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.4s ease;
  }
  .membership form {
    margin: 0;
  }

  @media (max-width: 520px) {
    .m-head {
      flex-direction: column;
    }
  }

  .hero-card {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }
  .who-block {
    flex: 1 1 200px;
    min-width: 0;
  }
  .who-block h1 {
    margin: 0.1rem 0;
    font-size: 1.5rem;
    text-align: left;
  }
  .who-block p {
    margin: 0;
  }
  .hero-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .hero-actions form {
    margin: 0;
  }

  .vote-nudge {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-color: var(--accent-line);
  }
  .vote-nudge h3 {
    margin: 0 0 0.2rem;
  }
  .vote-nudge p {
    margin: 0;
  }

  .badges {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.2rem;
    padding: 0.9rem 0.6rem;
    border-radius: var(--radius-sm);
    background: var(--glass);
    border: 1px solid var(--bc, var(--glass-border));
    font-family: Inter, sans-serif;
  }
  .badge .ico {
    font-size: 1.6rem;
    line-height: 1;
  }
  .badge strong {
    font-size: 0.85rem;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s, transform 0.2s;
  }
  .item:hover {
    text-decoration: none;
    border-color: var(--glass-border-strong);
    transform: translateY(-2px);
  }
  .item strong {
    font-family: Cubano, sans-serif;
    font-size: 1.05rem;
    font-weight: 400;
  }

  .cert {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .cert strong {
    font-family: Cubano, sans-serif;
    font-weight: 400;
    font-size: 1.02rem;
  }
  .cert.winner {
    border-color: rgba(251, 191, 36, 0.5);
  }

  .accent-text {
    color: var(--accent);
  }

  details summary {
    cursor: pointer;
    font-family: Inter, sans-serif;
    font-weight: 600;
    font-size: 0.9rem;
  }
  ul.plain {
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  ul.plain li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.88rem;
  }
  ul.plain a {
    color: #fff;
  }

  .right {
    text-align: right;
  }
  .plus {
    color: var(--ok);
    font-weight: 700;
  }
  .minus {
    color: var(--bad);
    font-weight: 700;
  }

  @media (min-width: 680px) {
    .badges {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  .pfp-nudge {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    text-decoration: none;
    font-family: Inter, sans-serif;
  }

  .pfp-nudge:hover {
    text-decoration: none;
    border-color: var(--accent-line);
  }

  .pfp-nudge span {
    min-width: 0;
  }

  .pfp-cta {
    margin-left: auto;
    white-space: nowrap;
    font-weight: 700;
    color: var(--accent);
  }

  @media (max-width: 560px) {
    .pfp-nudge {
      flex-wrap: wrap;
    }
    .pfp-cta {
      margin-left: 0;
    }
  }
</style>
