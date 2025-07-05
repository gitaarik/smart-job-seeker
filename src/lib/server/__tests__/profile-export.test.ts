/**
 * Unit tests for profile export utility functions
 * Tests schema and data export logic with mocked database
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('$lib/db', () => ({
  db: {
    profiles: {
      findUnique: vi.fn(),
    },
    directus_collections: {
      findUnique: vi.fn(),
    },
    directus_fields: {
      findMany: vi.fn(),
    },
    collected_data: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock remove-markdown
vi.mock('remove-markdown', () => ({
  default: (text: string) => text.replace(/[#*_`\[\]]/g, ''),
}));

import { exportProfileSchema, exportProfileData, exportProfile } from '../profile-export';
import { db } from '$lib/db';

describe('exportProfileSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error for non-existent profile', async () => {
    const mockDb = db as any;
    mockDb.profiles.findUnique.mockResolvedValueOnce(null);

    const result = await exportProfileSchema(999);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

describe('exportProfileData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export data for valid profile', async () => {
    const mockDb = db as any;

    const mockProfileData = {
      name: 'John Doe',
      title: 'Senior Developer',
      location: 'Amsterdam',
      highlights: [{ text: 'Highlight 1' }],
      tech_skill_categories: [{ name: 'JavaScript' }],
      work_experiences: [],
      side_projects: [],
      education: [],
      languages: [],
      references: [],
      project_stories: [],
      application_questions: [],
      cheat_sheets: [],
      salary_expectations: [],
    };

    mockDb.profiles.findUnique.mockResolvedValueOnce({ id: 1 });
    mockDb.profiles.findUnique.mockResolvedValueOnce(mockProfileData);
    mockDb.collected_data.findFirst.mockResolvedValueOnce(null);
    mockDb.collected_data.create.mockResolvedValueOnce({ id: 1 });

    const result = await exportProfileData(1);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Profile data exported');
  });

  it('should return error for non-existent profile', async () => {
    const mockDb = db as any;
    mockDb.profiles.findUnique.mockResolvedValueOnce(null);

    const result = await exportProfileData(999);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

describe('exportProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return results with schemaResult and dataResult properties', async () => {
    const mockDb = db as any;

    // Setup for schema export - will fail (profile not found)
    mockDb.profiles.findUnique.mockResolvedValueOnce(null);

    // Setup for data export - will also fail
    mockDb.profiles.findUnique.mockResolvedValueOnce(null);

    const result = await exportProfile(1);

    // Verify structure of response
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('schemaResult');
    expect(result).toHaveProperty('dataResult');
    expect(result.schemaResult).toHaveProperty('success');
    expect(result.dataResult).toHaveProperty('success');
  });
});
