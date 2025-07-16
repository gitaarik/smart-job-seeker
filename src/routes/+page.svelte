<script lang="ts">
  import { onMount } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  import {
    faGithub,
    faLinkedin,
    faNpm,
    faPython,
    faStackOverflow,
  } from "@fortawesome/free-brands-svg-icons";

  import { faCircleChevronDown } from "@fortawesome/free-solid-svg-icons";

  import profilePhoto from "$lib/images/profile-photo.jpeg";
  import Logo from "$lib/components/Logo.svelte";
  import ProfileLink from "$lib/components/ProfileLink.svelte";
  import InfoBox from "$lib/components/InfoBox.svelte";
  import GetInTouchButton from "$lib/components/contact-info/GetInTouchButton.svelte";
  import References from "$lib/components/references/References.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";

  const metaTitle = "Rik Wanders - Freelance Full Stack Developer";
  const metaUrl = "https://www.rikwanders.tech/";
  const metaDescription =
    "Freelance Full Stack Developer available for remote projects. Specialized in application development, system optimization, and technical strategy consulting. Focused on short-term engagements (2-6 months).";
  const metaImg = "https://www.rikwanders.tech/images/logo.png";

  let elAboutSection: HTMLElement;
  let elMoreInfo: HTMLElement;

  const currentYear: number = (new Date()).getFullYear();
  const devYearsExperience: number = currentYear - 2007;
  const remoteWorkYearsExperience: number = currentYear - 2020;

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

  <!-- Umami Analytics -->
  <script
    defer
    src="https://umami-analytics-nu-self.vercel.app/script.js"
    data-website-id="38a6004b-e9a0-4dbc-bdd6-ae6102196497"
  ></script>

  <meta name="title" content={metaTitle}>
  <meta name="description" content={metaDescription}>

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content={metaUrl}>
  <meta property="og:title" content={metaTitle}>
  <meta property="og:description" content={metaDescription}>
  <meta property="og:image" content={metaImg}>

  <!-- X (Twitter) -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content={metaUrl}>
  <meta property="twitter:title" content={metaTitle}>
  <meta property="twitter:description" content={metaDescription}>
  <meta property="twitter:image" content={metaImg}>
</svelte:head>

<ThemeSwitcher />

