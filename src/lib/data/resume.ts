import {
  faChartLine,
  faCloud,
  faCode,
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
  // faNetworkWired,
  faRobot,
  faRocket,
  faSearch,
  faServer,
  faShieldAlt,
  faUsers,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";

import {
  faGithub,
  faNodeJs,
  faPython,
} from "@fortawesome/free-brands-svg-icons";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons";

export const resume = {
  basics: {
    name: "Rik Wanders",
    label: "Senior Full Stack Developer",
    subLabel: "Available for international remote collaboration",
    image: "/src/lib/images/profile-photo.jpeg",
    email: "rik@rikwanders.tech",
    phone: "+31649118511",
    url: "https://www.rikwanders.tech",
    url_label: "rikwanders.tech",
    summary:
      "Dutch Senior Full Stack Developer residing in Spain, with 18+ years experience specializing in Python & Node.js ecosystems. Experienced in scaling complex, high-traffic & data heavy applications and leading agile development teams. Deeply engaged in UX design and skilled at engineering DevOps & CI/CD systems. Always interested in the latest AI, tech & security industry updates. Thrives in agile teams and/or startup environments. 5+ years remote work experience.",
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
      timezone: "CET/GMT+1",
      url: "https://maps.app.goo.gl/WefqeUxUYBD6Q1qF8",
    },
    profiles: [
      {
        network: "LinkedIn",
        username: "rik-wanders-software",
        url: "https://www.linkedin.com/in/rik-wanders-software/",
        label: "rik-wanders-software",
        icon: faLinkedin,
      },
      {
        network: "GitHub",
        username: "gitaarik",
        url: "https://github.com/gitaarik",
        label: "gitaarik",
        icon: faGithub,
      },
    ],
  },
  work: [
    {
      name: "Chipta",
      location: "Amsterdam, NL",
      description: "Ticketing Service",
      position: "Lead Developer",
      url: "https://www.chipta.com/",
      startDate: "2014-09",
      endDate: "2024-06",
      summary:
        "Led technical development and team management for innovative ticketing platform over 10 years, scaling from concept to processing thousands of orders per minute. Managed development teams of 3-5 developers while optimizing platform performance by 30-60%, implementing comprehensive testing suites, and orchestrating CI/CD systems. Built React Native mobile apps that increased revenue by 40%, modernized frontend interfaces increasing user engagement by 30%, and integrated critical payment systems processing tens of millions in transactions.",
      logo: "/src/lib/images/company-logos/chipta-logo.png",
      highlights: [
        {
          title: "Team Leadership",
          icon: faUsers,
          description:
            "Managed development teams of 3-5 developers using agile methodologies and strict code review processes",
        },
        {
          title: "Platform Scalability",
          icon: faChartLine,
          description:
            "Optimized SQL queries & Python processes with 30-60%, enabling platform to process thousands of orders per minute",
          tags: ["fullstack-python", "fullstack-react", "fullstack-svelte"],
        },
        {
          icon: faGlobe,
          description:
            "Led ticket scan app creation using React Native & WebSockets, supercharging scalability and increasing revenue by +40%",
          tags: ["fullstack-react", "fullstack-svelte"],
        },
        {
          icon: faGlobe,
          description:
            "Modernized frontend using React, MobX, responsive design & web components, increasing user engagement by +30%",
          tags: ["fullstack-react", "fullstack-svelte"],
        },
        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Established quality testing suite using Django and Selenium (+80% coverage) decreasing regression bugs by about 95%",
          tags: ["fullstack-python", "fullstack-react", "fullstack-svelte"],
        },
        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Orchestrated CI/CD systems on Linode using Ansible & Python, reducing deploy time by +60%, enabling regular releases",
          tags: ["fullstack-python", "fullstack-react", "fullstack-svelte"],
        },
        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Coordinated development environment setup of 4 Docker microservices in Docker Compose, streamlining onboarding",
          tags: ["fullstack-python", "fullstack-react", "fullstack-svelte"],
        },
        {
          title: "Technical Innovation",
          icon: faMicrochip,
          description:
            "Customized Django codebase for maintaining backward compatibility with old PHP system & database",
          tags: ["fullstack-python"],
        },
        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Integrated Zoom with OAuth, enabling clients to organize automatically managed online events with Zoom",
          tags: ["fullstack-python"],
        },
        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Implemented TicketSwap REST APIs using DRF, allowing users to validate authenticity of 2nd hand tickets",
          tags: [],
        },
        {
          title: "Payment Integration",
          icon: faDollarSign,
          description:
            "Guided payment service integrations (Mollie, Pay.nl, Paypal), processing tens of millions in payment transactions",
          tags: [],
        },
        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Improved internationalization features (language, country & timezone) enabling market expansion to Eurozone countries",
          tags: [],
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
      location: "Amsterdam, NL",
      description: "Tender/Procurement Discovery Platform",
      position: "Lead Developer (part time)",
      startDate: "2015-03",
      endDate: "2022-06",
      summary:
        "Built comprehensive tender discovery platform from scratch as part-time lead developer, designing complete platform using agile methodology in consultation with non-technical founders. Developed industry-first Elasticsearch-powered search engine filtering hundreds of thousands of tenders, engineered automated web crawling systems importing thousands of tenders daily, and implemented subscription-based revenue model with recurring payments and automated notification systems.",
      logo: "/src/lib/images/company-logos/tender-it-logo.png",
      highlights: [
        {
          title: "Product Development",
          icon: faWrench,
          description:
            "Directed agile/scrum methodology while designing complete platform in consultation with non-technical founders",
        },
        {
          title: "Search Innovation",
          icon: faSearch,
          description:
            "Developed industry-first Elasticsearch-powered search engine for filtering & scoring hundreds of thousands of tenders",
        },
        {
          title: "Data Automation",
          icon: faLaptopCode,
          description:
            "Engineered automated web crawling system importing & transforming thousands of tenders daily into structured data",
        },
        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Built subscription-based authentication system with monthly & yearly recurring payments supporting business model",
          tags: ["fullstack-python"],
        },
        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Created automatic notification mailing system for user configured tender preferences and saved searches",
          tags: [],
        },
        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Enhanced frontend in coordination with frontend developer using Vue.js, providing professional platform aesthetics",
          tags: ["fullstack-react", "fullstack-svelte"],
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
      location: "Amsterdam, NL",
      description: "Online Travel Agent",
      position: "Senior Full Stack Developer",
      url: "https://www.travelbird.com/",
      startDate: "2013-03",
      endDate: "2014-08",
      summary:
        "Contributed to mobile app development during time of travel industry mobile adoption, shipping native iOS booking app in scrum team that handled 15%+ of bookings within first 3 months. Designed REST API using Django REST Framework deployed on AWS to accommodate new iOS & Android apps and mobile website.",
      logo: "/src/lib/images/company-logos/travelbird-logo.png",
      highlights: [
        {
          title: "Mobile App Development",
          icon: faMobile,
          description:
            "Shipped native iOS booking app in scrum team (4) within 5 months, handling 15%+ of bookings within first 3 months",
        },

        {
          title: "Mobile App Development",
          icon: faMobile,
          description:
            "Designed REST API using DRF, deployed on AWS, accommodating new iOS & Android apps and mobile website",
        },

        {
          title: "Email Marketing Platform",
          icon: faEnvelope,
          description:
            "Built email marketing system using Python & SendGrid, sending thousands of emails, supporting acquisition",
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
      location: "Leiden, NL",
      description: "Web Development Agency",
      position: "Mid-level Web Developer",
      url: "https://www.swis.nl/",
      startDate: "2011-08",
      endDate: "2013-02",
      summary:
        "Delivered web projects for major clients including Bol.com and Gemeente Amsterdam as part of company's best performing Scrum team out of 5 teams. Cultivated advanced frontend & UX skills with jQuery & CSS3, significantly increasing user product engagement and client satisfaction while maintaining agency's reputation for quality delivery.",
      logo: "/src/lib/images/company-logos/swis-logo.png",
      highlights: [
        {
          title: "Client Delivery",
          icon: faHandshake,
          description:
            "Delivered web projects for major clients (Bol.com, Gemeente Amsterdam) as part of company's best of 5 Scrum teams",
        },
        {
          title: "Frontend & CMS Development",
          icon: faFileCode,
          description:
            "Cultivated advanced frontend & UX skills with jQuery & CSS3, increasing user product engagement & client satisfaction",
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
      location: "The Hague, NL",
      description: "Casual Gaming Community",
      position: "Junior / Mid-level Web Developer",
      url: "https://www.gamepoint.biz/",
      startDate: "2007-08",
      endDate: "2011-06",
      summary:
        "Progressed from junior to mid-level developer within a 10+ developer team at established gaming community platform serving hundreds of thousands of users. Implemented payment integrations and internationalization features, optimized MySQL database structures & queries, and maintained large-scale PHP codebase & Linux server setup while contributing to platform stability and feature development.",
      logo: "/src/lib/images/company-logos/gamepoint-logo.png",
      highlights: [
        {
          title: "Platform Development",
          icon: faDatabase,
          description:
            "Implemented payment integrations, internationalization, and optimized MySQL database structures & queries",
        },
        {
          title: "Team Collaboration & Growth",
          icon: faUsers,
          description:
            "Promoted to mid-level developer in 10+ developer team, maintaining large-scale PHP codebase & Linux servers setup",
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
      name: "Backend",
      level: "Expert",
      icon: faPython,
      keywords: [
        "Python",
        "Django",
        "Flask",
        "FastAPI",
        "RESTful API & LLM integrations",
        // "Celery",
        // "Silk",
        // "Beautifulsoup",
        "pytest",
      ],
    },

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
        "Tailwind CSS",
        "Jest",
        // "Web Components",
        // "Sass",
        // "Lit",
        // "Drizzle",
        // "MobX",
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
        // "Neovim",
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
        // "Serverless functions",
      ],
    },

    {
      name: "Cloud Platforms",
      level: "Proficient",
      icon: faCloud,
      keywords: [
        "Vercel",
        "Linode",
        "Amazon Web Services (AWS)",
      ],
    },
    // {
    //   name: "Serving, Caching & Load Balancing",
    //   level: "Proficient",
    //   icon: faNetworkWired,
    //   keywords: [
    //     "Nginx",
    //     "Varnish",
    //     "Redis",
    //     "Memcached",
    //     "HAProxy",
    //   ],
    // },
    //
    // {
    //   name: "Additional Languages",
    //   level: "Proficient",
    //   icon: faCode,
    //   keywords: [
    //     "Shell / Bash",
    //     "Lua",
    //     "PHP",
    //     "C",
    //     "Objective-C",
    //   ],
    // },
  ],
  education: [
    {
      institution: "Nova College",
      location: "Hoofddorp, NL",
      url: "https://www.novacollege.nl/",
      area: "Network Management",
      studyType: "Dutch secondary vocational education",
      startDate: "2004-08",
      endDate: "2007-06",
      graduationYear: "2007",
      score: 4,
    },
    {
      institution: "Festivalinfo.nl",
      location: "Amsterdam, NL",
      url: "https://www.festivalinfo.nl/",
      area: "Internship Web Developer",
      studyType: "Festival Info Platform",
      startDate: "2006-03",
      endDate: "2006-08",
      score: 4,
    },
  ],
  projects: [
    {
      name: "LitState",
      startDate: "2020-11",
      endDate: "2023-01",
      description:
        "Lightweight State Management library for Lit (Web Components library). Succesfully employed in Chipta frontend projects.",
      highlights: [
        "Conceived Open-Source NPM package providing reactive state management for Lit Web Components library",
        "Received appreciation in community with 143 GitHub stars during time of Lit & Web Components popularity",
        "Engaged with users handling GitHub Issues and Pull Requests",
        "Employed library succesfully in projects at Chipta",
      ],
      url: "https://github.com/gitaarik/lit-state",
      stars: 143,
    },
    {
      name: "Django Admin Relation Links",
      startDate: "2017-03",
      endDate: "2020-12",
      description:
        "Django Admin Navigation Enhancements. Effectively used in Chipta & Tender-it projects.",
      highlights: [
        "Conceived Open-Source Python package providing navigation enhancements in Django Admin",
        "Received appreciation in community with 108 GitHub stars",
        "Engaged with users handling GitHub Issues and Pull Requests",
        "Employed library succesfully in projects at Chipta",
      ],
      url: "https://github.com/gitaarik/django-admin-relation-links",
      stars: 108,
    },
    {
      name: "Jazzchords",
      startDate: "2013-06",
      endDate: "2017-12",
      description:
        "Easy Chord Chart Creation Tool, satisfactorily used for personal music projects",
      highlights: [
        "Succesfully employed self-created tool to create chord charts and print them for musical projects",
      ],
      url: "https://github.com/gitaarik/jazzchords",
      stars: 12,
    },
    {
      name: "Adyengo",
      startDate: "2013-08",
      endDate: "2020-05",
      description:
        "Adyen Payment Integration for Django, succesfully utilized in Tender-it project",
      highlights: [
        "Conceived Open-Source Python package providing Adyen payment integrations for Django",
        "Received appreciation in community with 10 GitHub stars",
        "Engaged with users handling GitHub Issues and Pull Requests",
        "Employed library succesfully in project at Tender-it",
      ],
      url: "https://github.com/gitaarik/adyengo",
      stars: 10,
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
};
