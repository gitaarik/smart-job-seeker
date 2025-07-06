<script lang="ts">
  import logo from "$lib/images/logo.svg";

  import ProfileLink from "./ProfileLink.svelte";
  import githubIcon from "$lib/images/github.svg";
  import pypiIcon from "$lib/images/pypi.svg";
  import npmIcon from "$lib/images/npm.svg";
  import stackOverflowIcon from "$lib/images/stack-overflow.svg";
  import InfoBox from "./InfoBox.svelte";
</script>

<div class="flex h-full min-h-screen flex-col justify-between">
  <div class="flex flex-col items-center">
    <div class="px-10 py-25 w-full flex flex-col items-center bg-gray-100">
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

      <button
        class="mt-20 bg-[rgb(28,89,112)] text-white py-4 px-8 rounded-lg text-xl font-semibold"
      >
        Get in touch
      </button>
    </div>

    <div class="p-10 w-full">
      <div class="flex flex-col items-center">
        <h3 class="text-3xl text-center font-semibold">About</h3>

        <div>
          <ul class="my-10 list-[circle] font-semibold">
            <li>
              18+ years full stack (web) development experience
            </li>

            <li class="my-3">
              Remote work and distributed team collaboration
            </li>

            <li>
              Proven track record scaling high-traffic applications
            </li>
          </ul>
        </div>

        <div class="mb-10 px-10 md:flex md:gap-20">
          <InfoBox headerText="Available for:">
            <ul class="mt-4 list-[circle] ml-4 px-4 pb-4 font-bold">
              <li>Application development</li>

              <li class="my-4">System optimization</li>

              <li class="my-4">Technical strategy consulting</li>

              <li>Short-term remote jobs</li>
            </ul>
          </InfoBox>

          <InfoBox headerText="Key skills:" class="max-md:mt-8">
            <ul class="mt-4 list-[circle] ml-4 px-4 pb-4 font-bold">
              <li>Python / Django / FastAPI / Numpy</li>
              <li class="my-4">Javascript / Node.js / Svelte / React</li>
              <li class="my-4">SQL & NoSQL Databases</li>
              <li>Linux / DevOps / CI/CD / Docker</li>
            </ul>
          </InfoBox>
        </div>
      </div>

      <div class="px-10 flex flex-col items-center">
        Timezone: Europe/Amsterdam
      </div>

      <div class="mt-10 px-10 text-sm flex flex-col items-center">
        <!-- <ul class="grid grid-cols-2 sm:grid-cols-4 gap-4"> -->
        <ul class="flex flex-wrap gap-x-4 gap-y-2">
          <li>
            <ProfileLink href="https://github.com/gitaarik" icon={githubIcon}
            >GitHub</ProfileLink>
          </li>

          <li>
            <ProfileLink href="https://pypi.org/user/gitaarik/" icon={pypiIcon}
            >PyPi</ProfileLink>
          </li>

          <li>
            <ProfileLink href="https://www.npmjs.com/~gitaarik" icon={npmIcon}
            >npm</ProfileLink>
          </li>

          <li>
            <ProfileLink
              href="https://stackoverflow.com/users/1248175/gitaarik"
              icon={stackOverflowIcon}
            >
              Stack Overflow
            </ProfileLink>
          </li>
        </ul>
      </div>
    </div>
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
