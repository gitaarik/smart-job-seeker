#!/usr/bin/env python3
"""
Selective UUID to INT conversion for database dump.
Converts ONLY:
1. Primary key IDs in user-defined tables (id column)
2. Foreign keys to profiles (profile column)
3. Foreign keys to other INT-based user tables

Preserves:
- All Directus table UUIDs
- All columns referencing Directus tables (cv_file_sent, file, folder, user, etc.)
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

UUID_PATTERN = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

# User-defined tables with INT primary keys
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

# Columns that should be converted to INT (primary keys and profile FKs)
COLUMNS_TO_CONVERT = {
    'id',              # primary key
    'profile',         # FK to profiles
    'work_experience', # FK to work_experiences
}

def parse_copy_statement(line):
    """Extract table name and columns from COPY statement."""
    match = re.search(r'COPY public\.(\w+) \((.*?)\)', line)
    if match:
        table = match.group(1)
        cols = [col.strip() for col in match.group(2).split(',')]
        return table, cols
    return None, None

def process_data_line(line, table_name, columns):
    """Convert UUIDs in a data line if they're in convertible columns."""
    if not line or line == '\\.\n' or not columns:
        return line

    # Split tab-separated values
    values = line.rstrip('\n').split('\t')

    # Find which columns to convert based on their index
    for i, col_name in enumerate(columns):
        if i < len(values) and col_name in COLUMNS_TO_CONVERT:
            # This column should be converted if it contains a UUID
            value = values[i]
            if re.match(f'^{UUID_PATTERN}$', value, re.IGNORECASE):
                # Will be replaced in the second pass
                pass

    return line

def build_uuid_mappings(dump_path):
    """Build UUID->INT mappings from user-defined tables only."""
    uuid_to_int = {}
    next_id = 1
    current_table = None
    current_columns = None

    with open(dump_path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            # Check for COPY statement
            if line.startswith('COPY public.'):
                table, cols = parse_copy_statement(line)
                if table in TABLES_WITH_INT_PK:
                    current_table = table
                    current_columns = cols
                else:
                    current_table = None
                    current_columns = None

            elif current_table and current_columns and line != '\\.\n':
                # This is a data line
                values = line.rstrip('\n').split('\t')

                # Map IDs (first column is typically id)
                for i, col_name in enumerate(current_columns):
                    if i < len(values) and col_name in COLUMNS_TO_CONVERT:
                        value = values[i]
                        if value and value != '\\N' and re.match(f'^{UUID_PATTERN}$', value, re.IGNORECASE):
                            if value not in uuid_to_int:
                                uuid_to_int[value] = next_id
                                next_id += 1

            elif line == '\\.\n':
                current_table = None
                current_columns = None

    return uuid_to_int

def convert_dump(input_path, output_path):
    """Convert specific UUIDs to INTs."""
    print("Building UUID to INT mappings...")
    uuid_to_int = build_uuid_mappings(input_path)
    print(f"Found {len(uuid_to_int)} UUIDs to convert")

    print("Sample mappings:")
    for uuid, int_val in sorted(uuid_to_int.items())[:10]:
        print(f"  {uuid} -> {int_val}")

    print(f"\nReading {input_path}...")
    with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    print("Converting UUIDs in user-defined tables...")
    current_table = None
    current_columns = None
    output_lines = []

    for line in lines:
        # Track current table
        if line.startswith('COPY public.'):
            table, cols = parse_copy_statement(line)
            if table in TABLES_WITH_INT_PK:
                current_table = table
                current_columns = cols
            else:
                current_table = None
                current_columns = None
            output_lines.append(line)

        elif current_table and current_columns and line not in ('\\.\n', '\\\.\n'):
            # This is a data line - convert specific UUIDs
            values = line.rstrip('\n').split('\t')
            converted = False

            for i, col_name in enumerate(current_columns):
                if i < len(values) and col_name in COLUMNS_TO_CONVERT:
                    value = values[i]
                    if value in uuid_to_int:
                        values[i] = str(uuid_to_int[value])
                        converted = True

            if converted:
                output_lines.append('\t'.join(values) + '\n')
            else:
                output_lines.append(line)

        elif line == '\\.\n' or line == '\\\.\n':
            current_table = None
            current_columns = None
            output_lines.append(line)

        else:
            output_lines.append(line)

    print(f"Writing {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(output_lines)

    print("Conversion complete!")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 convert-dump-uuids-to-int-v3.py <input.sql> [output.sql]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.sql', '-converted.sql')

    if not Path(input_file).exists():
        print(f"Error: {input_file} not found")
        sys.exit(1)

    convert_dump(input_file, output_file)
