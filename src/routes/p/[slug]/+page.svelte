<script lang="ts">
  import { onMount } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import AOS from "aos";
  import "aos/dist/aos.css";

  import {
    faGithub,
    faLinkedin,
    faNpm,
    faPython,
    faStackOverflow,
  } from "@fortawesome/free-brands-svg-icons";

  import {
    faChartLine,
    faCircleChevronDown,
    faCode,
    faDatabase,
    faGears,
    faNodeJs,
    faUsers,
    faUserTie,
  } from "@fortawesome/free-solid-svg-icons";

  import type { PageData } from "./$types";
  import Logo from "$lib/components/Logo.svelte";
  import ProfileLink from "$lib/components/ProfileLink.svelte";
  import InfoBox from "$lib/components/InfoBox.svelte";
  import GetInTouchButton from "$lib/components/contact-info/GetInTouchButton.svelte";
  import Quote from "$lib/components/Quote.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
  import { getDirectusAssetUrl } from "$lib/utils/directus-asset-url";

  let { data }: { data: PageData } = $props();

  const {
    profile,
    keySkills,
    contactFor,
    devYearsExperience,
    pyJsYearsExperience,
    remoteWorkYearsExperience,
  } = data;

  // Icon mapping helper
  const iconMap: Record<string, any> = {
    faPython,
    faNodeJs,
    faDatabase,
    faGears,
    faCode,
    faChartLine,
    faUsers,
    faUserTie,
  };

  // Meta tags from profile data
  const metaTitle = `${profile.name} - ${profile.title}`;
  const metaUrl = profile.personal_website ||
    `https://www.rikwanders.tech/p/${profile.slug}`;
  const metaDescription = profile.summary || profile.headline || "";
  const metaImg = profile.meta_image_url ||
    getDirectusAssetUrl(profile.profile_picture);

  // Profile picture URL
  const profilePhotoUrl = getDirectusAssetUrl(profile.profile_picture);

  const currentYear = new Date().getFullYear();

  let elAboutSection: HTMLElement;
  let elMoreInfo: HTMLElement;

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
    AOS.init({
      duration: 800,
      easing: "ease-out",
      once: true,
      offset: 120,
    });
    addEventListener("scroll", () => {
      updateMoreInfoOpacity();
    });
  });
</script>

