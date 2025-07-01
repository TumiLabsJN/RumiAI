#!/usr/bin/env node

/**
 * Test Google Video Intelligence API
 */

const path = require('path');
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'wif-credential.json');

const VideoAnalysisService = require('./server/services/VideoAnalysisService');
const fs = require('fs').promises;

async function testGVI() {
    const videoPath = 'downloads/videos/nutsnmore/7462841470299606318.mp4';
    const videoId = 'nutsnmore_7462841470299606318';
    
    console.log('🎥 Testing Google Video Intelligence API');
    console.log(`📹 Video: ${videoPath}`);
    console.log('');
    
    try {
        // Step 1: Upload to GCS
        console.log('☁️ Step 1: Uploading to Google Cloud Storage...');
        const uploadResult = await VideoAnalysisService.uploadToGCS(videoPath, videoId);
        console.log(`✅ Uploaded to: ${uploadResult.gcsUri || uploadResult}`);
        console.log('');
        
        // Step 2: Run Video Intelligence Analysis
        console.log('🎥 Step 2: Running Video Intelligence API analysis...');
        const gcsUri = uploadResult; // uploadToGCS returns the URI directly
        const gcsVideos = [{
            videoId: videoId,
            gcsUri: gcsUri,
            localPath: videoPath
        }];
        
        const analysisResults = await VideoAnalysisService.runVideoIntelligenceAnalysis(gcsVideos);
        const result = analysisResults[videoId];
        
        if (result) {
            console.log('✅ Analysis complete!');
            console.log(`   - Objects detected: ${result.objectAnnotations?.length || 0}`);
            console.log(`   - Text detected: ${result.textAnnotations?.length || 0}`);
            console.log(`   - Speech transcribed: ${result.speechTranscriptions?.length || 0}`);
            console.log(`   - Shots detected: ${result.shotAnnotations?.length || 0}`);
            console.log(`   - Faces detected: ${result.faceAnnotations?.length || 0}`);
            console.log(`   - Person detected: ${result.personAnnotations?.length || 0}`);
            
            // Save results
            const outputPath = `downloads/analysis/${videoId}/google_video_intelligence.json`;
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
            console.log(`\n💾 Results saved to: ${outputPath}`);
            
            // Sample some results
            if (result.objectAnnotations?.length > 0) {
                console.log('\n🎯 Sample objects detected:');
                result.objectAnnotations.slice(0, 5).forEach(obj => {
                    console.log(`   - ${obj.entity?.description || 'Unknown'} (confidence: ${(obj.confidence * 100).toFixed(1)}%)`);
                });
            }
            
            if (result.speechTranscriptions?.length > 0) {
                console.log('\n🗣️ Speech transcript preview:');
                const transcript = result.speechTranscriptions[0]?.alternatives?.[0]?.transcript;
                if (transcript) {
                    console.log(`   "${transcript.slice(0, 200)}${transcript.length > 200 ? '...' : ''}"`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

testGVI().catch(console.error);