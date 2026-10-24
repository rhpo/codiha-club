<!--
	Ticking countdown to a deadline.

	The server renders the first frame from its own clock, so the page is
	correct before hydration and for anyone with JavaScript off; the interval
	only takes over afterwards.
-->
<script>
  // @ts-nocheck
  import { onDestroy, onMount } from "svelte";
  import { countdownParts } from "$lib/applications.js";

  /** ISO timestamp to count down to. */
  export let until;
  /** Milliseconds remaining as the server measured them, to render first. */
  export let remaining = 0;
  export let label = "";

  let left = remaining;
  let timer = null;

  onMount(() => {
    // Recomputed from the target rather than decremented, so a backgrounded
    // tab that misses ticks still shows the right number when it returns.
    const tick = () => (left = Math.max(0, Date.parse(until) - Date.now()));
    tick();
    timer = setInterval(tick, 1000);
  });

  onDestroy(() => timer && clearInterval(timer));

  $: p = countdownParts(left);
  $: pad = (n) => String(n).padStart(2, "0");
</script>

<div
  class="countdown"
  class:urgent={left > 0 && left < 24 * 3600 * 1000}
  role="timer"
>
  {#if label}<span class="cd-label">{label}</span>{/if}
  <div class="cd-units">
    <span class="unit"><b>{p.days}</b><em>days</em></span>
    <span class="sep">:</span>
    <span class="unit"><b>{pad(p.hours)}</b><em>hrs</em></span>
    <span class="sep">:</span>
    <span class="unit"><b>{pad(p.minutes)}</b><em>min</em></span>
    <span class="sep">:</span>
    <span class="unit"><b>{pad(p.seconds)}</b><em>sec</em></span>
  </div>
</div>

<style>
  .countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.9rem 1rem;
    border-radius: 12px;
    background: var(--glass);
    border: 1px solid var(--glass-border);
  }

  .cd-label {
    font-family: Inter, sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
    text-align: center;
  }

  .cd-units {
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
  }

  .unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.1rem;
  }

  .unit b {
    font-family: Cubano, sans-serif;
    font-size: 1.7rem;
    line-height: 1;
    /* Tabular figures stop the whole row jittering each second. */
    font-variant-numeric: tabular-nums;
  }

  .unit em {
    font-family: Inter, sans-serif;
    font-style: normal;
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 0.15rem;
  }

  .sep {
    font-family: Cubano, sans-serif;
    font-size: 1.3rem;
    color: var(--muted-2);
    transform: translateY(-0.35rem);
  }

  .countdown.urgent .unit b {
    color: var(--accent);
  }

  @media (max-width: 420px) {
    .unit {
      min-width: 2.5rem;
    }
    .unit b {
      font-size: 1.35rem;
    }
  }
</style>
