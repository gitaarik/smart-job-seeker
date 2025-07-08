<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCircleNotch,
    faEnvelope,
    faPhone,
  } from "@fortawesome/free-solid-svg-icons";
  import Item from "./Item.svelte";
  import InfoBox from "../InfoBox.svelte";
  import {
    faSignalMessenger,
    faTelegram,
    faWhatsapp,
  } from "@fortawesome/free-brands-svg-icons";

  import { gRecaptchaValidated } from "$lib/stores/grecaptcha.ts";

  let elContactInfo: HTMLElement;
  let isLoading = false;

  // Your reCAPTCHA site key (get this from Google reCAPTCHA admin)
  const RECAPTCHA_SITE_KEY = "6LeAGHorAAAAAIxXJ4hI5SoY3XOThWClotwz7E0b";

  // Contact information to show after verification
  const contactInfo = {
    email: "hcwanders@posteo.net",
    phone: "+316 4911 8511",
  };

  onMount(() => {
    if (browser) {
      loadRecaptcha();
    }
  });

  function loadRecaptcha() {
    // Check if reCAPTCHA is already loaded
    if (window.grecaptcha) {
      setTimeout(async () => {
        await handleRecaptchaLoaded();
      });
      return;
    }

    // Create script tag for reCAPTCHA v3
    const script = document.createElement("script");
    script.src =
      `https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;

    window.onRecaptchaLoad = async function () {
      console.log("reCAPTCHA loaded and ready");
      await handleRecaptchaLoaded();
    };

    document.head.appendChild(script);
  }

  async function handleRecaptchaLoaded() {
    if (!window.grecaptcha) {
      alert("reCAPTCHA not loaded. Please refresh the page and try again.");
      return;
    }

    isLoading = true;

    try {
      // Execute reCAPTCHA v3
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
        action: "view_contact",
      });

      // Verify the token
      const success = await verifyRecaptcha(token);

      if (success) {
        gRecaptchaValidated.set(true);

        // elContactInfo.scrollIntoView({
        //   behavior: "smooth",
        //   block: "center",
        // });
      } else {
        alert(
          "Verification failed. Please refresh the page and try again.",
        );
      }
    } catch (error) {
      console.error("Error executing reCAPTCHA:", error);
      alert("An error occurred. Please try again.");
    } finally {
      isLoading = false;
    }
  }

  async function verifyRecaptcha(token: string): Promise<boolean> {
    try {
      const response = await fetch("/api/verify-recaptcha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, action: "view_contact" }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Error verifying reCAPTCHA:", error);
      return false;
    }
  }

  // Extend the Window interface for TypeScript
  declare global {
    interface Window {
      grecaptcha: any;
      onRecaptchaLoad: () => void;
    }
  }
</script>

<div bind:this={elContactInfo} class="flex flex-col items-center">
  {#if !$gRecaptchaValidated}
    <div class="flex justify-center items-center w-full h-30">
      <FontAwesomeIcon icon={faCircleNotch} spin class="mr-2" />

      {#if isLoading}
        Verifying you're a human...
      {:else}
        Loading Google reCAPTCHA...
      {/if}
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
