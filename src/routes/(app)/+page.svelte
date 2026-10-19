<script>
  // @ts-nocheck

  import def from "$lib/images/cursors/default.png";
  import pointer from "$lib/images/cursors/pointer.png";
  import text from "$lib/images/cursors/text.png";
  import interdit from "$lib/images/cursors/not-allowed.png";
  import Hero from "$lib/pages/Hero.svelte";
  import SLink from "$lib/pages/SLink.svelte";
  import SInstagram from "$lib/pages/SInstagram.svelte";
  import WhatTeach from "$lib/pages/WhatTeach.svelte";
  import Why from "$lib/pages/Why.svelte";
  import GetStarted from "$lib/pages/GetStarted.svelte";
  import LandingLeaderboard from "$lib/pages/LandingLeaderboard.svelte";
  import ScoreExplainer from "$lib/pages/ScoreExplainer.svelte";
  import EventCard from "$lib/components/EventCard.svelte";
  import HackathonCard from "$lib/components/HackathonCard.svelte";
  import Fa from "svelte-fa";
  import {
    faCalendarDays,
    faLaptopCode,
  } from "@fortawesome/free-solid-svg-icons";

  export let data;
</script>

<main
  class="cursors"
  style="--default: url({def}); --pointer: url({pointer}); --text: url({text}); --interdit: url({interdit});"
>
  <div class="autosize">
    <Hero />
    <Why />

    <LandingLeaderboard
      rows={data.leaderboard}
      semester={data.semester}
      meId={data.profile?.id}
    />

    <ScoreExplainer />

    <section class="block" id="events">
      <div class="section-head" data-aos="fade-right">
        <div>
          <span class="eyebrow">What's next</span>
          <h2><Fa icon={faCalendarDays} /> Upcoming events</h2>
        </div>
        <a href="/events">All events →</a>
      </div>

      {#if data.events.length}
        <div class="grid cols-3">
          {#each data.events as event, i (event.id)}
            <div class="cell" data-aos="fade-up" data-aos-delay={i * 120}>
              <EventCard {event} />
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty" data-aos="fade-up">Nothing scheduled right now.</p>
      {/if}
    </section>

    <section class="block" id="hackathons">
      <div class="section-head" data-aos="fade-right">
        <div>
          <span class="eyebrow">Build something</span>
          <h2><Fa icon={faLaptopCode} /> Open hackathons</h2>
        </div>
        <a href="/hackathons">All hackathons →</a>
      </div>

      {#if data.hackathons.length}
        <div class="grid cols-2">
          {#each data.hackathons as hackathon, i (hackathon.id)}
            <div class="cell" data-aos="fade-up" data-aos-delay={i * 120}>
              <HackathonCard {hackathon} />
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty" data-aos="fade-up">
          No hackathon open for applications right now.
        </p>
      {/if}
    </section>

    <WhatTeach />
    <br />
    <GetStarted />
    <br />
    <SLink />
    <SInstagram />

    <br />
  </div>
</main>

<style>
  :root {
    --shadow: white;
    --mw: 800px;

    --text-shadow: rgb(59 130 246);
  }

  .block {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    margin-bottom: 2rem;
  }

  .block h2 {
    font-size: 1.8rem;
  }


  :global(.container) {
    margin-bottom: 50px;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  :global(.container h1) {
    margin: 0;
    animation: glow 2s infinite;
  }

  @keyframes glow {
    0% {
      text-shadow: 0 0 0 var(--text-shadow);
    }

    50% {
      text-shadow: 0 0 10px var(--text-shadow);
    }

    100% {
      text-shadow: 0 0 0 var(--text-shadow);
    }
  }

  :global(.container p) {
    margin-top: 15px;
    margin-bottom: 30px;
    font-family: "Inter", sans-serif;
  }

  /* The custom cursor images only exist on this page. These used to be
     `:global(main ...)`, which kept applying after a client-side navigation to
     a route where --pointer is undefined, so `cursor: var(--pointer), auto`
     computed to `auto` and every link lost its pointer. Scoped to .cursors. */
  :global(.cursors) {
    cursor: var(--default), auto;
  }

  :global(
      .cursors p,
      .cursors h1,
      .cursors h2,
      .cursors h3,
      .cursors h4,
      .cursors h5,
      .cursors h6,
      .cursors span,
      .cursors input,
      .cursors textarea
    ) {
    cursor: var(--text), auto;
  }

  :global(
      .cursors button,
      .cursors input[type="button"],
      .cursors input[type="submit"],
      .cursors input[type="reset"],
      .cursors a,
      .cursors button *,
      .cursors input[type="button"] *,
      .cursors input[type="submit"] *,
      .cursors input[type="reset"] *,
      .cursors a *
    ) {
    cursor: var(--pointer), auto !important;
  }

  main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 2rem;

    min-height: 100vh;
    width: 100%;

    /* clears the fixed nav, then leaves room to breathe under it */
    padding-top: calc(var(--nav) + 2rem);
  }

  .autosize {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 2rem;

    width: 100%;
    max-width: var(--width);

    padding: var(--space);
  }

  @media screen and (max-width: 760px) {
    main {
      width: 100%;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .block h2 {
      font-size: 1.45rem;
    }
  }
</style>
