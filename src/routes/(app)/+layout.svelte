<script>
  // @ts-nocheck
  import {
    faCalendarDays,
    faGaugeHigh,
    faHome,
    faImages,
    faInfoCircle,
    faLaptopCode,
    faRankingStar,
    faScrewdriverWrench,
    faRightToBracket,
    faEnvelope,
    faX,
  } from "@fortawesome/free-solid-svg-icons";
  import { navigating, page } from "$app/stores";
  import { busyCount, dialogOptions, menuOpen, resetBusy } from "$lib/store.js";
  import { reportFormResult } from "$lib/ui/feedback.js";
  import { atLeast } from "$lib/roles.js";
  import { trackFormSubmissions } from "$lib/ui/busyForms.js";
  import LoadingScreen from "$lib/components/LoadingScreen.svelte";
  import { onMount } from "svelte";
  import { blur, fade, slide } from "svelte/transition";
  import { Hamburger } from "svelte-hamburgers";

  import "$lib/styles/base.css";
  import "$lib/styles/platform.css";
  import "aos/dist/aos.css";

  import AOS from "aos";
  import Fa from "svelte-fa";
  import Alert from "$lib/ui/Alert.svelte";
  import Logo from "$lib/components/Logo.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import { afterNavigate, onNavigate } from "$app/navigation";

  onMount(() => {
    AOS.init({
      duration: 700,
      easing: "ease-out-cubic",
      once: true,
      offset: 60,
      gyroscope: true,
    });
  });

  // Client-side navigation swaps the DOM without a reload, so AOS has to be
  // told about the new elements. Without this they stay stuck at opacity 0.
  afterNavigate(() => AOS.refreshHard());

  const links = [
    { name: "Home", icon: faHome, link: "/" },
    { name: "Events", icon: faCalendarDays, link: "/events" },
    { name: "Hackathons", icon: faLaptopCode, link: "/hackathons" },
    { name: "Leaderboard", icon: faRankingStar, link: "/leaderboard" },
    { name: "Gallery", icon: faImages, link: "/articles/gallery" },
    { name: "About us", icon: faInfoCircle, link: "/articles/about" },
  ];

  // Every form action in the group reports through the shared modal. Tracking
  // the last result by identity stops it reopening on unrelated store updates.
  let shownFormResult;
  $: if ($page.form !== shownFormResult) {
    shownFormResult = reportFormResult($page.form);
  }

  $: profile = $page.data?.profile ?? null;
  $: isApproved = profile?.status === "approved";
  $: isAdmin = isApproved && atLeast(profile?.role, "staff");

  // Secondary nav entries that depend on who is looking.
  $: accountLinks = profile
    ? [
        isApproved
          ? { name: "Dashboard", icon: faGaugeHigh, link: "/dashboard" }
          : { name: "Membership", icon: faGaugeHigh, link: "/pending" },
        ...(isApproved
          ? [{ name: "Mail", icon: faEnvelope, link: "/mail" }]
          : []),
        ...(isAdmin
          ? [{ name: "Admin", icon: faScrewdriverWrench, link: "/admin" }]
          : []),
      ]
    : [{ name: "Join the club", icon: faRightToBracket, link: "/login" }];

  const isActive = (path, link) =>
    link === "/" ? path === "/" : path === link || path.startsWith(link + "/");

  onMount(() => trackFormSubmissions());

  onMount(() => {
    window.addEventListener("scroll", () => {
      document.documentElement.style.setProperty(
        "--rotation-degrees",
        `${window.scrollY / 2}deg`,
      );
      document.documentElement.style.setProperty(
        "--rotation-color",
        `hsl(${window.scrollY / 2 + 180}, 100%, 70%)`,
      );
    });
  });

  let quoteShown = true;
  $: joinNudgeVisible = quoteShown && !profile && $page.url.pathname === "/";

  // $navigating already covers client-side navigation, so the old fixed 500ms
  // timer was only ever adding delay to every page change.
  onNavigate(() => menuOpen.set(false));

  // A form submit that ends in a client-side redirect resolves here.
  afterNavigate(() => resetBusy());
</script>

<div class="alert">
  <Alert
    bind:isOpen={$dialogOptions.open}
    bind:message={$dialogOptions.message}
    bind:title={$dialogOptions.title}
    bind:icon={$dialogOptions.icon}
    variant={$dialogOptions.variant}
  />
</div>

<LoadingScreen active={!!$navigating || $busyCount > 0} />

