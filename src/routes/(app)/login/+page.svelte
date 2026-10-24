<script>
  // @ts-nocheck
  import Fa from "svelte-fa";
  import { faDiscord } from "@fortawesome/free-brands-svg-icons";
  import {
    faShieldHalved,
    faBolt,
    faCertificate,
  } from "@fortawesome/free-solid-svg-icons";
  import { page } from "$app/stores";
  import GoogleG from "$lib/components/GoogleG.svelte";
  import Countdown from "$lib/components/Countdown.svelte";
  import { humanDuration } from "$lib/applications.js";

  export let data;
  export let form;

  $: next = $page.url.searchParams.get("next") ?? "/dashboard";
  $: error = form?.error ?? data.error;
  $: win = data.applications;
  $: closed = win && !win.accepting;

  const perks = [
    {
      icon: faBolt,
      title: "Earn points",
      text: "Check in to events with a QR scan and climb the leaderboard.",
    },
    {
      icon: faCertificate,
      title: "Get certificates",
      text: "Verifiable PDF certificates for every event and hackathon you join.",
    },
    {
      icon: faShieldHalved,
      title: "Admin approved",
      text: "New accounts stay pending until a club admin confirms you're a member.",
    },
  ];
</script>

<svelte:head>
  <title>Join CODIHA Club | Sign in</title>
  <meta
    name="description"
    content="Sign in to the CODIHA Club member platform with Google or Discord."
  />
</svelte:head>

<div class="page narrow">
  <div class="page-head center-head" data-aos="fade-down">
    <span class="eyebrow">Membership</span>
    <h1>Join the club</h1>
    <p>
      One tap with Google or Discord. No passwords to remember. We only ask for
      your name, university and field once you're in.
    </p>
  </div>

  {#if error}
    <div class="notice bad">{error}</div>
  {/if}

  {#if win?.state === "open" && win.msUntilClose}
    <div class="window-note" data-aos="zoom-in">
      <Countdown
        until={win.closesAt}
        remaining={win.msUntilClose}
        label="Applications close in"
      />
      <p class="tiny muted">
        Once the countdown runs out the club stops taking new members until the
        next intake.
      </p>
    </div>
  {:else if win?.state === "before"}
    <div class="window-note" data-aos="zoom-in">
      <Countdown
        until={win.opensAt}
        remaining={win.msUntilOpen}
        label="Applications open in"
      />
      <p class="tiny muted">
        Come back when the countdown ends, in about {humanDuration(
          win.msUntilOpen
        )}.
      </p>
    </div>
  {:else if win?.state === "after"}
    <div class="notice warn closed-note">
      <strong>Applications are closed.</strong>
      The club is not taking new members right now. Watch our socials for the next
      intake.
    </div>
  {/if}

  <div class="panel auth" data-aos="zoom-in" data-aos-delay="80">
    {#if closed}
      <p class="tiny muted terms">
        Sign-in is still open for existing members.
      </p>
    {/if}
    <form method="POST" action="?/oauth">
      <input type="hidden" name="provider" value="google" />
      <input type="hidden" name="next" value={next} />
      <button class="btn lg block provider google" type="submit">
        <GoogleG size={24} /> Continue with Google
      </button>
    </form>

    <form method="POST" action="?/oauth">
      <input type="hidden" name="provider" value="discord" />
      <input type="hidden" name="next" value={next} />
      <button class="btn lg block provider discord" type="submit">
        <Fa icon={faDiscord} /> Continue with Discord
      </button>
    </form>

    <p class="tiny muted terms">
      By continuing you agree that CODIHA Club may store your name, email and
      university to manage your membership, points and certificates.
    </p>
  </div>

  <div class="grid cols-3">
    {#each perks as perk, i}
      <div class="panel perk" data-aos="fade-up" data-aos-delay={120 + i * 100}>
        <Fa icon={perk.icon} />
        <h3>{perk.title}</h3>
        <p class="tiny muted">{perk.text}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .window-note {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .window-note p {
    margin: 0;
    text-align: center;
    max-width: 34ch;
  }

  .closed-note {
    margin-bottom: 1rem;
  }

  .center-head {
    align-items: center;
    text-align: center;
  }
  .center-head h1 {
    text-align: center;
  }
  .auth {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1.5rem 1.25rem;
  }
  .auth form {
    margin: 0;
  }
  .provider {
    font-family: Inter, sans-serif;
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: 0;
    border-radius: 12px;
    min-height: 60px;
    /* keeps both buttons the same height whatever the glyph's intrinsic size */
    line-height: 1;
  }
  .google {
    background: #fff;
    color: #1f2937;
    box-shadow: 0 8px 24px -14px rgba(0, 0, 0, 0.8);
  }
  .discord {
    background: #5865f2;
    color: #fff;
    box-shadow: 0 8px 24px -14px #5865f2;
  }
  /* base.css paints every element white; the Discord glyph has to follow the
	   button's own colour instead. */
  .provider :global(svg) {
    color: inherit;
    font-size: 1.3rem;
  }
  .terms {
    margin: 0.35rem 0 0;
    line-height: 1.5;
    text-align: center;
  }
  .perk {
    text-align: center;
    color: var(--accent);
    font-size: 1.4rem;
  }
  .perk h3 {
    font-family: Cubano, sans-serif;
    color: #fff;
    font-size: 1rem;
    margin: 0.6rem 0 0.3rem;
  }
  .perk p {
    margin: 0;
  }

  @media (min-width: 640px) {
    .auth {
      padding: 2rem 1.75rem;
    }
  }
</style>
