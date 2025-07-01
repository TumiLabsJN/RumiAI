#!/usr/bin/env python3
"""
Migration script to update existing prompt runners to use ML data validation
"""

import os
import shutil
from datetime import datetime


def create_backup(file_path):
    """Create a backup of the original file"""
    backup_dir = 'backups'
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f"{os.path.basename(file_path)}.backup_{timestamp}"
    backup_path = os.path.join(backup_dir, backup_name)
    
    shutil.copy2(file_path, backup_path)
    print(f"✅ Created backup: {backup_path}")
    return backup_path


def update_imports(content):
    """Add validation imports to the file"""
    import_line = "from services.ml_data_validator import MLDataValidator, create_safe_context"
    
    # Find where to insert the import (after other imports)
    lines = content.split('\n')
    insert_idx = 0
    
    for i, line in enumerate(lines):
        if line.startswith('import ') or line.startswith('from '):
            insert_idx = i + 1
    
    # Insert the new import if not already present
    if import_line not in content:
        lines.insert(insert_idx, import_line)
        print("✅ Added validation imports")
    
    return '\n'.join(lines)


def update_context_building(content):
    """Update context building to use validated extraction"""
    # Pattern to find context building sections
    replacements = [
        {
            'description': 'Replace manual context building with validated extraction',
            'old_pattern': [
                "# Prepare context data (truncated for long videos)",
                "context_data = {",
                "    'duration': duration,",
                "    'caption': unified_data.get('static_metadata', {}).get('captionText', '')[:500],",
                "    'engagement_stats': unified_data.get('static_metadata', {}).get('stats', {})",
                "}"
            ],
            'new_code': """# Prepare validated context data
        context_data = create_safe_context(unified_data, prompt_name, strict=False)
        
        # Log validation status
        validator = MLDataValidator(strict_mode=False)
        is_valid, warnings = validator.validate_prompt_context(prompt_name, context_data)
        if warnings:
            print(f"   ⚠️  Validation warnings: {warnings}")"""
        }
    ]
    
    # Apply replacements
    for replacement in replacements:
        old_block = '\n'.join(replacement['old_pattern'])
        if old_block in content:
            # Find the full context building block (including timeline additions)
            start_idx = content.find(old_block)
            
            # Find the end of the context building (look for the next major section)
            end_markers = [
                "# Estimate tokens",
                "# Extra delay if approaching limit",
                "try:",
                "# Run the prompt"
            ]
            
            end_idx = start_idx + len(old_block)
            for marker in end_markers:
                marker_idx = content.find(marker, start_idx)
                if marker_idx > 0:
                    end_idx = marker_idx
                    break
            
            # Replace the entire context building section
            content = content[:start_idx] + replacement['new_code'] + content[end_idx:]
            print("✅ Updated context building to use validation")
    
    return content


def add_validation_initialization(content):
    """Add validator initialization"""
    init_line = "validator = MLDataValidator(strict_mode=False)  # Use warning mode"
    
    if "MLDataValidator" in content and init_line not in content:
        # Add after runner initialization
        runner_init = "runner = ClaudeInsightRunner()"
        if runner_init in content:
            content = content.replace(
                runner_init,
                f"{runner_init}\n{init_line}"
            )
            print("✅ Added validator initialization")
    
    return content


def migrate_file(file_path):
    """Migrate a single file to use validation"""
    print(f"\n🔄 Migrating: {file_path}")
    print("-" * 60)
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return False
    
    # Create backup
    backup_path = create_backup(file_path)
    
    try:
        # Read the original content
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Apply migrations
        content = update_imports(content)
        content = add_validation_initialization(content)
        content = update_context_building(content)
        
        # Write the updated content
        with open(file_path, 'w') as f:
            f.write(content)
        
        print(f"✅ Successfully migrated {file_path}")
        print(f"   Backup saved at: {backup_path}")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        print(f"   Restoring from backup...")
        shutil.copy2(backup_path, file_path)
        return False


def main():
    """Main migration runner"""
    print("🚀 ML Data Validation Migration Tool")
    print("=" * 60)
    
    # Files to migrate
    files_to_migrate = [
        'run_video_prompts_safe.py',
        'run_video_prompts_batch.py',
        'run_all_video_prompts.py'
    ]
    
    # Check which files exist
    existing_files = [f for f in files_to_migrate if os.path.exists(f)]
    
    if not existing_files:
        print("❌ No files found to migrate")
        return
    
    print(f"Found {len(existing_files)} files to migrate:")
    for f in existing_files:
        print(f"  - {f}")
    
    # Ask for confirmation
    response = input("\nProceed with migration? (y/n): ").lower()
    if response != 'y':
        print("Migration cancelled.")
        return
    
    # Migrate each file
    success_count = 0
    for file_path in existing_files:
        if migrate_file(file_path):
            success_count += 1
    
    # Summary
    print(f"\n{'=' * 60}")
    print(f"Migration Summary:")
    print(f"  ✅ Successfully migrated: {success_count}/{len(existing_files)} files")
    
    if success_count < len(existing_files):
        print(f"  ❌ Failed: {len(existing_files) - success_count} files")
    
    print(f"\n📁 Backups saved in: backups/")
    print(f"\n💡 Next steps:")
    print(f"  1. Test the migrated files with: python3 <file> <video_id> --validate-only")
    print(f"  2. Run the integrity test: python3 test_ml_data_integrity.py")
    print(f"  3. Use the new validated runner: python3 run_video_prompts_validated.py <video_id>")


if __name__ == "__main__":
    main()