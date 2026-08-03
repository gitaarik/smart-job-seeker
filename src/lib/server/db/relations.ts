import { relations } from "drizzle-orm/relations";
import {
  accounts,
  ai_chat_templates,
  ai_chats,
  ai_prompts,
  api_keys,
  application_activity_log,
  application_letters,
  application_questions,
  application_records,
  application_status_log,
  applications,
  applications_files,
  billing_customers,
  certificates,
  cheat_sheets,
  collected_data,
  config,
  contacts,
  credential_shares,
  credit_balances,
  credit_purchases,
  credit_transactions,
  device_shares,
  education,
  feedback_replies,
  files,
  highlights,
  inbound_emails,
  job_importers,
  job_match_history,
  job_matches,
  job_platforms,
  job_resources,
  job_statuses,
  jobs,
  languages,
  letter_versions,
  match_config,
  os_contributions,
  platform_credentials,
  platform_profiles,
  profile_document_files,
  profile_document_projects,
  profile_exports,
  profile_version_extensions,
  profile_versions,
  profiles,
  project_stories,
  question_versions,
  references,
  salary_expectations,
  scraper_agent_iterations,
  scraper_agent_sessions,
  scraper_logs,
  search_task_run_items,
  search_task_runs,
  search_tasks,
  search_tasks_job_sites,
  sessions,
  side_project_achievements,
  side_project_technologies,
  side_projects,
  subscriptions,
  tech_skill_categories,
  tech_skill_types,
  tech_skills,
  usage_counters,
  user_feedback,
  user_feedback_files,
  user_feedback_subscribers,
  users,
  verification_email_addresses,
  work_experience_achievements,
  work_experience_project_technologies,
  work_experience_projects,
  work_experience_technologies,
  work_experiences,
} from "./schema";

export const ai_promptsRelations = relations(ai_prompts, ({ one }) => ({}));

export const application_activity_logRelations = relations(
  application_activity_log,
  ({ one }) => ({
    application: one(applications, {
      fields: [application_activity_log.application_id],
      references: [applications.id],
    }),
  }),
);

export const applicationsRelations = relations(
  applications,
  ({ one, many }) => ({
    application_activity_logs: many(application_activity_log),
    applications_files: many(applications_files),
    file: one(files, {
      fields: [applications.cv_file_sent_id],
      references: [files.id],
    }),
    job: one(jobs, {
      fields: [applications.job_id],
      references: [jobs.id],
    }),
    profile: one(profiles, {
      fields: [applications.profile_id],
      references: [profiles.id],
    }),
    application_letters: many(application_letters),
    application_questions: many(application_questions),
    application_status_logs: many(application_status_log),
    application_records: many(application_records),
  }),
);

export const applications_filesRelations = relations(
  applications_files,
  ({ one }) => ({
    application: one(applications, {
      fields: [applications_files.applications_id],
      references: [applications.id],
    }),
    file: one(files, {
      fields: [applications_files.file_id],
      references: [files.id],
    }),
  }),
);

export const filesRelations = relations(files, ({ one, many }) => ({
  applications_files: many(applications_files),
  educations: many(education),
  job_resources: many(job_resources),
  profile_exports: many(profile_exports),
  work_experiences: many(work_experiences),
  applications: many(applications),
  profiles: many(profiles),
  user_feedback_files: many(user_feedback_files),
  profile_document_projects: many(profile_document_projects),
}));

export const collected_dataRelations = relations(collected_data, ({ one }) => ({
  profile: one(profiles, {
    fields: [collected_data.profile_id],
    references: [profiles.id],
  }),
}));

export const profile_document_projectsRelations = relations(
  profile_document_projects,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [profile_document_projects.profile_id],
      references: [profiles.id],
    }),
    work_experience: one(work_experiences, {
      fields: [profile_document_projects.work_experience_id],
      references: [work_experiences.id],
    }),
    work_experience_project: one(work_experience_projects, {
      fields: [profile_document_projects.work_experience_project_id],
      references: [work_experience_projects.id],
    }),
    side_project: one(side_projects, {
      fields: [profile_document_projects.side_project_id],
      references: [side_projects.id],
    }),
    file: one(files, {
      fields: [profile_document_projects.file_id],
      references: [files.id],
    }),
    profile_document_files: many(profile_document_files),
  }),
);

