<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCamera,
    faEnvelope,
    faGlobe,
    faMapMarkerAlt,
    faPhone,
    faTrash,
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
  import { getProfilePhotoUrl } from "$lib/utils/profile-photo-url";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const profile = $derived(data.profile);
  let saving = $state(false);
  let showSuccess = $state(false);
  let uploadingPhoto = $state(false);
  let removingPhoto = $state(false);
  let photoFileInput: HTMLInputElement;

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

  function handlePhotoUpload() {
    uploadingPhoto = true;
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      uploadingPhoto = false;
      if (result.type === "success") {
        showSuccess = true;
        setTimeout(() => (showSuccess = false), 3000);
      }
    };
  }

  function handlePhotoRemove() {
    removingPhoto = true;
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      removingPhoto = false;
      if (result.type === "success") {
        showSuccess = true;
        setTimeout(() => (showSuccess = false), 3000);
      }
    };
  }

  function triggerPhotoUpload() {
    photoFileInput?.click();
  }

  function onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      input.form?.requestSubmit();
    }
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

  <!-- Profile Photo Section -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4 flex items-center gap-2">
      <FontAwesomeIcon icon={faCamera} class="w-5 h-5 text-[var(--dash-primary)]" />
      Profile Photo
    </h2>

    <div class="flex items-center gap-6">
      <!-- Current photo or placeholder -->
      <div class="relative">
        {#if getProfilePhotoUrl(profile)}
          <img
            src={getProfilePhotoUrl(profile)}
            alt="Profile"
            class="w-24 h-24 rounded-full object-cover border-2 border-[var(--dash-border)]"
          />
        {:else}
          <div class="w-24 h-24 rounded-full bg-[var(--dash-bg)] border-2 border-[var(--dash-border)] flex items-center justify-center">
            <FontAwesomeIcon icon={faUser} class="w-10 h-10 text-[var(--dash-text-secondary)]" />
          </div>
        {/if}
      </div>

      <!-- Upload/Remove actions -->
      <div class="flex flex-col gap-2">
        <form method="POST" action="?/uploadPhoto" use:enhance={handlePhotoUpload} enctype="multipart/form-data">
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp,image/gif"
            bind:this={photoFileInput}
            onchange={onPhotoSelected}
            class="hidden"
          />
          <button
            type="button"
            onclick={triggerPhotoUpload}
            disabled={uploadingPhoto}
            class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faCamera} class="w-4 h-4" />
            {uploadingPhoto ? "Uploading..." : getProfilePhotoUrl(profile) ? "Change Photo" : "Upload Photo"}
          </button>
        </form>

        {#if profile?.profile_photo_path}
          <form method="POST" action="?/removePhoto" use:enhance={handlePhotoRemove}>
            <button
              type="submit"
              disabled={removingPhoto}
              class="px-4 py-2 border border-[var(--dash-error)] text-[var(--dash-error)] rounded-lg hover:bg-[var(--dash-error-light)] transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
              {removingPhoto ? "Removing..." : "Remove"}
            </button>
          </form>
        {/if}

        <p class="text-xs text-[var(--dash-text-secondary)]">
          JPEG, PNG, WebP, or GIF. Max 5MB.
        </p>
      </div>
    </div>
  </div>

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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label for="slug" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            Profile URL
          </label>
          <div class="flex items-center gap-2">
            <span class="text-sm text-[var(--dash-text-secondary)]">/p/</span>
            <input
              type="text"
              id="slug"
              name="slug"
              value={profile?.slug || ""}
              placeholder="your-profile-name"
              class="flex-1 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
          <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
            Used in your public profile URL. Only lowercase letters, numbers, and hyphens.
          </p>
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            for="subtitle"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Subtitle
          </label>
          <textarea
            id="subtitle"
            name="subtitle"
            rows={2}
            placeholder="e.g., Full-Stack Developer"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          >{profile?.subtitle || ""}</textarea>
          <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
            One sentence describing your role or specialty
          </p>
        </div>

        <div>
          <label
            for="headline"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Headline
          </label>
          <textarea
            id="headline"
            name="headline"
            rows={2}
            placeholder="A short tagline about yourself"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
          >{profile?.headline || ""}</textarea>
          <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
            One sentence summarizing your professional focus
          </p>
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label for="location" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            <FontAwesomeIcon icon={faMapMarkerAlt} class="w-4 h-4 text-[var(--dash-text-secondary)] mr-1" />
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={profile?.location || ""}
            placeholder="Amsterdam, Netherlands"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
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
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3">
      <a
        href="/dashboard/profile"
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
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
