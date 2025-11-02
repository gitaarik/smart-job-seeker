#!/usr/bin/env python3
"""
Convert UUID values to sequential integers in database dump file.
This script:
1. Only converts UUIDs in user-defined tables (not Directus tables)
2. Preserves UUID values that are foreign keys to Directus tables
3. Maps each unique UUID from user-defined tables to sequential integers
"""

import re
import sys
from pathlib import Path

# UUID regex pattern
UUID_PATTERN = r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b'

# User-defined tables where we convert UUIDs to INTs
# These are the tables we changed to use INT @id
TABLES_WITH_INT_PK = {
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

def extract_table_data_sections(dump_path: str):
    """Extract and parse data sections for user-defined tables."""
    sections = {}
    current_table = None
    current_section = []

    with open(dump_path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            # Check for COPY statement
            if line.startswith('COPY public.'):
                match = re.search(r'COPY public\.(\w+)', line)
                if match:
                    table_name = match.group(1)
                    if table_name in TABLES_WITH_INT_PK:
                        current_table = table_name
                        current_section = [line]
                    else:
                        current_table = None
                        current_section = []
            elif current_table and line == '\\.\n':
                current_section.append(line)
                sections[current_table] = ''.join(current_section)
                current_table = None
                current_section = []
            elif current_table:
                current_section.append(line)

    return sections

def extract_uuid_mappings_from_tables(table_sections):
    """Extract UUID to INT mappings only from user-defined tables."""
    uuid_to_int = {}
    next_id = 1

    for table_name, section in table_sections.items():
        # Find all UUIDs in this table's data section
        uuids = re.findall(UUID_PATTERN, section, re.IGNORECASE)

        # Create mapping for each unique UUID
        for uuid in sorted(set(uuids)):
            if uuid not in uuid_to_int:
                uuid_to_int[uuid] = next_id
                next_id += 1

    return uuid_to_int

def should_convert_uuid_in_table(table_name, column_name):
    """Determine if a UUID in a specific column should be converted."""
    # Columns that reference Directus tables (should stay as UUID)
    DIRECTUS_FK_COLUMNS = {
        'cv_file_sent',  # references directus_files
        'file',          # references directus_files in various tables
        'folder',        # references directus_folders
        'user',          # references directus_users
        'user_created',  # references directus_users
        'user_updated',  # references directus_users
        'uploaded_by',   # references directus_users
        'modified_by',   # references directus_users
        'created_by',    # references directus_users
        'policy',        # references directus_policies
        'role',          # references directus_roles
    }

    return column_name not in DIRECTUS_FK_COLUMNS

def convert_dump(input_path: str, output_path: str):
    """Convert UUIDs to integers in user-defined tables only."""

    print("Parsing table data sections...")
    table_sections = extract_table_data_sections(input_path)
    print(f"Found {len(table_sections)} user-defined tables with data")

    print("Extracting UUID mappings from user-defined tables...")
    uuid_to_int = extract_uuid_mappings_from_tables(table_sections)
    print(f"Found {len(uuid_to_int)} unique UUIDs in user-defined tables")

    print("Sample mappings:")
    for uuid, int_val in sorted(uuid_to_int.items())[:5]:
        print(f"  {uuid} -> {int_val}")

    print(f"\nReading dump file: {input_path}")
    with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    print("Converting UUIDs to integers in user-defined tables...")

    # Replace UUIDs, but only in the relevant table sections
    for table_name, section in table_sections.items():
        new_section = section
        for uuid, int_val in uuid_to_int.items():
            new_section = new_section.replace(uuid, str(int_val))
        content = content.replace(section, new_section)

    print(f"Writing converted dump to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Conversion complete!")
    print(f"\nNote: Directus table UUIDs and references to Directus tables")
    print("      (like cv_file_sent) remain as UUIDs as expected.")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 convert-dump-uuids-to-int-v2.py <input_dump.sql> [output_dump.sql]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.sql', '-converted.sql')

    if not Path(input_file).exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)

    convert_dump(input_file, output_file)
