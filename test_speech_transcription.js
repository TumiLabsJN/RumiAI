#!/usr/bin/env node
/**
 * Test GVI speech transcription fix
 */

const UnifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler');
const fs = require('fs').promises;
const path = require('path');

async function testSpeechTranscription() {
    // Try multiple videos to find one with speech
    const testVideos = [
        { id: '7511834896067775774', username: 'cassmrslater' },
        { id: '7372639293631679790', username: 'nutsnmore' },
        { id: '7514088138839477534', username: 'ivf_me' }
    ];
    
    console.log('Testing speech transcription fix...\n');
    
    for (const video of testVideos) {
        console.log(`\n=== Testing video ${video.id} (${video.username}) ===`);
        
        // Load existing GVI analysis
        let gviData = {};
        try {
            const gviPath = path.join(__dirname, 'temp', 'video-analysis', `${video.id}.json`);
            const gviContent = await fs.readFile(gviPath, 'utf8');
            const gviAnalysis = JSON.parse(gviContent);
            
            // Check if speech transcriptions exist
            const rawTranscriptions = gviAnalysis.raw?.annotationResults?.[0]?.speechTranscriptions || [];
            const processedTranscriptions = gviAnalysis.processed?.speechTranscriptions || [];
            
            console.log(`Raw speechTranscriptions: ${rawTranscriptions.length} items`);
            console.log(`Processed speechTranscriptions: ${processedTranscriptions.length} items`);
            
            if (processedTranscriptions.length > 0) {
                console.log('\nSpeech found! Sample:');
                const firstTranscription = processedTranscriptions[0];
                if (firstTranscription.alternatives && firstTranscription.alternatives.length > 0) {
                    const transcript = firstTranscription.alternatives[0].transcript;
                    console.log(`Transcript: "${transcript?.substring(0, 100)}..."`);
                    
                    const words = firstTranscription.alternatives[0].words || [];
                    console.log(`Word count: ${words.length}`);
                    if (words.length > 0) {
                        console.log(`First few words:`, words.slice(0, 3));
                    }
                }
                
                // Use the processed data for timeline assembly
                gviData = gviAnalysis.processed || {};
                
                // Create test video info
                const videoInfo = {
                    id: video.id,
                    duration: 12,
                    createTime: new Date().toISOString(),
                    author: {
                        username: video.username,
                        displayName: video.username,
                        verified: false
                    }
                };
                
                // Recreate unified timeline
                console.log('\nRegenerating unified timeline with speech data...');
                await UnifiedTimelineAssembler.assembleUnifiedTimeline(
                    video.id,
                    gviData,
                    videoInfo,
                    video.username
                );
                
                // Load and check the result
                const unifiedPath = path.join(__dirname, 'unified_analysis', `${video.id}.json`);
                const unifiedData = await fs.readFile(unifiedPath, 'utf8');
                const unified = JSON.parse(unifiedData);
                
                console.log('\nSpeech Timeline:');
                const speechTimeline = unified.timelines.speechTimeline || {};
                console.log(`Total speech segments: ${Object.keys(speechTimeline).length}`);
                
                if (Object.keys(speechTimeline).length > 0) {
                    console.log('\nFirst few speech segments:');
                    Object.entries(speechTimeline).slice(0, 3).forEach(([timestamp, data]) => {
                        console.log(`  ${timestamp}: "${data.text?.substring(0, 50)}..." (${data.words?.length || 0} words)`);
                    });
                }
                
                // Check metadata summary
                console.log('\nMetadata Summary Speech Info:');
                console.log(`  hasAudio: ${unified.metadata_summary.hasAudio}`);
                console.log(`  transcript: "${unified.metadata_summary.transcript?.substring(0, 100)}..."`);
                console.log(`  wordCount: ${unified.metadata_summary.wordCount}`);
                console.log(`  speechDuration: ${unified.metadata_summary.speechDuration}s`);
                
                break; // Found a video with speech, stop testing
            }
            
        } catch (error) {
            console.log(`No GVI data found for ${video.id}: ${error.message}`);
        }
    }
    
    console.log('\n✅ Test complete!');
}

testSpeechTranscription().catch(console.error);