import {
  faCalendarAlt,
  faChartLine,
  faClock,
  faCloud,
  faCode,
  faDatabase,
  faDollarSign,
  faEnvelope,
  faFileCode,
  faGem,
  faGlobe,
  faHandshake,
  faHeart,
  faHome,
  faLaptopCode,
  faMicrochip,
  faMobile,
  faMountain,
  faMusic,
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
      "Dutch Senior Full Stack Developer residing in Spain, with 18+ years experience specializing in Python & Node.js ecosystems. Experienced in scaling complex, high-traffic & data heavy applications with Django and React, and leading agile development teams. Additional skills in DevOps, CI/CD & UX design. Always current with industry trends, AI, and security practices. Thrives in agile teams and/or startup environments. 5+ years remote work experience.",

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

  workAccomplishment: {
    title: "Scaling Chipta: From Startup to High-Traffic Platform",
    description:
      "My most impressive accomplishment was transforming Chipta from an early-stage proof of concept to a platform handling tens of millions in transactions. I led the complete migration to Django + React and modern web technologies, guided the creation of the React Native mobile app, and established a quality testing suite. Over 10 years, I built this into a robust system processing thousands of orders per minute during peak events while growing and leading the development team.",
    impact:
      "This decade-long technical leadership journey demonstrates my ability to scale both technology and teams while maintaining code quality and system reliability. The platform I built became the backbone for processing tens of millions in payment transactions and enabled the company to expand internationally. Most importantly, I established sustainable development practices that allowed the team to continue innovating long after each individual project was completed.",
    accomplishments: [
      {
        title: "Leading Platform Scaling Revolution",
        description:
          "Led teams of 3-5 developers at innovative ticketing platform for over 10 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, enabling the company to handle massive traffic spikes during high-demand events.",
        impact: "Thousands of orders per minute processing capability",
        metrics: "30-60% performance optimization",
      },
      {
        title: "Mobile Revenue Transformation",
        description:
          "Built React Native mobile apps that increased revenue by 40% and modernized frontend interfaces with React, increasing user engagement by 30%. This mobile-first approach opened entirely new revenue streams and customer segments.",
        impact: "40% revenue increase from mobile apps",
        metrics: "30% increase in user engagement",
      },
      {
        title: "System Reliability & Quality Revolution",
        description:
          "Established comprehensive testing suites with +80% coverage and orchestrated CI/CD systems that reduced deploy time by 80%. This transformed the development process from risky manual deployments to confident, frequent releases.",
        impact: "90% reduction in regression bugs",
        metrics: "80% reduction in deployment time",
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
        "Led teams of 3-5 developers at innovative ticketing platform for over 10 years, scaling the platform from concept to processing thousands of orders per minute. Optimed platform performance by 30-60%, implemented comprehensive testing suites, and orchestrated CI/CD systems. Built React Native mobile apps that increased revenue by 40%, modernized frontend interfaces with React, increasing user engagement by 30%. And integrated critical payment systems processing tens of millions in transactions.",
      logo: "/src/lib/images/company-logos/chipta-logo.png",

      highlights: [
        {
          title: "Team Leadership",
          icon: faUsers,
          description:
            "Optimized development team (3-5 devs) output with 25%, by leading agile methods and strict code review processes",
          // "Managed development teams of 3-5 developers using agile methodologies and strict code review processes",
        },

        {
          title: "Platform Scalability",
          icon: faChartLine,
          description:
            "Enabled processing thousands of orders per minute, by optimizing SQL queries & Python/Django processes with 30-60%",
          // "Optimized SQL queries & Python processes with 30-60%, enabling platform to process thousands of orders per minute",
          tags: [
            "fullstack-python",
            "fullstack-django",
            "fullstack-react",
            "fullstack-svelte",
          ],
        },

        {
          icon: faGlobe,
          description:
            "Increased user engagement by +30%, by modernizing frontend using React, responsive design & web components",
          // "Modernized frontend using React, responsive design & web components, increasing user engagement by +30%",
          tags: ["fullstack-react", "fullstack-svelte"],
        },

        {
          icon: faGlobe,
          description:
            "Supercharged scalability & boosted revenue +40%, by leading ticket scan app creation using React Native & WebSockets",
          // "Led ticket scan app creation using React Native & WebSockets, supercharging scalability and increasing revenue by +40%",
          tags: ["fullstack-react", "fullstack-svelte"],
        },

        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Decreased regression with 90%, by establishing TDD with quality testing suite using Django & Selenium (+80% coverage)",
          // "Established quality testing suite using Django and Selenium (+80% coverage) decreasing regression bugs by about 90%",
          tags: [
            "fullstack-python",
            "fullstack-django",
            "fullstack-react",
            "fullstack-svelte",
          ],
        },

        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Reduced deploy time -80% & enabled regular releases, by orchestrating CI/CD systems on Linode using Ansible & Python",
          // "Orchestrated CI/CD systems on Linode using Ansible & Python, reducing deploy time by -80%, enabling regular releases",
          tags: ["fullstack-python", "fullstack-react", "fullstack-svelte"],
        },

        {
          title: "System Reliability",
          icon: faShieldAlt,
          description:
            "Streamlined onboarding, by coordinating development environment setup of 4 Docker microservices in Docker Compose",
          // "Coordinated development environment setup of 4 Docker microservices in Docker Compose, streamlining onboarding",
          tags: ["fullstack-python", "fullstack-react", "fullstack-svelte"],
        },

        {
          title: "Technical Innovation",
          icon: faMicrochip,
          description:
            "Maintained backward compatibility with legacy PHP system & database, by customizing Django codebase",
          // "Customized Django codebase for maintaining backward compatibility with old PHP system & database",
          tags: ["fullstack-python", "fullstack-django"],
        },

        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Enabled clients to organize automatically managed online events with Zoom, by integrating Zoom with OAuth in Django",
          // "Integrated Zoom with OAuth, enabling clients to organize automatically managed online events with Zoom",
          tags: ["fullstack-python", "fullstack-django"],
        },

        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Allowed users to validate authenticity of 2nd hand tickets, by implementing TicketSwap REST APIs using DRF",
          // "Implemented TicketSwap REST APIs using DRF, allowing users to validate authenticity of 2nd hand tickets",
          tags: ["fullstack-django"],
        },

        {
          title: "Payment Integration",
          icon: faDollarSign,
          description:
            "Processed tens of millions in payment transactions, by building payment service integrations (Mollie, Pay.nl, Paypal)",
          // "Guided payment service integrations (Mollie, Pay.nl, Paypal), processing tens of millions in payment transactions",
          tags: [],
        },

        {
          title: "Market Expansion",
          icon: faGlobe,
          description:
            "Facilitated market expansion to eurozone, by implementing Django i18n features (language, country & timezone)",
          // "Improved internationalization features (language, country & timezone) enabling market expansion to Eurozone countries",
          tags: ["fullstack-django"],
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

      projects: [
        {
          name: "Migration to Django",
          startDate: "2014-09",
          endDate: "2015-03",
          summary:
            "Led migration from PHP to Django while maintaining backward compatibility and zero downtime.",
          description:
            "Migrated entire application from PHP codebase to Django while keeping existing database intact and ensuring backwards compatibility. Moved all core business logic to take advantage of Django's framework features.",
          outcome:
            "Complete platform migration with no downtime or data loss. Significantly improved development velocity and maintainability.",
        },

        {
          name: "Dashboard Modernization",
          startDate: "2015-04",
          endDate: "2015-09",
          summary:
            "Built modern dashboard with Django backend and React frontend, improving user experience and performance.",
          description:
            "Created modern dashboard combining Django backend with React frontend and REST API using Django REST Framework. Implemented Webpack bundling system and integrated legacy PHP components.",
          outcome:
            "40% faster page load times, improved user satisfaction, and foundation for mobile apps and partner integrations.",
        },

        {
          name: "Ticket Shop Modernization",
          startDate: "2015-02",
          endDate: "2016-12",
          summary:
            "Rebuilt ticket purchasing system as single-page app, reducing cart abandonment by 35%.",
          description:
            "Rebuilt entire ticket shop as single-page application using Lit and Web Components. Built REST API with Django REST Framework, enabled guest checkout, integrated multiple payment options, and created theming system.",
          outcome:
            "35% reduction in cart abandonment, 50% increase in mobile sales, improved customer satisfaction, and new revenue from theming features.",
        },

        {
          name: "Developer Documentation",
          startDate: "2015-10",
          endDate: "2016-02",
          summary:
            "Created comprehensive developer documentation reducing onboarding time from 3-4 weeks to 5-7 days.",
          description:
            "Built complete documentation system including onboarding guides, technical references, Docker setup instructions, and testing framework documentation with examples.",
          outcome:
            "Reduced new developer onboarding from 3-4 weeks to 5-7 days, improved code consistency, and better bug reporting.",
        },

        {
          name: "Internationalization & Localization",
          startDate: "2016-03",
          endDate: "2016-07",
          summary:
            "Built flexible translation system enabling expansion to 8 international markets.",
          description:
            "Customized Django's translation system to store translations in database using ORM models. Created admin interface for easy translation editing and developer tools for environment syncing.",
          outcome:
            "Launched in 8 international markets within 6 months, 40% increase in international customers.",
        },

        {
          name: "Deployment System",
          startDate: "2016-08",
          endDate: "2017-02",
          summary:
            "Built complete CI/CD pipeline reducing deployment time from 2+ hours to 15 minutes.",
          description:
            "Created automated CI/CD pipeline handling deployments to multiple environments, multi-server deployment, rollbacks, and monitoring with chat notifications. Included smart caching and complex scenario handling.",
          outcome:
            "Deployment time reduced from 2+ hours to 15 minutes, 90% reduction in deployment problems, enabled multiple daily deployments.",
        },

        {
          name: "Test Suite Implementation",
          startDate: "2017-03",
          endDate: "2017-06",
          summary:
            "Established comprehensive testing system increasing code coverage from 15% to 85%.",
          description:
            "Built complete testing system with unit test helpers, Selenium integration for critical workflows, and team training on testing best practices.",
          outcome:
            "Increased code coverage from 15% to 85%, 60% reduction in production bugs, improved development confidence and velocity.",
        },

        {
          name: "Visitor Management Tool",
          startDate: "2017-07",
          endDate: "2017-11",
          summary:
            "Built comprehensive attendee management interface saving organizers 5-8 hours per event.",
          description:
            "Created visitor management system with advanced search/filtering, detailed profiles, manual visitor addition, integrated ticket/payment management, automated emails, and flexible exports.",
          outcome:
            "Saved organizers 5-8 hours per event, 90% adoption rate, 25% increase in customer satisfaction, 70% reduction in support tickets.",
        },

        {
          name: "Mailing System Modernization",
          startDate: "2017-12",
          endDate: "2018-04",
          summary:
            "Modernized email system with HTML templates and personalization, increasing open rates by 45%.",
          description:
            "Built modern HTML email system with responsive templates, dynamic content insertion, inline images/attachments support, and efficient mass mailing with personalization.",
          outcome:
            "45% increase in email open rates, improved attendee engagement, better event attendance, reduced manual work for organizers.",
        },

        {
          name: "Website Integration Tool",
          startDate: "2018-05",
          endDate: "2018-08",
          summary:
            "Created embeddable ticket shop integration improving website conversion rates by 30%.",
          description:
            "Built configurable integration tool generating embed code with customization options, automatic resizing using postMessage API, and transparent background for seamless visual integration.",
          outcome:
            "30% improvement in website conversion rates, became key sales feature for 60% of enterprise customers, simplified setup from developer-required to 5-minute process.",
        },

        {
          name: "Ticket PDF Modernization",
          startDate: "2018-09",
          endDate: "2018-12",
          summary:
            "Modernized PDF generation with HTML templates and QR security, eliminating ticket fraud.",
          description:
            "Switched to HTML-to-PDF generation using WeasyPrint, added secure QR code generation with validation keys, and built multi-page PDF support for multiple ticket purchases.",
          outcome:
            "Design updates reduced from days to minutes, eliminated ticket fraud, faster event check-ins, improved customer satisfaction with professional tickets.",
        },

        {
          name: "Performance Optimization",
          startDate: "2019-01",
          endDate: "2019-05",
          summary:
            "Optimized ticket shop performance by up to 60%, reducing load times from 8 to 3 seconds.",
          description:
            "Used Django Silk profiling to identify bottlenecks, optimized database queries with select_related/prefetch_related, implemented strategic caching, and optimized Python code.",
          outcome:
            "Up to 60% performance improvement, load times reduced from 8 to 3 seconds, 25% reduction in cart abandonment, system handled 3x more concurrent users.",
        },

        {
          name: "Mobile Scan App",
          startDate: "2019-06",
          endDate: "2020-02",
          summary:
            "Built React Native scanning app reducing check-in times by 70% and saving organizers $50-200 per event.",
          description:
            "Developed cross-platform React Native app for ticket scanning and validation with barcode scanning, offline capability, REST API integration, and App Store/Google Play deployment.",
          outcome:
            "Eliminated expensive third-party solutions saving $50-200 per event, 70% reduction in check-in times, offline capability for poor venue connectivity, became key selling point for 40% of new customers.",
        },

        {
          name: "TicketSwap Integration",
          startDate: "2020-03",
          endDate: "2020-06",
          summary:
            "Integrated with TicketSwap to eliminate secondary market fraud and increase sales by 15%.",
          description:
            "Worked with TicketSwap's technical team to implement secure integration validating second-hand tickets sold through their platform, ensuring only legitimate tickets could be resold.",
          outcome:
            "Ticket fraud rates dropped to near zero, increased customer confidence, became competitive advantage, led to 15% increase in overall ticket sales.",
        },

        {
          name: "Zoom Integration",
          startDate: "2020-07",
          endDate: "2020-12",
          summary:
            "Built comprehensive Zoom integration enabling virtual events during COVID-19 pandemic.",
          description:
            "Implemented Zoom integration using OAuth for secure account connection, built meeting creation/participant management functionality, and created interface for multi-ticket assignments with separate access.",
          outcome:
            "Successfully pivoted platform for virtual events during pandemic, 80% of organizers adopted virtual events, prevented major revenue loss, reduced support tickets by 50%.",
        },

        {
          name: "Shared Frontend Library",
          startDate: "2021-01",
          endDate: "2021-05",
          summary:
            "Created shared JavaScript library reducing code duplication by 40% across all projects.",
          description:
            "Built shared JavaScript library containing common utilities, UI components, and business logic. Systematically refactored existing projects to use shared library instead of custom implementations.",
          outcome:
            "40% reduction in code duplication, 25% decrease in development time for new features, improved UI consistency and user experience scores.",
        },

        {
          name: "Feature Expansion",
          startDate: "2021-06",
          endDate: "2021-12",
          summary:
            "Enhanced multi-language support and custom attendee data collection, increasing international penetration by 60%.",
          description:
            "Built dashboard widget system for multi-language event management, implemented configurable custom questions, added age verification controls, and redesigned organizer signup process.",
          outcome:
            "60% increase in international market penetration, 75% adoption rate for custom questions feature, opened new market segments, 35% increase in organizer conversion rates.",
        },

        {
          name: "Public Events API",
          startDate: "2022-01",
          endDate: "2024-06",
          summary:
            "Built comprehensive REST API enabling partnerships and driving 30% increase in ticket sales.",
          description:
            "Designed REST API endpoints for structured event data access with privacy controls, implemented dashboard settings for public visibility control, and added categorization features for improved discovery.",
          outcome:
            "Enabled partnerships with 12+ event listing platforms, 30% increase in ticket sales through partner channels, improved event discoverability and audience matching.",
        },
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
        "Built comprehensive tender discovery platform from scratch as part time lead developer, designing complete platform using agile methodology in consultation with non-technical founders. Developed industry-first Elasticsearch-powered search engine filtering hundreds of thousands of tenders, engineered automated web crawling systems importing thousands of tenders daily, and implemented subscription-based revenue model with recurring payments and automated notification systems.",
      logo: "/src/lib/images/company-logos/tender-it-logo.png",

      highlights: [
        {
          title: "Product Development",
          icon: faWrench,
          description:
            "Delivered complete platform with Python, Django & React in part time setup in consultation with non-technical founders",
          // "Delivered complete platform in part time setup by directing agile methods in consultation with non-technical founders",
          // "Directed agile/scrum methodology while designing complete platform in consultation with non-technical founders",
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
            "Transformed thousands of tenders daily into structured data, by making web crawlers & importers with Django & Celery",
          // "Engineered automated web crawling system importing & transforming thousands of tenders daily into structured data",
        },

        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Enabled market entry via subscription system with monthly/yearly recurring payments, using React, Django & Celery",
          // "Built subscription-based authentication system with monthly & yearly recurring payments supporting business model",
        },

        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Supported user retention by developing automatic notification mailing system for user preferences & saved searches",
          // "Created automatic notification mailing system for user configured tender preferences and saved searches",
          tags: [],
        },

        {
          title: "Revenue Model",
          icon: faDollarSign,
          description:
            "Provided professional platform aesthetics by enhancing frontend in coordination with frontend developer using Vue.js",
          // "Enhanced frontend in coordination with frontend developer using Vue.js, providing professional platform aesthetics",
          tags: [],
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
            "Shipped native iOS booking app in Objective-C scrum team (4) within 5 months, handling 15%+ of bookings in 3 months",
        },

        {
          title: "Mobile App Development",
          icon: faMobile,
          description:
            "Designed REST API using DRF, deployed on AWS, accommodating iOS & Android apps and mobile website",
        },

        {
          title: "Email Marketing Platform",
          icon: faEnvelope,
          description:
            "Supported acquisition by sending thousands of emails with marketing system using Python, Django, Celery & SendGrid",
          // "Built email marketing system using Python, Django & SendGrid, sending thousands of emails, supporting acquisition",
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
            "Delivered web projects for major clients (Bol.com) as part of company's best of 5 Scrum teams using custom PHP CMS",
          // "Delivered web projects for major clients (Bol.com, Gemeente Amsterdam) as part of company's best of 5 Scrum teams",
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
        "Django REST Framework (DRF)",
        // "FastAPI",
        "Flask",
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
        "Elasticsearch",
        "MongoDB",
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
      studyType: "Dutch MBO",
      startDate: "2004-08",
      endDate: "2007-06",
      graduationYear: "2007",
      score: 4,
      description:
        "Comprehensive technical education focusing on network infrastructure, server administration, and system management. Gained foundational knowledge in Linux systems, network protocols, and database management that formed the basis for my software development career.",
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
      description:
        "Practical internship experience developing web features for a festival information platform. Worked with PHP, MySQL, and frontend technologies while learning industry best practices for web development in a real-world environment.",
    },
  ],

  projects: [
    {
      name: "Django Admin Relation Links",
      startDate: "2017-03",
      endDate: "2020-12",
      summary:
        "Django Admin navigation enhancement, simplifying navigation between related database objects. Open-sourced on GitHub and PyPi. Effectively used at Chipta & Tender-it.",
      description:
        "Enhanced Django Admin Navigation with an open source Python package released on PyPi, gaining 108 stars on GitHub. Succesfully employed at projects at Chipta & Tender-it. Engaged with developers in GitHub Issues & Pull Requests.",
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
      name: "LitState",
      startDate: "2020-11",
      endDate: "2023-01",
      summary:
        "Reactive state management library for Lit Web Components, Open-sourced on GitHub & NPM. Used in production at Chipta (ticket shop). I used Lit + LitState as a simpler, lightweight and browser-native alternative to React + Redux.",
      description:
        "Simplified state management in Lit Web Components library, by releasing an open source Node.js package on NPM, gaining 143 stars on GitHub during time of Lit & Web Components popularity. Successfully implemented library for projects at Chipta. Engaged with developers in GitHub Issues & Pull Requests.",
      // "Open-source Node.js package providing reactive state management for Lit web components. With comprehensive documentation and extension support. A minimal yet powerful solution for efficient state synchronization across components.",
      highlights: [
        "Created Open-Source NPM package providing reactive state management for Lit Web Components library",
        "Received appreciation in community with 143 GitHub stars during time of Lit & Web Components popularity",
        "Engaged with users handling GitHub Issues and Pull Requests",
        "Employed library succesfully in projects at Chipta",
      ],
      url: "https://github.com/gitaarik/lit-state",
      stars: 143,
    },

    {
      name: "Git Submodules Guide",
      startDate: "2014-01",
      endDate: "2014-01",
      summary:
        "Popular GitHub Gist explaining Git submodules fundamentals. Helped many developers understand submodules effectively.",
      description:
        "Popular GitHub Gist explaining Git submodules fundamentals with over 1,000 stars. Covers practical usage, team workflows, and common scenarios for managing Git submodules. This beginner-friendly guide has helped many developers understand submodules effectively.",
      url: "https://gist.github.com/gitaarik/8735255",
      highlights: [],
      stars: 1022,
    },

    {
      name: "Jazzchords",
      startDate: "2013-06",
      endDate: "2017-12",
      summary:
        "Web application for creating and printing professional chord charts using Python/Django and modern frontend technologies.",
      description:
        "Tool for creating, sharing & printing professional-looking chord charts. Built with Python/Django backend and modern frontend technologies. Designed for musicians who need clean, readable chord progressions for performance and collaboration.",
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
      summary:
        "Open-source Django package for Adyen payment integration with recurring payment support. Used in production at Tender-it.",
      description:
        "Streamlined Adyen Payment integration in Django by releasing open source Python package on PyPi. Including recurring payment support & helpfull logging. Succesfully used in Tender-it project.",
      // "Open-source Django app that simplifies Adyen payment system integration. Supports regular, one-click, and recurring payments with comprehensive logging and error handling. Provides Django models and managers that mirror Adyen's API structure for seamless e-commerce development.",
      // "Adyen Payment Integration for Django, succesfully utilized in Tender-it project",
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

  interests: [
    {
      name: "Music",
      icon: faMusic,
    },
    {
      name: "Traveling",
      icon: faGlobe,
    },
    {
      name: "Nature",
      icon: faHeart,
    },
    {
      name: "Hiking",
      icon: faMountain,
    },
  ],

  idealCompany: {
    required: [
      {
        description: "Technically innovative, uses modern technologies",
        icon: faRocket,
      },

      {
        description: "A place where I can grow and develop",
        icon: faChartLine,
      },

      {
        description: "Remote work mindset",
        icon: faGlobe,
      },

      {
        description: "Flexible working hours",
        icon: faClock,
      },
    ],

    niceToHave: [
      {
        description: "Short-term engagement (6-12 months) or part-time",
        icon: faCalendarAlt,
      },

      {
        description: "Open & personal atmosphere",
        icon: faUsers,
      },

      {
        description: "Flat organizational structure, no micromanagement",
        icon: faHandshake,
      },

      {
        description: "Contributing to society or positive world impact",
        icon: faHeart,
      },
    ],
  },

  fiveYearVision: {
    title: "Where I See Myself in 5 Years",
    variations: {
      general: {
        title: "Technical Leadership",
        content:
          "In five years, I envision myself as a **Senior Technical Leader** or **Principal Engineer** who bridges the gap between technical excellence and strategic vision. I aim to be someone who not only architects and builds cutting-edge solutions but also mentors the next generation of developers and helps shape technology decisions that drive meaningful impact.\n\nI see myself working in a **hybrid role** that combines deep technical work with leadership responsibilities - perhaps as a **Tech Lead** on innovative projects, a **Senior Consultant** helping organizations modernize their technology stack, or even a **Co-founder** of a technology company focused on solving real-world problems.\n\nKey aspects of my future role:\n\n• **Technical Mastery**: Staying at the forefront of emerging technologies, particularly in AI/ML integration, cloud-native architectures, and sustainable software practices\n\n• **Mentorship & Knowledge Sharing**: Leading workshops, contributing to open-source projects, and helping junior developers grow their careers\n\n• **Strategic Impact**: Contributing to product strategy and technical roadmaps that align with business goals and user needs\n\n• **Global Collaboration**: Working with diverse, international teams on projects that have global reach and positive societal impact\n\n• **Continuous Learning**: Maintaining my passion for learning new technologies while deepening expertise in areas like system architecture, DevOps, and user experience design",
      },

      datascience: {
        title: "Data Science Specialist",
        content:
          "In five years, I see myself as a **Senior Data Scientist** or **Principal Data Engineer** who transforms complex data into actionable insights that drive business decisions. I aim to be at the intersection of data engineering, machine learning, and business strategy.\n\nI envision working as a **Data Science Lead** on high-impact projects, building end-to-end data pipelines, and developing predictive models that solve real-world problems. Perhaps leading a data science team at a tech company or working as a **Chief Data Officer** at a growing startup.\n\nKey focus areas:\n\n• **Advanced Analytics**: Mastering statistical modeling, predictive analytics, and causal inference techniques\n\n• **Big Data Architecture**: Designing scalable data pipelines using tools like Apache Spark, Kafka, and cloud-native data platforms\n\n• **Machine Learning Operations**: Implementing MLOps practices for model deployment, monitoring, and continuous improvement\n\n• **Business Impact**: Translating complex data insights into strategic recommendations that drive measurable business outcomes\n\n• **Data Governance**: Establishing data quality frameworks, privacy compliance, and ethical AI practices\n\n• **Cross-functional Leadership**: Collaborating with product, engineering, and business teams to identify data-driven opportunities",
      },

      aiml: {
        title: "AI/ML Specialist",
        content:
          "In five years, I envision myself as a **Senior AI/ML Engineer** or **Research Engineer** at the forefront of artificial intelligence innovation. I aim to be someone who not only implements cutting-edge AI solutions but also contributes to the advancement of the field through research and practical applications.\n\nI see myself working as an **AI/ML Lead** on transformative projects, perhaps at an AI-first company, a research lab, or leading the AI initiatives at a technology organization. I could also be a **Founding AI Engineer** at a startup focused on solving complex problems through artificial intelligence.\n\nKey specialization areas:\n\n• **Deep Learning Expertise**: Mastering neural network architectures, transformers, and emerging AI models for various domains\n\n• **MLOps & Production AI**: Building robust, scalable AI systems with proper monitoring, versioning, and deployment pipelines\n\n• **Research & Development**: Contributing to open-source AI projects and publishing research in machine learning conferences\n\n• **Domain Applications**: Specializing in specific AI applications like computer vision, NLP, or reinforcement learning\n\n• **Ethical AI**: Championing responsible AI development, bias mitigation, and AI safety practices\n\n• **Technical Leadership**: Mentoring AI engineers and establishing best practices for AI development within organizations",
      },

      backend: {
        title: "Backend Specialist",
        content:
          "In five years, I see myself as a **Principal Backend Engineer** or **Backend Architecture Lead** who designs and builds the foundational systems that power modern applications at scale. I aim to be the go-to expert for complex distributed systems and high-performance backend solutions.\n\nI envision working as a **Senior Backend Architect** at a high-growth company, designing systems that handle millions of users, or as a **Platform Engineering Lead** building developer tools and infrastructure that enable entire engineering organizations to move faster.\n\nKey expertise areas:\n\n• **Distributed Systems**: Mastering microservices architecture, event-driven systems, and distributed computing patterns\n\n• **Performance Engineering**: Optimizing system performance, handling high-throughput scenarios, and designing for scalability\n\n• **Cloud-Native Development**: Architecting solutions using containerization, serverless computing, and cloud platforms\n\n• **API Design**: Creating robust, well-documented APIs that serve as the backbone of modern applications\n\n• **Database Excellence**: Deep expertise in both SQL and NoSQL databases, data modeling, and query optimization\n\n• **DevOps Integration**: Building CI/CD pipelines, infrastructure as code, and monitoring systems for backend services\n\n• **Security Focus**: Implementing security best practices, authentication systems, and data protection measures",
      },

      frontend: {
        title: "Frontend Specialist",
        content:
          "In five years, I envision myself as a **Senior Frontend Architect** or **Principal UI Engineer** who creates exceptional user experiences through cutting-edge frontend technologies. I aim to be someone who bridges design and engineering, creating interfaces that are both beautiful and highly performant.\n\nI see myself working as a **Frontend Team Lead** at a product-focused company, building design systems and user interfaces that delight millions of users, or as a **UX Engineering Lead** who works closely with designers to bring innovative ideas to life.\n\nKey specialization areas:\n\n• **Modern Frameworks**: Deep expertise in React, Vue, Svelte, and emerging frontend frameworks and their ecosystems\n\n• **Performance Optimization**: Mastering web performance, core web vitals, and creating lightning-fast user experiences\n\n• **Design Systems**: Building and maintaining comprehensive design systems that scale across large organizations\n\n• **User Experience**: Collaborating closely with UX designers to create intuitive, accessible, and inclusive interfaces\n\n• **Advanced CSS**: Expertise in modern CSS, animations, responsive design, and emerging web standards\n\n• **Developer Experience**: Creating tools, components, and workflows that improve frontend developer productivity\n\n• **Cross-Platform Development**: Exploring technologies like React Native, Electron, or WebAssembly for multi-platform solutions",
      },

      hybrid: {
        title: "AI-Driven Technical Leader",
        content:
          "In five years, I see myself as a **Principal AI/Data Engineering Leader** who combines deep technical expertise in artificial intelligence and data science with strong leadership capabilities. I aim to be at the forefront of the AI revolution while building and leading teams that create transformative, data-driven solutions.\n\nI envision myself as a **Head of AI Engineering** or **VP of Data & AI** at a forward-thinking technology company, where I can bridge the gap between cutting-edge AI research and practical business applications. Alternatively, I could be a **Co-founder & CTO** of an AI-first startup that leverages data science and machine learning to solve complex real-world problems.\n\nMy evolving expertise spans multiple domains:\n\n• **AI/ML Leadership**: Leading cross-functional teams in developing production-ready AI systems, from research prototypes to scalable solutions serving millions of users\n\n• **Data-Driven Strategy**: Establishing organizational data strategies, ML governance frameworks, and AI ethics policies that guide company-wide decision making\n\n• **Technical Architecture**: Designing end-to-end AI/ML platforms that integrate data engineering, model development, deployment, and monitoring at enterprise scale\n\n• **Research & Innovation**: Staying current with AI research trends, contributing to open-source AI projects, and fostering a culture of experimentation and innovation\n\n• **Talent Development**: Mentoring the next generation of AI engineers and data scientists, establishing technical career paths, and building high-performing AI teams\n\n• **Business Integration**: Translating complex AI capabilities into business value, working closely with product and strategy teams to identify AI opportunities\n\n• **Industry Impact**: Speaking at AI conferences, contributing to the broader AI community, and helping shape the responsible development of artificial intelligence",
      },
    },
  },

  weaknesses: [
    {
      title: "Perfectionism",
      description:
        "I sometimes spend too much time refining code or features beyond what's necessary for the current requirements, which can impact delivery timelines.",
      mitigation:
        "I'm learning to better balance quality with pragmatic delivery by setting clear 'good enough' thresholds and time-boxing optimization work.",
    },
    {
      title: "Over-engineering",
      description:
        "I tend to anticipate future requirements and build more flexible solutions than immediately needed, sometimes adding unnecessary complexity.",
      mitigation:
        "I'm practicing YAGNI (You Aren't Gonna Need It) principles and focusing on solving current problems first, then iterating based on actual needs. I actively use agile/scrum methodologies and TDD to ensure I only create the features that are actually required.",
    },
    {
      title: "Impatience with inefficient processes",
      description:
        "I can become frustrated with slow or bureaucratic processes that seem to hinder productivity and technical progress.",
      mitigation:
        "I'm working on better understanding the business reasons behind processes and proposing constructive improvements rather than just expressing frustration.",
    },
    {
      title: "Difficulty delegating technical tasks",
      description:
        "I sometimes prefer to handle complex technical problems myself rather than delegating them, which can create bottlenecks.",
      mitigation:
        "I'm actively working on mentoring team members and breaking down complex tasks into smaller, delegatable pieces with clear guidance.",
    },
  ],

  currentChallenges: [
    {
      title: "Remote Work Market Competition",
      description:
        "Finding fully remote positions is increasingly competitive, with many companies preferring hybrid or on-site arrangements, especially for senior roles.",
      approach:
        "I'm expanding my search globally, leveraging my multilingual skills and time zone flexibility, while actively building my online presence and network within remote-first communities.",
    },
    {
      title: "Short-term & Part-time Opportunities",
      description:
        "Most companies seek full-time, long-term commitments, making it challenging to find quality short-term (6-12 months) or part-time positions that match my experience level.",
      approach:
        "I'm exploring consulting opportunities, contract work, and startups that need flexible senior talent. I'm also positioning myself for project-based work where my experience can deliver quick wins.",
    },
    {
      title: "Emerging Technology Adoption",
      description:
        "Many opportunities require deep expertise in cutting-edge technologies (advanced AI/ML frameworks, cloud-native architectures, modern DevOps tools) that I'm still learning.",
      approach:
        "I'm dedicating time to hands-on learning through personal projects, online courses, and contributing to open-source projects. I'm also transparent about my learning journey and eager to grow in these areas on the job.",
    },
    {
      title: "Market Positioning for Career Transition",
      description:
        "Transitioning from traditional full-stack development to more specialized roles (AI/ML, data science) while maintaining leadership aspirations creates positioning challenges.",
      approach:
        "I'm building a portfolio that bridges my extensive development background with emerging technologies, highlighting transferable skills and demonstrating practical applications through projects and contributions.",
    },
  ],

  whatExcitesMe: {
    excites: [
      {
        title: "Complex Engineering Problems",
        description:
          "I thrive on tackling intricate technical challenges that require deep thinking, creative problem-solving, and innovative approaches to find elegant solutions.",
        icon: faWrench,
      },
      {
        title: "Creating Innovative Products & Services",
        description:
          "Building something new from the ground up, especially products that solve real-world problems or create new possibilities for users, energizes me tremendously.",
        icon: faRocket,
      },
      {
        title: "Beautiful UI with Great UX",
        description:
          "Crafting user interfaces that are not only visually appealing but also intuitive and delightful to use. The intersection of design and functionality fascinates me.",
        icon: faGem,
      },
      {
        title: "Guiding & Teaching Developers",
        description:
          "Mentoring junior developers, sharing knowledge, and helping others grow in their careers. Seeing someone succeed because of guidance I provided is incredibly rewarding.",
        icon: faUsers,
      },
      {
        title: "Cutting-edge Technologies",
        description:
          "Exploring and mastering new technologies, especially in AI/ML, cloud computing, and modern development frameworks. The rapid pace of innovation keeps me motivated.",
        icon: faRobot,
      },
      {
        title: "Cross-functional Collaboration",
        description:
          "Working closely with designers, product managers, and stakeholders to bring ideas to life. The collaborative aspect of building great products excites me.",
        icon: faHandshake,
      },
    ],

    doesntExcite: [
      {
        title: "Repetitive Maintenance Work",
        description:
          "While I understand its importance, spending extended periods on routine bug fixes or maintaining legacy systems without improvement opportunities doesn't energize me.",
      },
      {
        title: "Purely Administrative Tasks",
        description:
          "Tasks that are mainly bureaucratic or administrative in nature, with little technical or creative problem-solving involved, tend to drain my enthusiasm.",
      },
      {
        title: "Working in Isolation",
        description:
          "Long periods of solo work without team interaction or collaboration opportunities. I thrive on bouncing ideas off others and collective problem-solving.",
      },
      {
        title: "Micromanagement Environments",
        description:
          "Overly rigid processes or micromanagement that stifles creativity and autonomous decision-making. I prefer environments that trust and empower developers.",
      },
      {
        title: "Technology for Technology's Sake",
        description:
          "Implementing new technologies without clear business value or user benefit. I prefer purposeful innovation that solves real problems.",
      },
    ],
  },

  selfReflection: {
    biggestPositive: {
      title: "Relentless Problem-Solving Drive",
      description:
        "My biggest strength has been an almost obsessive curiosity and determination to understand how things work and how to make them better. When I encounter a problem, I can't let it go until I've found an elegant solution. This drive has led me to dive deep into technologies, anticipate edge cases others miss, and consistently deliver robust solutions that stand the test of time.",
      impact:
        "This trait has been fundamental to my success in scaling complex systems, building reliable software, and earning trust from teams and clients. It's why I've been able to optimize platforms by 30-60%, reduce deployment times by 80%, and create solutions that handle thousands of concurrent users. My reputation for thorough, thoughtful engineering stems directly from this characteristic.",
    },

    biggestHindrance: {
      title: "Perfectionist Tendencies & Impatience with Inefficiency",
      description:
        "My perfectionism and low tolerance for inefficient processes have been my biggest career hindrance. I sometimes spend too much time perfecting solutions beyond business requirements, and I can become visibly frustrated with bureaucratic processes or team members who don't share my sense of urgency for technical excellence.",
      impact:
        "This has occasionally strained relationships with stakeholders who prioritize speed over quality, and has sometimes made me seem impatient or difficult to work with when processes move slower than I think they should. It's also led me to take on too much work myself rather than delegating, creating bottlenecks and potentially limiting team growth.",
    },

    growth: {
      description:
        "Recognizing these patterns has been crucial for my development. I'm actively working on balancing my drive for excellence with business pragmatism, and I'm learning to channel my impatience into constructive process improvements rather than frustration. The key insight has been understanding that my greatest strength and biggest weakness are two sides of the same coin - my passion for doing things right.",
    },
  },

  careerPriorities: [
    {
      priority: 1,
      title: "Transition into AI/ML Leadership Role",
      description:
        "My top priority is securing a senior position that combines my extensive full-stack development experience with emerging AI/ML technologies. I want to lead teams building production-ready AI systems that solve real-world problems.",
      actions:
        "Actively learning advanced ML frameworks, contributing to AI open-source projects, and seeking opportunities to demonstrate AI/ML capabilities in practical applications.",
      icon: faRobot,
    },
    {
      priority: 2,
      title: "Maintain Work-Life Balance & Location Freedom",
      description:
        "Preserving my ability to work remotely from Spain while maintaining flexible hours is crucial for my personal well-being and long-term career sustainability.",
      actions:
        "Focusing exclusively on remote-first companies and roles that offer genuine flexibility, rather than compromising on location or work arrangements.",
      icon: faHome,
    },
    {
      priority: 3,
      title: "Build Portfolio of Meaningful Projects",
      description:
        "Creating a collection of projects that demonstrate both technical excellence and positive societal impact, showing my ability to bridge traditional development with emerging technologies.",
      actions:
        "Developing AI-powered applications, contributing to open-source ML tools, and documenting my learning journey to establish thought leadership in the space.",
      icon: faRocket,
    },
    {
      priority: 4,
      title: "Expand Professional Network in AI/Data Science",
      description:
        "Building relationships within the AI/ML community to learn from experts, find mentorship opportunities, and discover collaborative projects or career opportunities.",
      actions:
        "Engaging with AI communities online, attending virtual conferences, and connecting with professionals who are successfully bridging development and data science.",
      icon: faUsers,
    },
    {
      priority: 5,
      title: "Achieve Financial Stability Through Contract Work",
      description:
        "Securing consistent income through high-value consulting or contract positions while pursuing longer-term career transition goals.",
      actions:
        "Leveraging my senior development skills for well-paying short-term projects that provide financial security during my career pivot period.",
      icon: faDollarSign,
    },
  ],

  interviewQuestions: [
    {
      category: "Leadership & Team Management",
      questions: [
        {
          question:
            "Tell me about a time when you had to lead a difficult project or manage a challenging team situation.",
          answer: {
            title: "React Native App with Struggling Developer",
            situation: [
              "Leading React Native app at Chipta",
              "Developer struggling with new/buggy technology",
              "Limited documentation available",
            ],
            task: [
              "Keep developer motivated",
              "Guide developer through challenges",
              "Deliver app and keep project on track",
            ],
            action: [
              "Mentored developer on technical issues",
              "Helped in debugging process",
              "Researched source code and created patches",
              "Made architecture decisions",
            ],
            result: [
              "Delivered on time",
              "Boosted the revenue by +40%",
              "Developer became our React Native expert",
              "Created adoption process for new tech",
            ],
          },
        },
        {
          question:
            "Describe a situation where you had to mentor or develop a junior team member.",
          answer: {
            situation:
              "A junior developer joined our team at Chipta who was struggling with Django best practices and was spending too much time on tasks that should have been straightforward.",
            task:
              "I needed to help them become productive quickly while building their confidence and ensuring code quality remained high.",
            action:
              "I established regular one-on-one mentoring sessions, created comprehensive onboarding documentation, and implemented a buddy system where they could work alongside me on complex features. I also introduced code review sessions where we'd walk through their code together, explaining not just what needed to change, but why certain approaches were better.",
            result:
              "Within 3 months, they became one of our most reliable developers and eventually took ownership of major features independently. The onboarding documentation I created reduced new developer onboarding time from 3-4 weeks to 5-7 days for future hires.",
          },
        },
      ],
    },
    {
      category: "Technical Problem Solving",
      questions: [
        {
          question:
            "Walk me through your approach to solving a complex technical problem.",
          answer: {
            situation:
              "At Chipta, we were experiencing mysterious intermittent payment failures that were affecting customer trust and revenue, but the failures seemed random and were difficult to reproduce.",
            task:
              "I needed to identify the root cause of these payment failures and implement a reliable solution without disrupting the live payment processing system.",
            action:
              "I started by implementing comprehensive logging around the entire payment flow, including integration points with external payment providers like Mollie and PayPal. I analyzed weeks of payment data to identify patterns, set up monitoring dashboards, and created a testing environment that could simulate the production payment flow. Through careful analysis, I discovered the issue was related to race conditions in our payment status updates during high-traffic periods.",
            result:
              "I implemented a queue-based payment processing system using Django Channels and Redis that eliminated the race conditions. Payment failures dropped by 95%, and we processed tens of millions in transactions reliably. The monitoring system I built also helped prevent future payment issues.",
          },
        },
        {
          question:
            "Tell me about a time you had to learn a new technology quickly to solve a problem.",
          answer: {
            situation:
              "During the COVID-19 pandemic, our clients at Chipta suddenly needed to pivot from physical events to virtual events, but we had no video conferencing integration in our platform.",
            task:
              "I needed to quickly learn Zoom's API and OAuth integration to build a comprehensive virtual event management system within a tight 6-month deadline.",
            action:
              "I dove deep into Zoom's API documentation, built several proof-of-concept integrations, and experimented with different OAuth flows. I created a testing environment with multiple Zoom accounts to understand the full user experience. I also researched similar integrations in other platforms to understand best practices and potential pitfalls.",
            result:
              "I successfully built a complete Zoom integration that allowed automatic meeting creation, participant management, and separate access controls for different ticket types. 80% of our organizers adopted virtual events during the pandemic, which prevented major revenue loss for the company and our clients.",
          },
        },
      ],
    },
    {
      category: "Project Management & Delivery",
      questions: [
        {
          question:
            "Describe a time when you had to deliver a project under tight deadlines.",
          answer: {
            situation:
              "At Chipta, we needed to migrate our entire ticketing platform from PHP to Django while maintaining 100% uptime during our busy event season, with a hard deadline of 6 months due to legacy system maintenance costs.",
            task:
              "I needed to plan and execute a complete platform migration without any service interruption, data loss, or functionality regression.",
            action:
              "I broke the migration into phases, starting with the most critical backend systems while maintaining API compatibility. I implemented a comprehensive testing strategy using Django and Selenium, created detailed migration scripts, and established a rollback plan for each phase. I coordinated closely with the team to ensure parallel development of new features while migration was ongoing.",
            result:
              "We completed the migration 2 weeks ahead of schedule with zero downtime and no data loss. The new Django platform was immediately more maintainable and performant, setting the foundation for all future development. Development velocity increased significantly after the migration.",
          },
        },
        {
          question:
            "Tell me about a project that didn't go as planned and how you handled it.",
          answer: {
            situation:
              "At Tender-it, I was building a comprehensive tender discovery platform as the sole technical lead, but midway through development, the requirements changed significantly when we discovered our initial search approach wasn't meeting user needs.",
            task:
              "I needed to rebuild the core search functionality using Elasticsearch while keeping the project on track and maintaining stakeholder confidence.",
            action:
              "I immediately scheduled a meeting with the founders to discuss the technical challenges and proposed solutions. I created a detailed plan for implementing Elasticsearch, including migration strategies for existing data and a timeline for the new features. I also implemented the new search system incrementally, allowing users to test and provide feedback throughout the development process.",
            result:
              "The Elasticsearch-powered search engine became our key differentiator, allowing users to filter and score hundreds of thousands of tenders effectively. This pivot actually improved our market position and became a major selling point that helped secure our subscription-based business model.",
          },
        },
      ],
    },
    {
      category: "Collaboration & Communication",
      questions: [
        {
          question:
            "Describe a time when you had to work with a difficult stakeholder or team member.",
          answer: {
            situation:
              "At SWIS, I was working with a client who had very specific design requirements that were technically challenging and kept changing their mind about key functionality, causing frustration within our development team.",
            task:
              "I needed to maintain a positive client relationship while protecting my team from scope creep and ensuring we could deliver quality work on schedule.",
            action:
              "I scheduled regular check-ins with the client to better understand their underlying business needs rather than just their stated requirements. I created visual mockups and prototypes to help them visualize the impact of their requests. I also established a clear change request process that included timeline and cost implications for any modifications.",
            result:
              "The project was completed successfully and on time, with the client very satisfied with both the final product and the process. They became a repeat client, and the structured approach I developed became standard practice for our agency, reducing similar issues on future projects.",
          },
        },
        {
          question:
            "Tell me about a time you had to explain complex technical concepts to non-technical stakeholders.",
          answer: {
            situation:
              "At Chipta, I needed to explain to the business owners why implementing a comprehensive testing suite was crucial for our platform's reliability, but they were concerned about the time investment and didn't understand the technical benefits.",
            task:
              "I needed to communicate the business value of technical testing practices in terms that resonated with their priorities and concerns.",
            action:
              "I prepared a presentation that focused on business impact rather than technical details. I showed them data about production bugs, the cost of downtime during peak events, and customer support tickets related to system issues. I also created simple analogies, comparing our testing suite to quality control in manufacturing, and demonstrated how testing would prevent the expensive emergency fixes we'd been doing.",
            result:
              "They approved the testing initiative, which increased our code coverage from 15% to 85% and reduced production bugs by 60%. This also led to better communication patterns where I regularly translated technical decisions into business terms, improving overall project planning and prioritization.",
          },
        },
      ],
    },
    {
      category: "Innovation & Improvement",
      questions: [
        {
          question:
            "Tell me about a time when you identified an opportunity for improvement and took initiative to implement it.",
          answer: {
            situation:
              "At Chipta, I noticed that our deployment process was taking 2+ hours and causing significant stress for the team, with frequent deployment failures that required manual rollbacks.",
            task:
              "I wanted to streamline our deployment process to enable more frequent, reliable releases without requiring explicit approval from management.",
            action:
              "I researched CI/CD best practices and built a complete automated deployment pipeline using Ansible and Python. I implemented automated testing, deployment to multiple environments, rollback capabilities, and Slack notifications. I also created detailed documentation and trained the team on the new process.",
            result:
              "Deployment time reduced from 2+ hours to 15 minutes, with a 90% reduction in deployment problems. This enabled multiple daily deployments and significantly improved our development velocity and team confidence. The system became a model for other projects in the company.",
          },
        },
        {
          question:
            "Describe a time when you had to challenge the status quo or propose a better way of doing something.",
          answer: {
            situation:
              "At Chipta, the team was manually managing customer email communications, which was time-intensive and inconsistent, leading to poor customer experience and high support ticket volume.",
            task:
              "I believed we could significantly improve customer engagement and reduce manual work by modernizing our email system, but needed to convince the team it was worth the development investment.",
            action:
              "I analyzed our current email metrics and support tickets to build a business case. I then built a prototype HTML email system with responsive templates, dynamic content insertion, and automated personalization. I demonstrated the prototype to stakeholders and showed how it could improve both customer experience and operational efficiency.",
            result:
              "The new email system increased email open rates by 45% and improved attendee engagement significantly. It also saved organizers considerable time and reduced support tickets, becoming one of our most valued features. The success of this initiative led to more trust in my technical recommendations.",
          },
        },
      ],
    },
  ],

  flowState: {
    question:
      "When you get lost in your work in a good way, what are you working on? What are the activities you would like to do more of in your career?",

    lostInWork: [
      {
        title: "Architecting Complex System Solutions",
        description:
          "I completely lose track of time when designing how different components of a complex system will interact. Mapping out data flows, anticipating edge cases, and finding elegant ways to handle scalability challenges feels like solving a beautiful puzzle.",
        example:
          "Like when I was designing the ticket processing system at Chipta - hours would fly by as I optimized the queue management and payment flow integration.",
        icon: faWrench,
      },
      {
        title: "Debugging Intricate Technical Problems",
        description:
          "There's something deeply satisfying about tracing through complex codebases to find the root cause of mysterious bugs. The detective work, the hypothesis testing, the 'aha!' moment when everything clicks - it's pure flow state.",
        example:
          "Spending entire afternoons tracking down performance bottlenecks that turned into 60% optimization gains - completely absorbed in the process.",
        icon: faSearch,
      },
      {
        title: "Building Beautiful, Functional UI Components",
        description:
          "When I'm crafting user interfaces that are both visually appealing and technically sound, I enter a zone where design thinking and technical implementation merge seamlessly.",
        example:
          "Creating the responsive design system components that increased user engagement by 30% - lost in the details of animations, responsiveness, and user experience flow.",
        icon: faGem,
      },
      {
        title: "Learning & Implementing New Technologies",
        description:
          "Diving deep into documentation, experimenting with new frameworks, and building proof-of-concepts with emerging technologies. The learning curve and creative exploration are incredibly engaging.",
        example:
          "When I first explored React Native and WebSockets for the mobile ticket scanning app - completely absorbed in understanding the paradigms and possibilities.",
        icon: faRocket,
      },
    ],

    wantMoreOf: [
      {
        title: "AI/ML Model Development & Integration",
        description:
          "Building intelligent systems that learn and adapt. I want to spend more time developing machine learning models, implementing AI-powered features, and creating systems that get smarter over time.",
        why:
          "This represents the future of software development and aligns with my desire to work on cutting-edge, impactful technology.",
      },
      {
        title: "Technical Mentoring & Knowledge Transfer",
        description:
          "One-on-one mentoring sessions, conducting technical workshops, and helping junior developers level up their skills. The collaborative aspect of teaching while learning energizes me.",
        why:
          "It combines my technical expertise with my passion for helping others grow, and it keeps me sharp by forcing me to articulate complex concepts clearly.",
      },
      {
        title: "Cross-functional Product Strategy",
        description:
          "Working closely with product managers, designers, and stakeholders to shape product direction from a technical perspective. Being involved in 'what should we build' conversations, not just 'how should we build it'.",
        why:
          "I want to have more strategic impact and help ensure technical feasibility aligns with business goals and user needs.",
      },
      {
        title: "Open Source Contribution & Community Building",
        description:
          "Contributing to meaningful open-source projects, building developer tools that others can benefit from, and engaging with the broader tech community through writing and speaking.",
        why:
          "It allows me to give back to the community that has given me so much, while building my reputation and network in emerging technology areas.",
      },
      {
        title: "Experimental & Research-Oriented Projects",
        description:
          "Working on projects where the outcome isn't predetermined - exploring new possibilities, testing hypotheses, and pushing the boundaries of what's currently possible.",
        why:
          "This type of work feeds my curiosity and allows me to be at the forefront of technological innovation rather than just implementing established solutions.",
      },
    ],
  },
};
