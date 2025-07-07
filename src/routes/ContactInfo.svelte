<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";

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
    <div class="text-center mt-6">
      <FontAwesomeIcon icon={faCircleNotch} spin class="mr-1" />

      {#if isLoading}
        Verifying you're a human...
      {:else}
        Loading Google reCAPTCHA...
      {/if}
    </div>
  {:else}
    <div class="mt-6 md:px-10 w-fit flex flex-col gap-2">
      <div class="flex">
        <strong class="mr-1 sm:text-right sm:block sm:w-[50%]">Email:</strong>
        <a href="mailto:{contactInfo.email}" class="underline">{
          contactInfo.email
        }</a>
      </div>

      <div>
        <strong class="mr-1 sm:text-right">Phone:</strong>
        <a href="tel:{contactInfo.phone}" class="underline">{
          contactInfo.phone
        }</a>
      </div>

      <div>
        <strong class="mr-1 sm:text-right">Timezone:</strong>
        <span>
          Europe/Amsterdam
        </span>
      </div>

      <div>
        <strong class="mr-1 sm:text-right whitespace-nowrap"
        >Response time:</strong>
        <span>
          Within 2 business days
        </span>
      </div>
    </div>
  {/if}
</div>
