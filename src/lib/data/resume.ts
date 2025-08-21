import {
  faBullseye,
  faChartLine,
  faCloud,
  faCode,
  faCog,
  faCrown,
  faDatabase,
  faDollarSign,
  faEnvelope,
  faFileCode,
  faGem,
  faGlobe,
  faHandshake,
  faHome,
  faLaptopCode,
  faMicrochip,
  faMobile,
  faNetworkWired,
  faPaintBrush,
  faPlug,
  faRobot,
  faRocket,
  faSearch,
  faServer,
  faShieldAlt,
  faUsers,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";

import {
  faGitAlt,
  faNodeJs,
  faPython,
} from "@fortawesome/free-brands-svg-icons";

export const resume = {
  basics: {
    name: "Rik Wanders",
    label: "Senior Full Stack Developer",
    image: "/src/lib/images/profile-photo.jpeg",
    email: "rik@rikwanders.tech",
    phone: "+31 649118511",
    url: "https://www.rikwanders.tech",
    summary:
      "Dutch Senior Full Stack Developer residing in Spain, with 18+ years experience specializing in Python & Node.js ecosystems. Experienced in scaling complex & high-traffic applications and leading development teams.",
    highlights: [
      {
        description:
          "<strong>18+ years</strong> of <strong>full stack development experience</strong>.",
        icon: faGem,
      },
      {
        description:
          "Expertise in modern <strong>Python, JavaScript & Node.js</strong> ecosystems.",
        icon: faCode,
      },
      {
        description:
          "<strong>Team leadership</strong> and <strong>project management</strong> experience.",
        icon: faUsers,
      },
      {
        description:
          "Additional experience in <strong>Linux, DevOps & CI/CD.</strong>",
        icon: faServer,
      },
      {
        description:
          "Skilled in developing scalable solutions for <strong>high-traffic applications</strong>.",
        icon: faRocket,
      },
      {
        description:
          "<strong>5+ years remote work</strong> and distributed team collaboration experience.",
        icon: faHome,
      },
      {
        description:
          "<strong>AI-accelerated development</strong> skills, with business security in mind.",
        icon: faRobot,
      },
    ],
    location: {
      city: "Ronda",
      region: "Andalusia",
      countryCode: "ES",
      address: "Ronda, Spain",
    },
    profiles: [
      {
        network: "LinkedIn",
        username: "rik-wanders-software",
        url: "https://www.linkedin.com/in/rik-wanders-software/",
      },
    ],
  },
  work: [
    {
      name: "Chipta",
      location: "Amsterdam, The Netherlands",
      description: "Ticketing Service",
      position: "Lead Developer",
      url: "https://www.chipta.com/",
      startDate: "2014-09",
      endDate: "2024-06",
      summary:
        "Led technical development of innovative ticketing platform for 10 years, scaling from concept to processing thousands of tickets per minute during peak events. Transformed proof of concept into robust, scalable platform serving thousands of events.",
      logo: "/src/lib/images/company-logos/chipta-logo.png",
      highlights: [
        {
          title: "Team Leadership",
          icon: faUsers,
          description:
            "Built and managed diverse development teams of 3-5 developers, using agile methodologies that optimized efficiency and delivery speed",
        },
        {
          title: "Platform Scalability",
          icon: faChartLine,
          description:
            "Architected and optimized systems to handle extreme traffic spikes, delivering 40-60% speed improvements through strategic query optimization, caching, and infrastructure scaling",
        },
        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Created extensive testing suite (+80% coverage) and CI/CD system, radically improving deployment reliability & speed and enabling regular releases",
        },
        {
          title: "Payment Integration",
          icon: faDollarSign,
          description:
            "Implemented and maintained payment service provider integrations with multiple providers (Mollie, Pay.nl, PayPal), ensuring reliable transaction processing for the platform",
        },
        {
          title: "Technical Innovation",
          icon: faMicrochip,
          description:
            "Developed custom authentication, mailing, and localization systems, supporting custom needs and backward compatibility",
        },
        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Created multi-language & country platform capabilities that enabled international market expansion and supported global event organizers",
        },
      ],
      technologies: [
        "Python",
        "Django",
        "Django REST Framework",
        "Django Channels",
        "Django Silk",
        "Jinja2",
        "Weasyprint",
        "MySQL",
        "Ansible",
        "Python Fabric",
        "Linode",
        "Nginx",
        "Redis",
        "HAProxy",
        "Selenium",
        "OAuth",
        "Node.js",
        "React",
        "MobX",
        "Lit",
        "Web Components",
        "Web Sockets",
        "Webpack",
        "React Native",
      ],
    },
    {
      name: "Tender-it",
      location: "Amsterdam, The Netherlands",
      description: "Tender Discovery Platform",
      position: "Lead Developer",
      startDate: "2015-03",
      endDate: "2022-06",
      summary:
        "Built comprehensive tender discovery platform from scratch, enabling companies to efficiently find and track public procurement opportunities. Delivered complete platform with intuitive interface and administrative tools as part-time engagement.",
      logo: "/src/lib/images/company-logos/tender-it-logo.png",
      highlights: [
        {
          title: "Product Development",
          icon: faWrench,
          description:
            "Designed and developed entire platform (backend and frontend) from concept to production",
        },
        {
          title: "Search Innovation",
          icon: faSearch,
          description:
            "Implemented an extensive search engine using Elasticsearch, making it easy and time effective for users to find suitable tenders",
        },
        {
          title: "Data Automation",
          icon: faLaptopCode,
          description:
            "Created automated web crawling system that index thousands of public tenders daily, providing comprehensive market coverage",
        },
        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Built subscription-based authentication with recurring payments that supports sustainable business model and user growth",
        },
        {
          title: "User Experience",
          icon: faCrown,
          description:
            "Delivered intuitive 'saved searches' interface and email notification system that supported user engagement and retention",
        },
        {
          title: "Frontend Optimization",
          icon: faPaintBrush,
          description:
            "Successfully collaborated with frontend developer to optimize frontend experience using Vue.js",
        },
      ],
      technologies: [
        "Python",
        "Django",
        "Django REST Framework",
        "Django Celery",
        "Python Requests",
        "MySQL",
        "Beautifulsoup",
        "Elasticsearch",
        "Linode",
        "Nginx",
        "Node.js",
        "React",
        "Vue.js",
        "Webpack",
      ],
    },
    {
      name: "TravelBird",
      location: "Amsterdam, The Netherlands",
      description: "Online Travel Agent",
      position: "Senior Full Stack & iOS Developer",
      url: "https://www.travelbird.com/",
      startDate: "2013-03",
      endDate: "2014-08",
      summary:
        "Contributed to mobile app development during rapid growth phase (50 to 250+ employees), supporting European market expansion. Delivered iOS app and mobile website during critical period for travel industry mobile adoption.",
      logo: "/src/lib/images/company-logos/travelbird-logo.png",
      highlights: [
        {
          title: "Mobile Development",
          icon: faMobile,
          description:
            "Built and maintained iOS application as part of mobile team, supporting mobile bookings during a period of rapid company growth",
        },
        {
          title: "API Architecture",
          icon: faPlug,
          description:
            "Designed and implemented robust REST API using Django REST Framework, that accommodated iOS & Android apps and mobile website",
        },
        {
          title: "Cross-Platform Integration",
          icon: faLaptopCode,
          description:
            "Ensured consistent user experience across multiple mobile platforms and web interfaces",
        },
        {
          title: "Email Marketing Platform",
          icon: faEnvelope,
          description:
            "Worked on comprehensive email marketing system that supported customer acquisition and retention campaigns",
        },
      ],
      technologies: [
        "Objective-C",
        "Xcode",
        "Python",
        "Django",
        "Django REST Framework",
        "Django Celery",
        "Django South",
        "Django Compressor",
        "Sendgrid",
        "PostgreSQL",
        "MongoDB",
        "Linode",
        "Nginx",
        "Varnish",
        "JavaScript",
        "gulp.js",
        "Sass",
      ],
    },
    {
      name: "SWIS",
      location: "Leiden, The Netherlands",
      description: "Web Development Agency",
      position: "Mid-level Web Developer",
      url: "https://www.swis.nl/",
      startDate: "2011-08",
      endDate: "2013-02",
      summary:
        "Delivered web solutions for high-profile clients including major e-commerce and government organizations as part of dedicated Scrum team. Maintained agency's reputation for quality while meeting diverse client requirements.",
      logo: "/src/lib/images/company-logos/swis-logo.png",
      highlights: [
        {
          title: "Client Success",
          icon: faHandshake,
          description:
            "Successfully delivered web projects for major clients including Bol.com, EP, Gemeente Amsterdam, and Gemeente Haarlemmermeer",
        },
        {
          title: "Agile Workflow",
          icon: faBullseye,
          description:
            "Contributed to Scrum team that consistently met client deadlines and budget requirements",
        },
        {
          title: "Frontend Skills",
          icon: faFileCode,
          description:
            "Developed advanced jQuery and UX skills that improved user engagement metrics across client projects",
        },
        {
          title: "Custom CMS Expertise",
          icon: faCog,
          description:
            "Mastered in-house built CMS system, enabling rapid development and client customization capabilities",
        },
      ],
      technologies: [
        "PHP",
        "MySQL",
        "Apache",
        "Linux",
        "XAMPP",
        "HTML5",
        "CSS3",
        "JavaScript",
        "AJAX",
        "jQuery",
        "jQuery UI",
        "Underscore.js",
        "Bootstrap",
        "Responsive design",
        "Firebug",
      ],
    },
    {
      name: "Gamepoint",
      location: "The Hague, The Netherlands",
      description: "Casual Gaming / Community",
      position: "Junior / Mid-level Web Developer",
      url: "https://www.gamepoint.biz/",
      startDate: "2007-06",
      endDate: "2011-06",
      summary:
        "Progressed from junior to mid-level developer at established gaming community platform serving hundreds of thousands of users. Contributed to platform stability, feature development, and system enhancements.",
      logo: "/src/lib/images/company-logos/gamepoint-logo.png",
      highlights: [
        {
          title: "Payment Systems",
          icon: faDollarSign,
          description:
            "Successfully implemented multiple payment integrations that supported platform monetization and user transactions",
        },
        {
          title: "International Expansion",
          icon: faGlobe,
          description:
            "Contributed to internationalization and localization system that enabled platform expansion in other countries",
        },
        {
          title: "Database Design",
          icon: faDatabase,
          description:
            "Designed and optimized MySQL database structures that improved query performance and system reliability",
        },
        {
          title: "Team Collaboration",
          icon: faUsers,
          description:
            "Worked effectively in 10+ developer team environment, contributing to large-scale PHP codebase maintenance and feature development",
        },
        {
          title: "Career Growth",
          icon: faRocket,
          description:
            "Advanced from junior to mid-level developer, demonstrating consistent skill development and increasing responsibility",
        },
      ],
      technologies: [
        "PHP",
        "MySQL",
        "nginx",
        "Memcached",
        "HTML",
        "CSS",
        "JavaScript",
        "jQuery",
        "AJAX",
        "YUI Library",
      ],
    },
  ],
  skills: [
    {
      name: "Python",
      level: "expert",
      icon: faPython,
      keywords: [
        "Django",
        "REST Framework",
        "Celery",
        "Channels",
        "Silk",
        "REST APIs",
        "OOP",
        "Requests",
        "Beautifulsoup",
        "uv",
      ],
    },
    {
      name: "JavaScript / Node.js",
      level: "expert",
      icon: faNodeJs,
      keywords: [
        "React",
        "Svelte",
        "SvelteKit",
        "Web Components",
        "Lit",
        "Drizzle",
        "MobX",
        "async/await",
      ],
    },
    {
      name: "SQL Databases",
      level: "expert",
      icon: faDatabase,
      keywords: [
        "PostgreSQL",
        "MySQL",
        "MariaDB",
        "SQLite",
        "Schema design",
        "indexing",
        "optimization",
      ],
    },
    {
      name: "Frontend Tools",
      level: "expert",
      icon: faGlobe,
      keywords: [
        "Webpack",
        "Vite",
        "ESLint",
        "Prettier",
        "Tailwind CSS",
        "Sass",
      ],
    },
    {
      name: "Git (GitHub, GitLab)",
      level: "expert",
      icon: faGitAlt,
      keywords: [
        "GitHub",
        "GitLab",
        "advanced workflows",
        "submodules",
      ],
    },
    {
      name: "AI / LLM development tools",
      level: "expert",
      icon: faRobot,
      keywords: [
        "Claude Code",
        "Cursor",
      ],
    },
    {
      name: "DevOps",
      level: "working",
      icon: faServer,
      keywords: [
        "CI/CD",
        "Docker (Compose)",
        "Ansible",
      ],
    },
    {
      name: "Cloud Platforms",
      level: "working",
      icon: faCloud,
      keywords: [
        "Vercel",
        "Linode",
      ],
    },
    {
      name: "JavaScript / Node.js",
      level: "working",
      icon: faNodeJs,
      keywords: [
        "TypeScript",
        "React Native",
        "Vue.js",
      ],
    },
    {
      name: "NoSQL Databases",
      level: "working",
      icon: faDatabase,
      keywords: [
        "Elasticsearch",
        "Redis",
        "MongoDB",
      ],
    },
    {
      name: "Serving, Caching & Load Balancing",
      level: "working",
      icon: faNetworkWired,
      keywords: [
        "Nginx",
        "Varnish",
        "Memcached",
        "HAProxy",
      ],
    },
    {
      name: "Additional Languages",
      level: "working",
      icon: faCode,
      keywords: [
        "Lua",
        "C",
        "Objective-C",
        "PHP",
      ],
    },
  ],
  languages: [
    {
      language: "English",
      fluency: "Fluent",
    },
    {
      language: "Dutch",
      fluency: "Native",
    },
  ],
  references: [
    {
      name: "Michaël de Groot - Founder of Chipta",
      reference:
        "Rik modernized our client-facing interfaces and implemented optimizations that delivered substantial performance improvements. His work enabled us to process thousands of tickets rapidly during our busiest periods.",
      logo: "/src/lib/images/company-logos/chipta-logo.png",
    },
    {
      name: "Elmar Krack - Co-founder of Tender-it",
      reference:
        "Rik demonstrated exceptional technical leadership by designing and developing our entire platform from the ground up, handling both backend and frontend development with impressive skill.",
      logo: "/src/lib/images/company-logos/tender-it-logo.png",
    },
  ],
  referencesDescription: "Contact details available upon request.",
  projects: [],
};