export const profile_document_filesRelations = relations(
  profile_document_files,
  ({ one }) => ({
    project: one(profile_document_projects, {
      fields: [profile_document_files.project_id],
      references: [profile_document_projects.id],
    }),
  }),
);

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  collected_data: many(collected_data),
  configs: many(config),
  educations: many(education),
  highlights: many(highlights),
  match_configs: many(match_config),
  job_matches: many(job_matches),
  os_contributions: many(os_contributions),
  platform_profiles: many(platform_profiles),
  languages: many(languages),
  project_stories: many(project_stories),
  profile_exports: many(profile_exports),
  references: many(references),
  salary_expectations: many(salary_expectations),
  profile_versions: many(profile_versions, {
    relationName: "profile_versions_profile_id_profiles_id",
  }),
  side_projects: many(side_projects),
  tech_skill_categories: many(tech_skill_categories),
  cheat_sheets: many(cheat_sheets),
  profile_document_projects: many(profile_document_projects),
  work_experiences: many(work_experiences),
  applications: many(applications),
  api_keys: many(api_keys),
  search_tasks: many(search_tasks),
  ai_chats: many(ai_chats),
  job_statuses: many(job_statuses),
  file: one(files, {
    fields: [profiles.profile_picture_id],
    references: [files.id],
  }),
  profile_version_public_cv_version_id: one(profile_versions, {
    fields: [profiles.public_cv_version_id],
    references: [profile_versions.id],
    relationName: "profiles_public_cv_version_id_profile_versions_id",
  }),
  profile_version_public_resume_version_id: one(profile_versions, {
    fields: [profiles.public_resume_version_id],
    references: [profile_versions.id],
    relationName: "profiles_public_resume_version_id_profile_versions_id",
  }),
  job_match_histories: many(job_match_history),
  job_importers: many(job_importers),
  verification_email_addresses: many(verification_email_addresses),
  certificates: many(certificates),
}));

export const configRelations = relations(config, ({ one }) => ({
  profile: one(profiles, {
    fields: [config.default_profile],
    references: [profiles.id],
  }),
}));

export const educationRelations = relations(education, ({ one }) => ({
  file: one(files, {
    fields: [education.logo_id],
    references: [files.id],
  }),
  profile: one(profiles, {
    fields: [education.profile_id],
    references: [profiles.id],
  }),
}));

export const highlightsRelations = relations(highlights, ({ one }) => ({
  profile: one(profiles, {
    fields: [highlights.profile_id],
    references: [profiles.id],
  }),
}));

export const match_configRelations = relations(match_config, ({ one }) => ({
  profile: one(profiles, {
    fields: [match_config.profile_id],
    references: [profiles.id],
  }),
}));

export const job_matchesRelations = relations(job_matches, ({ one }) => ({
  ai_chat: one(ai_chats, {
    fields: [job_matches.ai_chat_scoring],
    references: [ai_chats.id],
  }),
  job: one(jobs, {
    fields: [job_matches.job_id],
    references: [jobs.id],
  }),
  profile: one(profiles, {
    fields: [job_matches.profile_id],
    references: [profiles.id],
  }),
}));

export const ai_chatsRelations = relations(ai_chats, ({ one, many }) => ({
  job_matches: many(job_matches),
  jobs: many(jobs),
  ai_chat_template: one(ai_chat_templates, {
    fields: [ai_chats.ai_chat_template],
    references: [ai_chat_templates.id],
  }),
  ai_chat: one(ai_chats, {
    fields: [ai_chats.followup_to],
    references: [ai_chats.id],
    relationName: "ai_chats_followup_to_ai_chats_id",
  }),
  ai_chats: many(ai_chats, {
    relationName: "ai_chats_followup_to_ai_chats_id",
  }),
  profile: one(profiles, {
    fields: [ai_chats.profile_id],
    references: [profiles.id],
  }),
  application_letters: many(application_letters),
  application_questions: many(application_questions),
  letter_versions: many(letter_versions),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  job_matches: many(job_matches),
  job_resources: many(job_resources),
  search_task_run_items: many(search_task_run_items),
  ai_chat: one(ai_chats, {
    fields: [jobs.ai_chat_extraction],
    references: [ai_chats.id],
  }),
  job_platform: one(job_platforms, {
    fields: [jobs.job_platform_id],
    references: [job_platforms.id],
  }),
  applications: many(applications),
  job_statuses: many(job_statuses),
  job_match_histories: many(job_match_history),
  job_importers: many(job_importers),
}));

