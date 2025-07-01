# CLAUDE RULES

## File Safety Rules

1. **CREATE BACKUPS before destructive operations:**
   - File replacement: `cp newfile.py existingfile.py`
   - File removal: `rm important_file.py`
   - File moving/renaming: `mv critical_file.py new_name.py`
   - Bulk operations that could break functionality
   
   Example:
   ```bash
   cp target_file.py target_file.py.backup_YYYYMMDD_desc
   # Then verify backup exists before proceeding
   ```

2. **NO BACKUPS NEEDED for safe operations:**
   - Using Edit/MultiEdit tools (preserves file)
   - Creating new files
   - Reading files
   - Appending to files
   - Small, targeted edits

3. **PREFER Edit tool over file replacement when possible**

4. **ASK PERMISSION before:**
   - Deleting files
   - Overwriting critical system files
   - Making changes that affect the entire codebase

5. **NEVER directly overwrite without backup:**
   - `cp new.py existing.py` ❌
   - `mv new.py existing.py` ❌
   - `> existing.py` ❌

## Backup Naming Convention
Use descriptive backup names:
- `file.py.backup_20240630_before_numpy_removal`
- `file.py.backup_20240630_working_version`

Not just `file.py.backup1`, `file.py.backup2`...