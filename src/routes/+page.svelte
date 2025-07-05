<script lang="ts">
  import logo from "$lib/images/logo.svg";

  import ProfileLink from "./profile-link.svelte";
  import githubIcon from "$lib/images/github.svg";
  import pypiIcon from "$lib/images/pypi.svg";
  import npmIcon from "$lib/images/npm.svg";
  import stackOverflowIcon from "$lib/images/stack-overflow.svg";
</script>

<div class="flex h-full min-h-screen flex-col justify-between">
  <div class="mt-10 flex w-full flex-col items-center">
    <div>
      <img src={logo} alt="Logo" class="h-40 w-40" />
    </div>

    <div class="mt-5 text-center">
      <h1 class="text-3xl">Rik Wanders</h1>
      <h2 class="mt-4 text-xl">Freelance Full Stack Developer</h2>
    </div>

    <div class="mt-8 px-10">
      <!-- <div class="mt-4">Available for remote projects.</div> -->

      <ul class="list-[circle]">
        <li>Application development</li>

        <li class="my-2">System optimization</li>

        <li>Technical strategy consulting</li>
      </ul>
    </div>

    <div class="mt-8">
      <ul class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        <li class="px-2">
          <ProfileLink href="https://github.com/gitaarik" icon={githubIcon}
          >GitHub</ProfileLink>
        </li>

        <li class="px-2">
          <ProfileLink href="https://pypi.org/user/gitaarik/" icon={pypiIcon}
          >PyPi</ProfileLink>
        </li>

        <li class="px-2">
          <ProfileLink href="https://www.npmjs.com/~gitaarik" icon={npmIcon}
          >npm</ProfileLink>
        </li>

        <li class="px-2">
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

  <div class="mt-10 mb-1 px-4 text-right text-xs text-gray-400">
    Logo Vector by
    <a
      class="underline"
      href="https://www.vecteezy.com/free-vector/logo"
      target="_blank"
    >Vecteezy</a>
  </div>
</div>
