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
  faRobot,
  faRocket,
  faSearch,
  faServer,
  faShieldAlt,
  faUsers,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";

import { faNodeJs, faPython } from "@fortawesome/free-brands-svg-icons";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons";

export const resume = {
  basics: {
    name: "Rik Wanders",
    label: "Senior Full Stack Developer",
    image: "/src/lib/images/profile-photo.jpeg",
    email: "rik@rikwanders.tech",
    phone: "+31649118511",
    url: "https://www.rikwanders.tech",
    url_label: "rikwanders.tech",
    summary:
      "Dutch Senior Full Stack Developer residing in Spain, with 18+ years experience specializing in Python & Node.js ecosystems. Experienced in scaling complex & high-traffic applications and leading development teams.",
    highlights: [
      {
        description:
          "<strong>18+ years</strong> of full stack development experience.",
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
          "Additional experience in <strong>DevOps & CI/CD.</strong>",
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
          "<strong>AI-accelerated development</strong> skills with security best practices.",
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
        label: "/in/rik-wanders-software/",
        icon: faLinkedin,
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
            "Managed development teams of 3-5 developers using agile methodologies and extensive code review processes",
        },
        {
          title: "Platform Scalability",
          icon: faChartLine,
          description:
            "Architected scalable systems handling extreme traffic spikes, processing thousands of orders per minute",
        },
        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Created comprehensive testing suite (+80% coverage) and CI/CD system enabling reliable regular releases",
        },
        {
          title: "Payment Integration",
          icon: faDollarSign,
          description:
            "Implemented payment integrations with multiple providers, processing tens of millions in transactions",
        },
        {
          title: "Technical Innovation",
          icon: faMicrochip,
          description:
            "Customized Django codebase for maintaining backward compatibility with old PHP system & database",
        },
        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Created internationalization capabilities enabling market expansion to Eurozone countries",
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
        "React Native",
      ],
    },
    {
      name: "Tender-it",
      location: "Amsterdam, The Netherlands",
      description: "Tender Discovery Platform",
      position: "Lead Developer - Part-time",
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
            "Leading agile/scrum methodology while designing complete platform in consultation with non-technical founders",
        },
        {
          title: "Search Innovation",
          icon: faSearch,
          description:
            "Implemented industry-first Elasticsearch-powered search engine for efficient tender discovery",
        },
        {
          title: "Data Automation",
          icon: faLaptopCode,
          description:
            "Created automated web crawling system indexing thousands of tenders daily into structured data",
        },
        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Built subscription-based authentication system with recurring payments supporting business model",
        },
        // {
        //   title: "User Experience",
        //   icon: faCrown,
        //   description:
        //     'Delivered intuitive "saved searches" and email notifications for user service & retention',
        // },
        // {
        //   title: "Frontend Optimization",
        //   icon: faPaintBrush,
        //   description: "Collaborated on frontend optimization using Vue.js",
        // },
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
      position: "Senior Full Stack",
      url: "https://www.travelbird.com/",
      startDate: "2013-03",
      endDate: "2014-08",
      summary:
        "Contributed to mobile app development during rapid growth phase (50 to 250+ employees), supporting European market expansion. Delivered iOS app and mobile website during critical period for travel industry mobile adoption.",
      logo: "/src/lib/images/company-logos/travelbird-logo.png",
      highlights: [
        {
          title: "Mobile & API Development",
          icon: faMobile,
          description:
            "Built iOS app in scrum team and led REST API using Django REST Framework for mobile platforms",
        },
        {
          title: "Email Marketing Platform",
          icon: faEnvelope,
          description:
            "Developed comprehensive email marketing system for customer acquisition and retention",
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
        "AWS",
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
          title: "Client Delivery",
          icon: faHandshake,
          description:
            "Delivered web projects for major clients (Bol.com, Gemeente Amsterdam) using Scrum methodology",
        },
        {
          title: "Frontend & CMS Development",
          icon: faFileCode,
          description:
            "Developed advanced jQuery/UX skills and mastered in-house CMS for rapid implementations",
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
          title: "Platform Development",
          icon: faDatabase,
          description:
            "Implemented payment integrations, internationalization, and optimized MySQL database structures",
        },
        {
          title: "Team Collaboration & Growth",
          icon: faUsers,
          description:
            "Advanced from junior to mid-level in 10+ developer team, contributing to large-scale PHP codebase",
        },
      ],
      technologies: [
        "PHP",
        "MySQL",
        "Linux",
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
      name: "Frontend",
      level: "Expert",
      icon: faNodeJs,
      keywords: [
        "JavaScript",
        "Node.js",
        "TypeScript",
        "React",
        "React Native",
        "Svelte",
        "Jest",
        "Web Components",
        "Tailwind CSS",
        "Sass",
        // "Lit",
        // "Drizzle",
        // "MobX",
      ],
    },

    {
      name: "Backend",
      level: "Expert",
      icon: faPython,
      keywords: [
        "Python",
        "Django",
        "Flask",
        "FastAPI",
        "RESTful API & LLM integrations",
        "Celery",
        "Silk",
        "Beautifulsoup",
      ],
    },

    {
      name: "Databases",
      level: "Expert",
      icon: faDatabase,
      keywords: [
        "PostgreSQL",
        "MySQL",
        "MariaDB",
        "SQLite",
        "SQL optimization",
        "MongoDB",
        "Elasticsearch",
      ],
    },

    {
      name: "Development tools",
      level: "Expert",
      icon: faRobot,
      keywords: [
        "Git",
        "GitHub",
        "GitHub Flow",
        "Claude Code",
        "Cursor",
        "VSCode",
        "Neovim",
      ],
    },

    {
      name: "DevOps",
      level: "Proficient",
      icon: faServer,
      keywords: [
        "Docker (Compose)",
        "CI/CD",
        "Ansible",
        "GitHub Actions",
        "Serverless functions",
      ],
    },

    {
      name: "Cloud Platforms",
      level: "Proficient",
      icon: faCloud,
      keywords: [
        "Vercel",
        "Linode",
        "AWS",
      ],
    },

    {
      name: "Serving, Caching & Load Balancing",
      level: "Proficient",
      icon: faNetworkWired,
      keywords: [
        "Nginx",
        "Varnish",
        "Redis",
        "Memcached",
        "HAProxy",
      ],
    },

    {
      name: "Additional Languages",
      level: "Proficient",
      icon: faCode,
      keywords: [
        "Shell / Bash",
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
