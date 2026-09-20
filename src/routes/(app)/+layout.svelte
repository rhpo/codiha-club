<script>
  // @ts-nocheck
  import {
    faBook,
    faHome,
    faImages,
    faInfoCircle,
    faMessage,
    faPhone,
    faX,
  } from "@fortawesome/free-solid-svg-icons";
  import { navigating } from "$app/stores";
  import { dialogOptions, menuOpen } from "$lib/store.js";
  import { onMount } from "svelte";
  import { blur, fade, slide } from "svelte/transition";
  import { Hamburger } from "svelte-hamburgers";

  import logo from "$lib/images/icon.png";

  import "./styles.css";
  import "aos/dist/aos.css";

  import AOS from "aos";
  import Fa from "svelte-fa";
  import Button from "$lib/ui/Button.svelte";
  import Input from "$lib/ui/Input.svelte";
  import Alert from "$lib/ui/Alert.svelte";
  import Logo from "$lib/components/Logo.svelte";
  import { onNavigate } from "$app/navigation";

  onMount(() => {
    AOS.init({
      duration: 1000,
      gyroscope: true,
    });
  });

  let links = [
    {
      name: "Home",
      icon: faHome,
      link: "/",
    },
    {
      name: "About",
      icon: faInfoCircle,
      link: "/articles/about",
    },
    {
      name: "Story",
      icon: faBook,
      link: "/articles/story",
    },
    {
      name: "Gallery",
      icon: faImages,
      link: "/articles/gallery",
    },
    {
      name: "Contact",
      icon: faPhone,
      link: "https://www.codiha.com/contact",
    },
  ];

  let pageLoading = true;
  onMount(() => {
    pageLoading = false;

    window.addEventListener("scroll", () => {
      document.documentElement.style.setProperty(
        "--rotation-degrees",
        `${window.scrollY / 2}deg`,
      );
      // document.documentElement.style.setProperty('--rotation-color', `hsl(${window.scrollY / 2}, 100%, 50%)`);
      //no, we're gonna make it start from white and go orange, and NEVER go black

      // document.documentElement.style.setProperty('--rotation-color', `hsl(${window.scrollY / 2}, 100%, 70%)`);
      // I don't like how it starts with the red color, let's change this:
      document.documentElement.style.setProperty(
        "--rotation-color",
        `hsl(${window.scrollY / 2 + 180}, 100%, 70%)`,
      );
    });
  });

  let quoteShown = true;

  onNavigate(() => {
    quoteShown = false;
    pageLoading = true;
    menuOpen.set(false);
    setTimeout(() => {
      pageLoading = false;
    }, 500);
  });
</script>

<div class="alert">
  <Alert
    bind:isOpen={$dialogOptions.open}
    bind:message={$dialogOptions.message}
    bind:title={$dialogOptions.title}
    bind:icon={$dialogOptions.icon}
  />
</div>

