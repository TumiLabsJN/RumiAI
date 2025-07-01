#!/usr/bin/env python3
"""
Update existing metadata.json files to use dynamic schema
"""

import os
import json
from datetime import datetime

def detect_prompt_folders(video_dir):
    """Dynamically detect all prompt folders"""
    prompt_folders = []
    
    if os.path.exists(video_dir):
        for item in os.listdir(video_dir):
            item_path = os.path.join(video_dir, item)
            # Skip non-directories and special folders
            if os.path.isdir(item_path) and item != 'reports' and not item.startswith('.'):
                prompt_folders.append(item)
    
    return sorted(prompt_folders)

def update_metadata_schema(insights_dir='insights'):
    """Update all metadata.json files to dynamic schema"""
    
    if not os.path.exists(insights_dir):
        print(f"❌ Insights directory not found: {insights_dir}")
        return
    
    updated_count = 0
    
    # Process each video directory
    for video_id in os.listdir(insights_dir):
        video_dir = os.path.join(insights_dir, video_id)
        
        if not os.path.isdir(video_dir):
            continue
            
        metadata_file = os.path.join(video_dir, 'metadata.json')
        
        if not os.path.exists(metadata_file):
            print(f"⚠️  No metadata.json for {video_id}")
            continue
        
        try:
            # Load existing metadata
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            print(f"\n📹 Processing {video_id}...")
            
            # Detect all prompt folders
            all_prompts = detect_prompt_folders(video_dir)
            print(f"   Found {len(all_prompts)} prompt folders")
            
            # Update metadata
            old_prompt_count = len(metadata.get('promptTypes', []))
            metadata['promptTypes'] = all_prompts
            
            # Build folder structure
            metadata['folderStructure'] = {
                'base': video_dir,
                'prompts': {prompt: os.path.join(video_dir, prompt) 
                           for prompt in all_prompts}
            }
            
            # Recalculate completion rate
            completed_count = len(metadata.get('completedPrompts', []))
            total_prompts = len(all_prompts) if all_prompts else 1
            old_rate = metadata.get('completionRate', 0)
            metadata['completionRate'] = (completed_count / total_prompts) * 100
            
            # Update timestamp
            metadata['lastUpdated'] = datetime.now().isoformat()
            metadata['schemaVersion'] = '2.0'  # Mark as updated schema
            
            # Save updated metadata
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"   ✅ Updated: {old_prompt_count} → {len(all_prompts)} prompts")
            print(f"   📊 Completion: {old_rate:.1f}% → {metadata['completionRate']:.1f}%")
            print(f"   📋 Completed prompts: {completed_count}/{total_prompts}")
            
            updated_count += 1
            
        except Exception as e:
            print(f"   ❌ Error updating {video_id}: {e}")
    
    print(f"\n✅ Updated {updated_count} metadata files to dynamic schema")

def verify_metadata(video_id, insights_dir='insights'):
    """Verify metadata for a specific video"""
    metadata_file = os.path.join(insights_dir, video_id, 'metadata.json')
    
    if not os.path.exists(metadata_file):
        print(f"❌ No metadata found for {video_id}")
        return
    
    with open(metadata_file, 'r') as f:
        metadata = json.load(f)
    
    print(f"\n📹 Metadata for {video_id}:")
    print(f"   Schema Version: {metadata.get('schemaVersion', '1.0')}")
    print(f"   Total Prompts: {len(metadata.get('promptTypes', []))}")
    print(f"   Completed: {len(metadata.get('completedPrompts', []))}")
    print(f"   Completion Rate: {metadata.get('completionRate', 0):.1f}%")
    print(f"   Last Updated: {metadata.get('lastUpdated', 'N/A')}")
    
    # Show prompt list
    print(f"\n📋 Prompt Types ({len(metadata.get('promptTypes', []))}):")
    for i, prompt in enumerate(metadata.get('promptTypes', []), 1):
        completed = '✅' if prompt in metadata.get('completedPrompts', []) else '❌'
        print(f"   {i:2d}. {completed} {prompt}")

def main():
    import sys
    
    if len(sys.argv) > 1:
        # Verify specific video
        video_id = sys.argv[1]
        verify_metadata(video_id)
    else:
        # Update all metadata files
        print("🔄 Updating all metadata.json files to dynamic schema...")
        update_metadata_schema()
        
        print("\n💡 To verify a specific video:")
        print("   python3 update_metadata_schema.py <video_id>")

if __name__ == "__main__":
    main()