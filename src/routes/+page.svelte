<script lang="ts">
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

  import logo from "$lib/images/logo.svg";

  import ProfileLink from "./ProfileLink.svelte";
  import InfoBox from "./InfoBox.svelte";
  import ContactInfo from "./ContactInfo.svelte";

  let aboutSectionEl: HTMLElement;
  let showGetInTouch = false;
  const currentYear: number = (new Date()).getFullYear();
  const devYearsExperience: number = currentYear - 2007;
  const remoteWorkYearsExperience: number = currentYear - 2020;

  function handleGetInTouch() {
    showGetInTouch = true;
  }

  function handleCloseContactInfo() {
    showGetInTouch = false;
  }

  function handleMoreInfo() {
    aboutSectionEl.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
</script>

<div class="flex h-full min-h-screen flex-col justify-between">
  <div class="flex flex-col items-center">
    <div
      class="px-10 pt-10 md:pt-25 w-full flex flex-col items-center bg-gray-100 min-h-screen"
    >
      <div>
        <img src={logo} alt="Logo" class="h-40 w-40" />
      </div>

      <div class="mt-5 text-center">
        <h1 class="text-3xl font-medium">Rik Wanders</h1>
        <h2 class="mt-4 text-xl">Freelance Full Stack Developer</h2>
        <h3 class="mt-4">Python • Django • React • Node.js</h3>

        <h4 class="mt-10 italic">
          Building scalable web applications for remote teams
        </h4>
      </div>

      <div class="mt-15 md:mt-20">
        {#if showGetInTouch}
          <div
            class="p-8 bg-white rounded-xl border-2 border-[rgb(61,135,164)] relative"
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
              class="flex items-center gap-2 bg-[rgb(28,89,112)] text-white py-4 px-8 rounded-lg text-xl font-semibold cursor-pointer hover:bg-[rgb(87,150,174)] scale-100 hover:scale-105 transition"
              on:click={handleGetInTouch}
            >
              <FontAwesomeIcon icon={faComments} />
              <span>
                Get in touch
              </span>
            </button>
          </div>
        {/if}
      </div>

      <div class="flex-grow"></div>

      <button
        class="flex-end mt-14 mb-8 flex items-center gap-2 cursor-pointer p-2 scale-100 hover:scale-110 transition"
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
      bind:this={aboutSectionEl}
      class="px-6 pt-10 md:pt-15 w-full min-h-screen"
    >
      <h3 class="text-3xl text-center font-semibold mb-8 md:mb-10">About me</h3>

      <div class="flex justify-center max-md:flex-col max-md:items-center">
        <div class="md:max-w-[50%] md:px-10">
          <p>
            With over {devYearsExperience} years of full-stack web development
            experience, I specialize in building and scaling complex,
            high-traffic applications that deliver exceptional user experiences.
            My expertise spans the entire development lifecycle, from initial
            architecture decisions to production deployment and optimization.
          </p>

          <p class="my-4">
            I bring {remoteWorkYearsExperience}+ years of remote work experience
            and excel at collaborating with distributed teams across different
            time zones and cultures. This background has honed my communication
            skills and ability to work autonomously while maintaining strong
            team alignment.
          </p>

          <p class="my-4">
            I stay at the forefront of technology by integrating AI tools into
            my development workflow and consistently applying current industry
            best practices. Security is paramount in everything I build—I
            maintain up-to-date knowledge of security best practices to ensure
            applications are both performant and secure.
          </p>

          <p>
            Whether architecting scalable backend systems, crafting intuitive
            frontend interfaces, or optimizing application performance, I
            combine technical expertise with a deep understanding of business
            needs to deliver solutions that drive real results.
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

          <ul class="px-10 flex flex-col items-center text-center">
            <li>
              <strong>Timezone: </strong>
              Europe/Amsterdam
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-15 px-10 flex flex-col items-center">
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

      <div class="mt-20 mb-1 px-4 text-right text-xs text-gray-400">
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
