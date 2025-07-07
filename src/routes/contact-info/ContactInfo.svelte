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

  let elContactInfo: HTMLElement;
  let isVerified = false;
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
        isVerified = true;

        elContactInfo.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
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
  {#if !isVerified}
    <div class="text-center">
      <FontAwesomeIcon icon={faCircleNotch} spin class="mr-1" />

      {#if isLoading}
        Verifying you're a human...
      {:else}
        Loading Google reCAPTCHA...
      {/if}
    </div>
  {:else}
    <div
      class="flex max-sm:flex-col gap-6 sm:gap-4 place-content-evenly text-center w-full px-4"
    >
      <div>
        <div class="mb-2 font-semibold">
          <FontAwesomeIcon icon={faEnvelope} class="mr-1" />
          Email
        </div>

        <a href="mailto:{contactInfo.email}" class="underline">{
          contactInfo.email
        }</a>

        <p class="mt-2 text-sm">Response within<br />2 business days.</p>
      </div>

      <div>
        <div class="mb-2 font-semibold">
          <FontAwesomeIcon icon={faPhone} class="mr-1" />
          Phone
        </div>

        <a href="tel:{contactInfo.phone}" class="underline">{
          contactInfo.phone
        }</a>

        <p class="mt-2 flex justify-center gap-2">
          <a
            href="https://signal.me/#eu/QF8n-f_yG7oqHHgN83R1zbW8oVuBhmqOkN5W60a1vpFs-3uMvvtKaLkuUTZMqMz3"
            target="_blank"
            title="Signal"
          ><FontAwesomeIcon icon={faSignalMessenger} /></a>

          <a
            href="https://api.whatsapp.com/send?phone=+31649118511"
            target="_blank"
            title="WhatsApp"
          ><FontAwesomeIcon icon={faWhatsapp} /></a>

          <a
            href="https://t.me/gitaarik"
            target="_blank"
            title="Telegram"
          ><FontAwesomeIcon icon={faTelegram} /></a>
        </p>

        <p class="mt-2 text-sm">
          Central European Timezone
        </p>
      </div>
    </div>
    <!-- <div class="md:px-10 w-fit flex flex-col gap-2"> -->
    <!--   <Item label="Email"> -->
    <!--     <a href="mailto:{contactInfo.email}" class="underline">{ -->
    <!--       contactInfo.email -->
    <!--     }</a> -->
    <!--   </Item> -->
    <!---->
    <!--   <Item label="Phone"> -->
    <!--     <a href="tel:{contactInfo.phone}" class="underline">{ -->
    <!--       contactInfo.phone -->
    <!--     }</a> -->
    <!--   </Item> -->
    <!---->
    <!--   <Item label="Timezone"> -->
    <!--     Europe/Amsterdam -->
    <!--   </Item> -->
    <!---->
    <!--   <Item label="Response time"> -->
    <!--     Within 2 business days -->
    <!--   </Item> -->
    <!-- </div> -->
  {/if}
</div>