export const job_resourcesRelations = relations(job_resources, ({ one }) => ({
  file: one(files, {
    fields: [job_resources.file_id],
    references: [files.id],
  }),
  job: one(jobs, {
    fields: [job_resources.job_id],
    references: [jobs.id],
  }),
}));

export const search_task_runsRelations = relations(
  search_task_runs,
  ({ one, many }) => ({
    search_task: one(search_tasks, {
      fields: [search_task_runs.search_task_id],
      references: [search_tasks.id],
    }),
    search_task_run_items: many(search_task_run_items),
    scraper_logs: many(scraper_logs),
    scraper_agent_iterations: many(scraper_agent_iterations),
    inbound_emails: many(inbound_emails),
  }),
);

export const search_tasksRelations = relations(
  search_tasks,
  ({ one, many }) => ({
    search_task_runs: many(search_task_runs),
    profile: one(profiles, {
      fields: [search_tasks.profile_id],
      references: [profiles.id],
    }),
    job_platform: one(job_platforms, {
      fields: [search_tasks.platform_id],
      references: [job_platforms.id],
    }),
    platform_profile: one(platform_profiles, {
      fields: [search_tasks.platform_profile_id],
      references: [platform_profiles.id],
    }),
    api_key: one(api_keys, {
      fields: [search_tasks.sjsbrowser_api_key],
      references: [api_keys.id],
    }),
    search_tasks_job_sites: many(search_tasks_job_sites),
    scraper_agent_sessions: many(scraper_agent_sessions),
  }),
);

