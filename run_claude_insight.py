#!/usr/bin/env python3
"""
Run a single Claude prompt for one insight and save to the correct folder
"""

import os
import json
import requests
import time
from datetime import datetime
from pathlib import Path

# Try to load dotenv if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class ClaudeInsightRunner:
    def __init__(self):
        self.api_key = os.getenv('ANTHROPIC_API_KEY')
        self.api_url = 'https://api.anthropic.com/v1/messages'
        self.model = 'claude-3-5-sonnet-20241022'
        self.base_dir = 'insights'
        
        # Per-prompt timeout configuration (in seconds)
        self.prompt_timeouts = {
            'creative_density': 60,
            'emotional_journey': 90,
            'speech_analysis': 90,
            'visual_overlay_analysis': 90,
            'metadata_analysis': 60,
            'person_framing': 90,
            'scene_pacing': 60,
            'default': 120
        }
        
    def run_claude_prompt(self, video_id, prompt_name, prompt_text, context_data=None):
        """
        Run a single Claude prompt and save the output
        
        Args:
            video_id: str - Video ID (e.g., 'cristiano_7515739984452701457')
            prompt_name: str - Insight type (e.g., 'hook_analysis')
            prompt_text: str - The prompt to send to Claude
            context_data: dict - Optional context data to include
        
        Returns:
            dict - Result with filepath and response
        """
        
        # Create output directory
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_dir = os.path.join(self.base_dir, video_id, prompt_name)
        os.makedirs(output_dir, exist_ok=True)
        
        # Build full prompt with context
        full_prompt = self._build_full_prompt(prompt_text, context_data)
        
        # Save prompt
        prompt_file = os.path.join(output_dir, f'{prompt_name}_prompt_{timestamp}.txt')
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(full_prompt)
        print(f"📝 Saved prompt to: {prompt_file}")
        
        # Get Claude response with appropriate timeout
        timeout = self.prompt_timeouts.get(prompt_name, self.prompt_timeouts['default'])
        claude_response = self._call_claude_api(full_prompt, timeout=timeout)
        
        # Save response
        if claude_response['success']:
            response_file = os.path.join(output_dir, f'{prompt_name}_result_{timestamp}.txt')
            with open(response_file, 'w', encoding='utf-8') as f:
                f.write(claude_response['response'])
            print(f"✅ Saved {prompt_name} result to: {response_file}")
            
            # Save complete JSON result
            json_file = os.path.join(output_dir, f'{prompt_name}_complete_{timestamp}.json')
            result_data = {
                'video_id': video_id,
                'prompt_name': prompt_name,
                'timestamp': datetime.now().isoformat(),
                'prompt': full_prompt,
                'response': claude_response['response'],
                'model': self.model,
                'context_data': context_data
            }
            
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(result_data, f, indent=2)
            print(f"💾 Saved complete data to: {json_file}")
            
            # Update metadata
            self._update_metadata(video_id, prompt_name)
            
            return {
                'success': True,
                'response_file': response_file,
                'json_file': json_file,
                'response': claude_response['response']
            }
        else:
            # Save error
            error_file = os.path.join(output_dir, f'{prompt_name}_error_{timestamp}.json')
            with open(error_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'error': claude_response['error'],
                    'timestamp': datetime.now().isoformat(),
                    'prompt': full_prompt
                }, f, indent=2)
            
            print(f"❌ Error saved to: {error_file}")
            return {
                'success': False,
                'error': claude_response['error'],
                'error_file': error_file
            }
    
    def _build_full_prompt(self, prompt_text, context_data):
        """Build the full prompt with context"""
        if not context_data:
            return prompt_text
        
        # Format context as structured data
        context_str = "CONTEXT DATA:\n"
        context_str += json.dumps(context_data, indent=2)
        
        full_prompt = f"{context_str}\n\nANALYSIS REQUEST:\n{prompt_text}"
        return full_prompt
    
    def _call_claude_api(self, prompt, timeout=120):
        """Call Claude API with the prompt"""
        print(f"⏱️ Using timeout: {timeout}s")
        if not self.api_key or self.api_key == 'your-anthropic-api-key-here':
            return {
                'success': False,
                'error': 'API key not configured'
            }
        
        try:
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': self.api_key,
                'anthropic-version': '2023-06-01'
            }
            
            data = {
                'model': self.model,
                'max_tokens': 4000,
                'messages': [{
                    'role': 'user',
                    'content': prompt
                }]
            }
            
            # Log prompt size for debugging
            prompt_size = len(json.dumps(data))
            print(f"📏 Prompt size: {prompt_size:,} characters")
            
            # Try with timeout and retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = requests.post(self.api_url, headers=headers, json=data, timeout=timeout)
                    
                    if response.status_code == 200:
                        result = response.json()
                        return {
                            'success': True,
                            'response': result['content'][0]['text']
                        }
                    elif response.status_code == 429:  # Rate limit
                        if attempt < max_retries - 1:
                            print(f"⏳ Rate limited, retrying in {2 ** attempt} seconds...")
                            time.sleep(2 ** attempt)
                            continue
                        else:
                            return {
                                'success': False,
                                'error': f"API rate limit exceeded after {max_retries} attempts"
                            }
                    else:
                        return {
                            'success': False,
                            'error': f"API error {response.status_code}: {response.text}"
                        }
                except requests.exceptions.Timeout:
                    if attempt < max_retries - 1:
                        print(f"⏱️ Request timed out, retrying (attempt {attempt + 1}/{max_retries})...")
                        continue
                    else:
                        return {
                            'success': False,
                            'error': f"Request timed out after {max_retries} attempts"
                        }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _update_metadata(self, video_id, prompt_name):
        """Update video metadata to track completed prompts"""
        metadata_file = os.path.join(self.base_dir, video_id, 'metadata.json')
        
        try:
            # Load existing metadata
            if os.path.exists(metadata_file):
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
            else:
                metadata = {
                    'videoId': video_id,
                    'createdAt': datetime.now().isoformat(),
                    'completedPrompts': []
                }
            
            # Update completed prompts
            if prompt_name not in metadata.get('completedPrompts', []):
                metadata['completedPrompts'].append(prompt_name)
                metadata['lastUpdated'] = datetime.now().isoformat()
                metadata['completionRate'] = (len(metadata['completedPrompts']) / 15) * 100
                
                # Save updated metadata
                with open(metadata_file, 'w') as f:
                    json.dump(metadata, f, indent=2)
                    
        except Exception as e:
            print(f"Failed to update metadata: {e}")
    
    def run_batch_prompts(self, video_id, prompts_dict):
        """Run multiple prompts for a video"""
        results = {}
        
        for prompt_name, prompt_data in prompts_dict.items():
            print(f"\n🔄 Running {prompt_name}...")
            
            prompt_text = prompt_data.get('prompt', '')
            context = prompt_data.get('context', None)
            
            result = self.run_claude_prompt(video_id, prompt_name, prompt_text, context)
            results[prompt_name] = result
            
        return results


