/**
 * Job Import Validation Schemas
 * Zod schemas for validating job import API requests
 */

import { z } from 'zod';
import { normalizeSalaryPeriod, type SalaryPeriod } from '$lib/salary/conversion';

/**
 * Salary period — accepts common aliases and normalizes to canonical values.
 * Canonical: "hour", "day", "week", "month", "year", "project"
 */
export const salaryPeriodSchema = z
	.string()
	.transform((val) => normalizeSalaryPeriod(val))
	.refine((val): val is SalaryPeriod => val !== null, {
		message:
			'Invalid salary period. Use: "hour", "day", "week", "month", "year", "hourly", "daily", "weekly", "monthly", "yearly", "fixed-price", or "project"'
	});
export { type SalaryPeriod };

/**
 * Remote work options
 */
export const remoteOptionSchema = z.enum(['remote', 'hybrid', 'onsite']);
export type RemoteOption = z.infer<typeof remoteOptionSchema>;

/**
 * Job type options
 */
export const jobTypeSchema = z.enum([
	'full-time',
	'part-time',
	'contract',
	'internship',
	'freelance',
	'temporary'
]);
export type JobType = z.infer<typeof jobTypeSchema>;

/**
 * Single job import request schema
 */
export const jobImportRequestSchema = z.object({
	// Required fields
	title: z
		.string()
		.min(1, 'Job title is required')
		.max(255, 'Job title must be 255 characters or less'),
	company: z
		.string()
		.min(1, 'Company name is required')
		.max(255, 'Company name must be 255 characters or less'),
	sourceUrl: z
		.string()
		.url('Source URL must be a valid URL')
		.max(500, 'Source URL must be 500 characters or less'),

	// Optional fields
	description: z
		.string()
		.max(100000, 'Description must be 100,000 characters or less')
		.optional()
		.nullable(),
	location: z.string().max(255, 'Location must be 255 characters or less').optional().nullable(),
	salary: z.string().max(255, 'Salary must be 255 characters or less').optional().nullable(),
	salaryMin: z.number().int().positive().optional().nullable(),
	salaryMax: z.number().int().positive().optional().nullable(),
	salaryCurrency: z
		.string()
		.max(10, 'Currency code must be 10 characters or less')
		.optional()
		.nullable(),
	salaryPeriod: salaryPeriodSchema.optional().nullable(),
	salaryDurationWeeks: z.number().positive().optional().nullable(),
	remote: remoteOptionSchema.optional().nullable(),
	jobType: jobTypeSchema.optional().nullable(),
	experienceLevel: z
		.string()
		.max(255, 'Experience level must be 255 characters or less')
		.optional()
		.nullable(),
	skills: z.array(z.string().max(100)).max(50).optional().nullable(),
	applicationUrl: z
		.string()
		.url('Application URL must be a valid URL')
		.max(500)
		.optional()
		.nullable(),
	postedAt: z
		.string()
		.datetime({ message: 'Posted date must be a valid ISO date string' })
		.optional()
		.nullable(),
	platformId: z.number().int().positive().optional().nullable(),
	searchId: z.number().int().positive().optional().nullable()
});

export type JobImportRequest = z.infer<typeof jobImportRequestSchema>;

/**
 * Batch job import request schema
 */
export const batchJobImportRequestSchema = z.object({
	jobs: z
		.array(jobImportRequestSchema)
		.min(1, 'At least one job is required')
		.max(100, 'Maximum 100 jobs per batch')
});

export type BatchJobImportRequest = z.infer<typeof batchJobImportRequestSchema>;

/**
 * Job import response action types
 */
export type JobImportAction = 'created' | 'updated' | 'skipped';

/**
 * Single job import response
 */
export interface JobImportResponse {
	success: boolean;
	jobId?: number;
	action: JobImportAction;
	message?: string;
	duplicateOf?: number;
}

/**
 * Batch job import response
 */
export interface BatchJobImportResponse {
	success: boolean;
	summary: {
		total: number;
		created: number;
		updated: number;
		skipped: number;
		failed: number;
	};
	results: JobImportResponse[];
}

/**
 * Validate a single job import request
 *
 * @param data - The data to validate
 * @returns Parsed and validated job import request
 * @throws ZodError if validation fails
 */
export function validateJobImport(data: unknown): JobImportRequest {
	return jobImportRequestSchema.parse(data);
}

/**
 * Validate a batch job import request
 *
 * @param data - The data to validate
 * @returns Parsed and validated batch import request
 * @throws ZodError if validation fails
 */
export function validateBatchJobImport(data: unknown): BatchJobImportRequest {
	return batchJobImportRequestSchema.parse(data);
}

/**
 * Safe validation that returns result instead of throwing
 *
 * @param data - The data to validate
 * @returns Validation result with success flag
 */
export function safeValidateJobImport(data: unknown): {
	success: boolean;
	data?: JobImportRequest;
	error?: z.ZodError;
} {
	const result = jobImportRequestSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}

/**
 * Safe batch validation that returns result instead of throwing
 *
 * @param data - The data to validate
 * @returns Validation result with success flag
 */
export function safeValidateBatchJobImport(data: unknown): {
	success: boolean;
	data?: BatchJobImportRequest;
	error?: z.ZodError;
} {
	const result = batchJobImportRequestSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}

/**
 * Format Zod errors for API response
 *
 * @param error - The Zod error
 * @returns Formatted error message
 */
export function formatValidationError(error: z.ZodError): string {
	return error.issues
		.map((e) => {
			const path = e.path.join('.');
			return path ? `${path}: ${e.message}` : e.message;
		})
		.join('; ');
}
