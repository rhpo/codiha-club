<script>
  // @ts-nocheck

  import tippy from "sveltejs-tippy";
  import tilt from "vanilla-tilt-svelte";
  import pfp from "$lib/images/icon.png";
  import Logo from "$lib/components/Logo.svelte";
</script>

<section class="ana">
  <div class="image-wrapper" data-aos="fade-right" data-aos-duration="2000">
    <div
      class="image"
      use:tilt={{
        scale: 1,
        max: 30,
        speed: 1000,
        glare: false,
        gyroscope: true,
        startX: 0,
      }}
      style="--primary-color: white;"
    >
      <Logo animated color="white" />
    </div>
  </div>

  <div class="info" data-aos="fade-down">
    <div class="wrap" data-aos="flip-right" data-aos-duration="2000">
      <div class="text">
        <div class="box" />
        <h1 style="white-space: nowrap">
          CODIHA <span class="rainbow">CLUB</span>
          <div class="hue">!</div>
        </h1>
      </div>
      <p style="opacity: 0.7;">
        The <b>Codiha-Club</b>, is an inter-university club based in
        <a
          use:tippy={{
            content: "École Supérieure des Sciences et Technologies d'Alger",
            placement: "top",
          }}
          style="color: white; text-decoration: underline"
          href="https://www.esst-sup.com/"
          target="_blank">ESST d'Alger</a
        >, is where students across
        <u
          use:tippy={{
            content: "ESST, ESI, USTHB...",
            placement: "top",
          }}>all universities</u
        > code, design, and have fun. We are a group of developers, designers, and
        creators who love to create and share our work with the world. 🚀
      </p>
    </div>
  </div>
</section>

<style>
  .hue {
    animation: wave 4s infinite;
    transform-origin: 70% 70%;
    display: inline-block;
  }
  @keyframes rainbow {
    0% {
      color: #ff6f00; /* Vivid Orange */
    }
    10% {
      color: #8e24aa; /* Strong Purple */
    }
    20% {
      color: #d50000; /* Strong Red */
    }
    30% {
      color: #00b8d4; /* Bright Cyan */
    }
    40% {
      color: #ffd600; /* Vivid Yellow */
    }
    50% {
      color: #ff3d00; /* Vivid Coral */
    }
    60% {
      color: #00c853; /* Strong Green */
    }
    70% {
      color: #00e5ff; /* Bright Cyan */
    }
    80% {
      color: #ff0080; /* Vivid Pink */
    }
    90% {
      color: #ff1744; /* Strong Red-Pink */
    }
    100% {
      color: #ff6f00; /* Vivid Orange */
    }
  }

  .rainbow {
    animation: rainbow 20s linear infinite;
  }

  .inline {
    display: inline-flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
  }

  @keyframes wave {
    0% {
      transform: rotate(0deg);
    }
    10% {
      transform: rotate(14deg);
    }
    20% {
      transform: rotate(-8deg);
    }
    30% {
      transform: rotate(14deg);
    }
    40% {
      transform: rotate(-4deg);
    }
    50% {
      transform: rotate(10deg);
    }
    60% {
      transform: rotate(-4deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  section {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 2rem;
    width: 100%;
  }

  section:not(.basic) {
    min-height: calc(100vh - var(--nav));
  }

  .image {
    position: relative;
    width: 100%;
    max-width: var(--mw);
    overflow: hidden;

    transform-style: preserve-3d;
    transform: perspective(1000px);

    border-radius: 50%;
    padding: 2rem;
  }

  .image img {
    filter: invert();
  }

  .image-wrapper {
    overflow: hidden;
    padding: 8px;
    min-width: 300px;
  }

  .me {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    border-radius: 10px;

    animation: shadow 2s infinite;
    transform: translateZ(20px);
  }

  .image img {
    width: 100%;
    max-width: var(--mw);
    border-radius: 10px;
  }

  .info {
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .wrap {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .info h1 {
    font-family: var(--font-main);
    font-weight: 700;

    font-size: min(8rem, 6vw);
  }

  .info p {
    font-family: var(--font-main);
    font-size: 1.8rem;
    font-weight: 400;
  }

  .info h1,
  .info p {
    margin: 10px;
  }

  .text {
    position: relative;
    width: fit-content;
    height: fit-content;
  }

  .box {
    display: none;

    position: absolute;
    top: 0;
    height: 100%;
    right: 0;
    background: var(--back);
    box-shadow: -18px 0px 22px -2px var(--back);
    -webkit-box-shadow: -18px 0px 22px -2px var(--back);
    -moz-box-shadow: -18px 0px 22px -2px var(--back);
    animation: reveal infinite 10s cubic-bezier(0.94, 0.56, 0.42, 0.97);
    animation-delay: 1s;
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.123);
    border-radius: 10px;
    padding: 0 10px;
  }

  @keyframes shadow {
    0% {
      filter: drop-shadow(0 0 0 var(--shadow));
    }

    50% {
      filter: drop-shadow(0 0 10px var(--shadow));
    }

    100% {
      filter: drop-shadow(0 0 0 var(--shadow));
    }
  }

  @keyframes reveal {
    0% {
      width: 0;
    }

    50% {
      width: 0;
    }

    80% {
      width: 100%;
      content: "✨";
    }

    100% {
      width: 0;
    }
  }

  @keyframes flipping {
    0% {
      transform: rotateY(0deg);
    }

    50% {
      transform: rotateY(180deg);
    }

    100% {
      transform: rotateY(0deg);
    }
  }

  @media screen and (max-width: 760px) {
    .info h1 {
      font-size: max(3rem, 8vw);
    }

    .ana {
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .ana p {
      text-align: center;
      font-size: 1rem !important;
    }

    .image-wrapper {
      width: 100%;
      max-width: 60vw;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    :root {
      --space: 1rem;
      --nav: 80px;
    }

    .image {
      max-width: min(300px, 100%);
    }

    .info {
      text-align: left;
    }

    .info p {
      font-size: 1.2rem;
    }
  }

  @media screen and (max-width: 760px) {
    .ana {
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .ana p {
      text-align: center;
      font-size: 1rem !important;
    }

    .image-wrapper {
      width: 100%;
      max-width: 60vw;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    :root {
      --space: 1rem;
      --nav: 80px;
    }

    .image {
      max-width: min(300px, 100%);
    }

    .info {
      text-align: left;
    }

    .info p {
      font-size: 1.2rem;
    }
  }
</style>
