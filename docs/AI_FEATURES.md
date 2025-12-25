# AI Features Guide

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [AI Letter Generation](#ai-letter-generation)
   - [Cover Letters](#cover-letters)
   - [Motivation Letters](#motivation-letters)
   - [Follow-up Emails](#follow-up-emails)
   - [Thank You Letters](#thank-you-letters)
4. [AI Answer Assistant](#ai-answer-assistant)
5. [Iterative Refinement (Follow-ups)](#iterative-refinement-follow-ups)
6. [AI Prompt Templates](#ai-prompt-templates)
7. [Profile Context System](#profile-context-system)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Smart Job Seeker's AI features help you create personalized, professional
content for your job applications using state-of-the-art language models. The
system generates content tailored to YOUR specific profile and EACH individual
job opportunity.

### Available AI Features

- **Letter Generation** - Create cover letters, motivation letters, follow-up
  emails, and thank-you letters customized for each application
- **Question Answering** - Generate answers to application questions based on
  your actual work experience and skills
- **Iterative Refinement** - Refine and improve AI-generated content through
  conversational follow-ups
- **Template System** - Use optimized prompt templates for consistent,
  high-quality output

### How AI Helps Your Job Search

The AI system analyzes your complete professional profile (work experience,
education, skills, achievements) and combines it with specific job requirements
to create highly relevant, personalized content. Instead of starting with a
blank page, you get a tailored first draft that you can review and refine.

**Key Benefits:**

- **Save Time** - Generate first drafts in seconds instead of hours
- **Personalization** - Content references your specific experience and
  achievements
- **Consistency** - Maintain professional quality across all applications
- **Flexibility** - Easily adapt content for different roles and companies
- **Learning Tool** - See how to effectively present your experience

### Groq Integration

The system uses Groq's high-performance inference platform for fast,
high-quality AI responses. Groq provides:

- **Speed** - Near-instant response generation
- **Quality** - State-of-the-art language model (Meta Llama)
- **Reliability** - Consistent output quality
- **Cost-Effective** - Generous free tier for personal use

### Privacy and Data Usage

Your privacy is important:

- **Your Data Stays Local** - Profile data is stored in your own database
- **Temporary Processing** - AI only processes data needed for each request
- **No Training** - Your data is never used to train AI models
- **Full Control** - You decide what content to use or discard
- **Secure Communication** - All API calls use encrypted connections

---

## Getting Started

### Prerequisites

Before using AI features, ensure your profile is complete and detailed:

1. **Work Experience** - Add all relevant positions with:
   - Company names and roles
   - Key responsibilities and achievements
   - Technologies and methodologies used
   - Quantifiable results (metrics, percentages, team sizes)

2. **Education** - Include degrees, certifications, and relevant coursework

3. **Skills** - List technical skills, tools, and methodologies

4. **Projects** - Document significant projects with outcomes

**The more complete and detailed your profile, the better the AI output.**

### Environment Setup

Ensure the `SJS_GROQ_API_KEY` environment variable is configured. This key
enables AI response generation.

If you're a system administrator, add to your `.env` file:

```bash
SJS_GROQ_API_KEY=your_groq_api_key_here
```

Users of a deployed system don't need to worry about this - it's handled by the
administrator.

### How Profile Data is Used

When you generate AI content:

1. **Your profile data** is temporarily loaded (work experience, skills,
   education)
2. **Job context** is added (job description, company information)
3. **Template prompt** is filled with this information
4. **AI generates** personalized content based on the combined context
5. **Result is saved** to your database for review and editing

The AI can only use information in your profile, so keep it updated and
detailed!

### First-Time Usage Tips

**Start Small:**

- Begin with a single cover letter for a job you know well
- Review the output to understand AI capabilities
- Try the follow-up feature to see how refinement works

**Set Expectations:**

- AI creates a strong first draft, not perfect final output
- Always review and personalize the content
- Add your personal voice and specific anecdotes
- Verify all facts and claims

**Optimize Your Profile:**

- Use specific numbers and metrics in your experience
- Include context for achievements (team size, timeline, impact)
- List relevant technologies and methodologies
- Keep information current and accurate

---

## AI Letter Generation

Generate professional letters tailored to each job application. The system
supports four letter types, each optimized for specific scenarios.

### Cover Letters

**When to use:** First contact with a potential employer for most job
applications.

**What the AI considers:**

- Your relevant work experience and achievements
- The job requirements and responsibilities
- Company information (if provided)
- Your skills that match the position
- Your career progression and expertise

**How to generate:**

1. In Directus CMS, create an Application record linked to a Vacancy
2. Create an Application Letter record linked to the Application
3. Set Letter Type to "Cover Letter"
4. (Optional) Add notes about the company culture or specific requirements
5. Trigger the AI generation workflow

The AI will create a cover letter that:

- Opens with a strong introduction mentioning the specific role
- Highlights 2-3 relevant experiences from your profile
- Connects your skills to the job requirements
- Shows enthusiasm for the opportunity
- Closes with a call to action

**Example Output Structure:**

```
Dear [Hiring Manager],

I am writing to express my strong interest in the [Position] role at [Company].
With [X years] of experience in [relevant field] and a proven track record of
[key achievement], I am confident I would be a valuable addition to your team.

In my current role as [Your Role] at [Company], I [specific achievement with
metric]. This experience has given me deep expertise in [relevant skills],
which directly aligns with your requirements for [job requirement].

[Additional paragraph highlighting another relevant experience]

I am particularly drawn to [Company] because [reason based on research]. I am
excited about the opportunity to contribute to [specific aspect of role].

Thank you for considering my application. I look forward to discussing how my
experience can contribute to your team's success.

Best regards,
[Your Name]
```

**Customization tips:**

- Add specific company research to your application notes
- Include any mutual connections or referrals in the additional context
- For career changes, emphasize transferable skills
- For senior roles, focus on leadership and strategic impact

### Motivation Letters

**When to use:** Academic positions, research roles, or highly specialized
positions where explaining your motivation is crucial.

**What makes it different:** Motivation letters focus more on:

- Your passion for the field
- Long-term career goals
- Specific interest in the organization or research area
- How the opportunity fits your professional development
- Your potential contributions to the field

**How to generate:**

Same process as cover letters, but select "Motivation Letter" as the Letter
Type.

**Key elements AI includes:**

- Academic or research background
- Specific interest in the position/organization
- Alignment with career goals
- Relevant projects or publications
- Future contributions you envision

**Tips for academic roles:**

- Ensure your education section is comprehensive
- Add research projects or publications to your profile
- Include teaching experience if relevant
- Mention specific professors or research groups you'd work with

### Follow-up Emails

**When to use:**

- After submitting an application (1-2 weeks later)
- After an interview (24-48 hours later)
- When checking on application status

**Tone and length:** Follow-up emails should be:

- Brief (3-4 short paragraphs maximum)
- Professional but warm
- Respectful of the recipient's time
- Include a clear but gentle call to action

**How to generate:**

Select "Follow-up Email" as Letter Type. The AI creates a concise email that:

- References your previous interaction (application or interview)
- Reiterates your strong interest
- Adds one new relevant point
- Politely requests an update

**Example structure:**

```
Subject: Following up on [Position] Application

Dear [Name],

I hope this email finds you well. I wanted to follow up on my application for
the [Position] role that I submitted on [date].

I remain very interested in this opportunity and believe my experience in
[relevant area] would enable me to contribute meaningfully to your team.

If there are any additional materials I can provide or questions I can answer,
please don't hesitate to let me know.

Thank you for your time and consideration.

Best regards,
[Your Name]
```

**Timing recommendations:**

- After application: Wait 7-14 days
- After phone screen: Wait 5-7 days
- After on-site interview: Send thank you within 24 hours, status check after 5
  days

### Thank You Letters

**When to use:** Within 24 hours after any interview (phone, video, or
in-person).

**Key elements AI includes:**

- Gratitude for the interviewer's time
- Reference to specific topics discussed
- Reinforcement of your qualifications
- Enthusiasm for the role
- Professional closing

**How to generate:**

Select "Thank You Letter" as Letter Type. For best results, add notes about:

- Topics discussed in the interview
- Specific projects or challenges mentioned
- Names of people you met
- Any concerns you want to address

**Professional etiquette:**

- Send within 24 hours
- Send to each person who interviewed you
- Personalize each message based on your conversation
- Keep it concise (3-4 paragraphs)
- Proofread carefully

**Example structure:**

```
Subject: Thank you - [Position] Interview

Dear [Interviewer Name],

Thank you for taking the time to speak with me yesterday about the [Position]
role. I enjoyed learning more about [specific project or aspect discussed] and
how the team approaches [specific challenge].

Our conversation reinforced my enthusiasm for this opportunity. My experience
with [relevant skill/project] that we discussed would enable me to contribute
immediately to [specific need].

I appreciate your insights about [topic from interview], and I'm excited about
the possibility of joining your team.

Thank you again for your consideration. Please don't hesitate to reach out if
you need any additional information.

Best regards,
[Your Name]
```

---

## AI Answer Assistant

The Answer Assistant helps you respond to application questions using your
actual experience and achievements.

### Purpose and Use Cases

Use the Answer Assistant for:

- **Pre-screening questions** - "Why are you interested in this role?"
- **Application forms** - "Describe your relevant experience"
- **Technical questions** - "What's your experience with [technology]?"
- **Behavioral questions** - "Tell me about a time you led a team"
- **Cultural fit questions** - "How do you handle conflicts?"

### How It Works

The AI analyzes:

1. **Your complete profile** - All work experience, projects, and achievements
2. **The specific question** - Understanding what's being asked
3. **Job context** - The role requirements and responsibilities
4. **Your relevant experiences** - Matching your background to the question

### Step-by-Step Generation

1. In Directus CMS, create an Application Question record
2. Enter the question text exactly as it appears
3. Link it to your Application (which links to the Vacancy)
4. Trigger the AI answer generation

The AI will:

- Search your profile for relevant experiences
- Structure a clear, concise answer
- Include specific examples and metrics
- Reference actual projects or achievements
- Match the tone to the question type

### Example: Technical Question

**Question:** "Describe your experience with Python and Django in production
environments."

**AI-Generated Answer:**

```
I have over 5 years of experience building and maintaining production Django
applications. In my current role at TechCorp, I architected and led the
development of a microservices platform using Django REST Framework that
handles over 1 million API requests daily.

Key highlights include:
- Reduced API response times by 40% through database optimization and caching
- Implemented comprehensive test coverage (95%+) using pytest
- Managed deployment pipeline with Docker and Kubernetes
- Mentored 3 junior developers in Django best practices

Prior to this, at StartupCo, I built the initial MVP using Django, which scaled
to support 50,000+ users. I'm well-versed in Django ORM, migrations, security
best practices, and performance optimization.
```

The answer references actual achievements from your profile and quantifies
impact with specific metrics.

### Customization for Different Companies

After AI generation:

- **Startup vs. Enterprise** - Emphasize relevant experience (agility vs. scale)
- **Company Culture** - Adjust tone (formal vs. casual)
- **Specific Requirements** - Highlight the most relevant aspects
- **Personal Touch** - Add a brief anecdote or unique perspective

---

## Iterative Refinement (Follow-ups)

The follow-up feature lets you have a conversation with the AI to refine and
improve generated content.

### What is Iterative Refinement?

Instead of regenerating from scratch, you can ask the AI to modify specific
aspects of the content it already created. The AI remembers the previous output
and your profile context, making targeted improvements.

**Think of it as editing with an AI assistant:**

- "Make this more formal"
- "Add emphasis on my leadership skills"
- "Reduce the length to 250 words"
- "Include a specific example from my work at Company X"

### How to Create Follow-ups

#### For Letters (Cover Letter, Motivation Letter, etc.)

1. Review the AI-generated letter
2. Identify what you want to change
3. Create a follow-up request describing the changes
4. Choose whether to include original context (usually no need)
5. Review the refined version
6. Repeat if needed (but 2-3 iterations is optimal)

#### For Interview Answers

Same process - review, identify changes, create follow-up request.

#### For Any AI Chat

The generic AI chat follow-up works for any AI-generated content.

### Follow-up Request Examples

**Tone Adjustments:**

- "Make this more enthusiastic and passionate"
- "Use more formal, professional language"
- "Make it sound more conversational"
- "Add more confident, assertive phrasing"

**Length Changes:**

- "Reduce to 250 words maximum"
- "Expand with more detail about my experience"
- "Shorten the introduction paragraph"
- "Add another paragraph about my technical skills"

**Content Emphasis:**

- "Add more emphasis on my Python and Django experience"
- "Highlight my leadership and mentoring skills"
- "Focus more on the scalability challenges I've solved"
- "Include the project I did at StartupCo about [specific topic]"

**Structural Changes:**

- "Reorder to put technical skills first"
- "Combine the second and third paragraphs"
- "Add bullet points for my achievements"
- "Split into shorter paragraphs"

**Specific Corrections:**

- "Don't mention my current job search in the letter"
- "Remove references to salary expectations"
- "Correct the company name to [correct name]"
- "Update years of experience to [correct number]"

### When to Include Original Context

The "include original context" option determines whether the AI can see your
full profile data and the job description again.

**Include original context (true) when:**

- You want to add new information from your profile
- The job description details are relevant to the refinement
- You're asking for content that requires profile data
- Example: "Add my machine learning project from 2023"

**Don't include original context (false) when:**

- Making simple edits (tone, length, structure)
- The change doesn't require additional profile information
- You want faster, more focused refinements
- Example: "Make it shorter" or "More formal tone"

**Default: false** - Most refinements don't need the full context.

### Example Workflow

**Step 1: Generate initial cover letter**

AI creates a 400-word cover letter emphasizing your full-stack development
experience.

**Step 2: Review**

You notice it's too long and doesn't emphasize leadership enough.

**Step 3: First follow-up**

Request: "Reduce to 300 words and add more emphasis on my leadership and
mentoring experience"

AI creates a refined version highlighting your role leading teams.

**Step 4: Review again**

Better, but you want to mention a specific project.

**Step 5: Second follow-up**

Request: "Add a specific example about the microservices platform I built at
TechCorp that handles 1M+ requests daily"

Include original context: Yes (so AI can reference specific project details)

**Step 6: Final review**

Perfect! The letter is now personalized, appropriately detailed, and highlights
key achievements.

### Best Practices for Follow-ups

**Be Specific:**

- ❌ "Make it better"
- ✅ "Make the tone more formal and reduce to 250 words"

**One Topic Per Request:**

- ❌ "Make it shorter, more formal, add Python experience, and fix the
  introduction"
- ✅ "Reduce to 250 words" (first request)
- ✅ "Make the tone more formal" (second request)

**Limit Iterations:**

- 2-3 follow-ups usually achieve the best results
- Too many iterations can dilute the content
- If you need major changes, consider regenerating

**Save Good Versions:**

- If a follow-up makes things worse, go back to the previous version
- Copy content you like before requesting major changes

---

## AI Prompt Templates

Templates control how the AI generates content. Understanding templates helps
you use the system more effectively.

### What are AI Prompt Templates?

Templates are pre-written instructions stored in the `ai_chat_prompts` table.
Each template has:

- **Request Type** - Unique identifier (e.g., `write_cover_letter`)
- **System Prompt** - Instructions for the AI about its role and approach
- **User Prompt** - The specific task with variable placeholders

### Available Templates

| Request Type                  | Purpose                      | When to Use             |
| ----------------------------- | ---------------------------- | ----------------------- |
| `write_cover_letter`          | Generate cover letters       | Most job applications   |
| `write_motivation_letter`     | Generate motivation letters  | Academic/research roles |
| `write_follow_up_email`       | Generate follow-up emails    | Application check-ins   |
| `write_thank_you_letter`      | Generate thank you letters   | Post-interview          |
| `answer_application_question` | Answer application questions | Pre-screening questions |
| `followup`                    | Refine existing AI content   | Iterative improvements  |

### How Templates Work

**System Prompt (AI Instructions):**

```
You are a professional career advisor helping a job seeker create a compelling
cover letter. Use the candidate's actual experience and achievements from their
profile. Write in a professional but warm tone. Be specific and use metrics
where available.
```

**User Prompt (Task with Variables):**

```
Create a cover letter for the following position:

Job Title: ${vacancyDetails.position}
Company: ${vacancyDetails.company}
Job Description:
${jobDescription}

Candidate Profile:
${schema}
${data}
```

**Variable Replacement:**

When you trigger generation, variables are automatically replaced:

- `${schema}` → Your profile structure with field descriptions
- `${data}` → Your actual profile data (experience, skills, education)
- `${jobDescription}` → The full job description
- `${vacancyDetails.position}` → The job title
- `${vacancyDetails.company}` → Company name
- And more...

### Variable Interpolation

Variables use the `${variableName}` syntax and are replaced with actual data:

**Standard Variables (always available):**

- `${schema}` - Description of profile fields
- `${data}` - Complete profile data in structured format

**Context-Specific Variables:**

- `${jobDescription}` - Full job description (for application letters)
- `${vacancyDetails}` - Object with position, company, source, etc.
- `${question}` - The application question text
- `${previousResponse}` - Previous AI response (for follow-ups)
- `${followupRequest}` - Your refinement request (for follow-ups)
- `${originalSystemPrompt}` - Original instructions (for follow-ups)
- `${originalUserPrompt}` - Original task (for follow-ups)

### When Admins Customize Templates

System administrators can modify templates to:

- Adjust tone (more formal, more casual)
- Change structure (different letter format)
- Add instructions (always mention specific skills)
- Include company-specific guidelines

As a user, you benefit from these optimizations without needing to worry about
the technical details.

### Using Custom Templates

If you have admin access to Directus:

1. Go to the `ai_chat_prompts` collection
2. Find the template you want to customize
3. Edit the system_prompt or user_prompt
4. Test with a sample generation
5. Refine until you get consistent desired output

**Example Customization:**

To make cover letters more concise, add to the system prompt:

```
Keep the cover letter to 300 words maximum. Be concise and impactful.
```

---

## Profile Context System

Understanding how your profile becomes AI context helps you optimize your
results.

### How Your Profile Becomes AI Context

When you trigger AI generation:

**Step 1: Profile Data Loading**

The system loads your complete profile:

- Work experiences (all positions, responsibilities, achievements)
- Education (degrees, institutions, dates)
- Skills (technical skills, methodologies, tools)
- Languages and proficiency levels
- Certifications and achievements
- Projects and their outcomes

**Step 2: Schema Information**

The system includes field descriptions so the AI understands data structure:

```json
{
  "work_experiences": "Professional work history including companies, roles,
responsibilities, and achievements",
  "technical_skills": "Programming languages, frameworks, and technical
competencies",
  "methodologies": "Development methodologies and practices (Agile, Scrum,
etc.)"
}
```

**Step 3: Context Assembly**

Your data is formatted for AI comprehension:

```
=== WORK EXPERIENCE ===

Senior Full Stack Developer at TechCorp (2020-2024)
- Led team of 5 developers building microservices platform
- Technologies: Python, Django, React, PostgreSQL, Docker, Kubernetes
- Achievements:
  - Reduced API response time by 40% through optimization
  - Scaled system to handle 1M+ daily requests
  - Implemented CI/CD pipeline reducing deployment time by 60%

[Additional experiences...]

=== TECHNICAL SKILLS ===

Backend: Python (Expert), Django (Expert), Node.js (Advanced)
Frontend: React (Advanced), TypeScript (Advanced)
DevOps: Docker (Advanced), Kubernetes (Intermediate), AWS (Intermediate)

[Additional skills...]
```

**Step 4: Job Context Addition**

For application letters, the job details are added:

```
=== JOB OPPORTUNITY ===

Position: Senior Backend Developer
Company: InnovativeCorp
Description: [Full job description]
Requirements: [Key requirements]
```

**Step 5: Template Combination**

The AI prompt template combines:

- Instructions (how to write)
- Your profile context (what to write about)
- Job context (what to write for)

### What Data is Included

**Work Experience:**

- Company names and employment dates
- Job titles and roles
- Key responsibilities
- Technologies and tools used
- Quantifiable achievements
- Team size and leadership roles
- Project descriptions and outcomes

**Education:**

- Degrees and certifications
- Institutions and dates
- Relevant coursework
- Academic achievements
- Research or thesis topics

**Skills:**

- Technical skills with proficiency levels
- Programming languages and frameworks
- Tools and platforms
- Methodologies (Agile, DevOps, etc.)
- Soft skills (when documented)

**Languages:**

- Languages spoken
- Proficiency levels

**Certifications:**

- Professional certifications
- Issuing organizations
- Dates obtained

### Why Complete Profiles Generate Better Output

**Sparse Profile:**

```
Work Experience: Developer at Company (2020-2024)
Skills: Python, JavaScript
```

**AI Output:** Generic, vague letter with little substance.

**Detailed Profile:**

```
Work Experience:
Senior Full Stack Developer at TechCorp (2020-2024)
- Led development of microservices platform using Django and React
- Managed team of 5 developers across 3 time zones
- Reduced API latency from 500ms to 200ms through database optimization
- Implemented automated testing achieving 95% code coverage
- Technologies: Python, Django, React, PostgreSQL, Redis, Docker, AWS

Skills:
- Python (5 years, Expert level)
- Django (4 years, Expert level)
- React (3 years, Advanced level)
- PostgreSQL (4 years, Advanced level)
- Docker/Kubernetes (2 years, Intermediate level)
```

**AI Output:** Specific, compelling letter with concrete examples, metrics, and
relevant technologies.

**The difference:** Detail enables personalization and credibility.

### Profile Data vs. What AI Sees

**Your Profile Data (stored in database):**

- Permanent storage
- Structured format
- All historical information
- Personal notes and internal details

**What AI Sees (temporary context):**

- Formatted snapshot of relevant data
- Organized for readability
- Focused on professional information
- Only used for the current request
- Discarded after response generation

**Privacy Note:** The AI service (Groq) processes your data to generate
responses but doesn't store or train on your information. Your data remains in
your database permanently.

### Example: Context Transformation

**Profile Data:**

```json
{
  "position": "Senior Full Stack Developer",
  "company": "TechCorp",
  "start_date": "2020-01-15",
  "end_date": null,
  "responsibilities": "Lead development team, architect microservices platform",
  "achievements": "Reduced API response time by 40%",
  "technologies": "Python, Django, React, PostgreSQL, Docker"
}
```

**AI Context:**

```
=== CURRENT POSITION ===

Senior Full Stack Developer at TechCorp (January 2020 - Present)

Responsibilities:
- Lead development team
- Architect microservices platform

Key Achievement:
- Reduced API response time by 40%

Technologies:
Python, Django, React, PostgreSQL, Docker
```

The AI receives formatted, readable context that highlights relevant
professional information.

---

## Best Practices

Follow these practices to get the most value from AI features.

### Profile Preparation

**Keep Your Profile Updated:**

- Add new skills as you learn them
- Update achievements with latest metrics
- Include recent projects and their outcomes
- Maintain accurate employment dates

**Use Specific Examples:**

- ❌ "Improved application performance"
- ✅ "Reduced API response time from 500ms to 200ms (40% improvement)"

**Include Metrics:**

- Team sizes ("Led team of 5 developers")
- Scale ("System handling 1M+ daily requests")
- Percentages ("Increased test coverage to 95%")
- Time savings ("Reduced deployment time by 60%")
- User impact ("Platform serving 50,000+ users")

**Add Context to Achievements:**

- ❌ "Built microservices platform"
- ✅ "Built microservices platform using Django that handles 1M+ API requests
  daily, reducing response time by 40% and serving 50,000+ active users"

**List All Relevant Technologies:**

Include:

- Programming languages
- Frameworks and libraries
- Databases and data stores
- DevOps tools
- Cloud platforms
- Development methodologies

### AI Letter Generation

**Research Before Generating:**

- Read the full job description carefully
- Research the company (values, culture, recent news)
- Identify key requirements and must-have skills
- Note specific projects or initiatives mentioned

**Always Review and Personalize:**

- Read the generated letter completely
- Verify all facts and claims are accurate
- Add your personal voice and style
- Include specific anecdotes or examples
- Remove generic phrases

**Maintain Your Authentic Voice:**

The AI provides structure and content, but the final letter should sound like
YOU:

- Use your natural writing style
- Add personal touches
- Include your unique perspective
- Adjust formality to match your personality

**Check for Factual Accuracy:**

- Verify dates and company names
- Confirm technical details
- Check metrics and numbers
- Ensure claims are supportable

### Iterative Refinement

**Be Specific in Follow-up Requests:**

- ❌ "Make it better"
- ❌ "Improve this"
- ✅ "Change the tone to be more formal"
- ✅ "Add emphasis on my Python and Django experience"
- ✅ "Reduce the length to 250 words"

**Start Broad, Refine Incrementally:**

1. First follow-up: Major changes (length, tone, structure)
2. Second follow-up: Content adjustments (add emphasis, include examples)
3. Third follow-up: Fine-tuning (word choice, flow)

**Limit Iterations to 2-3:**

- Too many iterations can dilute quality
- Diminishing returns after 3 refinements
- If you need major changes after 3 iterations, consider regenerating

**Save Intermediate Versions:**

- Copy content you like before requesting changes
- You can always return to an earlier version
- Don't rely solely on the AI to track versions

### Interview Answers

**Generate Answers Early:**

- Create answers when you first see questions
- Use them for interview preparation
- Practice delivery (not just reading)

**Customize for Company Culture:**

- Formal corporate: Professional, structured answers
- Startups: Show agility, innovation, hustle
- Tech companies: Emphasize technical depth
- Creative agencies: Demonstrate creativity and vision

**Add Personal Anecdotes:**

AI provides structure, you add personality:

- Include the specific challenge you faced
- Describe your thought process
- Share what you learned
- Make it memorable with unique details

**Practice Delivery:**

- Don't memorize word-for-word
- Understand the key points
- Practice telling the story naturally
- Adjust based on interview flow

### General Tips

**AI is Your Starting Point:**

- Think of AI output as a strong first draft
- Always add your personal touch
- Use it to overcome blank page syndrome
- Let it handle structure, you add substance

**Combine AI Efficiency with Human Touch:**

- AI: Speed, structure, consistency
- You: Personality, authenticity, nuance
- Together: Professional, personalized, compelling content

**Track What Works:**

- Note which approaches lead to interviews
- Refine your profile based on success
- Learn from AI-generated patterns
- Build your personal best practices

**Learn from AI Suggestions:**

The AI shows you how to:

- Structure professional letters
- Present achievements effectively
- Connect skills to job requirements
- Use professional language and tone

Use these patterns in your own writing.

---

## Troubleshooting

### Common Issues and Solutions

#### AI Not Generating Content

**Symptoms:**

- Webhook reports failure
- No response appears in AI chat
- Empty content in letter or answer field

**Common Causes & Solutions:**

**1. Missing SJS_GROQ_API_KEY**

- Check environment variables
- Contact system administrator
- Verify .env file configuration

**2. Incomplete Profile**

- Ensure work experience is added
- Add education and skills
- Verify profile data is saved

**3. Missing Vacancy Link**

- For letters: Application must be linked to a Vacancy
- For questions: Application must be linked to a Vacancy
- Check relationship fields in Directus

**4. Empty Job Description**

- Add job description to Vacancy record
- AI needs context to generate relevant content

**Steps to Debug:**

1. Check Directus webhook logs
2. Verify all required fields are filled
3. Confirm relationships are properly set
4. Review AI chat record for error messages
5. Contact system administrator if issue persists

#### Generated Content Too Generic

**Symptoms:**

- Content lacks specific examples
- No mention of your actual experience
- Vague statements without details
- Missing relevant technologies or achievements

**Solutions:**

**1. Add More Detail to Your Profile**

- Include specific project names
- Add quantifiable metrics
- List all relevant technologies
- Describe actual responsibilities

**2. Provide Job Context**

- Fill in complete job description
- Add company information
- Include specific requirements

**3. Use Follow-ups to Add Specificity**

Request: "Add specific examples from my work at [Company] related to [skill]"

Include original context: Yes

**4. Review Profile Field Descriptions**

- Ensure descriptions are clear and detailed
- Use the "note" field for additional context
- Add examples in your experience descriptions

#### AI Ignoring Certain Aspects

**Symptoms:**

- Doesn't mention specific skills you wanted highlighted
- Ignores recent experience
- Focuses on wrong technologies

**Solutions:**

**1. Use Follow-up Refinement**

Request: "Add more emphasis on my [specific skill/experience]"

**2. Add Additional Context When Generating**

Use the additionalContext field when generating letters:

```
"Company is known for microservices architecture. Emphasize my experience
scaling distributed systems."
```

**3. Update Profile Weights**

- Put most important/recent experience first
- Use stronger language for key achievements
- Add metrics to highlight significance

**4. Specify in Follow-up Request**

Request: "Focus primarily on my Python and Django experience, particularly the
microservices platform I built"

#### Content Too Long/Short

**Symptoms:**

- Letter exceeds reasonable length (>500 words)
- Response too brief and lacks substance
- Doesn't fit application requirements

**Solutions:**

**1. Use Follow-up for Length Adjustment**

Request: "Reduce to 300 words maximum while keeping key achievements"

Request: "Expand the section about my technical skills with more detail"

**2. Be Specific About Target Length**

Request: "Reduce to exactly 250 words"

Request: "Expand to approximately 400 words"

**3. Structural Adjustments**

Request: "Keep the same content but split into shorter paragraphs for
readability"

Request: "Combine paragraphs 2 and 3 to make more concise"

#### Wrong Tone or Style

**Symptoms:**

- Too formal or too casual
- Doesn't match company culture
- Overly enthusiastic or too reserved

**Solutions:**

**1. Specify Tone in Follow-up**

Request: "Make the tone more professional and formal"

Request: "Make this sound more enthusiastic and passionate"

Request: "Use more conversational language"

**2. Provide Examples**

Request: "Use a similar tone to how I would write an email to a colleague"

**3. Cultural Adjustment**

Request: "Adjust for a startup culture - more casual and direct"

Request: "Make it appropriate for a large corporate environment - more formal
and structured"

**4. Iteration for Tone**

Sometimes it takes 2 refinements to get tone right:

- First: "Make more formal"
- Review
- Second: "Keep formal but add warmth and enthusiasm"

### Getting Help

If you continue to experience issues:

**1. Check Webhook Logs**

In Directus:

- Go to Flows
- Find the relevant flow (letter generation, question answering, etc.)
- Check recent executions for errors

**2. Review AI Chat Records**

- Check the ai_chat record linked to your letter/question
- Look for error messages in the response field
- Verify full_prompt was generated

**3. Verify Configuration**

- Confirm SJS_GROQ_API_KEY is set
- Check webhook endpoint is accessible
- Verify Directus permissions

**4. Contact System Administrator**

Provide:

- What you were trying to do
- Error messages from logs
- AI chat record ID
- Application or question ID

**5. Check Groq API Status**

If all else fails, the Groq API service might be experiencing issues:

- Visit Groq's status page
- Check for service interruptions
- Wait and retry if there's an outage

---

## Summary

Smart Job Seeker's AI features provide powerful tools to streamline your job
application process:

- **Generate** professional letters and answers based on your actual experience
- **Refine** content through conversational follow-ups
- **Customize** output for each specific opportunity
- **Save time** while maintaining quality and personalization

**Remember:**

- Keep your profile detailed and updated
- Always review and personalize AI output
- Use follow-ups to refine content
- Combine AI efficiency with your authentic voice

For technical details about webhook integration and system configuration, see
[WEBHOOK.md](WEBHOOK.md).

For information about testing AI features, see [TESTING.md](TESTING.md).
