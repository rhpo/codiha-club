<script>
  // @ts-nocheck

  import Logo from "$lib/components/Logo.svelte";
  import "$lib/styles/markdown.css";

  export let data;
</script>

<main data-aos="fade-up" data-aos-duration="1000">
  <div class="info">
    <div class="logo" style="--primary-color: white;">
      <Logo animated />
    </div>

    <h1>
      {data.article.title}
    </h1>
    <p>
      {data.article.description}
    </p>
  </div>

  <div class="content markdown-body">
    {@html data.article.content}
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 2rem;

    padding: 4rem 2rem;
    padding-top: 12rem;
  }

  .logo {
    width: 150px;
    height: auto;
    margin-bottom: 1.5rem;
  }

  .info {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .info h1,
  .info p {
    margin: 0;
  }

  .info h1 {
    font-family: "Cubano", sans-serif;
    font-size: 3rem;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .info p {
    font-family: "Inter", sans-serif;
    font-size: 1.2rem;
    color: var(--text-secondary);
  }

  .content :global(img),
  .content :global(iframe),
  .content :global(video) {
    width: 100%;
    max-width: calc(var(--width) * 0.5);
    height: auto;
    margin: 0 auto;
    display: block;
    margin: 2rem auto;
  }

  @media screen and (max-width: 760px) {
    main {
      padding-top: 10rem;
    }

    .info h1 {
      font-size: 2.2rem;
    }

    .info p {
      font-size: 1rem;
    }

    .content :global(img),
    .content :global(iframe),
    .content :global(video) {
      width: 100%;
      max-width: calc(var(--width) * 0.7);
      height: auto;
      margin: 0 auto;
      display: block;
      margin: 2rem auto;
    }
  }

  .content {
    width: 100%;
    max-width: calc(var(--width) * 0.8);
  }

  .content :global(*) {
    font-family: "Inter", sans-serif !important;
  }

  .content :global(a) {
    color: var(--accent);
    text-decoration: underline;
  }
</style>
