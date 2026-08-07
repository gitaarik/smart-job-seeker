/**
 * Test data factories for creating mock objects in tests
 * Provides reusable factory functions for common test scenarios
 */

/**
 * Creates a mock profile with default values
 * Override any fields by passing them in the overrides parameter
 */
export function createMockProfile(overrides: Record<string, any> = {}): any {
	return {
		id: 1,
		sort: null,
		date_created: new Date('2024-01-01'),
		date_updated: null,
		name: 'John Doe',
		title: 'Senior Software Engineer',
		email_address: 'john.doe@example.com',
		phone_number: '+31612345678',
		location: 'Amsterdam, Netherlands',
		linkedin_profile: 'https://linkedin.com/in/johndoe',
		github_profile: 'https://github.com/johndoe',
		personal_website: 'https://johndoe.dev',
		summary: 'Experienced software engineer with 10+ years of experience',
		...overrides
	};
}

/**
 * Creates a mock AI chat record with default values
 */
export function createMockAiChat(overrides: Record<string, any> = {}): any {
	return {
		id: 1,
		date_created: new Date('2024-01-01'),
		date_updated: null,
		profile: 1,
		system_prompt: 'You are a helpful assistant',
		user_prompt: 'Hello',
		full_prompt: null,
		response: null,
		context: null,
		followup_to: null,
		...overrides
	};
}

/**
 * Creates a mock AI chat prompt with default values
 */
export function createMockAiChatPrompt(overrides: Record<string, any> = {}): any {
	return {
		id: 1,
		date_created: new Date('2024-01-01'),
		date_updated: null,
		request: 'Test Request',
		system_prompt: 'System prompt',
		user_prompt: 'User prompt',
		format: null,
		...overrides
	};
}

/**
 * Creates a mock profile with nested relations
 * Useful for testing complex queries with includes
 */
export function createMockProfileWithRelations(overrides: Partial<any> = {}): any {
	return {
		...createMockProfile(),
		highlights: [
			{
				id: 1,
				profile_id: 1,
				sort: 1,
				text: 'Led team of 5 developers'
			}
		],
		languages: [
			{
				id: 1,
				profile_id: 1,
				sort: 1,
				language: 'English',
				fluency: 'Native'
			}
		],
		tech_skill_categories: [
			{
				id: 1,
				profile_id: 1,
				sort: 1,
				name: 'Frontend',
				tech_skills: [
					{
						id: 1,
						tech_skill_category_id: 1,
						sort: 1,
						name: 'React',
						level: 'Expert'
					}
				]
			}
		],
		work_experiences: [],
		side_projects: [],
		education: [],
		references: [],
		project_stories: [],
		application_questions: [],
		cheat_sheets: [],
		salary_expectations: [],
		...overrides
	};
}

/**
 * Creates a mock collected_data record
 */
export function createMockCollectedData(overrides: Record<string, any> = {}): any {
	return {
		id: 1,
		date_updated: null,
		data: JSON.stringify({ type: 'object' }),
		profile: 1,
		schema: null,
		...overrides
	};
}

/**
 * Creates a mock webhook payload for testing webhook handlers
 */
export function createMockWebhookPayload(
	eventType: string,
	data: Record<string, unknown> = {}
): {
	event: string;
	data: Record<string, unknown>;
} {
	return {
		event: eventType,
		data: {
			id: 1,
			...data
		}
	};
}

/**
 * Creates a mock job vacancy for testing scraper
 */
export function createMockJobVacancy(overrides: Partial<any> = {}): any {
	return {
		id: 1,
		status: 'hiring',
		title: 'Senior Developer',
		company: 'Tech Corp',
		location: 'Amsterdam',
		url: 'https://example.com/job/123',
		description: '<p>We are looking for a senior developer...</p>',
		date_posted: new Date('2024-01-01'),
		...overrides
	};
}
