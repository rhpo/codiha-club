<script>
  import { faHeart } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";

  import { Highlight } from "svelte-highlight";
  import c from "svelte-highlight/languages/c";
  import "svelte-highlight/styles/github.css";
  import themeCode from "svelte-highlight/styles/github-dark";

  // write funny non-sense code for welcoming students in the community
  const code = `
// Welcome to CODIHA Community 🎉

#include <codiha.h>

int main() {
  joinClub(YOU, CODIHA);

  if (YOU->skills) {
	share(YOU->skills, community);
  } else {
	teach(YOU, CODIHA);
  }

  if (workshops) {
  	YOU->join(workshops);
  }
}

`;
</script>

<svelte:head>
  {@html themeCode}
</svelte:head>

<div class="container skillbox" data-aos="flip-right" data-aos-duration="1200">
  <h1><Fa icon={faHeart} /> Why CODIHA?</h1>
  <p class="description">
    CODIHA is where you collaborate on projects, gain hands-on experience, and
    connect with peers from different universities. It's a place to build your
    skills, earn certifications after each workshop, and share knowledge in a
    supportive community, helping you grow beyond the limits of a typical
    classroom.
  </p>

  <div class="code">
    <Highlight language={c} {code} />
  </div>
</div>

<br />

<style>
  /* embed {
		width: 100%;
		max-width: var(--mw);
		margin: 20px auto;
		display: block;
	} */

  @import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap");

  .code {
    width: 100%;
    max-width: var(--mw);
    display: block;

    border-radius: 10px;
    overflow: hidden;
  }

  :global(pre) {
    margin: 0;
    padding: 0;

    box-shadow: 0 0 20px rgba(255, 255, 255, 0.591) !important;
  }

  .code :global(*) {
    font-family: "JetBrains Mono", monospace !important;
    font-optical-sizing: auto;
    font-style: normal;

    text-align: left;
  }

  :global(.colored) {
    color: var(--accent);
  }

  :global(.tooltip) {
    margin: 0;
    font-family: "Inter", sans-serif;
    font-size: 15px;
    font-weight: 500;
    color: white;
  }

  .icon {
    position: relative;
    width: fit-content;
  }

  .icon *:not(.blur) {
    z-index: 2;
  }

  .blur {
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0.7;
    animation: blur 3s infinite;
  }

  @keyframes blur {
    0% {
      filter: blur(0px);
    }

    50% {
      filter: blur(20px);
    }

    100% {
      filter: blur(0px);
    }
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
    margin-bottom: 20px;
  }

  .skills {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }

  .skill {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 10px;
  }

  .skill i {
    font-size: 50px;
  }
</style>