<main class="flex h-full min-h-screen flex-col justify-between">
  <article class="flex flex-col items-center">
    <header
      class="pt-10 md:pt-25 w-full flex flex-col items-center bg-[var(--light-bg-color)] min-h-screen"
      aria-labelledby="header-heading"
    >
      <div class="px-5 sm:px-10">
        <!-- <img src={logo} alt="Logo" class="h-40 w-40"> -->
        <Logo class="h-45 w-45" />
      </div>

      <div class="px-5 sm:px-10 mt-5 text-center">
        <h1 id="header-heading" class="text-3xl font-medium">Rik Wanders</h1>
        <h2 class="mt-4 text-xl">Freelance Full Stack Developer</h2>
        <h3 class="mt-4">Python • Django • React • Node.js</h3>

        <h4 class="mt-10 italic">
          Building scalable web applications for remote teams
        </h4>
      </div>

      <div class="mt-15 md:mt-20 px-4 flex justify-center w-full">
        <GetInTouchButton class="bg-[var(--lighter-bg-color)]" />
      </div>

      <div class="flex-grow"></div>

      <button
        bind:this={elMoreInfo}
        class="flex-end mt-14 mb-15 flex items-center gap-2 cursor-pointer p-2 scale-100 hover:scale-110 focus:scale-110 hover:text-[var(--text-highlight-color)] focus:text-[var(--text-highlight-color)] transition"
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
    </header>

    <section
      class="w-full min-h-screen bg-[var(--shade-color)]"
      aria-labelledby="about-me-heading"
    >
      <div class="flex flex-col items-center px-5 sm:px-10">
        <div
          bind:this={elAboutSection}
          class="overflow-hidden max-w-[var(--max-content-width)] pt-10 md:pt-15"
        >
          <h3
            id="about-me-heading"
            class="text-3xl text-center font-semibold mb-8 md:mb-10 capitalize"
          >
            About me
          </h3>

          <div
            class="mb-15 flex gap-10 justify-center max-md:flex-col max-md:items-center"
          >
            <!-- <div class="md:max-w-[50%]"> -->
            <div class="text-base/7">
              <div
                class="max-xs:hidden lg:hidden float-right w-full max-w-[200px] pl-3 pb-3"
              >
                <img
                  src={profilePhoto}
                  alt="Profile Rik Wanders"
                >
              </div>

              <p>
                With over {devYearsExperience} years of full-stack web
                development experience, I specialize in building and scaling
                complex, high-traffic applications that deliver exceptional user
                experiences. My expertise spans the entire development
                lifecycle, from initial architecture decisions to production
                deployment and optimization.
              </p>

              <div
                class="xs:hidden mt-4 flex justify-center"
              >
                <img
                  src={profilePhoto}
                  alt="Profile Rik Wanders"
                  width="200"
                >
              </div>

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
                intuitive frontend interfaces, optimizing application
                performance or processing large amounts of data, I combine
                technical expertise with a deep understanding of business needs
                to deliver solutions that drive real results.
              </p>
            </div>

            <div class="max-lg:hidden">
              <img
                src={profilePhoto}
                alt="Profile Rik Wanders"
              >
            </div>
          </div>

          <div
            class="flex flex-col items-center md:flex-row gap-6 w-full justify-evenly mb-15"
          >
            <InfoBox headerText="Key skills:" class="w-full 2xs:max-w-[320px]">
              <ul class="mt-4 list-disc ml-4 px-4 pb-4 font-bold">
                <li>Python, Django, DRF, FastAPI</li>
                <li class="my-4">Javascript, Node.js, React, Svelte</li>
                <li class="my-4">SQL & NoSQL Databases</li>
                <li>Linux, DevOps, CI/CD, Docker</li>
              </ul>
            </InfoBox>

            <InfoBox headerText="Contact for:" class="w-full 2xs:max-w-[320px]">
              <ul class="mt-4 list-disc ml-4 px-4 pb-4 font-bold">
                <li>Application development</li>

                <li class="my-4">System optimization</li>

                <li class="my-4">Technical strategy consulting</li>

                <li>Short-term remote jobs</li>
              </ul>
            </InfoBox>
          </div>

          <div class="flex justify-center mb-15">
            <GetInTouchButton class="bg-[var(--light-bg-color)]" />
          </div>
        </div>
      </div>
    </section>

    <section class="w-full" aria-label="References">
      <References />
    </section>

    <footer
      class="pt-15 px-5 sm:px-10 flex flex-col w-full items-center gap-2 bg-[var(--footer-bg-color)] text-[var(--text-light-color)]"
      aria-labelledby="footer-heading"
    >
      <div class="flex flex-col w-full max-w-[var(--max-content-width)]">
        <h4 class="font-semibold text-lg mb-2" id="footer-heading">
          Rik Wanders Software
        </h4>
        <div
          class="flex max-[350px]:flex-col max-[350px]:gap-4 w-full justify-between"
        >
          <div>
            <div class="text-sm/6">
              <div>Hertzogstraat 37</div>
              <div>2021 AE&nbsp;&nbsp;Haarlem</div>
              <div>The Netherlands</div>
              <div class="mt-2">VAT ID: NL001792484B78</div>
              <div>KVK: 75629801</div>
            </div>
          </div>

          <div class="flex flex-col items-center max-[350px]:self-end">
            <ul class="text-sm flex flex-col gap-2 text-right">
              <li>
                <ProfileLink
                  href="https://www.linkedin.com/in/rik-wanders-software"
                  icon={faLinkedin}
                  title="LinkedIn"
                />
              </li>

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

        <div
          class="flex min-[420px]:justify-between max-[420px]:flex-col w-full text-xs opacity-70 mt-8 mb-4"
        >
          <div>
            Copyright © {currentYear} Rik Wanders Software
          </div>

          <div class="max-[420px]:mt-2">
            Logo Vector by
            <a
              class="underline"
              href="https://www.vecteezy.com/free-vector/logo"
              target="_blank"
            >Vecteezy</a>
          </div>
        </div>
      </div>
    </footer>
  </article>
</main>
