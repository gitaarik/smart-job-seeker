<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import EmploymentSection from "./EmploymentSection.svelte";
  import {
    faGlobe,
    faUsers,
    faArrowUp,
    faTachometerAlt,
    faShieldAlt,
    faDollarSign,
    faMicrochip,
    faCog,
    faSearch,
    faLaptopCode,
    faChartLine,
    faCrown,
    faPaintBrush,
    faMobile,
    faPlug,
    faProjectDiagram,
    faEnvelope,
    faHandshake,
    faBullseye,
    faFileCode,
    faShoppingCart,
    faDatabase,
    faRocket,
  } from "@fortawesome/free-solid-svg-icons";

  const employmentHistory = [
    {
      company: "Chipta",
      role: "Lead Developer",
      industry: "Ticketing Service",
      website: "https://www.chipta.com/",
      period: "September 2014 – June 2024",
      location: "Amsterdam, The Netherlands",
      logo: "/src/lib/images/company-logos/chipta-logo.png",
      description:
        "Joined this innovative ticketing startup as Lead Developer, scaling the platform from concept to processing thousands of tickets per minute during peak events. Successfully led technical development through 10 years of growth, making Chipta a competitive alternative for independent event organizers.",
      achievements: [
        {
          title: "Team Leadership",
          icon: faUsers,
          description:
            "Built and managed diverse development teams of 3-5 developers, using agile methodologies that optimized efficiency and delivery speed",
        },
        {
          title: "Platform Scalability",
          icon: faArrowUp,
          description:
            "Architected and optimized systems to handle extreme traffic spikes, enabling the platform to process thousands of ticket sales per minute without downtime",
        },
        {
          title: "Performance Optimization",
          icon: faTachometerAlt,
          description:
            "Delivered 40-60% speed improvements on high-traffic pages through strategic query optimization and caching implementation",
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
      impact:
        "Transformed a proof of concept into a robust, scalable ticketing platform serving thousands of events and processing high-volume traffic reliably.",
      technologies: [
        "Python",
        "Django",
        "Django REST Framework",
        "Django Channels",
        "Django Debug Toolbar",
        "Django Silk",
        "Jinja2",
        "Weasyprint",
        "MySQL",
        "Ansible",
        "Python Fabric",
        "Linode",
        "Nginx",
        "Redis",
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
      company: "Tender-it",
      role: "Lead Developer",
      industry: "Tender Discovery Platform",
      period: "March 2015 – June 2022",
      location: "Amsterdam, The Netherlands",
      logo: "/src/lib/images/company-logos/tender-it-logo.png",
      description:
        "Built a comprehensive tender discovery platform from scratch, enabling companies to efficiently find and track public procurement opportunities. Delivered a complete solution that automated manual tender search processes for businesses.",
      note:
        "This was a part-time engagement that I combined with my main focus on Chipta.",
      achievements: [
        {
          title: "Product Development",
          icon: faCog,
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
          icon: faChartLine,
          description:
            "Built subscription-based authentication and payment system that supports sustainable business model and user growth",
        },
        {
          title: "User Experience",
          icon: faCrown,
          description:
            'Delivered intuitive "saved searches" interface and email notification system that supported user engagement and retention',
        },
        {
          title: "Frontend Optimization",
          icon: faPaintBrush,
          description:
            "Successfully colaborated with frontend developer to optimize frontend experience using Vue.js",
        },
      ],
      impact:
        "Transformed a startup idea into a complete, extensible tender platform with a intuitive interface and solid administrative tools.",
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
      company: "TravelBird",
      role: "Senior Full Stack & iOS Developer",
      industry: "Online Travel Agent",
      website: "https://www.travelbird.com/",
      period: "March 2013 – August 2014",
      location: "Amsterdam, The Netherlands",
      logo: "/src/lib/images/company-logos/travelbird-logo.png",
      description:
        "Joined during rapid growth phase (50 to 250+ employees) and contributed to scaling mobile presence during the company's expansion across European markets.",
      achievements: [
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
          icon: faProjectDiagram,
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
      impact:
        "Successfully delivered mobile apps and mobile website as part of an agile team during a critical period when mobile app presence was becoming essential for travel industry competitiveness.",
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
        "Linode",
        "Nginx",
        "JavaScript",
        "gulp.js",
        "Sass",
      ],
    },
    {
      company: "SWIS",
      role: "Mid-level Web Developer",
      industry: "Web Development Agency",
      website: "https://www.swis.nl/",
      period: "August 2011 – February 2013",
      location: "Leiden, The Netherlands",
      logo: "/src/lib/images/company-logos/swis-logo.png",
      description:
        "Delivered web solutions for high-profile clients including major e-commerce and government organizations, working as part of a dedicated Scrum team in a fast-paced agency environment with diverse project requirements.",
      achievements: [
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
      impact:
        "Delivered high-quality web solutions that met diverse client needs while maintaining agency's reputation for quality and reliability.",
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
      company: "Gamepoint",
      role: "Junior / Mid-level Web Developer",
      industry: "Casual Gaming / Community",
      website: "https://www.gamepoint.biz/",
      period: "June 2007 – June 2011",
      location: "The Hague, The Netherlands",
      logo: "/src/lib/images/company-logos/gamepoint-logo.png",
      description:
        "Started career at established gaming community platform, progressing from junior to mid-level developer while contributing to platform stability and feature development.",
      achievements: [
        {
          title: "Payment Systems",
          icon: faShoppingCart,
          description:
            "Successfully implemented multiple payment integrations that supported platform monetization and user transactions",
        },
        {
          title: "International Expansion",
          icon: faGlobe,
          description:
            "Contributed to internationalization and localization efforts that enabled platform expansion in other countries",
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
      impact:
        "Supported stable operation and feature enhancement of established gaming community serving hundreds of thousands of active users.",
      technologies: [
        "PHP",
        "MySQL",
        "nginx",
        "HTML",
        "CSS",
        "JavaScript",
        "jQuery",
        "AJAX",
        "YUI Library",
      ],
    },
  ];
</script>

<ResumeSection title="Employment History" icon={faGlobe}>
  {#each employmentHistory as job, index (job.company)}
    <EmploymentSection
      company={job.company}
      role={job.role}
      industry={job.industry}
      website={job.website}
      period={job.period}
      location={job.location}
      logo={job.logo}
      description={job.description}
      note={job.note}
      achievements={job.achievements}
      impact={job.impact}
      technologies={job.technologies}
      isFirst={index === 0}
    />
    {#if index < employmentHistory.length - 1}
      <hr class="border-cloud my-12 print:hidden" />
      <div class="hidden print:block print:break-before-page"></div>
    {/if}
  {/each}
</ResumeSection>
