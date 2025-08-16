<script>
  import TechTag from './TechTag.svelte';
  import BulletList from './BulletList.svelte';
  import BulletItem from './BulletItem.svelte';
  
  export let company;
  export let role;
  export let industry;
  export let website = null;
  export let period;
  export let location;
  export let logo = null;
  export let description;
  export let note = null;
  export let achievements = [];
  export let impact;
  export let technologies = [];
</script>

<section class="mb-12 break-inside-avoid print:mb-8">
  <header class="mb-6">
    <div class="flex items-start justify-between mb-4">
      <div class="flex-1">
        <h3 class="text-2xl font-semibold text-cyan-700 mb-2 print:text-xl">{company}</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm print:text-xs">
          <div class="space-y-2">
            <div class="flex items-center">
              <svg width="12" height="12" class="mr-2 flex-shrink-0"><use href="#user-tie-icon" /></svg>
              <span>{role}</span>
            </div>
            
            <div class="flex items-center">
              <svg width="12" height="12" class="mr-2 flex-shrink-0"><use href="#company-icon" /></svg>
              <span>{industry}</span>
            </div>
            
            {#if website}
              <div class="flex items-center">
                <svg width="12" height="12" class="mr-2 flex-shrink-0"><use href="#link-icon" /></svg>
                <a href={website} target="_blank" class="text-cyan-700 hover:text-cyan-600">{website.replace('https://', '').replace('www.', '')}</a>
              </div>
            {/if}
          </div>
          
          <div class="space-y-2">
            <div class="flex items-center">
              <svg width="12" height="12" class="mr-2 flex-shrink-0"><use href="#calendar-icon" /></svg>
              <span>{period}</span>
            </div>
            
            <div class="flex items-center">
              <svg width="12" height="12" class="mr-2 flex-shrink-0"><use href="#location-icon" /></svg>
              <span>{location}</span>
            </div>
          </div>
        </div>
      </div>
      
      {#if logo}
        <div class="ml-4 flex-shrink-0">
          <img src={logo} alt="{company} Logo" class="h-20 w-auto border border-gray-400 rounded" />
        </div>
      {/if}
    </div>
  </header>

  <div class="space-y-4">
    <p class="text-sm leading-relaxed print:text-xs">{description}</p>
    
    {#if note}
      <p class="text-sm italic text-gray-700 print:text-xs"><strong>Note:</strong> {note}</p>
    {/if}

    {#if achievements.length > 0}
      <div>
        <h4 class="text-lg font-semibold mb-3 print:text-base">Key Achievements:</h4>
        <BulletList>
          {#each achievements as achievement}
            <BulletItem>
              <strong>{achievement.title}:</strong> {achievement.description}
            </BulletItem>
          {/each}
        </BulletList>
      </div>
    {/if}

    <div>
      <h4 class="text-lg font-semibold mb-3 print:text-base">
        {#if company === 'TravelBird'}
          Industry Impact:
        {:else if company === 'SWIS'}
          Client Impact:
        {:else if company === 'Gamepoint'}
          Platform Impact:
        {:else}
          Technical Impact:
        {/if}
      </h4>
      <p class="text-sm leading-relaxed print:text-xs">{impact}</p>
    </div>

    {#if technologies.length > 0}
      <div>
        <h4 class="text-lg font-semibold mb-3 print:text-base">Technologies Used:</h4>
        <div class="flex flex-wrap gap-2">
          {#each technologies as tech}
            <TechTag>{tech}</TechTag>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</section>