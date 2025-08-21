<script lang="ts">
  import { resume } from "$lib/data/resume";

  // Helper function to format date ranges
  function formatDateRange(startDate: string, endDate?: string): string {
    const formatDate = (date: string) => {
      const [year, month] = date.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    };
    
    const start = formatDate(startDate);
    const end = endDate ? formatDate(endDate) : 'Present';
    return `${start} - ${end}`;
  }

  // Helper function to strip HTML tags for ATS compatibility
  function stripHTML(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }
</script>

<svelte:head>
  <title>Rik Wanders - Senior Full Stack Developer - Text Resume</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="ATS-friendly text resume for Rik Wanders, Senior Full Stack Developer" />
</svelte:head>

<div class="max-w-4xl mx-auto p-8 bg-white text-black font-mono text-sm leading-relaxed">
  <!-- Header Section -->
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">{resume.basics.name}</h1>
    <h2 class="text-xl mb-4">{resume.basics.label}</h2>
    
    <div class="mb-4">
      <p>Email: {resume.basics.email}</p>
      <p>Phone: {resume.basics.phone}</p>
      <p>Website: {resume.basics.url}</p>
      <p>Location: {resume.basics.location.address}</p>
      {#each resume.basics.profiles as profile}
        <p>{profile.network}: {profile.url}</p>
      {/each}
    </div>
  </div>

  <!-- Professional Summary -->
  <div class="mb-8">
    <h2 class="text-lg font-bold mb-3 border-b-2 border-black">PROFESSIONAL SUMMARY</h2>
    <p class="mb-4">{resume.basics.summary}</p>
  </div>

  <!-- Key Qualifications -->
  <div class="mb-8">
    <h2 class="text-lg font-bold mb-3 border-b-2 border-black">KEY QUALIFICATIONS</h2>
    <ul class="list-none">
      {#each resume.basics.qualifications as qualification}
        <li class="mb-2">• {stripHTML(qualification.description)}</li>
      {/each}
    </ul>
  </div>

  <!-- Technical Skills -->
  <div class="mb-8">
    <h2 class="text-lg font-bold mb-3 border-b-2 border-black">TECHNICAL SKILLS</h2>
    {#each resume.skills as skillGroup}
      <div class="mb-3">
        <h3 class="font-bold">{skillGroup.name} ({skillGroup.level})</h3>
        <p>{skillGroup.keywords.join(', ')}</p>
      </div>
    {/each}
  </div>

  <!-- Professional Experience -->
  <div class="mb-8">
    <h2 class="text-lg font-bold mb-3 border-b-2 border-black">PROFESSIONAL EXPERIENCE</h2>
    {#each resume.work as job}
      <div class="mb-6">
        <div class="mb-2">
          <h3 class="text-base font-bold">{job.position}</h3>
          <p class="font-bold">{job.name} | {job.location}</p>
          <p>{formatDateRange(job.startDate, job.endDate)}</p>
          {#if job.description}
            <p class="italic">{job.description}</p>
          {/if}
        </div>
        
        <p class="mb-3">{job.summary}</p>
        
        {#if job.highlights && job.highlights.length > 0}
          <div class="mb-3">
            <h4 class="font-bold mb-2">Key Achievements:</h4>
            <ul class="list-none">
              {#each job.highlights as highlight}
                <li class="mb-2">• <strong>{highlight.title}:</strong> {highlight.description}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if job.technologies && job.technologies.length > 0}
          <div class="mb-3">
            <h4 class="font-bold mb-1">Technologies Used:</h4>
            <p>{job.technologies.join(', ')}</p>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Languages -->
  <div class="mb-8">
    <h2 class="text-lg font-bold mb-3 border-b-2 border-black">LANGUAGES</h2>
    {#each resume.languages as language}
      <p>{language.language}: {language.fluency}</p>
    {/each}
  </div>

  <!-- References -->
  <div class="mb-8">
    <h2 class="text-lg font-bold mb-3 border-b-2 border-black">REFERENCES</h2>
    {#each resume.references as reference}
      <div class="mb-4">
        <h3 class="font-bold">{reference.name}</h3>
        <p class="italic">"{reference.reference}"</p>
      </div>
    {/each}
    <p class="mt-4 font-bold">{resume.referencesDescription}</p>
  </div>
</div>

<style>
  /* Ensure high contrast and clean formatting for ATS systems */
  :global(body) {
    background: white;
    color: black;
  }
  
  /* Print-friendly styles */
  @media print {
    .max-w-4xl {
      max-width: none;
      margin: 0;
      padding: 0;
    }
  }
</style>