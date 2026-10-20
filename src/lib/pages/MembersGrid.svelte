<script>
  // @ts-nocheck
  import tippy from "sveltejs-tippy";
  import Fa from "svelte-fa";
  import { faUsers } from "@fortawesome/free-solid-svg-icons";
  import { initials } from "$lib/utils.js";

  /** Rows from the public member_directory view. */
  export let members = [];

  // The tooltip carries the name and the points, so the grid itself stays a
  // wall of faces with no text to wrap or truncate.
  const label = (m) =>
    `${m.full_name || "Member"} · ${m.points ?? 0} coin${(m.points ?? 0) === 1 ? "" : "s"}`;
</script>

{#if members.length}
  <section class="block" id="members">
    <div class="section-head" data-aos="fade-right">
      <div>
        <span class="eyebrow">The club</span>
        <h2><Fa icon={faUsers} /> Members</h2>
      </div>
      <span class="tiny muted">{members.length} and counting</span>
    </div>

    <div class="grid-members" data-aos="fade-up">
      {#each members as m (m.id)}
        <div
          class="chip"
          class:board={m.is_board}
          use:tippy={{ content: label(m), placement: "top" }}
        >
          {#if m.avatar_url}
            <img src={m.avatar_url} alt={m.full_name} loading="lazy" />
          {:else}
            <span class="fallback">{initials(m.full_name)}</span>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
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

  /* auto-fill rather than a fixed count: the row stays dense whether the club
     has 8 members or 200, with no breakpoint per size. */
  .grid-members {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 0.6rem;
    width: 100%;
  }

  .chip {
    position: relative;
    aspect-ratio: 1;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--glass-border);
    background: var(--glass);
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s;
  }

  .chip:hover {
    transform: translateY(-3px) scale(1.06);
    border-color: var(--accent);
    z-index: 2;
  }

  /* Staff and above get the accent ring, so the board is visible at a glance
     without a second label. */
  .chip.board {
    border-color: var(--accent-line);
  }

  .chip img,
  .fallback {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .fallback {
    display: grid;
    place-items: center;
    font-family: Cubano, sans-serif;
    font-size: 0.8rem;
    color: var(--muted);
  }

  @media screen and (max-width: 760px) {
    .block h2 {
      font-size: 1.45rem;
    }
    .grid-members {
      grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
      gap: 0.5rem;
    }
  }
</style>
