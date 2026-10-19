<script>
  // @ts-nocheck
  import { faDiscord, faGoogle } from "@fortawesome/free-brands-svg-icons";
  import {
    faFlagCheckered,
    faGaugeHigh,
    faHourglassHalf,
  } from "@fortawesome/free-solid-svg-icons";

  import Fa from "svelte-fa";
  import { page } from "$app/stores";

  $: profile = $page.data?.profile ?? null;
  $: approved = profile?.status === "approved";
</script>

<div class="container skillbox" data-aos="flip-right" data-aos-duration="1200">
  <h1><Fa icon={faFlagCheckered} /> Get STARTED!</h1>
  <p class="description">
    {#if approved}
      You're a verified CODIHA member. Jump into your dashboard to register for
      events, apply to hackathons and track your points.
    {:else if profile}
      Your membership is waiting on an admin review. We'll email you the second
      it's approved.
    {:else}
      Ready to join us? Sign in with Google or Discord, tell us your university
      and field, and an admin will approve your membership.
    {/if}
  </p>
</div>

<div class="links" data-aos="fade-right">
  {#if approved}
    <a class="cta" href="/dashboard">
      <Fa icon={faGaugeHigh} /> GO TO MY DASHBOARD
    </a>
  {:else if profile}
    <a class="cta pending" href="/pending">
      <Fa icon={faHourglassHalf} /> MEMBERSHIP PENDING
    </a>
  {:else}
    <div class="duo">
      <a class="cta" href="/login">JOIN THE CLUB</a>
      <div class="providers">
        <span><Fa icon={faGoogle} /> Google</span>
        <span class="dot">·</span>
        <span><Fa icon={faDiscord} /> Discord</span>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.colored) {
    color: var(--accent);
  }

  .container p {
    margin: 0;
  }

  .skillbox {
    width: 100%;
    max-width: var(--mw);
    padding: 20px;
    padding-bottom: 0;
    margin-bottom: 0;
    text-align: center;
  }

  .skillbox h1 {
    margin-bottom: 10px;
  }

  .skillbox .description {
    font-family: Inter, sans-serif;
    line-height: 1.6;
  }

  .links {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    width: 100%;
    max-width: var(--mw);
  }

  .duo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }

  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;

    font-family: Cubano, sans-serif;
    font-size: 1.6rem;
    letter-spacing: 0.02em;
    text-decoration: none;

    padding: 1.15rem 2.4rem;
    min-height: 72px;
    border-radius: 14px;

    background: var(--accent);
    color: var(--on-accent);
    border: 2px solid rgba(255, 255, 255, 0.25);

    animation: pulse 2s infinite;
    transition: transform 0.15s, filter 0.15s;
  }

  .cta:hover {
    text-decoration: none;
    filter: brightness(1.08);
    transform: translateY(-2px);
  }

  .cta:active {
    transform: scale(0.97);
  }

  .cta.pending {
    background: rgba(251, 191, 36, 0.9);
    animation: none;
  }

  .providers {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: Inter, sans-serif;
    font-size: 0.82rem;
    opacity: 0.75;
  }

  .providers .dot {
    opacity: 0.5;
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 var(--accent-line);
    }
    50% {
      box-shadow: 0 0 22px 6px var(--accent-glow);
    }
  }

  @media screen and (max-width: 520px) {
    .duo,
    .links {
      width: 100%;
    }

    .cta {
      font-size: 1.3rem;
      padding: 1rem 1.2rem;
      min-height: 64px;
      width: 100%;
      text-align: center;
    }
  }
</style>
