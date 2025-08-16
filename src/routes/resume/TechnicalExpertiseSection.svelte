<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import TechnicalSkillsList from "./TechnicalSkillsList.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCode,
    faCrown,
    faHardHat,
  } from "@fortawesome/free-solid-svg-icons";

  const expertKnowledge = [
    { title: "Python", details: "Django, Django REST Framework, Celery" },
    {
      title: "JavaScript / Node.js",
      details: "React, Svelte, Web Components",
    },
    {
      title: "SQL Databases",
      details:
        "PostgreSQL, MySQL/MariaDB, SQLite - schema design, indexing, optimization",
    },
    {
      title: "Web Technologies",
      details: "HTML5, CSS (Tailwind), REST APIs",
    },
    {
      title: "Web Protocols",
      details: "HTTP/HTTPS, DNS, TLS/SSL, SSH, FTP/SFTP",
    },
    {
      title: "Shell Scripting / CLI Tools",
      details:
        "bash, advanced CLI tools (find, grep, vim, sed, awk, curl, rsync)",
    },
    { title: "AI / LLM development tools", details: "Claude Code, Cursor" },
    {
      title: "Git (GitHub, GitLab)",
      details: "GitHub, GitLab, advanced workflows, submodules",
    },
  ];

  const workingKnowledge = [
    {
      title: "Linux & DevOps",
      details:
        "System administration, CI/CD, Docker, Ansible, Nginx, Apache",
    },
    {
      title: "Cloud Platforms",
      details: "Vercel, Linode, Amazon Web Services (AWS)",
    },
    {
      title: "JavaScript / Node.js",
      details: "TypeScript, React Native, Vue.js",
    },
    { title: "NoSQL Databases", details: "Elasticsearch, Redis, MongoDB" },
    {
      title: "Caching & Load Balancing",
      details: "Varnish, Memcached, HAProxy",
    },
    {
      title: "Additional Languages",
      details: "Lua, C, Objective-C, Java, PHP",
    },
  ];
</script>

<ResumeSection title="Technical Expertise" icon={faCode}>
  <div class="grid grid-cols-1 md:grid-cols-5 gap-8 relative">
    <div class="md:col-span-3">
      <h3
        class="flex items-center justify-between pt-4 pb-2 mb-5 border-b border-cyan-700"
      >
        <span class="text-lg font-medium">Expert Knowledge</span>
        <FontAwesomeIcon icon={faCrown} class="w-4 h-4" />
      </h3>
      <TechnicalSkillsList skills={expertKnowledge} />
    </div>

    <div class="md:col-span-2 md:border-l md:border-gray-500 md:pl-8">
      <h3
        class="flex items-center justify-between pt-4 pb-2 mb-5 border-b border-cyan-700"
      >
        <span class="text-lg font-medium">Working Knowledge</span>
        <FontAwesomeIcon icon={faHardHat} class="w-4 h-4" />
      </h3>
      <TechnicalSkillsList skills={workingKnowledge} />
    </div>
  </div>
</ResumeSection>