{#if $menuOpen}
  <menu transition:slide={{ axis: "x" }}>
    {#each links as link}
      <a
        href={link.link}
        class:active={isActive($page.url.pathname, link.link)}
        on:click={() => menuOpen.set(false)}
      >
        <Fa icon={link.icon} />
        {link.name}
      </a>
    {/each}

    <div class="menu-sep" />

    {#each accountLinks as link}
      <a
        href={link.link}
        class:active={isActive($page.url.pathname, link.link)}
        on:click={() => menuOpen.set(false)}
      >
        <Fa icon={link.icon} />
        {link.name}
      </a>
    {/each}

    {#if profile}
      <form method="POST" action="/logout" class="menu-logout">
        <button type="submit">Sign out</button>
      </form>
    {/if}
  </menu>
{/if}

<nav>
  <section>
    <a class="site-title" href="/">
      <span class="spinning">
        <img src="/logo.png" width="40px" alt="CODIHA" />
      </span>
      <span class="spinning-color">CODIHA</span>
    </a>

    <div class="links">
      {#each links as link}
        <a href={link.link} class:active={isActive($page.url.pathname, link.link)}>
          <Fa icon={link.icon} />
          {link.name}
        </a>
      {/each}
    </div>

    <div class="account">
      {#if profile}
        <a
          class="me"
          href={isApproved ? "/dashboard" : "/pending"}
          title={profile.full_name}
        >
          <Avatar src={profile.avatar_url} name={profile.full_name} size={32} />
          <span class="me-name">{(profile.full_name || "Member").split(" ")[0]}</span>
          {#if !isApproved}<span class="pill warn tiny">Pending</span>{/if}
        </a>
        {#if isAdmin}
          <a class="btn sm ghost admin-link" href="/admin">
            <Fa icon={faScrewdriverWrench} /> Admin
          </a>
        {/if}
      {:else}
        <a class="btn join" href="/login">
          <Fa icon={faRightToBracket} /> Join the club
        </a>
      {/if}

      <div class="ham">
        <Hamburger bind:open={$menuOpen} />
      </div>
    </div>
  </section>
</nav>

<main>
  <slot />
</main>

<div class="footer">
  <div class="sponsors">
    <div class="codiha" style="--primary-color: white;">
      <Logo />
    </div>

    <img class="esst" src="/images/esst.png" alt="ESST" />
  </div>

  <div class="foot-links">
    <a href="/events">Events</a>
    <a href="/hackathons">Hackathons</a>
    <a href="/leaderboard">Leaderboard</a>
    <a href="/articles/about">About</a>
    <a href="/articles/story">Our story</a>
    <a href="/articles/gallery">Gallery</a>
    <a href="https://www.codiha.com/contact">Contact</a>
  </div>

  <p>
    {new Date().getFullYear()} CODIHA&trade; Club
  </p>

  <span class="subfoo">
    Site made by the <a href="https://agency.codiha.com/">CODIHA</a>&trade;
    Agency.
  </span>
</div>

{#if joinNudgeVisible}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="quote-box" data-aos="fade-left" transition:blur>
    <div class="quote">
      <h1>JOIN US TODAY!</h1>
      <p>Sign in with Google or Discord to get your member dashboard.</p>
      <a class="btn block" href="/login">Join the club</a>
    </div>

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <p
      on:click={() => (quoteShown = false)}
      style="margin: 0; cursor: pointer; font-size: 12px"
    >
      <Fa icon={faX} />
    </p>
  </div>
{/if}

<style>
  menu {
    position: fixed;
    margin: 0;
    padding: 0;
    top: 0;
    left: 0;
    width: 78%;
    max-width: 320px;
    height: 100dvh;
    background-color: var(--surface-strong);
    backdrop-filter: blur(14px);
    border-right: 1px solid rgb(166, 197, 197);
    z-index: 4;

    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2rem 1.5rem;
    gap: 1.25rem;
    overflow-y: auto;
  }

  menu a {
    text-decoration: none;
    font-size: 1.25rem;
    color: var(--color-text);

    display: flex;
    align-items: center;
    gap: 0.9rem;

    transition: all 0.2s ease-in-out;
  }

  menu a.active {
    color: var(--accent);
  }

  .menu-sep {
    height: 1px;
    background: rgba(166, 197, 197, 0.4);
    width: 100%;
  }

  .menu-logout button {
    background: none;
    border: 1px solid rgba(166, 197, 197, 0.4);
    color: var(--color-text);
    border-radius: 10px;
    padding: 0.55rem 0.9rem;
    font-family: Inter, sans-serif;
    cursor: pointer;
    width: 100%;
  }

  .sponsors {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 1rem;
    font-size: 0.6rem;
    margin-bottom: 0.7rem !important;
  }

  .codiha {
    width: 50px;
  }

  .esst {
    width: 80px;
  }

  .footer {
    margin-top: 0.4rem;
    padding: 2rem 1rem;
    width: 100%;
    text-align: center;
    user-select: none;
    background-color: rgba(255, 255, 255, 0.119);
    backdrop-filter: blur(5px);

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .footer * {
    font-family: "Inter", sans-serif;
    margin: 0;
  }

  .foot-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem 1.1rem;
    margin-bottom: 0.9rem !important;
  }

  .foot-links a {
    color: var(--color-text);
    opacity: 0.8;
    font-size: 0.85rem;
    text-decoration: none;
  }

  .foot-links a:hover {
    opacity: 1;
    color: var(--accent);
  }

  .subfoo,
  .subfoo * {
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .subfoo a {
    text-decoration: underline;
    color: var(--accent);
  }

  .site-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    flex: 0 0 auto;
  }

  .site-title * {
    font-family: Cubano, sans-serif;
    font-size: 1.6rem;
  }

  .site-title {
    transform: translateY(-2px);
  }

  .spinning img {
    transform: translateY(2px);
  }

  .spinning {
    display: inline-flex;
    transform-origin: center;
    transform: rotate(var(--rotation-degrees));
  }

  .spinning-color {
    color: var(--color-text);
    text-shadow: 0 0 6px var(--rotation-color);
  }

  :global(.hamburger-inner, .hamburger-inner::before, .hamburger-inner::after) {
    background-color: white !important;
  }

  .ham {
    display: none;
  }

  .account {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 0 0 auto;
  }

  .me {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    padding: 0.25rem 0.6rem 0.25rem 0.25rem;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: var(--glass);
  }

  .me:hover {
    text-decoration: none;
    border-color: var(--glass-border-strong);
  }

  .me-name {
    font-family: Inter, sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .join {
    font-family: Inter, sans-serif;
    font-weight: 700;
    box-shadow: 0 8px 22px -12px var(--accent-glow);
  }

  @media screen and (max-width: 520px) {
    /* Tighter, but still a 44px touch target next to the hamburger. */
    .join {
      font-size: 0.85rem;
      padding: 0.6rem 0.9rem;
      min-height: 44px;
      gap: 0.4rem;
    }
  }

  :global(.alert *) {
    font-family: Inter, sans-serif;
  }

  .quote-box {
    width: fit-content;
    border-radius: 15px;
    display: flex;
    flex-direction: row;
    align-items: flex-start;

    max-width: min(360px, calc(100vw - 30px));
    line-height: 1.2;

    gap: 0.75rem;
    padding: 1rem;

    position: fixed;
    bottom: 0;
    margin: 15px;
    right: 0;
    z-index: 3;
    backdrop-filter: blur(10px);
    background-color: var(--surface);
    border: 1px solid rgb(166, 197, 197);
  }

  .quote-box h1 {
    margin: 0 0 0.4rem;
    font-size: 1.25rem;
    text-align: left;
  }

  .quote-box .quote {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .quote-box .quote p {
    margin: 0 !important;
    font-family: "Inter", sans-serif !important;
    font-size: 0.82rem;
  }

  :root {
    --nav-body: 96px;
    /* content offset under the fixed nav */
    --nav: var(--nav-body);
    --space: 3rem;
  }


  nav {
    padding: 0 var(--space);
    height: var(--nav-body);

    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    width: 100%;
    z-index: 3;

    background-color: var(--surface-nav);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgb(166, 197, 197);
  }

  section {
    width: 100%;
    max-width: var(--width);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  nav * {
    color: var(--color-text);
  }

  main {
    display: flex;
    flex-direction: column;
    align-items: center;

    min-height: 100vh;
    width: 100%;
  }

  .links {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: fit-content;
    gap: 1.5rem;
    flex: 1 1 auto;
    justify-content: center;
  }

  .links a {
    text-decoration: none;
    font-family: "Inter", sans-serif;
    font-size: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;

    transition: all 0.2s ease-in-out;
  }

  .links a.active {
    color: var(--accent);
  }

  .links:hover a:not(:hover) {
    filter: blur(2px);
  }

  @media screen and (max-width: 1180px) {
    .ham {
      display: block;
    }

    .links {
      display: none;
    }
  }

  @media screen and (max-width: 760px) {
    :root {
      --space: 1rem;
      --nav-body: 76px;
    }

    .site-title * {
      font-size: 1.3rem;
    }

    .me-name {
      display: none;
    }

    .admin-link :global(span),
    .admin-link {
      font-size: 0.75rem;
    }
  }

  @media screen and (max-width: 420px) {
    .admin-link {
      display: none;
    }
  }
</style>
