<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import TechnicalSkillsList from "./TechnicalSkillsList.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCode,
    faCrown,
    faHardHat,
    faDatabase,
    faGlobe,
    faNetworkWired,
    faTerminal,
    faRobot,
    faCloud,
    faServer,
  } from "@fortawesome/free-solid-svg-icons";
  import { faPython, faNodeJs, faGitAlt, faLinux } from "@fortawesome/free-brands-svg-icons";

  const expertKnowledge = [
    { title: "Python", details: "Django, REST Framework, Celery, Channels, Silk", icon: faPython },
    {
      title: "JavaScript / Node.js",
      details: "React, Svelte, Web Components",
      icon: faNodeJs,
    },
    {
      title: "SQL Databases",
      details:
        "PostgreSQL, MySQL/MariaDB, SQLite - schema design, indexing, optimization",
      icon: faDatabase,
    },
    {
      title: "Web Technologies",
      details: "HTML5, CSS3 (Tailwind), REST APIs",
      icon: faGlobe,
    },
    {
      title: "Web Protocols",
      details: "HTTP/HTTPS, DNS, TLS/SSL, SSH, FTP/SFTP",
      icon: faNetworkWired,
    },
    {
      title: "Shell Scripting / CLI Tools",
      details:
        "bash, advanced CLI tools (find, grep, vim, sed, awk, curl, rsync)",
      icon: faTerminal,
    },
    { title: "AI / LLM development tools", details: "Claude Code, Cursor, VSCode", icon: faRobot },
    {
      title: "Git (GitHub, GitLab)",
      details: "GitHub, GitLab, advanced workflows, submodules",
      icon: faGitAlt,
    },
  ];

  const workingKnowledge = [
    {
      title: "Linux & DevOps",
      details:
        "System administration, CI/CD, Docker (Compose), Ansible, Nginx, Apache",
      icon: faLinux,
    },
    {
      title: "Cloud Platforms",
      details: "Vercel, Linode, Amazon Web Services (AWS)",
      icon: faCloud,
    },
    {
      title: "JavaScript / Node.js",
      details: "TypeScript, React Native, Vue.js",
      icon: faNodeJs,
    },
    { title: "NoSQL Databases", details: "Elasticsearch, Redis, MongoDB", icon: faDatabase },
    {
      title: "Caching & Load Balancing",
      details: "Varnish, Memcached, HAProxy",
      icon: faServer,
    },
    {
      title: "Additional Languages",
      details: "Lua, C, Objective-C, PHP",
      icon: faTerminal,
    },
  ];
</script>

<ResumeSection title="Technical Expertise" icon={faCode}>
  <div class="space-y-8">
    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-cyan-700"
      >
        <span class="text-lg font-medium">Expert Knowledge</span>
        <FontAwesomeIcon icon={faCrown} class="w-4 h-4 ml-2" />
      </h3>
      <TechnicalSkillsList skills={expertKnowledge} />
    </div>

    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-cyan-700"
      >
        <span class="text-lg font-medium">Working Knowledge</span>
        <FontAwesomeIcon icon={faHardHat} class="w-4 h-4 ml-2" />
      </h3>
      <TechnicalSkillsList skills={workingKnowledge} />
    </div>
  </div>
</ResumeSection>
