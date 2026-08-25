import { describe, expect, it } from 'vitest';
import {
	aiPromptSchemas,
	detectLoginPageSchema,
	extractJobDataSchema,
	extractJobHeaderSchema,
	extractQaPairsSchema,
	findNextPageButtonSchema,
	getSchemaForPrompt,
	reviewLetterSchema,
	reviseAnswerSchema,
	scoreJobMatchSchema,
	writeLetterSchema
} from '../ai-prompt-schemas';

describe('AI Prompt Schemas', () => {
	describe('Schema Registry', () => {
		it('should have all expected schemas in registry', () => {
			expect(aiPromptSchemas).toHaveProperty('extract_job_data');
			expect(aiPromptSchemas).toHaveProperty('extract_job_header');
			expect(aiPromptSchemas).toHaveProperty('score_job_match');
			expect(aiPromptSchemas).toHaveProperty('detect_login_page');
			expect(aiPromptSchemas).toHaveProperty('find_next_page_button');
		});

		it('should get schema by request name', () => {
			const schema = getSchemaForPrompt('extract_job_data');
			expect(schema).toBeDefined();
			expect(schema).toBe(extractJobDataSchema);
		});

		it('should return undefined for unknown request', () => {
			const schema = getSchemaForPrompt('unknown_request');
			expect(schema).toBeUndefined();
		});

		it('should return undefined for text-only prompts without structured output', () => {
			// advise_* prompts return plain markdown, not structured JSON
			expect(getSchemaForPrompt('advise_application_question')).toBeUndefined();
		});

		it('should map answer_application_question to the write-letter schema', () => {
			// Generation now returns { text, feedback } like cover letters.
			expect(getSchemaForPrompt('answer_application_question')).toBe(writeLetterSchema);
		});

		it('should return schema for write_cover_letter (structured output)', () => {
			expect(getSchemaForPrompt('write_cover_letter')).toBeDefined();
		});

		it('should map extract_qa_pairs to its schema', () => {
			expect(aiPromptSchemas).toHaveProperty('extract_qa_pairs');
			expect(getSchemaForPrompt('extract_qa_pairs')).toBe(extractQaPairsSchema);
		});

		it('should reuse the letter-review schema for review_application_question', () => {
			expect(getSchemaForPrompt('review_application_question')).toBe(reviewLetterSchema);
		});

		it('should map revise_application_question to its schema', () => {
			expect(aiPromptSchemas).toHaveProperty('revise_application_question');
			expect(getSchemaForPrompt('revise_application_question')).toBe(reviseAnswerSchema);
		});
	});

	describe('reviseAnswerSchema', () => {
		it('should validate a normal { revisedText } object', () => {
			const r = reviseAnswerSchema.parse({
				revisedText: 'A better answer.'
			}) as { revisedText: string };
			expect(r.revisedText).toBe('A better answer.');
		});

		it('should coerce a bare string into { revisedText }', () => {
			const r = reviseAnswerSchema.parse('Just the text') as {
				revisedText: string;
			};
			expect(r.revisedText).toBe('Just the text');
		});

		it('should coerce { text } and { answer } shapes (gpt-oss drift)', () => {
			expect(
				(
					reviseAnswerSchema.parse({ text: 'via text' }) as {
						revisedText: string;
					}
				).revisedText
			).toBe('via text');
			expect(
				(
					reviseAnswerSchema.parse({ answer: 'via answer' }) as {
						revisedText: string;
					}
				).revisedText
			).toBe('via answer');
		});

		it('should reject when no usable text is present', () => {
			expect(() => reviseAnswerSchema.parse({ foo: 'bar' })).toThrow();
		});
	});

	describe('extractJobDataSchema', () => {
		it('should validate complete job data', () => {
			const validData = {
				title: 'Software Engineer',
				job_description: 'Full description here',
				company_description: 'Company info',
				company: 'Tech Corp',
				job_poster: 'HR Manager',
				date_posted: '2026-01-08',
				location: 'Remote',
				remote: 'remote',
				experience_levels: ['senior'],
				job_type: 'full_time',
				salary_min: 80000,
				salary_max: 120000,
				salary_currency: 'EUR',
				salary_period: 'year',
				skills_required: ['JavaScript', 'React', 'Node.js'],
				skills_preferred: ['TypeScript', 'AWS'],
				responsibilities: ['Design systems', 'Lead team'],
				soft_skills: ['Communication', 'Leadership'],
				status: 'hiring'
			};
			expect(() => extractJobDataSchema.parse(validData)).not.toThrow();
		});

		it('should allow null values for optional fields', () => {
			const dataWithNulls = {
				title: 'Software Engineer',
				job_description: 'Full description',
				company_description: null,
				company: null,
				job_poster: null,
				date_posted: null,
				location: null,
				remote: null,
				experience_levels: null,
				job_type: null,
				salary_min: null,
				salary_max: null,
				salary_currency: null,
				salary_period: null,
				skills_required: null,
				skills_preferred: null,
				responsibilities: null,
				soft_skills: null,
				status: null
			};
			expect(() => extractJobDataSchema.parse(dataWithNulls)).not.toThrow();
		});

		it('should accept float salary values and round them', () => {
			const dataWithFloats = {
				title: 'Software Engineer',
				job_description: 'Description',
				salary_min: 80000.0,
				salary_max: 120000.5
			};
			const result = extractJobDataSchema.parse(dataWithFloats);
			expect(result.salary_min).toBe(80000);
			expect(result.salary_max).toBe(120001);
		});

		it("should coerce numeric strings and 'null' strings from LLM responses", () => {
			const llmData = {
				title: 'Software Engineer',
				job_description: 'Description',
				salary_min: '80000', // Numeric string — should coerce to 80000
				salary_max: 'null' // String "null" — should coerce to null
			};
			const result = extractJobDataSchema.parse(llmData);
			expect(result.salary_min).toBe(80000);
			expect(result.salary_max).toBeNull();
		});

		it('should reject non-numeric salary strings', () => {
			const invalidData = {
				title: 'Software Engineer',
				job_description: 'Description',
				salary_min: 'competitive', // Non-numeric string — should fail
				salary_max: 120000
			};
			expect(() => extractJobDataSchema.parse(invalidData)).toThrow();
		});

		// The prompt has always asked for source_url, but without a key here it
		// was missing from the structured-output schema sent to the provider, so
		// the model never emitted it. The manual-create flow uses it to fill in a
		// job URL the user didn't type.
		it('should carry source_url through', () => {
			const result = extractJobDataSchema.parse({
				title: 'Software Engineer',
				source_url: 'https://jobs.example.com/postings/42'
			});
			expect(result.source_url).toBe('https://jobs.example.com/postings/42');
		});

		it("should coerce a 'null' string source_url to null", () => {
			const result = extractJobDataSchema.parse({
				title: 'Software Engineer',
				source_url: 'null'
			});
			expect(result.source_url).toBeNull();
		});

		// The prompt used to restrict currency to EUR/USD/GBP, so the model
		// returned null for everything else — and because the salary fields are
		// extracted together, a DKK or SEK posting lost its whole salary.
		describe('salary_currency', () => {
			it.each(['DKK', 'SEK', 'NOK', 'CHF', 'PLN', 'INR', 'JPY'])('accepts %s', (code) => {
				const result = extractJobDataSchema.parse({ salary_currency: code });
				expect(result.salary_currency).toBe(code);
			});

			it('uppercases and trims', () => {
				const result = extractJobDataSchema.parse({
					salary_currency: ' dkk '
				});
				expect(result.salary_currency).toBe('DKK');
			});

			it.each(['€', 'kr', 'euros', 'EU', 'EURO', ''])(
				'nulls out %o rather than storing a bogus code',
				(raw) => {
					const result = extractJobDataSchema.parse({ salary_currency: raw });
					expect(result.salary_currency).toBeNull();
				}
			);
		});
	});

	describe('scoreJobMatchSchema', () => {
		it('should validate valid job match score', () => {
			const validData = {
				score: 85,
				summary: 'Strong match with minor gaps',
				skill_match_percentage: 80,
				strengths: [
					'Strong React experience',
					'Good TypeScript skills',
					'Relevant industry background'
				],
				gaps: ['Limited AWS experience', 'No Kubernetes knowledge'],
				recommendation: 'recommend'
			};
			expect(() => scoreJobMatchSchema.parse(validData)).not.toThrow();
		});

		it('should enforce score boundaries', () => {
			const invalidScore = {
				score: 150, // > 100
				summary: 'Summary',
				skill_match_percentage: 80,
				strengths: ['Strength 1'],
				gaps: ['Gap 1'],
				recommendation: 'recommend'
			};
			expect(() => scoreJobMatchSchema.parse(invalidScore)).toThrow();
		});

		// gpt-oss returns a fraction whenever the percentage arithmetic produces
		// one (5 of 8 skills -> 62.5). Rejecting that used to discard the entire
		// match rather than the decimal place.
		it('should accept fractional scores and percentages', () => {
			const fractional = {
				score: 74.5,
				summary: 'Summary',
				skill_match_percentage: 62.5,
				strengths: ['Strength 1'],
				gaps: ['Gap 1'],
				recommendation: 'recommend'
			};
			expect(() => scoreJobMatchSchema.parse(fractional)).not.toThrow();
		});

		it('should enforce valid recommendation enum', () => {
			const invalidRecommendation = {
				score: 85,
				summary: 'Summary',
				skill_match_percentage: 80,
				strengths: ['Strength 1'],
				gaps: ['Gap 1'],
				recommendation: 'maybe' // Invalid enum value
			};
			expect(() => scoreJobMatchSchema.parse(invalidRecommendation)).toThrow();
		});

		it('should enforce array size limits', () => {
			const tooManyStrengths = {
				score: 85,
				summary: 'Summary',
				skill_match_percentage: 80,
				strengths: Array(15).fill('Strength'), // > 10
				gaps: ['Gap 1'],
				recommendation: 'recommend'
			};
			expect(() => scoreJobMatchSchema.parse(tooManyStrengths)).toThrow();
		});
	});

	describe('detectLoginPageSchema', () => {
		it('should validate login detection response', () => {
			const validData = {
				isLoginPage: true,
				confidence: 0.95,
				indicators: ['Login form found', 'Password field present', 'Sign in button detected']
			};
			expect(() => detectLoginPageSchema.parse(validData)).not.toThrow();
		});

		it('should enforce confidence boundaries', () => {
			const invalidConfidence = {
				isLoginPage: true,
				confidence: 1.5, // > 1.0
				indicators: ['Login form']
			};
			expect(() => detectLoginPageSchema.parse(invalidConfidence)).toThrow();
		});
	});

	describe('extractQaPairsSchema', () => {
		it('should validate a normal question/answer pair', () => {
			const data = {
				pairs: [
					{
						question: 'Why do you want to work here?',
						answer: 'Because...',
						confidence: 'high'
					}
				]
			};
			expect(() => extractQaPairsSchema.parse(data)).not.toThrow();
		});

		it('should accept a questions-only pair (empty answer)', () => {
			// The questions-only paste path: each question comes back with an empty
			// answer for the user to fill in later.
			const data = {
				pairs: [
					{
						question: 'Describe a challenge you overcame.',
						answer: '',
						confidence: 'high'
					}
				]
			};
			expect(() => extractQaPairsSchema.parse(data)).not.toThrow();
		});

		it('should accept an answer-only pair (empty question) flagged low', () => {
			const data = {
				pairs: [
					{
						question: '',
						answer: 'An orphaned answer chunk.',
						confidence: 'low'
					}
				]
			};
			expect(() => extractQaPairsSchema.parse(data)).not.toThrow();
		});

		it('should accept an empty pairs array', () => {
			expect(() => extractQaPairsSchema.parse({ pairs: [] })).not.toThrow();
		});

		it('should coerce a bare top-level array into { pairs } (gpt-oss quirk)', () => {
			// The model sometimes returns [{...}] instead of { pairs: [{...}] }.
			const bareArray = [{ question: 'Q', answer: 'A', confidence: 'high' }];
			const result = extractQaPairsSchema.parse(bareArray) as {
				pairs: unknown[];
			};
			expect(result.pairs).toHaveLength(1);
		});

		it('should reject a missing confidence field', () => {
			const data = { pairs: [{ question: 'Q', answer: 'A' }] };
			expect(() => extractQaPairsSchema.parse(data)).toThrow();
		});

		it('should reject an invalid confidence enum value', () => {
			const data = {
				pairs: [{ question: 'Q', answer: 'A', confidence: 'medium' }]
			};
			expect(() => extractQaPairsSchema.parse(data)).toThrow();
		});

		it('should reject when pairs is not an array', () => {
			expect(() => extractQaPairsSchema.parse({ pairs: 'nope' })).toThrow();
		});
	});

	describe('findNextPageButtonSchema', () => {
		it('should validate next page button response', () => {
			const validData = {
				found: true,
				dataXxxId: 42,
				paginationType: 'next_prev'
			};
			expect(() => findNextPageButtonSchema.parse(validData)).not.toThrow();
		});

		it('should allow null dataXxxId when not found', () => {
			const notFoundData = {
				found: false,
				dataXxxId: null,
				paginationType: 'none'
			};
			expect(() => findNextPageButtonSchema.parse(notFoundData)).not.toThrow();
		});

		it('should enforce valid pagination type enum', () => {
			const invalidType = {
				found: true,
				dataXxxId: 1,
				paginationType: 'unknown' // Invalid enum
			};
			expect(() => findNextPageButtonSchema.parse(invalidType)).toThrow();
		});
	});
});

describe('extractJobHeaderSchema', () => {
	it('accepts grounded fields and nulls', () => {
		const parsed = extractJobHeaderSchema.parse({
			title: null,
			company: { value: 'Belastingdienst', quote: 'van de Belastingdienst' },
			job_poster: 'null',
			location: { value: null, quote: null }
		});
		expect(parsed).toMatchObject({
			title: null,
			company: { value: 'Belastingdienst', quote: 'van de Belastingdienst' },
			job_poster: null,
			location: { value: null, quote: null }
		});
	});

	// A bare string is a value without evidence; it must survive parsing in a
	// shape the grounding check can reject, not be dropped or coerced into proof.
	it('keeps a bare string as a value with no quote', () => {
		expect(extractJobHeaderSchema.parse({ company: 'Belastingdienst' })).toMatchObject({
			company: { value: 'Belastingdienst', quote: null }
		});
	});
});
