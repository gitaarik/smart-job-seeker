<script lang="ts">
  import logo from "$lib/images/logo.svg";
  import scrollDownIcon from "$lib/images/circle-chevron-down.svg";
  import getInTouchIcon from "$lib/images/comments.svg";

  import ProfileLink from "./ProfileLink.svelte";
  import githubIcon from "$lib/images/github.svg";
  import pypiIcon from "$lib/images/pypi.svg";
  import npmIcon from "$lib/images/npm.svg";
  import stackOverflowIcon from "$lib/images/stack-overflow.svg";
  import InfoBox from "./InfoBox.svelte";
  import ContactInfo from "./ContactInfo.svelte";

  let aboutSectionEl: HTMLElement;
  let showGetInTouch = false;
  const currentYear: number = (new Date()).getFullYear();
  const devYearsExperience: number = currentYear - 2007;
  const remoteWorkYearsExperience: number = currentYear - 2020;

  function handleGetInTouchClick() {
    showGetInTouch = true;
  }

  function handleMoreInfoClick() {
    aboutSectionEl.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
</script>

<div class="flex h-full min-h-screen flex-col justify-between">
  <div class="flex flex-col items-center">
    <div
      class="px-10 pt-25 w-full flex flex-col items-center bg-gray-100 min-h-screen"
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

      <div class="mt-20">
        {#if showGetInTouch}
          <h3 class="text-center text-3xl font-medium py-4 px-8">
            Contact info
          </h3>
          <ContactInfo />
        {:else}
          <div class="text-center">
            <button
              class="flex gap-2 bg-[rgb(28,89,112)] text-white py-4 px-8 rounded-lg text-xl font-semibold cursor-pointer hover:bg-[rgb(87,150,174)] scale-100 hover:scale-105 transition"
              on:click={handleGetInTouchClick}
            >
              <img
                src={getInTouchIcon}
                alt="get in touch icon"
                width="20"
                height="20"
              />
              Get in touch
            </button>
          </div>
        {/if}
      </div>

      <div class="flex-grow"></div>

      <button
        class="flex-end mt-14 mb-8 flex items-center gap-2 cursor-pointer p-2 scale-100 hover:scale-110 transition"
        on:click={handleMoreInfoClick}
      >
        <span>
          <img
            src={scrollDownIcon}
            alt="scroll down icon"
            width="20"
            height="20"
          />
        </span>
        <span
          class="text-md font-semibold"
        >
          More Info
        </span>
      </button>
    </div>

    <div bind:this={aboutSectionEl} class="px-6 pt-15 w-full min-h-screen">
      <h3 class="text-3xl text-center font-semibold mb-10">About me</h3>

      <div class="flex justify-center max-md:flex-col">
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

        <!-- <div> -->
        <!--   <ul class="my-10 list-disc font-semibold"> -->
        <!--     <li> -->
        <!--       {devYearsExperience}+ years full stack (web) development -->
        <!--       experience -->
        <!--     </li> -->
        <!---->
        <!--     <li class="my-3"> -->
        <!--       5+ years remote work and distributed team collaboration experience -->
        <!--     </li> -->
        <!---->
        <!--     <li class="my-3"> -->
        <!--       Wide experience creating &amp; scaling complex &amp; high-traffic -->
        <!--       applications -->
        <!--     </li> -->
        <!---->
        <!--     <li class="my-3"> -->
        <!--       Leveraging AI tools and current industry best practices -->
        <!--     </li> -->
        <!---->
        <!--     <li> -->
        <!--       Up-to-date with current security best practices -->
        <!--     </li> -->
        <!--   </ul> -->
        <!-- </div> -->

        <!-- <div class="mb-10 sm:flex md:gap-20 sm:gap-6"> -->
        <div class="mb-6 md:mb-10 flex flex-col gap-6 max-md:mt-6">
          <!-- <InfoBox headerText="Key skills:" class="max-sm:mt-8"> -->
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

          <ul class="px-10 flex flex-col items-center">
            <li>
              <strong>Timezone: </strong>
              Europe/Amsterdam
            </li>
          </ul>
        </div>
      </div>

      <div class="px-10 flex flex-col items-center">
        <ul class="flex flex-wrap gap-x-6 gap-y-4">
          <li>
            <ProfileLink
              href="https://github.com/gitaarik"
              icon={githubIcon}
              title="GitHub"
            />
          </li>

          <li>
            <ProfileLink
              href="https://pypi.org/user/gitaarik/"
              icon={pypiIcon}
              title="PyPi"
            />
          </li>

          <li>
            <ProfileLink
              href="https://www.npmjs.com/~gitaarik"
              icon={npmIcon}
              title="npm"
            />
          </li>

          <li>
            <ProfileLink
              href="https://stackoverflow.com/users/1248175/gitaarik"
              icon={stackOverflowIcon}
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