export const os_contributionsRelations = relations(
  os_contributions,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [os_contributions.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const platform_profilesRelations = relations(
  platform_profiles,
  ({ one, many }) => ({
    job_platform: one(job_platforms, {
      fields: [platform_profiles.platform_id],
      references: [job_platforms.id],
    }),
    profile: one(profiles, {
      fields: [platform_profiles.profile_id],
      references: [profiles.id],
    }),
    platform_credential: one(platform_credentials, {
      fields: [platform_profiles.platform_credential_id],
      references: [platform_credentials.id],
    }),
    search_tasks: many(search_tasks),
  }),
);

export const platform_credentialsRelations = relations(
  platform_credentials,
  ({ one, many }) => ({
    user: one(users, {
      fields: [platform_credentials.user_id],
      references: [users.id],
    }),
    job_platform: one(job_platforms, {
      fields: [platform_credentials.platform_id],
      references: [job_platforms.id],
    }),
    platform_profiles: many(platform_profiles),
    credential_shares: many(credential_shares),
  }),
);

export const credential_sharesRelations = relations(
  credential_shares,
  ({ one }) => ({
    user: one(users, {
      fields: [credential_shares.shared_with],
      references: [users.id],
    }),
    platform_credential: one(platform_credentials, {
      fields: [credential_shares.platform_credential_id],
      references: [platform_credentials.id],
    }),
  }),
);

export const job_platformsRelations = relations(job_platforms, ({ many }) => ({
  platform_profiles: many(platform_profiles),
  jobs: many(jobs),
  search_tasks: many(search_tasks),
}));

export const languagesRelations = relations(languages, ({ one }) => ({
  profile: one(profiles, {
    fields: [languages.profile_id],
    references: [profiles.id],
  }),
}));

export const search_task_run_itemsRelations = relations(
  search_task_run_items,
  ({ one }) => ({
    job: one(jobs, {
      fields: [search_task_run_items.job_id],
      references: [jobs.id],
    }),
    search_task_run: one(search_task_runs, {
      fields: [search_task_run_items.run_id],
      references: [search_task_runs.id],
    }),
  }),
);

export const project_storiesRelations = relations(
  project_stories,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [project_stories.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const profile_exportsRelations = relations(
  profile_exports,
  ({ one }) => ({
    file: one(files, {
      fields: [profile_exports.file_id],
      references: [files.id],
    }),
    profile: one(profiles, {
      fields: [profile_exports.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const referencesRelations = relations(references, ({ one }) => ({
  profile: one(profiles, {
    fields: [references.profile_id],
    references: [profiles.id],
  }),
}));

export const scraper_logsRelations = relations(scraper_logs, ({ one }) => ({
  search_task_run: one(search_task_runs, {
    fields: [scraper_logs.run_id],
    references: [search_task_runs.id],
  }),
}));

export const salary_expectationsRelations = relations(
  salary_expectations,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [salary_expectations.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const profile_versionsRelations = relations(
  profile_versions,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [profile_versions.profile_id],
      references: [profiles.id],
      relationName: "profile_versions_profile_id_profiles_id",
    }),
    profile_version_extensions_extended_id: many(profile_version_extensions, {
      relationName:
        "profile_version_extensions_extended_id_profile_versions_id",
    }),
    extension_links: many(profile_version_extensions, {
      relationName:
        "profile_version_extensions_extender_id_profile_versions_id",
    }),
    profiles_public_cv_version_id: many(profiles, {
      relationName: "profiles_public_cv_version_id_profile_versions_id",
    }),
    profiles_public_resume_version_id: many(profiles, {
      relationName: "profiles_public_resume_version_id_profile_versions_id",
    }),
  }),
);

export const side_project_technologiesRelations = relations(
  side_project_technologies,
  ({ one }) => ({
    side_project: one(side_projects, {
      fields: [side_project_technologies.side_project_id],
      references: [side_projects.id],
    }),
  }),
);

export const side_projectsRelations = relations(
  side_projects,
  ({ one, many }) => ({
    side_project_technologies: many(side_project_technologies),
    profile: one(profiles, {
      fields: [side_projects.profile_id],
      references: [profiles.id],
    }),
    side_project_achievements: many(side_project_achievements),
    profile_document_projects: many(profile_document_projects),
  }),
);

export const work_experience_achievementsRelations = relations(
  work_experience_achievements,
  ({ one }) => ({
    work_experience: one(work_experiences, {
      fields: [work_experience_achievements.work_experience_id],
      references: [work_experiences.id],
    }),
  }),
);

export const work_experiencesRelations = relations(
  work_experiences,
  ({ one, many }) => ({
    work_experience_achievements: many(work_experience_achievements),
    work_experience_projects: many(work_experience_projects),
    work_experience_technologies: many(work_experience_technologies),
    file: one(files, {
      fields: [work_experiences.logo_id],
      references: [files.id],
    }),
    profile: one(profiles, {
      fields: [work_experiences.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  billing_customers: many(billing_customers),
  subscriptions: many(subscriptions),
  credit_purchases: many(credit_purchases),
  usage_counters: many(usage_counters),
  credit_balances: many(credit_balances),
  credit_transactions: many(credit_transactions),
  contacts_recipient_id: many(contacts, {
    relationName: "contacts_recipient_id_users_id",
  }),
  contacts_requester_id: many(contacts, {
    relationName: "contacts_requester_id_users_id",
  }),
  device_shares: many(device_shares),
}));

export const work_experience_projectsRelations = relations(
  work_experience_projects,
  ({ one, many }) => ({
    work_experience: one(work_experiences, {
      fields: [work_experience_projects.work_experience_id],
      references: [work_experiences.id],
    }),
    work_experience_project_technologies: many(
      work_experience_project_technologies,
    ),
    profile_document_projects: many(profile_document_projects),
  }),
);

export const work_experience_technologiesRelations = relations(
  work_experience_technologies,
  ({ one }) => ({
    work_experience: one(work_experiences, {
      fields: [work_experience_technologies.work_experience_id],
      references: [work_experiences.id],
    }),
  }),
);

export const tech_skill_categoriesRelations = relations(
  tech_skill_categories,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [tech_skill_categories.profile_id],
      references: [profiles.id],
    }),
    tech_skills: many(tech_skills),
  }),
);

export const work_experience_project_technologiesRelations = relations(
  work_experience_project_technologies,
  ({ one }) => ({
    work_experience_project: one(work_experience_projects, {
      fields: [work_experience_project_technologies.work_experience_project_id],
      references: [work_experience_projects.id],
    }),
  }),
);

export const tech_skillsRelations = relations(tech_skills, ({ one }) => ({
  tech_skill_category: one(tech_skill_categories, {
    fields: [tech_skills.category_id],
    references: [tech_skill_categories.id],
  }),
  tech_skill_type: one(tech_skill_types, {
    fields: [tech_skills.tech_type_id],
    references: [tech_skill_types.id],
  }),
}));

export const tech_skill_typesRelations = relations(
  tech_skill_types,
  ({ many }) => ({
    tech_skills: many(tech_skills),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const cheat_sheetsRelations = relations(cheat_sheets, ({ one }) => ({
  profile: one(profiles, {
    fields: [cheat_sheets.profile_id],
    references: [profiles.id],
  }),
}));

export const profile_version_extensionsRelations = relations(
  profile_version_extensions,
  ({ one }) => ({
    extended: one(profile_versions, {
      fields: [profile_version_extensions.extended_id],
      references: [profile_versions.id],
      relationName:
        "profile_version_extensions_extended_id_profile_versions_id",
    }),
    profile_version_extender_id: one(profile_versions, {
      fields: [profile_version_extensions.extender_id],
      references: [profile_versions.id],
      relationName:
        "profile_version_extensions_extender_id_profile_versions_id",
    }),
  }),
);

export const side_project_achievementsRelations = relations(
  side_project_achievements,
  ({ one }) => ({
    side_project: one(side_projects, {
      fields: [side_project_achievements.side_project_id],
      references: [side_projects.id],
    }),
  }),
);

export const api_keysRelations = relations(api_keys, ({ one, many }) => ({
  user: one(users, {
    fields: [api_keys.user_id],
    references: [users.id],
  }),
  search_tasks: many(search_tasks),
  device_shares: many(device_shares),
}));

export const ai_chat_templatesRelations = relations(
  ai_chat_templates,
  ({ many }) => ({
    ai_chats: many(ai_chats),
  }),
);

export const search_tasks_job_sitesRelations = relations(
  search_tasks_job_sites,
  ({ one }) => ({
    search_task: one(search_tasks, {
      fields: [search_tasks_job_sites.search_tasks_id],
      references: [search_tasks.id],
    }),
  }),
);

export const scraper_agent_iterationsRelations = relations(
  scraper_agent_iterations,
  ({ one }) => ({
    scraper_agent_session: one(scraper_agent_sessions, {
      fields: [scraper_agent_iterations.session_id],
      references: [scraper_agent_sessions.id],
    }),
    search_task_run: one(search_task_runs, {
      fields: [scraper_agent_iterations.run_id],
      references: [search_task_runs.id],
    }),
  }),
);

export const scraper_agent_sessionsRelations = relations(
  scraper_agent_sessions,
  ({ one, many }) => ({
    scraper_agent_iterations: many(scraper_agent_iterations),
    search_task: one(search_tasks, {
      fields: [scraper_agent_sessions.search_task_id],
      references: [search_tasks.id],
    }),
  }),
);

export const job_statusesRelations = relations(job_statuses, ({ one }) => ({
  job: one(jobs, {
    fields: [job_statuses.job_id],
    references: [jobs.id],
  }),
  profile: one(profiles, {
    fields: [job_statuses.profile_id],
    references: [profiles.id],
  }),
}));

export const application_lettersRelations = relations(
  application_letters,
  ({ one, many }) => ({
    ai_chat: one(ai_chats, {
      fields: [application_letters.ai_chat_id],
      references: [ai_chats.id],
    }),
    application: one(applications, {
      fields: [application_letters.application_id],
      references: [applications.id],
    }),
    letter_versions: many(letter_versions),
  }),
);

export const application_questionsRelations = relations(
  application_questions,
  ({ one, many }) => ({
    ai_chat: one(ai_chats, {
      fields: [application_questions.ai_chat_id],
      references: [ai_chats.id],
    }),
    application: one(applications, {
      fields: [application_questions.application_id],
      references: [applications.id],
    }),
    question_versions: many(question_versions),
  }),
);

export const question_versionsRelations = relations(
  question_versions,
  ({ one }) => ({
    ai_chat: one(ai_chats, {
      fields: [question_versions.ai_chat],
      references: [ai_chats.id],
    }),
    application_question: one(application_questions, {
      fields: [question_versions.question],
      references: [application_questions.id],
    }),
  }),
);

export const application_status_logRelations = relations(
  application_status_log,
  ({ one, many }) => ({
    application: one(applications, {
      fields: [application_status_log.application],
      references: [applications.id],
    }),
    application_records: many(application_records),
  }),
);

export const application_recordsRelations = relations(
  application_records,
  ({ one }) => ({
    application: one(applications, {
      fields: [application_records.application_id],
      references: [applications.id],
    }),
    status_log_entry: one(application_status_log, {
      fields: [application_records.status_log],
      references: [application_status_log.id],
    }),
    file: one(files, {
      fields: [application_records.file_id],
      references: [files.id],
    }),
  }),
);

export const letter_versionsRelations = relations(
  letter_versions,
  ({ one }) => ({
    ai_chat: one(ai_chats, {
      fields: [letter_versions.ai_chat],
      references: [ai_chats.id],
    }),
    application_letter: one(application_letters, {
      fields: [letter_versions.letter],
      references: [application_letters.id],
    }),
  }),
);

export const job_match_historyRelations = relations(
  job_match_history,
  ({ one }) => ({
    job: one(jobs, {
      fields: [job_match_history.job_id],
      references: [jobs.id],
    }),
    profile: one(profiles, {
      fields: [job_match_history.profile_id],
      references: [profiles.id],
    }),
  }),
);

export const job_importersRelations = relations(job_importers, ({ one }) => ({
  job: one(jobs, {
    fields: [job_importers.job_id],
    references: [jobs.id],
  }),
  profile: one(profiles, {
    fields: [job_importers.profile_id],
    references: [profiles.id],
  }),
}));

export const user_feedback_filesRelations = relations(
  user_feedback_files,
  ({ one }) => ({
    user_feedback: one(user_feedback, {
      fields: [user_feedback_files.user_feedback_id],
      references: [user_feedback.id],
    }),
    file: one(files, {
      fields: [user_feedback_files.file_id],
      references: [files.id],
    }),
  }),
);

export const user_feedbackRelations = relations(
  user_feedback,
  ({ one, many }) => ({
    user_feedback_files: many(user_feedback_files),
    user_feedback: one(user_feedback, {
      fields: [user_feedback.merged_into_id],
      references: [user_feedback.id],
      relationName: "user_feedback_merged_into_id_user_feedback_id",
    }),
    user_feedbacks: many(user_feedback, {
      relationName: "user_feedback_merged_into_id_user_feedback_id",
    }),
    feedback_replies: many(feedback_replies),
    user_feedback_subscribers: many(user_feedback_subscribers),
  }),
);

export const billing_customersRelations = relations(
  billing_customers,
  ({ one }) => ({
    user: one(users, {
      fields: [billing_customers.user_id],
      references: [users.id],
    }),
  }),
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.user_id],
    references: [users.id],
  }),
}));

export const credit_purchasesRelations = relations(
  credit_purchases,
  ({ one }) => ({
    user: one(users, {
      fields: [credit_purchases.user_id],
      references: [users.id],
    }),
  }),
);

export const usage_countersRelations = relations(usage_counters, ({ one }) => ({
  user: one(users, {
    fields: [usage_counters.user_id],
    references: [users.id],
  }),
}));

export const verification_email_addressesRelations = relations(
  verification_email_addresses,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [verification_email_addresses.profile_id],
      references: [profiles.id],
    }),
    inbound_emails: many(inbound_emails),
  }),
);

export const credit_balancesRelations = relations(
  credit_balances,
  ({ one }) => ({
    user: one(users, {
      fields: [credit_balances.user_id],
      references: [users.id],
    }),
  }),
);

export const credit_transactionsRelations = relations(
  credit_transactions,
  ({ one }) => ({
    user: one(users, {
      fields: [credit_transactions.user_id],
      references: [users.id],
    }),
  }),
);

export const certificatesRelations = relations(certificates, ({ one }) => ({
  profile: one(profiles, {
    fields: [certificates.profile_id],
    references: [profiles.id],
  }),
}));

export const inbound_emailsRelations = relations(inbound_emails, ({ one }) => ({
  verification_email_address: one(verification_email_addresses, {
    fields: [inbound_emails.verification_address_id],
    references: [verification_email_addresses.id],
  }),
  search_task_run: one(search_task_runs, {
    fields: [inbound_emails.run_id],
    references: [search_task_runs.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  user_recipient_id: one(users, {
    fields: [contacts.recipient_id],
    references: [users.id],
    relationName: "contacts_recipient_id_users_id",
  }),
  user_requester_id: one(users, {
    fields: [contacts.requester_id],
    references: [users.id],
    relationName: "contacts_requester_id_users_id",
  }),
}));

export const device_sharesRelations = relations(device_shares, ({ one }) => ({
  user: one(users, {
    fields: [device_shares.shared_with],
    references: [users.id],
  }),
  api_key: one(api_keys, {
    fields: [device_shares.api_key_id],
    references: [api_keys.id],
  }),
}));

export const feedback_repliesRelations = relations(
  feedback_replies,
  ({ one }) => ({
    user_feedback: one(user_feedback, {
      fields: [feedback_replies.feedback_id],
      references: [user_feedback.id],
    }),
  }),
);

export const user_feedback_subscribersRelations = relations(
  user_feedback_subscribers,
  ({ one }) => ({
    user_feedback: one(user_feedback, {
      fields: [user_feedback_subscribers.feedback_id],
      references: [user_feedback.id],
    }),
  }),
);
