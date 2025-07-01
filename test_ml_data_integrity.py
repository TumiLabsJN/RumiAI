#!/usr/bin/env python3
"""
Test ML Data Integrity
Verifies that ML detection data is properly formatted and contains no fabricated data
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from services.ml_data_validator import MLDataValidator


class MLDataIntegrityTester:
    """Test suite for ML data integrity"""
    
    def __init__(self):
        self.validator = MLDataValidator(strict_mode=True)
        self.test_results = []
        
    def test_unified_analysis_file(self, file_path: str) -> Dict:
        """Test a single unified analysis file"""
        print(f"\n🔍 Testing: {file_path}")
        print("-" * 60)
        
        result = {
            'file': file_path,
            'tests': {},
            'passed': True
        }
        
        try:
            # Load the file
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            video_id = data.get('video_id', 'unknown')
            print(f"Video ID: {video_id}")
            
            # Test 1: Basic structure validation
            print("\n1. Testing basic structure...")
            is_valid, issues = self.validator.validate_unified_analysis(data)
            result['tests']['structure'] = {
                'passed': is_valid,
                'issues': issues
            }
            if is_valid:
                print("   ✅ Structure validation passed")
            else:
                print("   ❌ Structure validation failed:")
                for issue in issues:
                    print(f"      - {issue}")
                result['passed'] = False
            
            # Test 2: Timeline data validation
            print("\n2. Testing timeline data...")
            timelines = data.get('timelines', {})
            timeline_issues = []
            
            for timeline_name, timeline_data in timelines.items():
                is_valid, issues = self.validator.validate_timeline_data(timeline_data, timeline_name)
                if not is_valid:
                    timeline_issues.extend(issues)
            
            result['tests']['timelines'] = {
                'passed': len(timeline_issues) == 0,
                'issues': timeline_issues
            }
            
            if len(timeline_issues) == 0:
                print("   ✅ Timeline validation passed")
            else:
                print("   ❌ Timeline validation failed:")
                for issue in timeline_issues:
                    print(f"      - {issue}")
                result['passed'] = False
            
            # Test 3: Check for suspicious data patterns
            print("\n3. Testing for suspicious data patterns...")
            suspicious_found = self._check_suspicious_patterns(data)
            
            result['tests']['suspicious_patterns'] = {
                'passed': len(suspicious_found) == 0,
                'patterns': suspicious_found
            }
            
            if len(suspicious_found) == 0:
                print("   ✅ No suspicious patterns found")
            else:
                print("   ❌ Suspicious patterns detected:")
                for pattern in suspicious_found:
                    print(f"      - {pattern}")
                result['passed'] = False
            
            # Test 4: Data consistency checks
            print("\n4. Testing data consistency...")
            consistency_issues = self._check_data_consistency(data)
            
            result['tests']['consistency'] = {
                'passed': len(consistency_issues) == 0,
                'issues': consistency_issues
            }
            
            if len(consistency_issues) == 0:
                print("   ✅ Data consistency checks passed")
            else:
                print("   ❌ Data consistency issues:")
                for issue in consistency_issues:
                    print(f"      - {issue}")
                result['passed'] = False
            
            # Test 5: Context extraction for each prompt type
            print("\n5. Testing context extraction for prompts...")
            prompt_issues = self._test_prompt_contexts(data)
            
            result['tests']['prompt_contexts'] = {
                'passed': len(prompt_issues) == 0,
                'issues': prompt_issues
            }
            
            if len(prompt_issues) == 0:
                print("   ✅ All prompt contexts extracted successfully")
            else:
                print("   ❌ Prompt context issues:")
                for issue in prompt_issues:
                    print(f"      - {issue}")
                result['passed'] = False
            
        except Exception as e:
            print(f"❌ Failed to test file: {str(e)}")
            result['passed'] = False
            result['error'] = str(e)
        
        # Summary for this file
        print(f"\n{'=' * 60}")
        print(f"Overall result: {'✅ PASSED' if result['passed'] else '❌ FAILED'}")
        
        self.test_results.append(result)
        return result
    
    def _check_suspicious_patterns(self, data: Dict) -> List[str]:
        """Check for patterns that indicate fabricated data"""
        suspicious_patterns = [
            'link in bio',
            'swipe up',
            'example.com',
            'lorem ipsum',
            'test test test',
            'placeholder',
            'todo:',
            'fixme:',
            '[insert here]',
            'coming soon',
        ]
        
        found_patterns = []
        data_str = json.dumps(data).lower()
        
        for pattern in suspicious_patterns:
            if pattern in data_str:
                # Find where it appears
                if 'timelines' in data:
                    for timeline_name, timeline_data in data['timelines'].items():
                        timeline_str = json.dumps(timeline_data).lower()
                        if pattern in timeline_str:
                            found_patterns.append(f"'{pattern}' found in {timeline_name}")
                else:
                    found_patterns.append(f"'{pattern}' found in data")
        
        return found_patterns
    
    def _check_data_consistency(self, data: Dict) -> List[str]:
        """Check for data consistency issues"""
        issues = []
        
        # Check duration consistency
        duration = data.get('duration_seconds', 0)
        if duration > 0:
            # Check if timeline entries exceed duration
            timelines = data.get('timelines', {})
            for timeline_name, timeline_data in timelines.items():
                if isinstance(timeline_data, dict):
                    for timestamp in timeline_data.keys():
                        try:
                            # Extract end time from timestamp (e.g., "10-11s" -> 11)
                            if '-' in timestamp and timestamp.endswith('s'):
                                end_time = int(timestamp.split('-')[1].rstrip('s'))
                                if end_time > duration:
                                    issues.append(f"{timeline_name} has entry at {timestamp} beyond video duration {duration}s")
                        except (ValueError, IndexError):
                            pass
        
        # Check frame count consistency
        total_frames = data.get('total_frames', 0)
        fps = data.get('fps', 1)
        expected_frames = int(duration * fps) if duration > 0 and fps > 0 else 0
        
        if total_frames > 0 and expected_frames > 0:
            # Allow 10% tolerance
            if abs(total_frames - expected_frames) > expected_frames * 0.1:
                issues.append(f"Frame count mismatch: {total_frames} frames != {expected_frames} expected (duration*fps)")
        
        # Check for empty timelines that should have data
        timelines = data.get('timelines', {})
        metadata_summary = data.get('metadata_summary', {})
        
        # If objects are mentioned in summary, objectTimeline should have data
        if metadata_summary.get('objects') and not timelines.get('objectTimeline'):
            issues.append("Objects mentioned in summary but objectTimeline is empty")
        
        # If speech is mentioned, speechTimeline should have data
        if metadata_summary.get('speech') and not timelines.get('speechTimeline'):
            issues.append("Speech mentioned in summary but speechTimeline is empty")
        
        return issues
    
    def _test_prompt_contexts(self, data: Dict) -> List[str]:
        """Test context extraction for various prompt types"""
        issues = []
        test_prompts = ['hook_analysis', 'engagement_triggers', 'creative_density']
        
        for prompt_name in test_prompts:
            try:
                context = self.validator.extract_safe_context_data(data, prompt_name)
                
                # Validate the extracted context
                is_valid, warnings = self.validator.validate_prompt_context(prompt_name, context)
                
                if not is_valid or warnings:
                    issues.append(f"{prompt_name}: {', '.join(warnings)}")
                    
            except Exception as e:
                issues.append(f"{prompt_name}: Failed to extract context - {str(e)}")
        
        return issues
    
    def test_all_unified_files(self, directory: str = 'unified_analysis') -> Dict:
        """Test all unified analysis files in directory"""
        print(f"\n🔍 Testing all files in {directory}/")
        print("=" * 80)
        
        files = list(Path(directory).glob('*.json'))
        print(f"Found {len(files)} files to test\n")
        
        for file_path in sorted(files):
            self.test_unified_analysis_file(str(file_path))
        
        # Generate summary report
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r['passed'])
        failed = total - passed
        
        print(f"\n{'=' * 80}")
        print(f"📊 OVERALL SUMMARY")
        print(f"{'=' * 80}")
        print(f"Total files tested: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success rate: {(passed/total*100):.1f}%" if total > 0 else "N/A")
        
        # List failed files
        if failed > 0:
            print(f"\nFailed files:")
            for result in self.test_results:
                if not result['passed']:
                    print(f"  - {result['file']}")
                    for test_name, test_data in result['tests'].items():
                        if not test_data.get('passed', True):
                            print(f"    ❌ {test_name}")
        
        # Save detailed report
        report_path = f'test_reports/ml_integrity_report_{Path.cwd().name}_{os.getpid()}.json'
        os.makedirs('test_reports', exist_ok=True)
        
        report = {
            'summary': {
                'total': total,
                'passed': passed,
                'failed': failed,
                'success_rate': (passed/total*100) if total > 0 else 0
            },
            'details': self.test_results
        }
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Detailed report saved: {report_path}")
        
        return report


def main():
    """Main test runner"""
    tester = MLDataIntegrityTester()
    
    if len(sys.argv) > 1:
        # Test specific file
        file_path = sys.argv[1]
        if os.path.exists(file_path):
            tester.test_unified_analysis_file(file_path)
        else:
            print(f"❌ File not found: {file_path}")
            sys.exit(1)
    else:
        # Test all files
        tester.test_all_unified_files()


if __name__ == "__main__":
    main()