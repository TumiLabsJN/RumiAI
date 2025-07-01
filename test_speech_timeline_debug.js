#!/usr/bin/env node

/**
 * Test script to debug speech timeline assembly
 */

const fs = require('fs').promises;
const path = require('path');
const UnifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler');

async function testSpeechTimeline() {
    console.log('🧪 Testing Speech Timeline Assembly');
    console.log('===================================\n');
    
    // Test video ID - use an existing one
    const videoId = '7518102381825903903';
    const username = 'rumimacro';
    
    try {
        // Step 1: Load GVI data
        console.log('📊 Step 1: Loading GVI analysis data...');
        const gviAnalysisPath = path.join(__dirname, 'temp', 'video-analysis', `${videoId}.json`);
        const gviData = await fs.readFile(gviAnalysisPath, 'utf8');
        const gviAnalysis = JSON.parse(gviData);
        
        console.log('✅ GVI data loaded');
        console.log('   - Has processed:', !!gviAnalysis.processed);
        console.log('   - Has speechTranscriptions in processed:', !!gviAnalysis.processed?.speechTranscriptions);
        console.log('   - speechTranscriptions count:', gviAnalysis.processed?.speechTranscriptions?.length || 0);
        
        if (gviAnalysis.processed?.speechTranscriptions?.length > 0) {
            const firstTranscription = gviAnalysis.processed.speechTranscriptions[0];
            console.log('   - First transcription has alternatives:', !!firstTranscription.alternatives);
            if (firstTranscription.alternatives?.[0]) {
                const alt = firstTranscription.alternatives[0];
                console.log('   - First alternative transcript:', alt.transcript?.substring(0, 50) + '...');
                console.log('   - Has words:', !!alt.words, alt.words?.length || 0, 'words');
            }
        }
        console.log('');
        
        // Step 2: Test with different metadata structures
        console.log('📝 Step 2: Testing UnifiedTimelineAssembler with different metadata structures...\n');
        
        // Test Case 1: Direct processed object (as in test flow)
        console.log('Test Case 1: metadataSummary = gviAnalysis.processed');
        const metadataSummary1 = gviAnalysis.processed || {};
        
        // Basic video info
        const videoInfo = {
            duration: 10, // Example duration
            fps: 1,
            author: { username: username }
        };
        
        const unifiedAnalysis1 = await UnifiedTimelineAssembler.assembleUnifiedTimeline(
            videoId,
            metadataSummary1,
            videoInfo,
            username
        );
        
        console.log('✅ Test Case 1 complete');
        console.log('   - Speech timeline entries:', Object.keys(unifiedAnalysis1.timelines.speechTimeline).length);
        console.log('   - Metadata summary has speechTranscriptions:', !!unifiedAnalysis1.metadata_summary.speechTranscriptions);
        console.log('');
        
        // Test Case 2: Nested structure 
        console.log('Test Case 2: metadataSummary = { processed: gviAnalysis.processed }');
        const metadataSummary2 = { processed: gviAnalysis.processed };
        
        const unifiedAnalysis2 = await UnifiedTimelineAssembler.assembleUnifiedTimeline(
            videoId + '_test2',
            metadataSummary2,
            videoInfo,
            username
        );
        
        console.log('✅ Test Case 2 complete');
        console.log('   - Speech timeline entries:', Object.keys(unifiedAnalysis2.timelines.speechTimeline).length);
        console.log('   - Metadata summary has speechTranscriptions:', !!unifiedAnalysis2.metadata_summary.speechTranscriptions);
        console.log('');
        
        // Step 3: Display speech timeline content
        console.log('🎤 Step 3: Speech Timeline Content');
        console.log('==================================\n');
        
        if (Object.keys(unifiedAnalysis1.timelines.speechTimeline).length > 0) {
            console.log('Speech segments found:');
            Object.entries(unifiedAnalysis1.timelines.speechTimeline).slice(0, 5).forEach(([timestamp, data]) => {
                console.log(`   - ${timestamp}: "${data.text.substring(0, 50)}..."`);
            });
            console.log(`   ... and ${Object.keys(unifiedAnalysis1.timelines.speechTimeline).length - 5} more segments`);
        } else {
            console.log('❌ No speech segments in timeline!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testSpeechTimeline();