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
  faNetworkWired,
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
      "Dutch Senior Full Stack Developer residing in Spain, with 18+ years experience specializing in Python & Node.js ecosystems. Experienced in scaling complex, high-traffic & data heavy applications and leading development teams. Passionate about UX design and a love for designing DevOps & CI/CD systems. Thrives in agile teams and/or startup environments. 5+ years remote work experience.",
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
            "Managed development teams of 3-5 developers using agile methodologies and strict code review processes",
        },
        {
          title: "Platform Scalability",
          icon: faChartLine,
          description:
            "Optimized SQL queries & Python processes with 30-60%, enabling platform to process thousands of orders per minute",
        },
        {
          icon: faGlobe,
          description:
            "Led ticket scan app creation using React Native & WebSockets, supercharging scalability and increasing revenue by +40%",
            // "Led ticket scan app creation using React Native, reducing hardware costs while improving business scalability",
            // "Led mobile app creation, deciding on React Native architecture, guiding developer in process",
        },
        {
          icon: faGlobe,
          description:
            "Modernized frontend using React, MobX, responsive design & web components, increasing user engagement by +30%",
        },
        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Established quality testing suite using Django and Selenium (+80% coverage) decreasing regression bugs by about 95%",
        },
        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Ochestrated CI/CD systems on Linode, using Ansible & Python, enabling reliable regular deployment and releases",
        },
        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Coordinated development environment setup of 4 Docker microservices in Docker Compose, streamlining onboarding",
        },
        {
          title: "Payment Integration",
          icon: faDollarSign,
          description:
            "Assisted payment service integrations (Mollie, Pay.nl, Paypal), processing tens of millions in payment transactions",
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
            "Implemented TicketSwap REST APIs using DRF, allowing users to validate authenticity of 2nd hand tickets",
        },
        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Integrated Zoom with OAuth, enabling clients to organize automatically managed online events with Zoom",
        },
        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Improved internationalization features (language, country & timezone) enabling market expansion to Eurozone countries",
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
      description: "Tender/Procurement Discovery Platform",
      position: "Lead Developer (part time)",
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
        },
        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Created automatic notification mailing system for user configured tender preferences and saved searches",
        },
        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Enhanced frontend UX design in coordination with frontend developer using Vue.js, fostering professional aesthetic",
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
      position: "Senior Full Stack Developer",
      url: "https://www.travelbird.com/",
      startDate: "2013-03",
      endDate: "2014-08",
      summary:
        "Contributed to mobile app development during rapid growth phase (50 to 250+ employees), supporting European market expansion. Delivered iOS app and mobile website during critical period for travel industry mobile adoption.",
      logo: "/src/lib/images/company-logos/travelbird-logo.png",
      highlights: [
        {
          title: "Mobile App Development",
          icon: faMobile,
          description:
            "Delivered native iOS booking app in scrum team (4) within 5 months, handling 15%+ of bookings within first 3 months",
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
            "Worked on email marketing system using Python & SendGrid, sending thousands of emails, supporting acquisition",
            // "Worked on email marketing system using Python & SendGrid, supporting customer acquisition and retention campaigns",
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
            "Completed web projects for major clients (Bol.com, Gemeente Amsterdam) as part of company's best of 5 Scrum teams",
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
      location: "The Hague, The Netherlands",
      description: "Casual Gaming Community",
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
            "Implemented payment integrations, internationalization, and optimized MySQL database structures & queries",
        },
        {
          title: "Team Collaboration & Growth",
          icon: faUsers,
          description:
            "Advanced from junior to mid-level in 10+ developer team, contributing to large-scale PHP codebase & Linux servers setup",
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
        "Celery",
        "Silk",
        "Beautifulsoup",
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
