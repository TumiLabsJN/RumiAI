#!/usr/bin/env node

/**
 * Verify that speech timeline is correctly populated in unified analysis
 */

const fs = require('fs').promises;
const path = require('path');

async function verifySpeechTimeline() {
    console.log('🔍 Verifying Speech Timeline Fix');
    console.log('================================\n');
    
    try {
        // Check a few unified analysis files
        const unifiedDir = path.join(__dirname, 'unified_analysis');
        const files = await fs.readdir(unifiedDir);
        const jsonFiles = files.filter(f => f.endsWith('.json')).slice(0, 5);
        
        console.log(`Checking ${jsonFiles.length} unified analysis files...\n`);
        
        let totalWithSpeech = 0;
        let totalWithEmptySpeech = 0;
        
        for (const file of jsonFiles) {
            const filePath = path.join(unifiedDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const analysis = JSON.parse(data);
            
            const speechTimelineEntries = Object.keys(analysis.timelines?.speechTimeline || {}).length;
            const hasSpeechTranscriptions = !!analysis.metadata_summary?.speechTranscriptions?.length;
            const transcriptionsCount = analysis.metadata_summary?.speechTranscriptions?.length || 0;
            
            console.log(`📄 ${file}:`);
            console.log(`   - Speech timeline entries: ${speechTimelineEntries}`);
            console.log(`   - Has speechTranscriptions in metadata: ${hasSpeechTranscriptions} (${transcriptionsCount} items)`);
            console.log(`   - Has transcript: ${!!analysis.metadata_summary?.transcript}`);
            
            if (speechTimelineEntries > 0) {
                totalWithSpeech++;
                // Show first speech segment
                const firstSegment = Object.entries(analysis.timelines.speechTimeline)[0];
                if (firstSegment) {
                    console.log(`   - First segment: "${firstSegment[1].text?.substring(0, 50)}..."`);
                }
            } else if (hasSpeechTranscriptions && transcriptionsCount > 0) {
                totalWithEmptySpeech++;
                console.log(`   ⚠️  WARNING: Has speech transcriptions but empty timeline!`);
            }
            console.log('');
        }
        
        console.log('📊 Summary:');
        console.log(`   - Files with speech timeline: ${totalWithSpeech}`);
        console.log(`   - Files with empty timeline despite transcriptions: ${totalWithEmptySpeech}`);
        console.log(`   - Total files checked: ${jsonFiles.length}`);
        
        if (totalWithEmptySpeech > 0) {
            console.log('\n❌ Some files still have empty speech timelines!');
            console.log('   Run test_rumiai_complete_flow.js again to regenerate with the fix.');
        } else {
            console.log('\n✅ All files with speech transcriptions have populated timelines!');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run verification
verifySpeechTimeline();