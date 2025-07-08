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

  import { isHuman } from "$lib/stores/is-human";

  let isLoading = true;
  let isLoadError = false;
  let isVerifyError = false;
  let turnstileContainer: HTMLElement;

  const TURNSTILE_SITE_KEY = "0x4AAAAAABkW4tr8bO8w8Vi8";

  const contactInfo: object = {
    email: "hcwanders@posteo.net",
    phone: "+316 4911 8511",
  };

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
    // Check if Turnstile is already loaded
    if (window.turnstile) {
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
      console.log("Turnstile loaded and ready");
      renderTurnstile();
    };

    script.onerror = (error) => {
      isLoadError = true;
      console.log("error:", error);
    };

    document.head.appendChild(script);
  }

  function renderTurnstile() {
    if (!window.turnstile || !turnstileContainer) {
      return;
    }

    window.turnstile.render(turnstileContainer, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: handleTurnstileSuccess,
      "error-callback": handleTurnstileError,
      "expired-callback": handleTurnstileExpired,
      "unsupported-callback": handleTurnstileUnsupported,
      "before-interactive-callback": () => {
        console.log("before-interactive-callback");
      },
      theme: "auto", // or "light" or "dark"
      size: "normal", // or "compact"
    });
  }

  async function handleTurnstileSuccess(token: string) {
    console.log("Turnstile verification successful");

    try {
      // Verify the token with your backend
      const success = await verifyTurnstile(token);

      if (success) {
        isHuman.set(true);
      } else {
        isVerifyError = true;
        // Reset the widget
        window.turnstile.reset(turnstileContainer);
      }
    } catch (error) {
      console.error("Error verifying Turnstile:", error);
      isVerifyError = true;
      window.turnstile.reset(turnstileContainer);
    }
  }

  function handleTurnstileError(error: any) {
    console.error("Turnstile error:", error);
    if (!$isHuman) {
      isVerifyError = true;
    }
  }

  function handleTurnstileExpired() {
    isHuman.set(false);
  }

  function handleTurnstileUnsupported() {
    console.log("wajooo!!!!");
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

  // Extend the Window interface for TypeScript
  declare global {
    interface Window {
      turnstile: {
        render: (container: HTMLElement, options: any) => void;
        reset: (container: HTMLElement) => void;
        remove: (container: HTMLElement) => void;
      };
    }
  }
</script>

<div class="flex flex-col items-center">
  {#if !$isHuman}
    {#if isLoadError || isVerifyError}
      <div class="px-4 md:px-8 text-center text-red-900">
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

    <div class="flex flex-col justify-center items-center w-full">
      <!-- Turnstile widget container -->
      <div bind:this={turnstileContainer} class="cf-turnstile"></div>
    </div>
  {:else}
    <div
      class="flex max-xs:flex-col gap-6 xs:gap-4 place-content-evenly text-center w-full px-4"
    >
      <div>
        <div class="mb-2 text-lg font-semibold">
          <FontAwesomeIcon icon={faEnvelope} class="mr-1" />
          Email
        </div>

        <a
          href="mailto:{contactInfo.email}"
          class="underline hover:text-[var(--highlight-color)]"
        >{contactInfo.email}</a>

        <p class="mt-2 xs:mt-4 text-sm/6">
          You can expect a response<br />
          within 2 business days.
        </p>
      </div>

      <div>
        <div class="mb-2 text-lg font-semibold">
          <FontAwesomeIcon icon={faPhone} class="mr-1" />
          Phone
        </div>

        <a
          href="tel:{contactInfo.phone}"
          class="underline hover:text-[var(--highlight-color)]"
        >{contactInfo.phone}</a>

        <p class="mt-2 flex justify-center gap-4 text-xl">
          <a
            href="https://signal.me/#eu/QF8n-f_yG7oqHHgN83R1zbW8oVuBhmqOkN5W60a1vpFs-3uMvvtKaLkuUTZMqMz3"
            target="_blank"
            title="Signal"
            class="hover:text-[var(--highlight-color)]"
          ><FontAwesomeIcon icon={faSignalMessenger} /></a>

          <a
            href="https://api.whatsapp.com/send?phone=+31649118511"
            target="_blank"
            title="WhatsApp"
            class="hover:text-[var(--highlight-color)]"
          ><FontAwesomeIcon icon={faWhatsapp} /></a>

          <a
            href="https://t.me/gitaarik"
            target="_blank"
            title="Telegram"
            class="hover:text-[var(--highlight-color)]"
          ><FontAwesomeIcon icon={faTelegram} /></a>
        </p>

        <p class="mt-2 text-sm">
          Central European Timezone
        </p>
      </div>
    </div>
  {/if}
</div>
