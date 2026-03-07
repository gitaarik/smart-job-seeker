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

### LLM Integration

The system uses LangChain with multiple LLM providers for flexible,
high-quality AI responses:

- **Groq** (default) - High-performance inference with Meta Llama models
- **Gemini** - Google's Generative AI
- **OpenAI** - GPT-4o and other OpenAI models
- **DeepSeek** - Cost-effective alternative
- **Cerebras** - High-speed inference

The provider can be configured per deployment. Responses are cached to reduce
latency and API costs.

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

At minimum, configure an API key for one LLM provider. The default provider is
Groq:

```bash
SJS_LLM_API_KEY_GROQ=your_groq_api_key_here
```

To use a different provider, set `SJS_LLM_PROVIDER` and the corresponding API
key:

```bash
SJS_LLM_PROVIDER=gemini
SJS_LLM_API_KEY_GEMINI=your_gemini_api_key_here
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

AI letter generation is available through the dashboard at `/dashboard/applications/letters/`
or via the API endpoints at `/api/ai/`.

### Cover Letters

**When to use:** First contact with a potential employer for most job
applications.

**What the AI considers:**

- Your relevant work experience and achievements
- The job requirements and responsibilities
- Company information (if provided)
- Your skills that match the position
- Your career progression and expertise

The AI will create a cover letter that:

- Opens with a strong introduction mentioning the specific role
- Highlights 2-3 relevant experiences from your profile
- Connects your skills to the job requirements
- Shows enthusiasm for the opportunity
- Closes with a call to action

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

### Thank You Letters

**When to use:** Within 24 hours after any interview (phone, video, or
in-person).

**Key elements AI includes:**

- Gratitude for the interviewer's time
- Reference to specific topics discussed
- Reinforcement of your qualifications
- Enthusiasm for the role
- Professional closing

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

### Follow-up Request Examples

**Tone Adjustments:**

- "Make this more enthusiastic and passionate"
- "Use more formal, professional language"
- "Make it sound more conversational"

**Length Changes:**

- "Reduce to 250 words maximum"
- "Expand with more detail about my experience"
- "Shorten the introduction paragraph"

**Content Emphasis:**

- "Add more emphasis on my Python and Django experience"
- "Highlight my leadership and mentoring skills"
- "Focus more on the scalability challenges I've solved"

### When to Include Original Context

The "include original context" option determines whether the AI can see your
full profile data and the job description again.

**Include original context when:**

- You want to add new information from your profile
- The job description details are relevant to the refinement
- Example: "Add my machine learning project from 2023"

**Don't include original context when:**

- Making simple edits (tone, length, structure)
- The change doesn't require additional profile information
- Example: "Make it shorter" or "More formal tone"

**Default: false** - Most refinements don't need the full context.

### Best Practices for Follow-ups

**Be Specific:**

- "Make the tone more formal and reduce to 250 words"

**Limit Iterations to 2-3:**

- Too many iterations can dilute quality
- If you need major changes after 3 iterations, consider regenerating

---

## AI Prompt Templates

Templates control how the AI generates content. Understanding templates helps
you use the system more effectively.

### What are AI Prompt Templates?

Templates are pre-written instructions stored in the `ai_chat_templates` table.
Each template has:

- **Request Type** - Unique identifier (e.g., `write_cover_letter`)
- **System Prompt** - Instructions for the AI about its role and approach
- **User Prompt** - The specific task with variable placeholders

### Available Templates

- `write_cover_letter` - Generate cover letters (most job applications)
- `write_motivation_letter` - Generate motivation letters (academic/research roles)
- `write_follow_up_email` - Generate follow-up emails (application check-ins)
- `write_thank_you_letter` - Generate thank you letters (post-interview)
- `answer_application_question` - Answer application questions (pre-screening)
- `followup` - Refine existing AI content (iterative improvements)

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

---

## Profile Context System

Understanding how your profile becomes AI context helps you optimize your
results.

### How Your Profile Becomes AI Context

When you trigger AI generation:

1. **Profile Data Loading** - The system loads your complete profile (work
   experiences, education, skills, languages, certifications, projects)
2. **Schema Information** - Field descriptions are included so the AI
   understands data structure
3. **Context Assembly** - Data is formatted for AI comprehension
4. **Job Context Addition** - Job details are added for application letters
5. **Template Combination** - The AI prompt template combines instructions,
   profile context, and job context

### Why Complete Profiles Generate Better Output

**Sparse Profile:** Generic, vague output with little substance.

**Detailed Profile (with specific metrics, technologies, team sizes):**
Specific, compelling content with concrete examples and relevant technologies.

**The difference:** Detail enables personalization and credibility.

---

## Best Practices

### Profile Preparation

- Keep your profile updated with latest skills and achievements
- Use specific numbers and metrics ("Reduced API response time by 40%")
- Include context for achievements (team size, timeline, impact)
- List all relevant technologies, frameworks, and methodologies

### AI Letter Generation

- Read the full job description carefully before generating
- Always review and personalize AI output
- Add your personal voice and unique anecdotes
- Verify all facts, dates, and claims

### Iterative Refinement

- Be specific in follow-up requests
- Start broad (length, tone), then refine incrementally
- Limit to 2-3 iterations for best results
- Save good versions before requesting major changes

### Interview Answers

- Generate answers early for preparation
- Customize tone for company culture
- Add personal anecdotes the AI can't know
- Practice delivery naturally, don't memorize word-for-word

---

## Troubleshooting

### AI Not Generating Content

**Common Causes:**

1. **Missing LLM API key** - Check that `SJS_LLM_API_KEY_*` is configured for
   your chosen provider
2. **Incomplete profile** - Ensure work experience, education, and skills are
   added
3. **Missing vacancy link** - Applications must be linked to a vacancy
4. **Empty job description** - AI needs job context to generate relevant content

### Generated Content Too Generic

1. Add more detail to your profile (specific metrics, project names, technologies)
2. Provide complete job descriptions
3. Use follow-ups to add specificity with original context enabled

### Wrong Tone or Style

Use follow-up refinement to adjust tone. Sometimes it takes 2 iterations:

1. "Make more formal"
2. "Keep formal but add warmth and enthusiasm"

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

For information about testing AI features, see [TESTING.md](TESTING.md).
