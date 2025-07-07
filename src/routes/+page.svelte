<script lang="ts">
  import { onMount } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  import {
    faGithub,
    faNpm,
    faPython,
    faStackOverflow,
  } from "@fortawesome/free-brands-svg-icons";

  import {
    faCircleChevronDown,
    faComments,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";

  import Logo from "$lib/images/Logo.svelte";

  import ProfileLink from "./ProfileLink.svelte";
  import InfoBox from "./InfoBox.svelte";
  import ContactInfo from "./ContactInfo.svelte";

  const metaTitle = "Rik Wanders - Freelance Full Stack Developer";
  const metaUrl = "https://www.rikwanders.tech/";
  const metaDescription =
    "Freelance Full Stack Developer available for remote projects. Application development, system optimization, and technical strategy consulting. Focused on short-term engagements (2-6 months).";
  const metaImg = "https://www.rikwanders.tech/images/logo.png";

  let elAboutSection: HTMLElement;
  let elContactSection: HTMLElement;
  let elMoreInfo: HTMLElement;

  let showGetInTouch = false;
  const currentYear: number = (new Date()).getFullYear();
  const devYearsExperience: number = currentYear - 2007;
  const remoteWorkYearsExperience: number = currentYear - 2020;

  function handleGetInTouch() {
    showGetInTouch = true;

    elContactSection.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function handleCloseContactInfo() {
    showGetInTouch = false;
  }

  function handleMoreInfo() {
    elAboutSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    elMoreInfo.blur();
  }

  onMount(() => {
    addEventListener("scroll", () => {
      const moreInfoScrollTop = elMoreInfo.getBoundingClientRect().top;
      const viewportHalf = window.innerHeight / 2;

      let opacity = 0.7 - (viewportHalf - moreInfoScrollTop) / viewportHalf;

      if (opacity > 1) {
        opacity = 1;
      } else if (opacity < 0) {
        opacity = 0;
      }

      elMoreInfo.style.opacity = `${opacity}`;
    });
  });
</script>

<svelte:head>
  <title>Rik Wanders - Freelance Full Stack Developer</title>

  <meta name="title" content={metaTitle} />
  <meta name="description" content={metaDescription} />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content={metaUrl} />
  <meta property="og:title" content={metaTitle} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:image" content={metaImg} />

  <!-- X (Twitter) -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content={metaUrl} />
  <meta property="twitter:title" content={metaTitle} />
  <meta property="twitter:description" content={metaDescription} />
  <meta property="twitter:image" content={metaImg} />
</svelte:head>

<div class="flex h-full min-h-screen flex-col justify-between">
  <div class="flex flex-col items-center">
    <div
      class="sm:px-10 pt-10 md:pt-25 w-full flex flex-col items-center bg-gray-100 min-h-screen"
    >
      <div>
        <!-- <img src={logo} alt="Logo" class="h-40 w-40" /> -->
        <Logo class="h-40 w-40" />
      </div>

      <div class="px-4 mt-5 text-center">
        <h1 class="text-3xl font-medium">Rik Wanders</h1>
        <h2 class="mt-4 text-xl">Freelance Full Stack Developer</h2>
        <h3 class="mt-4">Python • Django • React • Node.js</h3>

        <h4 class="mt-10 italic">
          Building scalable web applications for remote teams
        </h4>
      </div>

      <div
        bind:this={elContactSection}
        class="mt-15 max-sm:w-full md:mt-20"
      >
        {#if showGetInTouch}
          <div
            class="p-8 bg-white sm:rounded-xl border-y-2 sm:border-x-2 border-[var(--primary-color)] relative"
          >
            <button
              class="absolute right-3 top-2 cursor-pointer"
              on:click={handleCloseContactInfo}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3 class="text-center text-3xl font-medium mb-4 px-8">
              Contact info
            </h3>
            <ContactInfo />
          </div>
        {:else}
          <div class="text-center">
            <button
              class="inline-flex items-center gap-2 bg-[var(--primary-color)] text-white py-4 px-8 rounded-lg text-xl font-semibold cursor-pointer hover:bg-[var(--highlight-color)] focus:bg-[var(--highlight-color)] scale-100 hover:scale-105 focus:scale-105 transition"
              on:click={handleGetInTouch}
            >
              <FontAwesomeIcon icon={faComments} />
              <span class="text-nowrap">
                Get in touch
              </span>
            </button>
          </div>
        {/if}
      </div>

      <div class="flex-grow"></div>

      <button
        bind:this={elMoreInfo}
        class="flex-end mt-14 mb-15 flex items-center gap-2 cursor-pointer p-2 scale-100 hover:scale-110 focus:scale-110 hover:text-[var(--highlight-color)] focus:text-[var(--highlight-color)] transition"
        on:click={handleMoreInfo}
      >
        <span>
          <FontAwesomeIcon icon={faCircleChevronDown} />
        </span>
        <span
          class="text-md font-semibold"
        >
          More Info
        </span>
      </button>
    </div>

    <div
      class="flex flex-col items-stretch w-full min-h-screen bg-[var(--shade-color)]"
    >
      <div class="flex flex-col items-center px-10">
        <div
          bind:this={elAboutSection}
          class="overflow-hidden max-w-[var(--max-content-width)] pt-10 md:pt-15"
        >
          <h3 class="text-3xl text-center font-semibold mb-8 md:mb-10">
            About me
          </h3>

          <div
            class="flex gap-10 justify-center max-md:flex-col max-md:items-center"
          >
            <!-- <div class="md:max-w-[50%]"> -->
            <div class="md:max-w-[525px]">
              <p>
                With over {devYearsExperience} years of full-stack web
                development experience, I specialize in building and scaling
                complex, high-traffic applications that deliver exceptional user
                experiences. My expertise spans the entire development
                lifecycle, from initial architecture decisions to production
                deployment and optimization.
              </p>

              <p class="my-4">
                I bring {remoteWorkYearsExperience}+ years of remote work
                experience and excel at collaborating with distributed teams
                across different time zones and cultures. This background has
                honed my communication skills and ability to work autonomously
                while maintaining strong team alignment.
              </p>

              <p class="my-4">
                I stay at the forefront of technology by integrating AI tools
                into my development workflow and consistently applying current
                industry best practices. Security is paramount in everything I
                build—I maintain up-to-date knowledge of security best practices
                to ensure applications are both performant and secure.
              </p>

              <p>
                Whether architecting scalable backend systems, crafting
                intuitive frontend interfaces, or optimizing application
                performance, I combine technical expertise with a deep
                understanding of business needs to deliver solutions that drive
                real results.
              </p>
            </div>

            <div
              class="flex flex-col gap-6 max-md:mt-6 max-md:w-fit"
            >
              <InfoBox headerText="Key skills:">
                <ul class="mt-4 list-disc ml-4 px-4 pb-4 font-bold">
                  <li>Python, Django, FastAPI, Numpy</li>
                  <li class="my-4">Javascript, Node.js, React, Svelte</li>
                  <li class="my-4">SQL & NoSQL Databases</li>
                  <li>Linux, DevOps, CI/CD, Docker</li>
                </ul>
              </InfoBox>

              <InfoBox headerText="Available for:">
                <ul class="mt-4 list-disc ml-4 px-4 pb-4 font-bold">
                  <li>Application development</li>

                  <li class="my-4">System optimization</li>

                  <li class="my-4">Technical strategy consulting</li>

                  <li>Short-term remote jobs</li>
                </ul>
              </InfoBox>

              <div class="px-10 text-center text-nowrap">
                <strong>Timezone: </strong>
                Europe/Amsterdam
              </div>
            </div>
          </div>

          <div class="mt-15 mb-15 px-10 flex flex-col items-center">
            <ul
              class="max-sm:grid max-sm:grid-cols-2 sm:flex sm:flex-wrap sm:justify-center sm:justify-between gap-15"
            >
              <li>
                <ProfileLink
                  href="https://github.com/gitaarik"
                  icon={faGithub}
                  title="GitHub"
                />
              </li>

              <li>
                <ProfileLink
                  href="https://pypi.org/user/gitaarik/"
                  icon={faPython}
                  title="PyPi"
                />
              </li>

              <li>
                <ProfileLink
                  href="https://www.npmjs.com/~gitaarik"
                  icon={faNpm}
                  title="npm"
                />
              </li>

              <li>
                <ProfileLink
                  href="https://stackoverflow.com/users/1248175/gitaarik"
                  icon={faStackOverflow}
                  title="Stack Overflow"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        class="pt-15 px-10 flex flex-col items-center gap-2 bg-[var(--text-color)] text-[var(--light-color)]"
      >
        <div class="flex flex-col w-full max-w-[var(--max-content-width)]">
          <div>
            <h4 class="font-semibold text-lg mb-2">Rik Wanders Software</h4>

            <div class="text-sm">
              <div>Hertzogstraat 37</div>
              <div>2021 AE&nbsp;&nbsp;Haarlem</div>
              <div>The Netherlands</div>
              <div class="mt-2">VAT ID: NL001792484B78</div>
            </div>
          </div>

          <div
            class="flex sm:justify-between max-sm:flex-col w-full text-xs text-gray-400 mt-8 mb-2"
          >
            <div>
              Copyright © {currentYear} Rik Wanders Software
            </div>

            <div class="max-sm:mt-2">
              Logo Vector by
              <a
                class="underline"
                href="https://www.vecteezy.com/free-vector/logo"
                target="_blank"
              >Vecteezy</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
