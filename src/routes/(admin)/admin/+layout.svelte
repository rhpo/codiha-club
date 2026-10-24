<script>
  // @ts-nocheck
  import Fa from "svelte-fa";
  import {
    faGaugeHigh,
    faUsers,
    faCalendarDays,
    faImages,
    faLaptopCode,
    faCheckToSlot,
    faEnvelope,
    faPalette,
    faArrowLeft,
  } from "@fortawesome/free-solid-svg-icons";
  import { page } from "$app/stores";
  import Avatar from "$lib/components/Avatar.svelte";
  import Alert from "$lib/ui/Alert.svelte";
  import LoadingScreen from "$lib/components/LoadingScreen.svelte";
  import { busyCount, dialogOptions, resetBusy } from "$lib/store.js";
  import { reportFormResult } from "$lib/ui/feedback.js";
  import { trackFormSubmissions } from "$lib/ui/busyForms.js";
  import { navigating } from "$app/stores";
  import { afterNavigate } from "$app/navigation";
  import { onMount } from "svelte";
  import { atLeast } from "$lib/roles.js";
  import { faUserShield } from "@fortawesome/free-solid-svg-icons";

  import "$lib/styles/base.css";
  import "$lib/styles/platform.css";
  import "./admin.css";

  export let data;

  // Each tab names the rank it needs, so staff see one tab and a superadmin
  // sees them all. The routes enforce the same thing server-side.
  $: role = data.profile?.role;
  $: tabs = [
    { name: "Overview", icon: faGaugeHigh, href: "/admin", min: "staff" },
    {
      name: "Members",
      icon: faUsers,
      href: "/admin/members",
      badge: data.pendingMembers,
      min: "staff",
    },
    {
      name: "Hackathons",
      icon: faLaptopCode,
      href: "/admin/hackathons",
      badge: data.pendingApplications,
      min: "staff",
    },
    {
      name: "Workshops",
      icon: faCalendarDays,
      href: "/admin/events",
      min: "project_manager",
    },
    { name: "Gallery", icon: faImages, href: "/admin/gallery", min: "staff" },
    {
      name: "Votes",
      icon: faCheckToSlot,
      href: "/admin/polls",
      min: "project_manager",
    },
    { name: "Users", icon: faUserShield, href: "/admin/users", min: "admin" },
    { name: "Campaigns", icon: faEnvelope, href: "/admin/mail", min: "admin" },
    {
      name: "Appearance",
      icon: faPalette,
      href: "/admin/appearance",
      min: "admin",
    },
  ].filter((t) => atLeast(role, t.min));

  const active = (path, href) =>
    href === "/admin"
      ? path === "/admin"
      : path === href || path.startsWith(href + "/");

  // Admin actions are destructive often enough that silent success is wrong.
  let shownFormResult;
  $: if ($page.form !== shownFormResult) {
    shownFormResult = reportFormResult($page.form);
  }

  onMount(() => trackFormSubmissions());
  afterNavigate(() => resetBusy());
</script>

<LoadingScreen active={!!$navigating || $busyCount > 0} label="Working" />

<Alert
  bind:isOpen={$dialogOptions.open}
  bind:message={$dialogOptions.message}
  bind:title={$dialogOptions.title}
  bind:icon={$dialogOptions.icon}
  variant={$dialogOptions.variant}
/>

<div class="admin-shell">
  <header class="admin-top">
    <a class="brand" href="/admin">
      <img src="/logo.png" width="30" alt="CODIHA" />
      <span>ADMIN</span>
    </a>

    <div class="top-right">
      <a class="btn sm ghost" href="/"><Fa icon={faArrowLeft} /> Site</a>
      <div class="whoami">
        <Avatar
          src={data.profile.avatar_url}
          name={data.profile.full_name}
          size={28}
        />
        <span class="tiny">{data.profile.full_name.split(" ")[0]}</span>
      </div>
      <form method="POST" action="/logout">
        <button class="btn sm ghost" type="submit">Sign out</button>
      </form>
    </div>
  </header>

  <nav class="admin-tabs" aria-label="Admin sections">
    {#each tabs as tab}
      <a href={tab.href} class:active={active($page.url.pathname, tab.href)}>
        <Fa icon={tab.icon} />
        <span>{tab.name}</span>
        {#if tab.badge}<em class="count">{tab.badge}</em>{/if}
      </a>
    {/each}
  </nav>

  <main class="admin-main">
    <slot />
  </main>
</div>

<style>
  .admin-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .admin-top {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    background: var(--surface-strong);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--glass-border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
  }
  .brand span {
    font-family: Cubano, sans-serif;
    font-size: 1.1rem;
    letter-spacing: 0.08em;
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .top-right form {
    margin: 0;
  }

  .whoami {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: Inter, sans-serif;
  }

  .admin-tabs {
    position: sticky;
    top: 49px;
    z-index: 4;
    display: flex;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.5rem 1rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--surface);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--glass-border);
    scrollbar-width: none;
  }
  .admin-tabs::-webkit-scrollbar {
    display: none;
  }

  .admin-tabs a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.8rem;
    border-radius: 999px;
    font-family: Inter, sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    color: var(--color-text);
    white-space: nowrap;
    border: 1px solid transparent;
  }

  .admin-tabs a:hover {
    background: var(--glass);
    text-decoration: none;
  }

  .admin-tabs a.active {
    background: var(--accent-soft);
    border-color: var(--accent-line);
    color: var(--accent);
  }

  .count {
    font-style: normal;
    font-size: 0.7rem;
    background: var(--bad);
    color: #3b0a0a;
    border-radius: 999px;
    padding: 0 0.35rem;
    font-weight: 700;
  }

  .admin-main {
    flex: 1;
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    padding: 1.25rem 1rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  @media (min-width: 760px) {
    .admin-top,
    .admin-tabs {
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }
    .admin-main {
      padding: 1.75rem 1.5rem 4rem;
    }
  }

  /* Two stacked sticky bars on a 375px screen left almost no room for the
	   page itself, and 'top: 49px' assumed a header height that only holds on
	   desktop. On phones the header stays, the tabs scroll away. */
  @media (max-width: 759px) {
    .admin-tabs {
      position: static;
    }

    .brand span {
      font-size: 0.95rem;
    }

    .top-right {
      gap: 0.35rem;
    }

    /* The avatar alone identifies you; the name was pushing Sign out off. */
    .whoami .tiny {
      display: none;
    }

    .admin-top .btn.sm {
      padding: 0.45rem 0.6rem;
      font-size: 0.78rem;
    }
  }
</style>
