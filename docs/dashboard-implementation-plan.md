# Dashboard Implementation Plan

## Overview

Create a user-facing dashboard for the Smart Job Seeker application that allows authenticated users to manage their professional profiles, track job applications, and access all platform features.

## Phased Approach

### Phase 1: Dashboard Foundation ✅ COMPLETED

- [x] Protected `/dashboard` route group with authentication
- [x] Dashboard layout with header (logo, profile switcher, user menu)
- [x] Profile selection logic (URL param + cookie persistence)
- [x] Dashboard home page with profile overview and quick stats
- [x] Profile creation page (basic: name + title)

### Phase 2: Profile Creation & Import ✅ COMPLETED

**Goal:** Allow users to import their resume/CV and have it parsed by AI to auto-populate their profile.

**Features:**
- Profile creation wizard with multiple steps
- CV/Resume file upload (PDF, DOCX, HTML)
- LLM-based resume parsing to extract:
  - Personal info (name, title, contact)
  - Work experiences with achievements
  - Education history
  - Skills and technologies
  - Side projects
  - Languages
- Profile review/edit page after import
- Manual profile creation fallback (skip import)

**Technical considerations:**
- File upload to Directus
- PDF/DOCX text extraction (pdf-parse, mammoth)
- LLM prompt for structured extraction
- Progressive form for manual entry

### Phase 3: Profile Management

**Goal:** Full CRUD for all profile-related data, mirroring Directus collections.

**Pages to create:**

```
/dashboard/profile/
├── edit/                    # Basic info, highlights
├── work-experience/         # List + add/edit employers
│   └── [id]/               # Edit specific experience
├── education/              # List + add/edit education
├── skills/                 # Skill categories and skills
├── side-projects/          # List + add/edit projects
├── languages/              # Language proficiency
├── references/             # Professional references
└── versions/               # Profile versions for different contexts
```

**Features per section:**
- List view with sorting/filtering
- Add/edit forms
- Delete with confirmation
- Reorder (drag-and-drop or sort field)
- Status management (draft/published/archived)

### Phase 4: Job Seeking Features

**Goal:** Job discovery, matching, and application tracking.

**Pages to create:**

```
/dashboard/jobs/
├── searches/               # Configure job searches
├── matches/                # View AI-matched jobs
├── saved/                  # Bookmarked jobs
└── [id]/                   # Job details

/dashboard/applications/
├── active/                 # Current applications
├── [id]/                   # Application details
│   ├── letters/           # Cover letters, follow-ups
│   ├── questions/         # Application questions
│   └── activity/          # Activity log
└── salary/                 # Salary expectations
```

**Features:**
- Job search configuration (platforms, keywords, filters)
- Job match scores with AI explanations
- Application status tracking (applied, interviewing, offer, rejected)
- AI-generated cover letters and question responses
- Salary expectation management

### Phase 5: Interview Prep & AI Features

**Goal:** Interview preparation tools and AI assistant.

**Pages to create:**

```
/dashboard/interview/
├── stories/                # Project stories for interviews
└── cheat-sheets/           # Custom cheat sheets

/dashboard/export/
├── versions/               # Resume/CV versions
├── tokens/                 # Share links with tracking
└── preview/                # Preview exports

/dashboard/ai/
└── chat/                   # AI assistant chat interface
```

**Features:**
- Project stories with STAR format guidance
- Cheat sheets for quick reference
- Resume/CV export in multiple formats (PDF, HTML, JSON)
- Shareable links with view tracking
- AI chat for generating content, answering questions

---

## Menu Structure

```
Dashboard
├── Overview (home)
├── Profile
│   ├── Basic Info
│   ├── Work Experience
│   ├── Education
│   ├── Skills
│   ├── Side Projects
│   ├── Languages
│   └── References
│   └── Highlights
├── Job Search
│   ├── Search Settings
│   ├── Job Matches
│   └── Saved Jobs
├── Applications
│   ├── Active Applications
│   ├── Letters & Forms
│   └── Salary Expectations
├── Interview Prep
│   ├── Project Stories
│   └── Cheat Sheets
├── Export & Share
│   ├── Resume/CV Versions
│   └── Share Links
└── AI Assistant
```

---

## Technical Stack

- **Frontend:** SvelteKit 2 + Svelte 5 (runes)
- **Styling:** Tailwind CSS with custom theme
- **Database:** PostgreSQL via Prisma ORM
- **CMS:** Directus (schema management, file storage)
- **Auth:** Better Auth (email/password)
- **AI:** LangChain with multiple providers (Groq, OpenAI, Gemini, etc.)
- **File Processing:** pdf-parse, mammoth (for DOCX)

---

## Data Model Reference

Key collections (from Directus/Prisma):

**Profile Core:**
- `profiles` - Main profile with user_id link
- `profile_versions` - Tagged versions for different contexts
- `profile_exports` - Generated export files
- `profile_tokens` - Shareable access tokens

**Resume/CV Data:**
- `highlights` - Career highlights
- `work_experiences` → `work_experience_achievements`, `work_experience_technologies`, `work_experience_projects`
- `education` - Education history
- `tech_skill_categories` → `tech_skills` → `tech_skill_types`
- `side_projects` → `side_project_achievements`, `side_project_technologies`
- `languages` - Language skills
- `references` - Professional references
- `os_contributions` - Open source contributions

**Job Seeking:**
- `job_searches` - Search configurations
- `job_platforms` → `platform_profiles`
- `jobs` - Job postings
- `job_matches` → `job_match_preferences`
- `job_resources` - Helpful links

**Applications:**
- `applications` → `application_activity_log`, `application_questions`, `application_letters`
- `salary_expectations`

**Interview Prep:**
- `project_stories`
- `cheat_sheets`

**AI:**
- `ai_prompts` - Prompt templates
- `ai_chat_templates` → `ai_chats` - Chat history

---

## Implementation Notes

1. **Profile ownership:** Profiles link to users via `user_id` field
2. **Multi-profile:** Users can have multiple profiles for different contexts
3. **Versioning:** Profile versions allow different resume variations
4. **AI Integration:** Existing webhook handlers for AI chat, letters, questions
5. **File uploads:** Via Directus files API
6. **Real-time:** Consider adding real-time updates for job matches
