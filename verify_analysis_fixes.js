const LocalVideoAnalyzer = require('./server/services/LocalVideoAnalyzer.js');
const unifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler.js');
const fs = require('fs').promises;

async function verifyAnalysisFixes(videoUrl) {
    console.log('🔍 Verifying RumiAI Analysis Fixes');
    console.log('==================================');
    console.log(`📱 URL: ${videoUrl}\n`);
    
    // Extract video ID from URL
    const match = videoUrl.match(/video\/(\d+)/);
    if (!match) {
        console.error('❌ Invalid TikTok URL');
        return;
    }
    const videoId = match[1];
    
    // Check if we have existing analysis
    const analysisFiles = {
        ocr: `creative_analysis_outputs/${videoId}_1/${videoId}_1_creative_analysis.json`,
        mediapipe: `human_analysis_outputs/${videoId}_1/${videoId}_1_human_analysis.json`,
        whisper: `speech_transcriptions/${videoId}_whisper.json`,
        unified: `unified_analysis/${videoId}.json`
    };
    
    console.log('📊 Checking Analysis Results:');
    console.log('============================\n');
    
    try {
        // 1. Check OCR/Creative Analysis
        if (await fileExists(analysisFiles.ocr)) {
            const ocrData = JSON.parse(await fs.readFile(analysisFiles.ocr, 'utf8'));
            const textCount = ocrData.frame_details?.reduce((sum, frame) => 
                sum + (frame.text_elements?.length || 0), 0) || 0;
            const stickerCount = ocrData.frame_details?.reduce((sum, frame) => 
                sum + (frame.creative_elements?.filter(el => el.element === 'sticker').length || 0), 0) || 0;
            
            console.log('1. OCR/Creative Detection:');
            console.log(`   ✅ Text elements: ${textCount}`);
            console.log(`   ✅ Stickers: ${stickerCount}\n`);
        } else {
            console.log('1. OCR/Creative Detection: ❌ Not found\n');
        }
        
        // 2. Check MediaPipe/Human Analysis
        if (await fileExists(analysisFiles.mediapipe)) {
            const mediapipeData = JSON.parse(await fs.readFile(analysisFiles.mediapipe, 'utf8'));
            const humanPresence = mediapipeData.insights?.human_presence || 0;
            const expressions = mediapipeData.insights?.expression_variety || 0;
            
            console.log('2. Human/Expression Detection:');
            console.log(`   ✅ Human presence: ${(humanPresence * 100).toFixed(0)}%`);
            console.log(`   ✅ Expression variety: ${expressions}\n`);
        } else {
            console.log('2. Human/Expression Detection: ❌ Not found\n');
        }
        
        // 3. Check Whisper Transcription
        if (await fileExists(analysisFiles.whisper)) {
            const whisperData = JSON.parse(await fs.readFile(analysisFiles.whisper, 'utf8'));
            const wordCount = whisperData.wordCount || 0;
            const segments = whisperData.segments?.length || 0;
            
            console.log('3. Speech Transcription:');
            console.log(`   ✅ Word count: ${wordCount}`);
            console.log(`   ✅ Speech segments: ${segments}\n`);
        } else {
            console.log('3. Speech Transcription: ❌ Not found\n');
        }
        
        // 4. Check Unified Timeline
        if (await fileExists(analysisFiles.unified)) {
            const unifiedData = JSON.parse(await fs.readFile(analysisFiles.unified, 'utf8'));
            
            console.log('4. Unified Timeline:');
            console.log(`   ✅ Stickers in timeline: ${Object.keys(unifiedData.timelines?.stickerTimeline || {}).length}`);
            console.log(`   ✅ Text in timeline: ${Object.keys(unifiedData.timelines?.textOverlayTimeline || {}).length}`);
            console.log(`   ✅ Speech in timeline: ${Object.keys(unifiedData.timelines?.speechTimeline || {}).length}`);
            console.log(`   ✅ Scene changes: ${Object.keys(unifiedData.timelines?.sceneChangeTimeline || {}).length}`);
            console.log(`   ✅ Word count in metadata: ${unifiedData.metadata_summary?.wordCount || 0}`);
            console.log(`   ✅ Transcript present: ${!!unifiedData.metadata_summary?.transcript}\n`);
        } else {
            console.log('4. Unified Timeline: ❌ Not found\n');
        }
        
        console.log('✅ Verification complete!');
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    }
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Get URL from command line or use default
const url = process.argv[2] || 'https://www.tiktok.com/@nutsnmore/video/7489578000846048558';
verifyAnalysisFixes(url);