<script lang="ts">
  import { onMount } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import AOS from 'aos';
  import 'aos/dist/aos.css';

  import {
    faGithub,
    faLinkedin,
    faNpm,
    faPython,
    faStackOverflow,
  } from "@fortawesome/free-brands-svg-icons";

  import { faCircleChevronDown } from "@fortawesome/free-solid-svg-icons";

  import profilePhoto from "$lib/images/profile-photo.jpeg?enhanced";
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

  function updateMoreInfoOpacity() {
    if (!elMoreInfo) return;

    const moreInfoScrollTop = elMoreInfo.getBoundingClientRect().top;
    const viewportHalf = window.innerHeight / 2;
    let opacity = 0.7 - (viewportHalf - moreInfoScrollTop) / viewportHalf;

    opacity = Math.max(0, Math.min(1, opacity));
    elMoreInfo.style.opacity = `${opacity}`;
  }

  onMount(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      easing: 'ease-out',
      once: true,
      offset: 120,
    });

    // Set up scroll listener for more info button opacity
    addEventListener("scroll", () => {
      updateMoreInfoOpacity();
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
      class="pt-10 md:pt-25 w-full flex flex-col items-center bg-ice min-h-screen transition-colors"
      aria-labelledby="header-heading"
    >
      <div data-aos="fade-up" data-aos-delay="100" class="px-5 sm:px-10">
        <Logo class="h-45 w-45" />
      </div>

      <div class="px-5 sm:px-10 mt-5 text-center">
        <h1
          data-aos="fade-up"
          data-aos-delay="300"
          id="header-heading"
          class="text-3xl font-medium"
        >
          Rik Wanders
        </h1>
        <h2 data-aos="fade-up" data-aos-delay="500" class="mt-4 text-xl">
          Freelance Full Stack Developer
        </h2>
        <h3 data-aos="fade-up" data-aos-delay="700" class="mt-4">
          Python • Django • React • Node.js
        </h3>

        <h4 data-aos="fade-up" data-aos-delay="1200" class="mt-10 italic">
          Building scalable web applications for remote teams
        </h4>
      </div>

      <div
        data-aos="fade-up"
        data-aos-delay="1600"
        class="mt-15 md:mt-20 px-4 flex justify-center w-full"
      >
        <GetInTouchButton contentClass="bg-snow" />
      </div>

      <div class="flex-grow"></div>

      <button
        bind:this={elMoreInfo}
        data-aos="fade-up"
        data-aos-delay="1800"
        class="flex-end mt-14 mb-15 flex items-center gap-2 cursor-pointer p-2 scale-100 hover:scale-110 focus:scale-110 hover:text-teal focus:text-teal transition"
        on:click={handleMoreInfo}
      >
        <span>
          <FontAwesomeIcon icon={faCircleChevronDown} class="w-4" />
        </span>
        <span
          class="text-md font-semibold"
        >
          More Info
        </span>
      </button>
    </header>

    <section
      class="w-full min-h-screen bg-mist transition-colors"
      aria-labelledby="about-me-heading"
    >
      <div class="flex flex-col items-center px-5 sm:px-10">
        <div
          bind:this={elAboutSection}
          class="overflow-hidden max-w-[var(--max-content-width)] pt-10 md:pt-15"
        >
          <h3
            data-aos="fade-up"
            id="about-me-heading"
            class="text-3xl text-center font-semibold mb-8 md:mb-10 capitalize"
          >
            About me
          </h3>

          <div
            data-aos="fade-up"
            data-aos-delay="200"
            class="mb-15 flex gap-10 justify-center max-md:flex-col max-md:items-center"
          >
            <div class="text-base/7 tracking-[0.1px]">
              <div
                class="max-xs:hidden lg:hidden float-right w-full max-w-[200px] pl-3 pb-3"
              >
                <enhanced:img
                  src={profilePhoto}
                  alt="Rik Wanders"
                  width="200"
                />
              </div>

              <p>
                With over {devYearsExperience} years of Full Stack Python &amp;
                Node.js development experience, I specialize in building and
                scaling complex, high-traffic and data-heavy web applications
                with perfect user experience. My skills cover the entire
                development process, from initial architecture decisions to
                production deployment and optimization.
              </p>

              <div
                class="xs:hidden mt-4 flex justify-center"
              >
                <enhanced:img
                  src={profilePhoto}
                  alt=""
                  aria-hidden="true"
                  width="200"
                />
              </div>

              <p class="my-4">
                I have been working fully remote for the last
                {remoteWorkYearsExperience} years, collaborating with, and
                leading distributed agile teams across different time zones and
                cultures. This experience has refined my communication skills
                and ability to work independently while maintaining strong team
                alignment.
              </p>

              <p class="my-4">
                I'm always interested in the latest developments in the software
                industry. By integrating AI into my development workflow, I'm
                able to speed up repetitive development tasks and focus on
                quality and architecture. All this while maintaining current
                security best practices.
              </p>

              <p>
                I like to be challenged with unique technical problems, where I
                can use my creativity and analytical reasoning to develop custom
                made solutions. Together with my business insights I can timely
                deliver complete technical solutions that produce real results.
              </p>
            </div>

            <div class="max-lg:hidden">
              <enhanced:img
                src={profilePhoto}
                alt=""
                aria-hidden="true"
              />
            </div>
          </div>

        </div>
      </div>
    </section>

    <section class="w-full bg-mist transition-colors">
      <div class="flex flex-col items-center px-5 sm:px-10">
        <div class="max-w-[var(--max-content-width)] pb-15">
          <div
            data-aos="fade-up"
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

          <div data-aos="fade-up" data-aos-delay="200" class="flex justify-center">
            <GetInTouchButton contentClass="bg-ice" />
          </div>
        </div>
      </div>
    </section>

    <section
      class="w-full bg-navy text-pearl transition-colors"
      aria-label="References"
    >
      <div class="pt-20 pb-10 px-5 sm:px-10 flex justify-center">
        <div data-aos="fade" class="max-w-[600px]">
          <h3
            class="text-3xl font-semibold mb-8 md:mb-10 capitalize text-center"
          >
            What Clients Say
          </h3>
          <References />
        </div>
      </div>
    </section>

    <footer
      class="pt-15 px-5 sm:px-10 flex flex-col w-full items-center gap-2 bg-midnight text-pearl transition-colors"
      aria-labelledby="footer-heading"
    >
      <div
        data-aos="fade"
        class="flex flex-col w-full max-w-[var(--max-content-width)]"
      >
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

