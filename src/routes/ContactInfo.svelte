<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  let isVerified = false;
  let isLoading = false;
  let widgetId: number | null = null;

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
      // Now you can safely call execute
      // window.grecaptcha.execute("YOUR_SITE_KEY", { action: "your_action" })
      //   .then(function (token) {
      //     // Handle the token
      //     console.log("Token:", token);
      //   });
    };

    // script.onload = async function () {
    //   console.log("wjow:");
    //   console.log(window.grecaptcha.execute);
    //
    //   setTimeout(() => {
    //     console.log("wjow2:");
    //     console.log(window.grecaptcha.execute);
    //   }, 0);
    //   // await handleRecaptchaLoaded();
    // };

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
      } else {
        alert("Verification failed. Please try again.");
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

<div>
  {#if !isVerified}
    {#if isLoading}
      <div>Verifying you're a human...</div>
    {:else}
      <div>Loading Google reCAPTCHA...</div>
    {/if}
  {:else}
    <ul class="mt-6 px-10 flex flex-col gap-3 items-center">
      <li>
        <strong>Email:</strong>
        <a href="mailto:{contactInfo.email}" class="underline">{
          contactInfo.email
        }</a>
      </li>

      <li>
        <strong>Phone:</strong>
        <a href="tel:{contactInfo.phone}" class="underline">{
          contactInfo.phone
        }</a>
      </li>

      <li>
        <strong>Timezone:</strong>
        Europe/Amsterdam
      </li>

      <li>
        <strong>Response time:</strong>
        Within 2 business days
      </li>
    </ul>
  {/if}
</div>
