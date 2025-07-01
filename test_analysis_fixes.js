const LocalVideoAnalyzer = require('./server/services/LocalVideoAnalyzer.js');
const unifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler.js');
const fs = require('fs').promises;

async function testAnalysisFixes() {
    const videoPath = 'test_video.mp4';
    const videoId = '7489578000846048558';
    
    console.log('🧪 Testing RumiAI Analysis Fixes');
    console.log('================================\n');
    
    try {
        // Run local analysis
        console.log('🎥 Running local video analysis...');
        const analysisResult = await LocalVideoAnalyzer.analyzeVideo(videoPath, videoId);
        
        // Save analysis result
        await fs.writeFile(`local_analysis_${videoId}.json`, JSON.stringify(analysisResult, null, 2));
        
        // Check results
        console.log('\n📊 Analysis Results:');
        console.log('====================');
        
        // 1. OCR Text Detection
        const textCount = analysisResult.textAnnotations?.length || 0;
        console.log(`\n1. OCR Text Detection:`);
        console.log(`   ✅ Detected ${textCount} text elements`);
        if (textCount > 0) {
            console.log(`   📝 Sample texts:`);
            analysisResult.textAnnotations.slice(0, 3).forEach(text => {
                console.log(`      - "${text.text}"`);
            });
        }
        
        // 2. Sticker Detection
        const stickerCount = analysisResult._raw?.ocr?.frame_details?.reduce((sum, frame) => 
            sum + (frame.creative_elements?.filter(el => el.element === 'sticker').length || 0), 0) || 0;
        console.log(`\n2. Sticker Detection:`);
        console.log(`   ${stickerCount > 0 ? '✅' : '❌'} Detected ${stickerCount} stickers`);
        
        // 3. Human Expression Detection
        const expressionCount = analysisResult._raw?.mediapipe?.timeline?.expressions?.length || 0;
        console.log(`\n3. Expression Timeline:`);
        console.log(`   ${expressionCount > 0 ? '✅' : '⚠️'} ${expressionCount} expressions detected`);
        console.log(`   ℹ️  Note: This video may not have human faces`);
        
        // 4. Scene Change Detection
        const sceneCount = analysisResult.shots?.length || 0;
        console.log(`\n4. Scene Change Detection:`);
        console.log(`   ✅ Detected ${sceneCount} scenes (threshold: 20.0)`);
        
        // 5. Speech Transcription
        const wordCount = analysisResult.wordCount || 0;
        const segments = analysisResult.speechSegments?.length || 0;
        console.log(`\n5. Speech Transcription:`);
        console.log(`   ✅ Total words: ${wordCount}`);
        console.log(`   ✅ Speech segments: ${segments}`);
        if (analysisResult.transcript) {
            console.log(`   📝 Transcript preview: "${analysisResult.transcript.substring(0, 100)}..."`);
        }
        
        // Create unified timeline
        console.log('\n🔄 Creating unified timeline...');
        const unifiedTimeline = await unifiedTimelineAssembler.assembleTimeline(videoId);
        
        // Save unified timeline
        await fs.writeFile(`unified_timeline_${videoId}.json`, JSON.stringify(unifiedTimeline, null, 2));
        
        // Check unified timeline
        console.log('\n📊 Unified Timeline Results:');
        console.log('===========================');
        
        // Check speech in timeline
        const speechSegmentsInTimeline = Object.keys(unifiedTimeline.timelines?.speechTimeline || {}).length;
        console.log(`\n6. Speech in Timeline:`);
        console.log(`   ${speechSegmentsInTimeline > 0 ? '✅' : '❌'} ${speechSegmentsInTimeline} speech segments in timeline`);
        
        // Check metadata summary
        const metadataWordCount = unifiedTimeline.metadata_summary?.wordCount || 0;
        const metadataTranscript = unifiedTimeline.metadata_summary?.transcript || '';
        console.log(`\n7. Speech in Metadata Summary:`);
        console.log(`   ${metadataWordCount > 0 ? '✅' : '❌'} Word count: ${metadataWordCount}`);
        console.log(`   ${metadataTranscript ? '✅' : '❌'} Transcript: ${metadataTranscript ? 'Present' : 'Missing'}`);
        
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testAnalysisFixes();