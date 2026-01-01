# Delete Platform Jobs - Setup & Usage

## Overview

This feature allows you to delete all jobs from a specific job platform using
either the platform ID or a unique key.

## Setup Steps

### 1. Add `key` field to job_platforms in Directus

1. Open Directus admin: http://localhost:8055
2. Go to **Settings → Data Model → job_platforms**
3. Click **"Create Field"**
4. Configure:
   - **Field Name**: `key`
   - **Type**: String
   - **Interface**: Input
   - **Schema**:
     - Max Length: `255`
     - Allow NULL: `Yes` (for existing records)
     - **Unique**: `Yes` ✓
     - **Index**: `Yes` ✓
   - **Field Options**:
     - Trim: `Yes`
     - Slug: `Yes` (optional)
   - **Validation** (optional): Pattern `^[a-z0-9-_]+$`
   - **Note**: "Unique key for identifying platform (e.g., 'linkedin',
     'mercor')"
5. Click **Save**

### 2. Update Prisma Schema

```bash
npm run docker:update-schema
```

This will pull the new field definition from Directus into the Prisma schema.

### 3. Add keys to existing platforms

Go to **Content → job_platforms** and add unique keys:

| Platform  | Suggested Key |
| --------- | ------------- |
| LinkedIn  | `linkedin`    |
| Mercor    | `mercor`      |
| Indeed    | `indeed`      |
| Glassdoor | `glassdoor`   |
| Turing    | `turing`      |

Keys should be:

- Lowercase
- URL-friendly (alphanumeric, hyphens, underscores only)
- Memorable and intuitive

## Usage

### Delete by Platform ID

```bash
npm run host:delete-platform-jobs -- --platform-id 1
```

### Delete by Platform Key

```bash
npm run host:delete-platform-jobs -- --platform-key mercor
```

### Skip Confirmation (for scripts)

```bash
npm run host:delete-platform-jobs -- --platform-key mercor --yes
```

### From Docker

```bash
npm run docker:delete-platform-jobs -- --platform-key linkedin
```

## Script Behavior

1. **Lookup**: Finds the platform by ID or key
2. **Display**: Shows platform info and job count
3. **Confirm**: Asks for confirmation (unless `--yes` flag is used)
4. **Delete**: Removes all jobs associated with that platform
5. **Report**: Shows how many jobs were deleted

## Examples

```bash
# Delete all Mercor jobs (with confirmation)
npm run host:delete-platform-jobs -- --platform-key mercor

# Delete by ID #3 (with confirmation)
npm run host:delete-platform-jobs -- --platform-id 3

# Delete without confirmation (dangerous!)
npm run host:delete-platform-jobs -- --platform-key indeed --yes

# Check help
npm run host:delete-platform-jobs -- --help
```

## Safety Features

- ✅ Requires either `--platform-id` or `--platform-key` (not both)
- ✅ Shows platform details before deletion
- ✅ Displays total job count
- ✅ Asks for confirmation (unless `--yes`)
- ✅ Validates platform exists
- ✅ Reports actual number of deleted records

## Notes

- The `key` field is **optional** - platforms can exist without a key
- Keys must be **unique** - no two platforms can share the same key
- Deletion is **permanent** - jobs cannot be recovered
- Use `--yes` flag carefully in automated scripts
