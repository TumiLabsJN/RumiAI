#!/usr/bin/env node

/**
 * Complete GVI Analysis Runner
 * Handles full Video Intelligence pipeline for any size video
 */

const path = require('path');
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'wif-credential.json');

const VideoAnalysisService = require('./server/services/VideoAnalysisService');
const fs = require('fs').promises;

async function runCompleteGVI(videoId) {
    const username = videoId.split('_')[0];
    const vidNum = videoId.split('_')[1];
    const videoPath = `downloads/videos/${username}/${vidNum}.mp4`;
    
    console.log('🎥 Google Video Intelligence Analysis - Complete Pipeline');
    console.log('========================================================');
    console.log(`📹 Video ID: ${videoId}`);
    console.log(`📂 Video Path: ${videoPath}`);
    
    try {
        // Check video exists
        const stats = await fs.stat(videoPath);
        console.log(`📊 Video Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log('');
        
        // Step 1: Upload to GCS
        console.log('☁️  Step 1: Uploading to Google Cloud Storage...');
        const startUpload = Date.now();
        
        const gcsUri = await VideoAnalysisService.uploadToGCS(videoPath, videoId);
        
        const uploadTime = (Date.now() - startUpload) / 1000;
        console.log(`✅ Upload complete in ${uploadTime.toFixed(1)}s`);
        console.log(`📍 GCS URI: ${gcsUri}`);
        console.log('');
        
        // Step 2: Start Video Intelligence Analysis
        console.log('🎬 Step 2: Starting Video Intelligence API analysis...');
        console.log('⚠️  This typically takes 1-3 minutes depending on video length');
        
        const startAnalysis = Date.now();
        
        // Call the analysis
        const gcsVideos = [{
            videoId: videoId,
            gcsUri: gcsUri,
            localPath: videoPath
        }];
        
        console.log('📊 Requesting analysis for:');
        console.log(`   - Object Tracking`);
        console.log(`   - Text Detection`);
        console.log(`   - Speech Transcription`);
        console.log(`   - Person Detection`);
        console.log(`   - Shot Detection`);
        console.log('');
        
        const analysisResults = await VideoAnalysisService.runVideoIntelligenceAnalysis(gcsVideos);
        const result = analysisResults[videoId];
        
        const analysisTime = (Date.now() - startAnalysis) / 1000;
        
        if (result) {
            console.log(`✅ Analysis complete in ${analysisTime.toFixed(1)}s!`);
            console.log('');
            console.log('📊 Results Summary:');
            console.log(`   - Objects detected: ${result.objectAnnotations?.length || 0}`);
            console.log(`   - Text detected: ${result.textAnnotations?.length || 0}`);
            console.log(`   - Speech segments: ${result.speechTranscriptions?.length || 0}`);
            console.log(`   - Shots detected: ${result.shotAnnotations?.length || 0}`);
            console.log(`   - Faces detected: ${result.faceAnnotations?.length || 0}`);
            console.log(`   - Persons detected: ${result.personAnnotations?.length || 0}`);
            
            // Save results
            const outputPath = `downloads/analysis/${videoId}/google_video_intelligence.json`;
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
            
            console.log('');
            console.log(`💾 Full results saved to: ${outputPath}`);
            
            // Show sample results
            if (result.objectAnnotations?.length > 0) {
                console.log('\n🎯 Top Objects Detected:');
                const topObjects = {};
                result.objectAnnotations.forEach(obj => {
                    const name = obj.entity?.description || 'Unknown';
                    topObjects[name] = (topObjects[name] || 0) + 1;
                });
                
                Object.entries(topObjects)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .forEach(([name, count]) => {
                        console.log(`   - ${name}: ${count} occurrences`);
                    });
            }
            
            if (result.speechTranscriptions?.length > 0) {
                console.log('\n🗣️ Speech Transcript:');
                const transcript = result.speechTranscriptions[0]?.alternatives?.[0]?.transcript;
                if (transcript) {
                    console.log(`   "${transcript.slice(0, 200)}${transcript.length > 200 ? '...' : ''}"`);
                }
            }
            
            // Update unified analysis
            console.log('\n🔄 Updating unified analysis...');
            await updateUnifiedWithGVI(videoId, result);
            
            console.log('\n✅ Complete GVI pipeline finished successfully!');
            console.log(`⏱️  Total time: ${((Date.now() - startUpload) / 1000).toFixed(1)}s`);
            
        } else {
            console.log('❌ Analysis failed - no results returned');
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.code === 401 || error.code === 403) {
            console.error('🔑 Authentication issue - check credentials');
        } else if (error.code === 3) {
            console.error('📍 Invalid argument - check GCS URI format');
        }
        throw error;
    }
}

async function updateUnifiedWithGVI(videoId, gviResults) {
    try {
        const unifiedPath = `unified_analysis/${videoId}.json`;
        const unified = JSON.parse(await fs.readFile(unifiedPath, 'utf8'));
        
        // Add GVI results to timelines
        if (gviResults.objectAnnotations) {
            unified.timelines.objectTimeline = processObjectAnnotations(gviResults.objectAnnotations);
        }
        
        if (gviResults.textAnnotations) {
            unified.timelines.textOverlayTimeline = processTextAnnotations(gviResults.textAnnotations);
        }
        
        if (gviResults.speechTranscriptions) {
            unified.timelines.speechTimeline = processSpeechTranscriptions(gviResults.speechTranscriptions);
        }
        
        unified.google_video_intelligence = {
            analyzed: true,
            timestamp: new Date().toISOString()
        };
        
        await fs.writeFile(unifiedPath, JSON.stringify(unified, null, 2));
        console.log('✅ Unified analysis updated with GVI results');
        
    } catch (error) {
        console.log('⚠️  Could not update unified analysis:', error.message);
    }
}

function processObjectAnnotations(annotations) {
    const timeline = {};
    annotations.forEach(ann => {
        ann.frames?.forEach(frame => {
            const time = frame.timeOffset?.seconds || 0;
            const timeKey = `${time}`;
            if (!timeline[timeKey]) timeline[timeKey] = [];
            timeline[timeKey].push({
                object: ann.entity?.description || 'unknown',
                confidence: ann.confidence || 0
            });
        });
    });
    return timeline;
}

function processTextAnnotations(annotations) {
    const timeline = {};
    annotations.forEach(ann => {
        ann.segments?.forEach(segment => {
            const time = segment.segment?.startTimeOffset?.seconds || 0;
            const timeKey = `${time}`;
            timeline[timeKey] = {
                text: ann.text || '',
                confidence: segment.confidence || 0
            };
        });
    });
    return timeline;
}

function processSpeechTranscriptions(transcriptions) {
    const timeline = {};
    transcriptions.forEach(trans => {
        trans.alternatives?.forEach(alt => {
            alt.words?.forEach(word => {
                const time = word.startTime?.seconds || 0;
                const timeKey = `${time}`;
                timeline[timeKey] = {
                    word: word.word || '',
                    confidence: alt.confidence || 0
                };
            });
        });
    });
    return timeline;
}

// Run if called directly
if (require.main === module) {
    const videoId = process.argv[2];
    if (!videoId) {
        console.log('Usage: node run_gvi_complete.js <video_id>');
        console.log('Example: node run_gvi_complete.js nutsnmore_7462841470299606318');
        process.exit(1);
    }
    
    runCompleteGVI(videoId).catch(error => {
        console.error('Failed:', error);
        process.exit(1);
    });
}

module.exports = { runCompleteGVI };