# Convenience function matching the requested format
def run_claude_prompt(video_id, prompt_name, prompt_text, claude_response=None):
    """
    Simple function to run or save a Claude prompt
    
    If claude_response is provided, it saves that response.
    If claude_response is None, it calls the Claude API.
    """
    runner = ClaudeInsightRunner()
    
    if claude_response is not None:
        # Just save the provided response
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_dir = os.path.join('insights', video_id, prompt_name)
        os.makedirs(output_dir, exist_ok=True)
        
        # Save prompt
        with open(os.path.join(output_dir, f'{prompt_name}_prompt_{timestamp}.txt'), 'w') as f:
            f.write(prompt_text)
        
        # Save response
        with open(os.path.join(output_dir, f'{prompt_name}_result_{timestamp}.txt'), 'w') as f:
            f.write(claude_response)
        
        print(f"✅ Saved {prompt_name} output for {video_id} in {output_dir}")
        return output_dir
    else:
        # Call Claude API
        result = runner.run_claude_prompt(video_id, prompt_name, prompt_text)
        return result


# Example usage and test
def main():
    """Example usage"""
    # Example 1: Simple usage with provided response
    print("Example 1: Save provided response")
    print("-" * 50)
    
    run_claude_prompt(
        video_id='cristiano_7515739984452701457',
        prompt_name='hook_analysis',
        prompt_text='Analyze the hook effectiveness in the first 3 seconds',
        claude_response='The video uses a strong visual hook with text overlay "Is this the real value?" creating immediate curiosity...'
    )
    
    # Example 2: Call Claude API with context
    print("\n\nExample 2: Call Claude API")
    print("-" * 50)
    
    runner = ClaudeInsightRunner()
    
    # Load unified analysis for context
    unified_path = 'unified_analysis/cristiano_7515739984452701457.json'
    context_data = {}
    
    if os.path.exists(unified_path):
        with open(unified_path, 'r') as f:
            unified = json.load(f)
            context_data = {
                'first_3_seconds': {
                    'text_overlays': unified.get('timelines', {}).get('textOverlayTimeline', {}),
                    'objects': unified.get('timelines', {}).get('objectTimeline', {})
                },
                'video_stats': unified.get('static_metadata', {}).get('stats', {})
            }
    
    result = runner.run_claude_prompt(
        video_id='cristiano_7515739984452701457',
        prompt_name='engagement_tactics',
        prompt_text='Identify and analyze all engagement tactics used in this TikTok video. Focus on psychological triggers, visual techniques, and viewer retention strategies.',
        context_data=context_data
    )
    
    if result['success']:
        print(f"\n📄 Claude's response preview:")
        print(result['response'][:200] + '...')


if __name__ == "__main__":
    main()