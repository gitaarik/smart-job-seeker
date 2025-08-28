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
  let elLogo: HTMLElement;
  let elName: HTMLElement;
  let elTitle: HTMLElement;
  let elSkills: HTMLElement;
  let elSubtitle: HTMLElement;
  let elGetInTouchButton: HTMLElement;
  let elAboutHeading: HTMLElement;
  let elAboutText: HTMLElement;
  let elInfoBoxes: HTMLElement;
  let elAboutGetInTouch: HTMLElement;
  let elReferences: HTMLElement;
  let elFooter: HTMLElement;

  const currentYear: number = (new Date()).getFullYear();
  const devYearsExperience: number = currentYear - 2007;
  const remoteWorkYearsExperience: number = currentYear - 2020;

  let headerAnimationsTriggered = false;
  let aboutSectionAnimationsTriggered = false;

  function handleMoreInfo() {
    if (!aboutSectionAnimationsTriggered) {
      triggerAboutSectionAnimations();
    }
    
    elAboutSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    elMoreInfo.blur();
  }

  function triggerHeaderAnimations() {
    if (headerAnimationsTriggered) return;
    headerAnimationsTriggered = true;

    console.log('Triggering header animations');
    setTimeout(() => {
      console.log('Logo animation', elLogo);
      if (elLogo) {
        elLogo.classList.add('fade-in');
        elLogo.classList.add('animate-fade-in');
      }
    }, 100);
    setTimeout(() => {
      console.log('Name animation', elName);
      if (elName) {
        elName.classList.add('fade-in');
        elName.classList.add('animate-fade-in');
      }
    }, 300);
    setTimeout(() => {
      console.log('Title animation', elTitle);
      if (elTitle) {
        elTitle.classList.add('fade-in');
        elTitle.classList.add('animate-fade-in');
      }
    }, 500);
    setTimeout(() => {
      console.log('Skills animation', elSkills);
      if (elSkills) {
        elSkills.classList.add('fade-in');
        elSkills.classList.add('animate-fade-in');
      }
    }, 700);
    setTimeout(() => {
      console.log('Subtitle animation', elSubtitle);
      if (elSubtitle) {
        elSubtitle.classList.add('fade-in');
        elSubtitle.classList.add('animate-fade-in');
      }
    }, 1200);
    setTimeout(() => {
      console.log('Get in touch button animation', elGetInTouchButton);
      if (elGetInTouchButton) {
        elGetInTouchButton.classList.add('fade-in');
        elGetInTouchButton.classList.add('animate-fade-in');
      }
    }, 1600);
    setTimeout(() => {
      console.log('More info button animation', elMoreInfo);
      if (elMoreInfo) {
        elMoreInfo.classList.add('fade-in');
        elMoreInfo.classList.add('animate-fade-in');
      }
    }, 1800);
  }

  function triggerAboutSectionAnimations() {
    if (aboutSectionAnimationsTriggered) return;
    aboutSectionAnimationsTriggered = true;

    console.log('Triggering about section animations');
    setTimeout(() => {
      console.log('About heading animation');
      if (elAboutHeading) {
        elAboutHeading.classList.add('fade-in');
        elAboutHeading.classList.add('animate-fade-in');
      }
    }, 200);
    setTimeout(() => {
      console.log('About text animation');
      if (elAboutText) {
        elAboutText.classList.add('fade-in');
        elAboutText.classList.add('animate-fade-in');
      }
    }, 400);
    setTimeout(() => {
      console.log('Info boxes animation');
      if (elInfoBoxes) {
        elInfoBoxes.classList.add('fade-in');
        elInfoBoxes.classList.add('animate-fade-in');
      }
    }, 800);
    setTimeout(() => {
      console.log('About get in touch animation');
      if (elAboutGetInTouch) {
        elAboutGetInTouch.classList.add('fade-in');
        elAboutGetInTouch.classList.add('animate-fade-in');
      }
    }, 1000);
  }

  function checkScrollAnimations() {
    const windowHeight = window.innerHeight;
    
    if (elAboutSection && !aboutSectionAnimationsTriggered) {
      const aboutTop = elAboutSection.getBoundingClientRect().top;
      if (aboutTop < windowHeight * 0.8) {
        triggerAboutSectionAnimations();
      }
    }

    if (elReferences && !elReferences.classList.contains('fade-in')) {
      const referencesTop = elReferences.getBoundingClientRect().top;
      if (referencesTop < windowHeight * 0.8) {
        console.log('References content animation');
        elReferences.classList.add('fade-in');
        elReferences.classList.add('animate-fade-in-footer');
      }
    }

    if (elFooter && !elFooter.classList.contains('fade-in')) {
      const footerTop = elFooter.getBoundingClientRect().top;
      if (footerTop < windowHeight * 0.8) {
        console.log('Footer content animation');
        elFooter.classList.add('fade-in');
        elFooter.classList.add('animate-fade-in-footer');
      }
    }
  }

  onMount(() => {
    triggerHeaderAnimations();

    addEventListener("scroll", () => {
      checkScrollAnimations();

      const moreInfoScrollTop = elMoreInfo.getBoundingClientRect().top;
      const viewportHalf = window.innerHeight / 2;

      let opacity = 0.7 - (viewportHalf - moreInfoScrollTop) / viewportHalf;

      if (opacity > 1) {
        opacity = 1;
      } else if (opacity < 0) {
        opacity = 0;
      }

      if (elMoreInfo.classList.contains('fade-in')) {
        elMoreInfo.style.opacity = `${opacity}`;
      }
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
      <div bind:this={elLogo} class="px-5 sm:px-10 fade-element">
        <Logo class="h-45 w-45" />
      </div>

      <div class="px-5 sm:px-10 mt-5 text-center">
        <h1 bind:this={elName} id="header-heading" class="text-3xl font-medium fade-element">Rik Wanders</h1>
        <h2 bind:this={elTitle} class="mt-4 text-xl fade-element">Freelance Full Stack Developer</h2>
        <h3 bind:this={elSkills} class="mt-4 fade-element">Python • Django • React • Node.js</h3>

        <h4 bind:this={elSubtitle} class="mt-10 italic fade-element">
          Building scalable web applications for remote teams
        </h4>
      </div>

      <div bind:this={elGetInTouchButton} class="mt-15 md:mt-20 px-4 flex justify-center w-full fade-element">
        <GetInTouchButton contentClass="bg-snow" />
      </div>

      <div class="flex-grow"></div>

      <button
        bind:this={elMoreInfo}
        class="flex-end mt-14 mb-15 flex items-center gap-2 cursor-pointer p-2 scale-100 hover:scale-110 focus:scale-110 hover:text-teal focus:text-teal transition fade-element"
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
            bind:this={elAboutHeading}
            id="about-me-heading"
            class="text-3xl text-center font-semibold mb-8 md:mb-10 capitalize fade-element"
          >
            About me
          </h3>

          <div
            bind:this={elAboutText}
            class="mb-15 flex gap-10 justify-center max-md:flex-col max-md:items-center fade-element"
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

          <div
            bind:this={elInfoBoxes}
            class="flex flex-col items-center md:flex-row gap-6 w-full justify-evenly mb-15 fade-element"
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

          <div bind:this={elAboutGetInTouch} class="flex justify-center mb-15 fade-element">
            <GetInTouchButton contentClass="bg-ice" />
          </div>
        </div>
      </div>
    </section>

    <section class="w-full bg-navy text-pearl transition-colors" aria-label="References">
      <div class="pt-20 pb-10 px-5 sm:px-10 flex justify-center">
        <div bind:this={elReferences} class="max-w-[600px] fade-element-footer">
          <h3 class="text-3xl font-semibold mb-8 md:mb-10 capitalize text-center">
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
      <div bind:this={elFooter} class="flex flex-col w-full max-w-[var(--max-content-width)] fade-element-footer">
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

<style>
  :global(.fade-element) {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.8s ease-out, transform 0.8s ease-out;
  }

  :global(.fade-element.fade-in) {
    opacity: 1;
    transform: translateY(0);
  }

  /* Simple fade for footer content - no height changes */
  :global(.fade-element-footer) {
    opacity: 0;
    transition: opacity 0.8s ease-out;
  }

  :global(.fade-element-footer.fade-in) {
    opacity: 1;
  }

  /* Alternative keyframe approach */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeInSimple {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  :global(.animate-fade-in) {
    animation: fadeInUp 0.8s ease-out forwards;
  }

  :global(.animate-fade-in-footer) {
    animation: fadeInSimple 0.8s ease-out forwards;
  }
</style>
