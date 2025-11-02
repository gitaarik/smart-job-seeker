#!/usr/bin/env python3
"""
Convert UUID values to sequential integers in database dump file.
This script:
1. Identifies all UUID patterns in the dump
2. Maps each unique UUID to a sequential integer
3. Replaces all UUID occurrences with their integer equivalents
"""

import re
import sys
from pathlib import Path

# UUID regex pattern
UUID_PATTERN = r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b'

# Tables where the primary key (id column) is UUID and should be converted to INT
# This is derived from the models that we changed to use INT @id
TABLES_WITH_UUID_PK = {
    'application_questions',
    'applications',
    'cheat_sheets',
    'dev_methodologies',
    'education',
    'highlights',
    'languages',
    'profile_versions',
    'profiles',
    'project_stories',
    'references',
    'side_projects',
    'soft_skills',
    'tech_skill_categories',
    'tech_skills',
    'work_experience_achievements',
    'work_experience_technologies',
    'work_experiences',
}

# Columns that are foreign keys to profiles (should be converted)
FK_TO_PROFILES = {
    'profile',
    'profile_id',
    'user',
}

# Other UUID columns that should be converted
UUID_COLUMNS_TO_CONVERT = {
    'created_by',
    'updated_by',
    'user_created',
    'user_updated',
    'user',
    'uploaded_by',
    'modified_by',
}

def extract_uuid_mappings(dump_path: str) -> dict:
    """Extract UUID to INT mappings from the dump file."""
    uuid_to_int = {}
    next_id = 1

    with open(dump_path, 'r') as f:
        content = f.read()

    # Find all UUIDs in the file
    uuids = re.findall(UUID_PATTERN, content, re.IGNORECASE)

    # Create mapping for each unique UUID
    for uuid in sorted(set(uuids)):
        if uuid not in uuid_to_int:
            uuid_to_int[uuid] = next_id
            next_id += 1

    return uuid_to_int

def convert_dump(input_path: str, output_path: str):
    """Convert UUIDs to integers in the dump file."""

    print("Extracting UUID mappings...")
    uuid_to_int = extract_uuid_mappings(input_path)

    print(f"Found {len(uuid_to_int)} unique UUIDs")
    print("Sample mappings:")
    for uuid, int_val in sorted(uuid_to_int.items())[:10]:
        print(f"  {uuid} -> {int_val}")

    print(f"\nReading dump file: {input_path}")
    with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    print("Converting UUIDs to integers...")
    # Replace each UUID with its integer value
    for uuid, int_val in uuid_to_int.items():
        content = content.replace(uuid, str(int_val))

    print(f"Writing converted dump to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Conversion complete!")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 convert-dump-uuids-to-int.py <input_dump.sql> [output_dump.sql]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.sql', '-converted.sql')

    if not Path(input_file).exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)

    convert_dump(input_file, output_file)