<svelte:head>
  <title>{metaTitle}</title>

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
  {#if metaImg}
    <meta property="og:image" content={metaImg}>
  {/if}

  <!-- X (Twitter) -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content={metaUrl}>
  <meta property="twitter:title" content={metaTitle}>
  <meta property="twitter:description" content={metaDescription}>
  {#if metaImg}
    <meta property="twitter:image" content={metaImg}>
  {/if}
</svelte:head>

<div class="fixed top-0 right-0 z-50" data-aos="fade">
  <ThemeSwitcher />
</div>

<main class="flex h-full min-h-screen flex-col justify-between">
  <article class="flex flex-col items-center">
    <header
      class="pt-10 md:pt-25 w-full flex flex-col items-center bg-ice min-h-screen transition-colors"
      aria-labelledby="header-heading"
    >
      <div data-aos="fade" class="px-5 sm:px-10">
        <Logo class="h-45 w-45" />
      </div>

      <div
        class="px-5 sm:px-10 mt-5 text-center"
      >
        <div
          data-aos="fade"
        >
          <h1
            id="header-heading"
            class="text-3xl font-medium"
          >
            {profile.name}
          </h1>

          <h2 class="mt-4 text-xl">
            {profile.title}
          </h2>

          {#if profile.subtitle}
            <h3 class="mt-4">
              {profile.subtitle}
            </h3>
          {/if}
        </div>

        {#if profile.headline}
          <h4
            data-aos="fade"
            class="mt-10 italic"
          >
            {profile.headline}
          </h4>
        {/if}
      </div>

      <div
        data-aos="fade"
        class="mt-15 md:mt-20 px-4 flex justify-center w-full"
      >
        <GetInTouchButton contentClass="bg-snow" />
      </div>

      <div class="flex-grow"></div>

      <div
        bind:this={elMoreInfo}
        class="flex-end mt-14 mb-15"
      >
        <button
          class="flex items-center gap-2 cursor-pointer p-2 scale-100 hover:scale-110 focus:scale-110 hover:text-teal focus:text-teal transition"
          data-aos="fade"
          data-aos-anchor-placement="top-bottom"
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
      </div>
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
            data-aos="fade"
            id="about-me-heading"
            class="text-3xl text-center font-semibold mb-8 md:mb-10 capitalize"
          >
            About me
          </h3>

          <div
            data-aos="fade"
            class="mb-15 flex gap-10 justify-center max-md:flex-col max-md:items-center"
          >
            <div class="text-base/7 tracking-[0.1px]">
              {#if profilePhotoUrl}
                <div
                  class="max-lg:hidden float-right w-full max-w-[265px] pl-4 pb-4"
                >
                  <img
                    src={profilePhotoUrl}
                    alt={profile.name}
                    width="265"
                    loading="lazy"
                  />
                </div>

                <div
                  class="max-xs:hidden lg:hidden float-right w-full max-w-[200px] pl-3 pb-3"
                >
                  <img
                    src={profilePhotoUrl}
                    alt={profile.name}
                    width="200"
                    loading="lazy"
                  />
                </div>
              {/if}

              {#if profile.about_me_text}
                {@html profile.about_me_text}
              {/if}

              {#if profilePhotoUrl}
                <div
                  class="xs:hidden mt-4 flex justify-center"
                >
                  <img
                    src={profilePhotoUrl}
                    alt=""
                    aria-hidden="true"
                    width="200"
                    loading="lazy"
                  />
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-center px-5 sm:px-10">
        <div class="max-w-[var(--max-content-width)] pb-15">
          <div
            data-aos="fade"
            class="flex flex-col items-center md:flex-row gap-6 w-full justify-evenly mb-15"
          >
            <InfoBox
              headerText="Key skills:"
              class="w-full 2xs:max-w-[340px] sm:min-w-[340px]"
            >
              <ul class="p-4 sm:p-5 font-bold">
                {#each keySkills as skill, i}
                  <li
                    class={i > 0
                      ? "my-4 sm:my-5 flex items-center gap-3"
                      : "flex items-center gap-3"}
                  >
                    {#if                     skill.icon_name &&
                      iconMap[skill.icon_name]}
                      <FontAwesomeIcon
                        icon={iconMap[skill.icon_name]}
                        class="w-4 text-teal"
                      />
                    {/if}
                    {skill.text}
                  </li>
                {/each}
              </ul>
            </InfoBox>

            <InfoBox
              headerText="Contact for:"
              class="w-full 2xs:max-w-[340px] sm:min-w-[340px]"
            >
              <ul class="p-4 sm:p-5 font-bold">
                {#each contactFor as item, i}
                  <li
                    class={i > 0
                      ? "my-4 sm:my-5 flex items-center gap-3"
                      : "flex items-center gap-3"}
                  >
                    {#if                     item.icon_name &&
                      iconMap[item.icon_name]}
                      <FontAwesomeIcon
                        icon={iconMap[item.icon_name]}
                        class="w-4 text-teal"
                      />
                    {/if}
                    {item.text}
                  </li>
                {/each}
              </ul>
            </InfoBox>
          </div>

          <div
            data-aos="fade"
            class="flex justify-center"
          >
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
        <div class="max-w-[600px]">
          <h3
            data-aos="fade"
            class="text-3xl font-semibold mb-8 md:mb-10 capitalize text-center"
          >
            What Clients Say
          </h3>

          {#if profile.references && profile.references.length > 0}
            {#each profile.references as reference}
              <div data-aos="fade">
                <Quote
                  author={reference.author_position
                    ? `${reference.author} - ${reference.author_position}`
                    : reference.author}
                >
                  {reference.text}
                </Quote>
              </div>
            {/each}
          {/if}
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
          {profile.company_name || profile.name}
        </h4>
        <div
          class="flex max-[350px]:flex-col max-[350px]:gap-4 w-full justify-between"
        >
          <div>
            <div class="text-sm/6">
              {#if profile.street_address}
                <div>{profile.street_address}</div>
              {/if}
              {#if profile.postal_code || profile.city}
                <div>{profile.postal_code}&nbsp;&nbsp;{profile.city}</div>
              {/if}
              {#if profile.country_code}
                <div>{profile.country_code}</div>
              {/if}
              {#if profile.vat_id || profile.kvk_number}
                <div class="mt-2">
                  {#if profile.vat_id}<div>VAT ID: {profile.vat_id}</div>{/if}
                  {#if profile.kvk_number}<div>
                      KVK: {profile.kvk_number}
                    </div>{/if}
                </div>
              {/if}
            </div>
          </div>

          <div class="flex flex-col items-center max-[350px]:self-end">
            <ul class="text-sm flex flex-col gap-2 text-right">
              {#if profile.linkedin_profile}
                <li>
                  <ProfileLink
                    href={profile.linkedin_profile}
                    icon={faLinkedin}
                    title="LinkedIn"
                  />
                </li>
              {/if}

              {#if profile.github_profile}
                <li>
                  <ProfileLink
                    href={profile.github_profile}
                    icon={faGithub}
                    title="GitHub"
                  />
                </li>
              {/if}

              {#if profile.pypi_profile}
                <li>
                  <ProfileLink
                    href={profile.pypi_profile}
                    icon={faPython}
                    title="PyPi"
                  />
                </li>
              {/if}

              {#if profile.npm_profile}
                <li>
                  <ProfileLink
                    href={profile.npm_profile}
                    icon={faNpm}
                    title="npm"
                  />
                </li>
              {/if}

              {#if profile.stackoverflow_profile}
                <li>
                  <ProfileLink
                    href={profile.stackoverflow_profile}
                    icon={faStackOverflow}
                    title="Stack Overflow"
                  />
                </li>
              {/if}
            </ul>
          </div>
        </div>

        <div
          class="flex min-[420px]:justify-between max-[420px]:flex-col w-full text-xs opacity-70 mt-8 mb-4"
        >
          <div>
            Copyright © {currentYear} {profile.company_name || profile.name}
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
