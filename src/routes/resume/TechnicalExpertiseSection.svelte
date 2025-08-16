<script>
  import ResumeSection from './ResumeSection.svelte';
  import BulletList from './BulletList.svelte';
  import BulletItem from './BulletItem.svelte';
  
  const expertKnowledge = [
    { title: 'Python', details: 'Django, Django REST Framework, Celery' },
    { title: 'JavaScript / Node.js', details: 'React, Svelte, Web Components' },
    { title: 'SQL Databases', details: 'PostgreSQL, MySQL/MariaDB, SQLite - schema design, indexing, optimization' },
    { title: 'Web Technologies', details: 'HTML5, CSS (Tailwind), REST APIs' },
    { title: 'Web Protocols', details: 'HTTP/HTTPS, DNS, TLS/SSL, SSH, FTP/SFTP' },
    { title: 'Shell Scripting / CLI Tools', details: 'bash, advanced CLI tools (find, grep, vim, sed, awk, curl, rsync)' },
    { title: 'AI / LLM development tools', details: 'Claude Code, Cursor' },
    { title: 'Git (GitHub, GitLab)', details: 'GitHub, GitLab, advanced workflows, submodules' }
  ];
  
  const workingKnowledge = [
    { title: 'Linux & DevOps', details: 'System administration, CI/CD, Docker, Ansible, Nginx, Apache' },
    { title: 'Cloud Platforms', details: 'Vercel, Linode, Amazon Web Services (AWS)' },
    { title: 'JavaScript / Node.js', details: 'TypeScript, React Native, Vue.js' },
    { title: 'NoSQL Databases', details: 'Elasticsearch, Redis, MongoDB' },
    { title: 'Caching & Load Balancing', details: 'Varnish, Memcached, HAProxy' },
    { title: 'Additional Languages', details: 'Lua, C, Objective-C, Java, PHP' }
  ];
</script>

<style>
  .subsection-heading {
    @apply flex items-center pt-4 pb-2 mb-5 border-b border-cyan-700;
  }

  .subsection-title {
    @apply text-lg print:text-base;
  }
</style>

<ResumeSection title="Technical Expertise" iconName="code-icon" iconWidth="30" iconHeight="17">
  <h3 class="subsection-heading">
    <span class="subsection-title">Expert Knowledge</span>
    <svg width="18" height="18" class="ml-2"><use href="#crown-icon" /></svg>
  </h3>

  <BulletList className="mb-6">
    {#each expertKnowledge as item}
      <BulletItem>
        <h5 class="font-semibold inline">{item.title}</h5>
        {item.details}
      </BulletItem>
    {/each}
  </BulletList>

  <h3 class="subsection-heading">
    <span class="subsection-title">Working Knowledge</span>
    <svg width="18" height="18" class="ml-2"><use href="#helmet-safety-icon" /></svg>
  </h3>

  <BulletList>
    {#each workingKnowledge as item}
      <BulletItem>
        <h5 class="font-semibold inline">{item.title}</h5>
        {item.details}
      </BulletItem>
    {/each}
  </BulletList>
</ResumeSection>