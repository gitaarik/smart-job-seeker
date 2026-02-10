<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faEnvelope,
    faGlobe,
    faMapMarkerAlt,
    faPhone,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";
  import {
    faGithub,
    faLinkedin,
    faNpm,
    faPython,
    faStackOverflow,
  } from "@fortawesome/free-brands-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const profile = $derived(data.profile);
  let saving = $state(false);
  let showSuccess = $state(false);

  function handleSubmit() {
    saving = true;
    showSuccess = false;
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      saving = false;
      if (result.type === "success") {
        showSuccess = true;
        setTimeout(() => (showSuccess = false), 3000);
      }
    };
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Basic Info" icon={faUser} />

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if showSuccess}
    <div class="bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg p-4">
      <p class="text-[var(--dash-success)] text-sm">Profile updated successfully!</p>
    </div>
  {/if}

  <form
    method="POST"
    action="?/update"
    use:enhance={handleSubmit}
    class="space-y-8"
  >
    <!-- Personal Information -->
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faUser} class="w-5 h-5 text-[var(--dash-primary)]" />
        Personal Information
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="name" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            Full Name <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={profile?.name || ""}
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label for="title" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            Professional Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={profile?.title || ""}
            placeholder="e.g., Senior Software Engineer"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="subtitle"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Subtitle
          </label>
          <input
            type="text"
            id="subtitle"
            name="subtitle"
            value={profile?.subtitle || ""}
            placeholder="e.g., Full-Stack Developer"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="headline"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Headline
          </label>
          <input
            type="text"
            id="headline"
            name="headline"
            value={profile?.headline || ""}
            placeholder="A short tagline about yourself"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div class="md:col-span-2">
          <label
            for="summary"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Professional Summary
          </label>
          <textarea
            id="summary"
            name="summary"
            rows={4}
            placeholder="Write a brief professional summary..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          >{profile?.summary || ""}</textarea>
        </div>
      </div>
    </div>

    <!-- Contact Information -->
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faEnvelope} class="w-5 h-5 text-[var(--dash-primary)]" />
        Contact Information
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            for="email_address"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            <FontAwesomeIcon
              icon={faEnvelope}
              class="w-4 h-4 text-[var(--dash-text-secondary)] mr-1"
            />
            Email Address
          </label>
          <input
            type="email"
            id="email_address"
            name="email_address"
            value={profile?.email_address || ""}
            placeholder="you@example.com"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="phone_number"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            <FontAwesomeIcon icon={faPhone} class="w-4 h-4 text-[var(--dash-text-secondary)] mr-1" />
            Phone Number
          </label>
          <input
            type="tel"
            id="phone_number"
            name="phone_number"
            value={profile?.phone_number || ""}
            placeholder="+1 (555) 000-0000"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div class="md:col-span-2">
          <label
            for="personal_website"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            <FontAwesomeIcon icon={faGlobe} class="w-4 h-4 text-[var(--dash-text-secondary)] mr-1" />
            Personal Website
          </label>
          <input
            type="url"
            id="personal_website"
            name="personal_website"
            value={profile?.personal_website || ""}
            placeholder="https://yourwebsite.com"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>
    </div>

    <!-- Location -->
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faMapMarkerAlt} class="w-5 h-5 text-[var(--dash-primary)]" />
        Location
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label for="city" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            City
          </label>
          <input
            type="text"
            id="city"
            name="city"
            value={profile?.city || ""}
            placeholder="San Francisco"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label for="region" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            State / Region
          </label>
          <input
            type="text"
            id="region"
            name="region"
            value={profile?.region || ""}
            placeholder="California"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="country_code"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Country Code
          </label>
          <input
            type="text"
            id="country_code"
            name="country_code"
            value={profile?.country_code || ""}
            placeholder="US"
            maxlength={2}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent uppercase"
          />
        </div>
      </div>
    </div>

    <!-- Social Profiles -->
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faGlobe} class="w-5 h-5 text-[var(--dash-primary)]" />
        Social Profiles
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            for="linkedin_profile"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            <FontAwesomeIcon
              icon={faLinkedin}
              class="w-4 h-4 text-[#0A66C2] mr-1"
            />
            LinkedIn
          </label>
          <input
            type="url"
            id="linkedin_profile"
            name="linkedin_profile"
            value={profile?.linkedin_profile || ""}
            placeholder="https://linkedin.com/in/yourprofile"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="github_profile"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            <FontAwesomeIcon icon={faGithub} class="w-4 h-4 text-[var(--dash-text)] mr-1" />
            GitHub
          </label>
          <input
            type="url"
            id="github_profile"
            name="github_profile"
            value={profile?.github_profile || ""}
            placeholder="https://github.com/yourusername"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="stackoverflow_profile"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            <FontAwesomeIcon
              icon={faStackOverflow}
              class="w-4 h-4 text-[#F48024] mr-1"
            />
            Stack Overflow
          </label>
          <input
            type="url"
            id="stackoverflow_profile"
            name="stackoverflow_profile"
            value={profile?.stackoverflow_profile || ""}
            placeholder="https://stackoverflow.com/users/123456"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="npm_profile"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            <FontAwesomeIcon icon={faNpm} class="w-4 h-4 text-[#CB3837] mr-1" />
            npm
          </label>
          <input
            type="url"
            id="npm_profile"
            name="npm_profile"
            value={profile?.npm_profile || ""}
            placeholder="https://npmjs.com/~yourusername"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="pypi_profile"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            <FontAwesomeIcon
              icon={faPython}
              class="w-4 h-4 text-[#3776AB] mr-1"
            />
            PyPI
          </label>
          <input
            type="url"
            id="pypi_profile"
            name="pypi_profile"
            value={profile?.pypi_profile || ""}
            placeholder="https://pypi.org/user/yourusername"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3">
      <a
        href="/dashboard/profile"
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={saving}
        class="px-6 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  </form>
</div>