{#if pageLoading || $navigating}
  <div class="loading" transition:fade>
    <div class="spinner" />
  </div>
{/if}

{#if $menuOpen}
  <menu transition:slide={{ axis: "x" }}>
    {#each links as link}
      <a href={link.link} class:active={link.link === $navigating?.path}>
        <Fa icon={link.icon} />
        {link.name}
      </a>
    {/each}
  </menu>
{/if}

<nav>
  <section data-aos="fade-right">
    <h1 class="site-title">
      <span class="spinning">
        <img src="/logo.png" width="40px" alt="CODIHA" />
      </span>
      <span class="spinning-color">CODIHA</span>
    </h1>

    <div class="links">
      {#each links as link}
        <a href={link.link}>
          <Fa icon={link.icon} />
          {link.name}
        </a>
      {/each}
    </div>

    <div class="ham">
      <Hamburger bind:open={$menuOpen} />
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

  <p>
    {new Date().getFullYear()} CODIHA&trade; Club
  </p>

  <span class="subfoo">
    Site made by the <a href="https://agency.codiha.com/">CODIHA</a>&trade;
    Agency.
  </span>
</div>

{#if quoteShown}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="quote-box" data-aos="fade-left" transition:blur>
    <h1>JOIN US TODAY!</h1>

    <div class="quote">
      <p>
        Click the Join us button at the bottom to become a member of CODIHA!
      </p>
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
    width: 70%;
    height: 100dvh;
    background-color: rgba(255, 255, 255, 0.119);
    backdrop-filter: blur(10px);
    border-right: 1px solid rgb(166, 197, 197);
    z-index: 4;

    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2rem;
    gap: 2rem;
  }

  menu a {
    text-decoration: none;
    font-size: 1.5rem;
    color: var(--text-primary);

    display: flex;
    align-items: center;
    gap: 1rem;

    transition: all 0.2s ease-in-out;
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
    padding: 2rem 0;
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
    gap: 1rem;
  }

  .site-title * {
    font-family: Cubano, sans-serif;
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
    /* color: var(--rotation-color); */
    color: white;
    text-shadow: 0 0 6px var(--rotation-color);
  }

  :global(.hamburger-inner, .hamburger-inner::before, .hamburger-inner::after) {
    background-color: white !important;
  }

  .ham {
    display: none;
  }

  @media screen and (max-width: 940px) {
    .ham {
      display: block;
    }

    .links {
      display: none;
    }
  }

  :global(.alert *) {
    font-family: Inter, sans-serif;
  }

  .loading {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;

    display: flex;
    justify-content: center;
    align-items: center;

    backdrop-filter: blur(10px);
    z-index: 9999;
  }

  .spinner {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 5px solid #fff;
    border-top-color: transparent;
    animation: spin 1s infinite linear;
  }

  .quote-box {
    width: fit-content;
    border-radius: 15px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;

    max-height: var(--nav-body);
    max-width: calc(var(--width) / 2);
    line-height: 1;

    gap: 1rem;
    padding: 1rem;

    position: fixed;
    bottom: 0;
    margin: 15px;
    right: 0;
    z-index: 3;
    backdrop-filter: blur(10px);
    background-color: rgba(255, 255, 255, 0.119);
    border: 1px solid rgb(166, 197, 197);
  }

  .quote-box h1 {
    margin: 0;
  }

  .quote-box p {
    margin: 0 !important;
  }

  .quote p {
    font-family: "Inter", sans-serif !important;
  }

  @media screen and (max-width: 1080px) {
    .quote-box h1 {
      font-size: 1.5rem;
    }

    .quote-box .quote {
      font-size: 0.8rem;
      line-height: 1;
      word-break: break-word;
    }

    .quote-box {
      padding: 1rem;
    }

    .quote-box {
      height: 80px;
    }
  }

  @media screen and (max-width: 530px) {
    .quote-box h1 {
      font-size: 1.2rem;
    }

    .quote-box .quote {
      font-size: 0.6rem;
      font-weight: 100;
      line-height: 1;
      word-break: break-word;
    }
  }

  :root {
    --nav-body: 140px;
    --nav: calc(var(--nav-body) - var(--space) * 2);
    --space: 3rem;
  }

  :global(body) {
    cursor: var(--cursor), auto;
  }

  nav {
    padding: var(--space);
    height: calc(var(--nav-body) - var(--space) * 2);

    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    width: 100%;
    z-index: 3;

    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgb(166, 197, 197);
  }

  section {
    width: 100%;
    max-width: var(--width);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  nav * {
    color: var(--color-text);
  }

  nav h1 {
    margin: 0;
  }

  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;

    min-height: 100vh;
  }

  .links {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    height: fit-content;
    gap: var(--space);
  }

  .links a {
    text-decoration: none;
    font-family: "Inter", sans-serif;
    font-size: 1.2rem;

    transition: all 0.2s ease-in-out;
  }

  .links:hover a:not(:hover) {
    filter: blur(3px);
  }

  @media screen and (max-width: 760px) {
    nav {
      --nav-body: 120px;
      height: calc(var(--nav-body) - var(--space) * 2);
    }

    :root {
      --space: 1rem;
    }

    nav h1 {
      font-size: 3rem;
    }

    .links {
      display: none;
    }
  }
</style>
