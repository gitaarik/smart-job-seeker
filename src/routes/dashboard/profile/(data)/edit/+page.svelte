<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCamera,
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
  import SectionHeader from "../../components/SectionHeader.svelte";
  import Card from "../../../components/Card.svelte";
  import MediaUpload from "$lib/components/MediaUpload.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
  import CountrySelect from "../../../jobs/components/CountrySelect.svelte";
  import { getProfilePhotoUrl } from "$lib/utils/profile-photo-url";

  let { data }: { data: PageData } = $props();

  const profile = $derived(data.profile);
  let photoUrl = $state(getProfilePhotoUrl(data.profile));

  // Section states
  type SaveState = "idle" | "saving" | "saved" | "error";
  let personalInfoState = $state<SaveState>("idle");
  let contactState = $state<SaveState>("idle");
  let socialState = $state<SaveState>("idle");

  // Form values - Personal Information
  let name = $state(data.profile?.name || "");
  let slug = $state(data.profile?.slug || "");
  let title = $state(data.profile?.title || "");
  let subtitle = $state(data.profile?.subtitle || "");
  let headline = $state(data.profile?.headline || "");
  let summary = $state(data.profile?.summary || "");

  // Form values - Contact Information
  let email_address = $state(data.profile?.email_address || "");
  let phone_number = $state(data.profile?.phone_number || "");
  let location = $state(data.profile?.location || "");
  let country_code = $state(data.profile?.country_code || "");
  let personal_website = $state(data.profile?.personal_website || "");

  // Form values - Social Profiles
  let linkedin_profile = $state(data.profile?.linkedin_profile || "");
  let github_profile = $state(data.profile?.github_profile || "");
  let stackoverflow_profile = $state(data.profile?.stackoverflow_profile || "");
  let npm_profile = $state(data.profile?.npm_profile || "");
  let pypi_profile = $state(data.profile?.pypi_profile || "");

  async function saveSection(
    fields: Record<string, string>,
    setState: (state: SaveState) => void,
  ) {
    setState("saving");

    try {
      const response = await fetch(`/api/profile/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Save failed:", error);
        setState("error");
        setTimeout(() => setState("idle"), 2000);
        return;
      }

      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch (error) {
      console.error("Save failed:", error);
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  function savePersonalInfo() {
    saveSection(
      { name, slug, title, subtitle, headline, summary },
      (s) => (personalInfoState = s),
    );
  }

  function saveContact() {
    saveSection(
      { email_address, phone_number, location, country_code, personal_website },
      (s) => (contactState = s),
    );
  }

  function saveSocial() {
    saveSection(
      {
        linkedin_profile,
        github_profile,
        stackoverflow_profile,
        npm_profile,
        pypi_profile,
      },
      (s) => (socialState = s),
    );
  }

</script>

<svelte:head>
  <title>Basic Info - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <SectionHeader title="Basic Info" icon={faUser} />

  <!-- Profile Photo Section -->
  <Card padding="lg">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4 flex items-center gap-2">
      <FontAwesomeIcon icon={faCamera} class="w-5 h-5 text-[var(--dash-primary)]" />
      Profile Photo
    </h2>

    <MediaUpload
      entityType="profile"
      entityId={profile.id}
      field="profile_photo_path"
      currentUrl={photoUrl}
      label=""
      onUpload={(url) => (photoUrl = url)}
      onDelete={() => (photoUrl = null)}
    />
  </Card>

  <!-- Personal Information -->
  <Card padding="lg">
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
          bind:value={name}
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
            bind:value={slug}
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
          bind:value={title}
          placeholder="e.g., Senior Software Engineer"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>

      <div>
        <label for="subtitle" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          Subtitle
        </label>
        <textarea
          id="subtitle"
          bind:value={subtitle}
          rows={2}
          placeholder="e.g., Full-Stack Developer"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
        ></textarea>
        <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
          One sentence describing your role or specialty
        </p>
      </div>

      <div>
        <label for="headline" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          Headline
        </label>
        <textarea
          id="headline"
          bind:value={headline}
          rows={2}
          placeholder="A short tagline about yourself"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
        ></textarea>
        <p class="text-xs text-[var(--dash-text-secondary)] mt-1">
          One sentence summarizing your professional focus
        </p>
      </div>

      <div class="md:col-span-2">
        <label for="summary" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          Professional Summary
        </label>
        <textarea
          id="summary"
          bind:value={summary}
          rows={4}
          placeholder="Write a brief professional summary..."
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y"
        ></textarea>
      </div>
    </div>

    <div class="flex justify-end mt-4">
      <SectionSaveButton state={personalInfoState} onClick={savePersonalInfo} />
    </div>
  </Card>

  <!-- Contact Information -->
  <Card padding="lg">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4 flex items-center gap-2">
      <FontAwesomeIcon icon={faEnvelope} class="w-5 h-5 text-[var(--dash-primary)]" />
      Contact Information
    </h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="email_address" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          <FontAwesomeIcon
            icon={faEnvelope}
            class="w-4 h-4 text-[var(--dash-text-secondary)] mr-1"
          />
          Email Address
        </label>
        <input
          type="email"
          id="email_address"
          bind:value={email_address}
          placeholder="you@example.com"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>

      <div>
        <label for="phone_number" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          <FontAwesomeIcon icon={faPhone} class="w-4 h-4 text-[var(--dash-text-secondary)] mr-1" />
          Phone Number
        </label>
        <input
          type="tel"
          id="phone_number"
          bind:value={phone_number}
          placeholder="+1 (555) 000-0000"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>

      <div>
        <label for="location" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          <FontAwesomeIcon
            icon={faMapMarkerAlt}
            class="w-4 h-4 text-[var(--dash-text-secondary)] mr-1"
          />
          Location
        </label>
        <input
          type="text"
          id="location"
          bind:value={location}
          placeholder="Amsterdam, Netherlands"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>

      <div>
        <label for="country_code" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          <FontAwesomeIcon
            icon={faMapMarkerAlt}
            class="w-4 h-4 text-[var(--dash-text-secondary)] mr-1"
          />
          Country
        </label>
        <CountrySelect bind:value={country_code} placeholder="Select country..." />
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
          bind:value={personal_website}
          placeholder="https://yourwebsite.com"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>
    </div>

    <div class="flex justify-end mt-4">
      <SectionSaveButton state={contactState} onClick={saveContact} />
    </div>
  </Card>

  <!-- Social Profiles -->
  <Card padding="lg">
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-4 flex items-center gap-2">
      <FontAwesomeIcon icon={faGlobe} class="w-5 h-5 text-[var(--dash-primary)]" />
      Social Profiles
    </h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="linkedin_profile" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          <FontAwesomeIcon icon={faLinkedin} class="w-4 h-4 text-[#0A66C2] mr-1" />
          LinkedIn
        </label>
        <input
          type="url"
          id="linkedin_profile"
          bind:value={linkedin_profile}
          placeholder="https://linkedin.com/in/yourprofile"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>

      <div>
        <label for="github_profile" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          <FontAwesomeIcon icon={faGithub} class="w-4 h-4 text-[var(--dash-text)] mr-1" />
          GitHub
        </label>
        <input
          type="url"
          id="github_profile"
          bind:value={github_profile}
          placeholder="https://github.com/yourusername"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>

      <div>
        <label
          for="stackoverflow_profile"
          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
        >
          <FontAwesomeIcon icon={faStackOverflow} class="w-4 h-4 text-[#F48024] mr-1" />
          Stack Overflow
        </label>
        <input
          type="url"
          id="stackoverflow_profile"
          bind:value={stackoverflow_profile}
          placeholder="https://stackoverflow.com/users/123456"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>

      <div>
        <label for="npm_profile" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          <FontAwesomeIcon icon={faNpm} class="w-4 h-4 text-[#CB3837] mr-1" />
          npm
        </label>
        <input
          type="url"
          id="npm_profile"
          bind:value={npm_profile}
          placeholder="https://npmjs.com/~yourusername"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>

      <div>
        <label for="pypi_profile" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
          <FontAwesomeIcon icon={faPython} class="w-4 h-4 text-[#3776AB] mr-1" />
          PyPI
        </label>
        <input
          type="url"
          id="pypi_profile"
          bind:value={pypi_profile}
          placeholder="https://pypi.org/user/yourusername"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>
    </div>

    <div class="flex justify-end mt-4">
      <SectionSaveButton state={socialState} onClick={saveSocial} />
    </div>
  </Card>

</div>
