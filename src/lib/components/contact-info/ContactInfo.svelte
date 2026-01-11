<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  import {
    faCircleNotch,
    faEnvelope,
    faPhone,
  } from "@fortawesome/free-solid-svg-icons";

  import {
    faSignalMessenger,
    faTelegram,
    faWhatsapp,
  } from "@fortawesome/free-brands-svg-icons";

  import { track } from "$lib/tools/analytics";
  import { isHumanState } from "$lib/stores/is-human.svelte";
  import { themeState } from "$lib/stores/theme.svelte";
  import { getWindowVariable } from "$lib/tools/window";

  interface Profile {
    email_address?: string | null;
    phone_number?: string | null;
    location_timezone?: string | null;
    signal_profile?: string | null;
    whatsapp_number?: string | null;
    telegram_username?: string | null;
  }

  interface Props {
    profile: Profile;
  }

  let { profile }: Props = $props();

  let isLoading = true;
  let isLoadError = false;
  let isVerifyError = false;
  let turnstileContainer: HTMLElement;

  const TURNSTILE_SITE_KEY = "0x4AAAAAABkW4tr8bO8w8Vi8";

  onMount(() => {
    if (browser) {
      setInterval(() => {
        if (
          turnstileContainer &&
          turnstileContainer.getBoundingClientRect().height > 0
        ) {
          isLoading = false;
        }
      }, 100);

      loadTurnstile();
    }
  });

  function loadTurnstile() {
    const turnstile = getWindowVariable("turnstile");

    if (turnstile) {
      setTimeout(() => {
        renderTurnstile();
      });
      return;
    }

    // Create script tag for Turnstile
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      renderTurnstile();
    };

    script.onerror = (error) => {
      isLoadError = true;
      console.log("error:", error);
    };

    document.head.appendChild(script);
  }

  function renderTurnstile() {
    const turnstile = getWindowVariable("turnstile");

    if (!turnstile || !turnstileContainer) {
      return;
    }

    turnstile.render(turnstileContainer, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: handleTurnstileSuccess,
      "error-callback": handleTurnstileError,
      "expired-callback": handleTurnstileExpired,
      "unsupported-callback": handleTurnstileUnsupported,
      theme: themeState.actual || "auto", // "light", "dark" or "auto"
      size: "normal", // or "compact"
    });
  }

  async function handleTurnstileSuccess(token: string) {
    const turnstile = getWindowVariable("turnstile");

    if (!turnstile || !turnstileContainer) {
      return;
    }

    try {
      // Verify the token with your backend
      const success = await verifyTurnstile(token);

      if (success) {
        isHumanState.value = true;
        track("HumanValidated");
      } else {
        isVerifyError = true;
        // Reset the widget
        turnstile.reset(turnstileContainer);
      }
    } catch (error) {
      console.error("Error verifying Turnstile:", error);
      isVerifyError = true;
      turnstile.reset(turnstileContainer);
    }
  }

  function handleTurnstileError(error: any) {
    console.error("Turnstile error:", error);
    if (!isHumanState.value) {
      isVerifyError = true;
    }
  }

  function handleTurnstileExpired() {
    isHumanState.value = false;
  }

  function handleTurnstileUnsupported() {
    isVerifyError = true;
  }

  async function verifyTurnstile(token: string): Promise<boolean> {
    try {
      const response = await fetch("/api/verify-turnstile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Error verifying Turnstile:", error);
      return false;
    }
  }
</script>

<div class="flex flex-col items-center h-full">
  {#if !isHumanState.value}
    {#if isLoadError || isVerifyError}
      <div class="px-4 md:px-8 text-center text-crimson">
        <p>
          Human Verification failed. Please refresh<br />
          the page and try again, or check your ad blocker.
        </p>

        <p class="mt-2">
          Make sure external scripts from<br />
          challenges.cloudflare.com are allowed.
        </p>
      </div>
    {:else if isLoading}
      <div class="flex items-center">
        <FontAwesomeIcon icon={faCircleNotch} spin class="mr-2" />
        <span>Loading Human Verification</span>
      </div>
    {/if}

    <div class="flex flex-col justify-center items-center w-full h-full">
      <!-- Turnstile widget container -->
      <div bind:this={turnstileContainer} class="cf-turnstile"></div>
    </div>
  {:else}
    <div
      class="flex max-xs:flex-col gap-6 xs:gap-4 place-content-evenly text-center w-full px-4"
    >
      {#if profile.phone_number}
        <div>
          <div class="mb-2 text-lg font-semibold">
            <FontAwesomeIcon icon={faPhone} class="mr-1" />
            Phone
          </div>

          <a
            href="tel:{profile.phone_number}"
            class="underline hover:text-teal"
          >{profile.phone_number}</a>

          {#if         profile.signal_profile || profile.whatsapp_number ||
          profile.telegram_username}
            <p class="mt-2 flex justify-center gap-4 text-xl">
              {#if profile.signal_profile}
                <a
                  href={profile.signal_profile}
                  target="_blank"
                  title="Signal"
                  class="hover:text-teal"
                ><FontAwesomeIcon icon={faSignalMessenger} /></a>
              {/if}

              {#if profile.whatsapp_number}
                <a
                  href="https://wa.me/{profile.whatsapp_number.replace(/[^0-9+]/g, '')}"
                  target="_blank"
                  title="WhatsApp"
                  class="hover:text-teal"
                ><FontAwesomeIcon icon={faWhatsapp} /></a>
              {/if}

              {#if profile.telegram_username}
                <a
                  href="https://t.me/{profile.telegram_username}"
                  target="_blank"
                  title="Telegram"
                  class="hover:text-teal"
                ><FontAwesomeIcon icon={faTelegram} /></a>
              {/if}
            </p>
          {/if}

          {#if profile.location_timezone}
            <p class="mt-2 text-sm">
              {profile.location_timezone}
            </p>
          {/if}
        </div>
      {/if}

      {#if profile.email_address}
        <div>
          <div class="mb-2 text-lg font-semibold">
            <FontAwesomeIcon icon={faEnvelope} class="mr-1" />
            Email
          </div>

          <a
            href="mailto:{profile.email_address}"
            class="underline hover:text-teal"
          >{profile.email_address}</a>

          <p class="mt-2 xs:mt-4 text-sm/6">
            You can expect a response<br />
            within 2 business days.
          </p>
        </div>
      {/if}
    </div>
  {/if}
</div>
