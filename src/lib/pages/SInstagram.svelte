<script>
  // @ts-nocheck

  import Button from "$lib/ui/Button.svelte";

  import Input from "$lib/ui/Input.svelte";
  import { dialog } from "$lib/ui/dialog";
  import {
    faExclamationCircle,
    faMessage,
  } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
</script>

<main>
  <h1 data-aos="fade-right">
    <Fa icon={faMessage} /> Our Instagram!
  </h1>

  <iframe
    data-aos="flip-left"
    data-aos-duration="1200"
    title="Instagram Post"
    class="instagram-media instagram-media-rendered svelte-15byjn2"
    id="instagram-embed-1"
    allowtransparency="true"
    allowfullscreen=""
    frameborder="0"
    height="664"
    scrolling="no"
    src="https://www.instagram.com/codihaclub/embed/?cr=1&amp;v=14&amp;wp=540&amp;"
  ></iframe>
</main>

<style>
  main {
    width: 100%;
    max-width: var(--mw);
    padding: 0 20px;
    aspect-ratio: 1440/1180;
  }

  iframe {
    border: none;

    overflow: hidden;
    width: 100%;
    height: 100%;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    main {
      aspect-ratio: 1440/1020;
      margin-bottom: 1rem;
    }
  }
</style>
