<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import InfoBoxes from "./InfoBoxes.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloud,
    faCode,
    faCrown,
    faDatabase,
    faEye,
    faGlobe,
    faHardHat,
    faNetworkWired,
    faRobot,
    faServer,
    faTerminal,
  } from "@fortawesome/free-solid-svg-icons";
  import {
    faGitAlt,
    faLinux,
    faNodeJs,
    faPython,
  } from "@fortawesome/free-brands-svg-icons";

  const expertKnowledge = [
    {
      title: "Python",
      details: "Django, REST Framework, Celery, Channels, Silk",
      icon: faPython,
    },
    {
      title: "JavaScript / Node.js",
      details: "React, Svelte, Web Components",
      icon: faNodeJs,
    },
    {
      title: "SQL Databases",
      details:
        "PostgreSQL, MySQL/MariaDB, SQLite<br />Schema design, indexing, optimization",
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
        "bash, advanced CLI tools<br />(find, grep, vim, sed, awk, curl, rsync)",
      icon: faTerminal,
    },
    {
      title: "Git (GitHub, GitLab)",
      details: "GitHub, GitLab, advanced workflows, submodules",
      icon: faGitAlt,
    },
    {
      title: "AI / LLM development tools",
      details: "Claude Code, Cursor",
      icon: faRobot,
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
    {
      title: "NoSQL Databases",
      details: "Elasticsearch, Redis, MongoDB",
      icon: faDatabase,
    },
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

  const exploring = [
    {
      title: "Python",
      details: "FastAPI, pandas, scikit-learn, langchain",
      icon: faPython,
    },
    {
      title: "JavaScript / Node.js",
      details: "Next.js, Jest, Zustand",
      icon: faNodeJs,
    },
    {
      title: "Cloud Platforms",
      details: "AWS, Azure, GCP",
      icon: faCloud,
    },
    {
      title: "DevOps",
      details: "Kubernetes, Terraform, GitHub Actions",
      icon: faServer,
    },
  ];
</script>

<ResumeSection title="Technical Expertise" icon={faCode}>
  <div class="space-y-8">
    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-ocean"
      >
        <span class="text-lg font-medium">Expert Knowledge</span>
        <FontAwesomeIcon icon={faCrown} class="w-4 h-4 ml-2" />
      </h3>
      <InfoBoxes items={expertKnowledge} />
    </div>

    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-ocean"
      >
        <span class="text-lg font-medium">Working Knowledge</span>
        <FontAwesomeIcon icon={faHardHat} class="w-4 h-4 ml-2" />
      </h3>
      <InfoBoxes items={workingKnowledge} />
    </div>

    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-ocean"
      >
        <span class="text-lg font-medium">Exploring</span>
        <FontAwesomeIcon icon={faEye} class="w-4 h-4 ml-2" />
      </h3>
      <InfoBoxes items={exploring} />
    </div>
  </div>
</ResumeSection>
