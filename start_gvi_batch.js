#!/usr/bin/env node

/**
 * Start GVI Analysis for multiple videos
 * Non-blocking - starts analysis and returns immediately
 */

const path = require('path');
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'wif-credential.json');

const { Storage } = require('@google-cloud/storage');
const videoIntelligence = require('@google-cloud/video-intelligence');
const fs = require('fs').promises;

async function startGVIBatch(videoIds) {
    const storage = new Storage();
    const bucket = storage.bucket('tiktok-video-analysis-jorge');
    const client = new videoIntelligence.VideoIntelligenceServiceClient();
    
    console.log('🚀 Starting GVI Analysis Batch');
    console.log('==============================');
    
    for (const videoId of videoIds) {
        try {
            const username = videoId.split('_')[0];
            const vidNum = videoId.split('_')[1];
            const videoPath = `downloads/videos/${username}/${vidNum}.mp4`;
            
            // Check if already analyzed
            const resultsPath = `downloads/analysis/${videoId}/google_video_intelligence.json`;
            try {
                await fs.access(resultsPath);
                console.log(`✓ ${videoId} - Already analyzed`);
                continue;
            } catch {}
            
            // Check if video exists
            try {
                const stats = await fs.stat(videoPath);
                console.log(`\n📹 ${videoId} - ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
            } catch {
                console.log(`✗ ${videoId} - Video not found`);
                continue;
            }
            
            // Check if already uploaded
            const gcsPath = `video-analysis/${videoId}/${vidNum}.mp4`;
            const gcsUri = `gs://${bucket.name}/${gcsPath}`;
            
            const [exists] = await bucket.file(gcsPath).exists();
            
            if (!exists) {
                console.log(`   Uploading...`);
                await bucket.upload(videoPath, {
                    destination: gcsPath,
                    metadata: { contentType: 'video/mp4' }
                });
                console.log(`   ✓ Uploaded`);
            } else {
                console.log(`   ✓ Already in GCS`);
            }
            
            // Start analysis
            console.log(`   Starting analysis...`);
            
            const request = {
                inputUri: gcsUri,
                features: [
                    'OBJECT_TRACKING',
                    'TEXT_DETECTION',
                    'SPEECH_TRANSCRIPTION',
                    'PERSON_DETECTION',
                    'SHOT_CHANGE_DETECTION'
                ],
                videoContext: {
                    speechTranscriptionConfig: {
                        languageCode: 'en-US',
                        enableAutomaticPunctuation: true
                    }
                }
            };
            
            const [operation] = await client.annotateVideo(request);
            console.log(`   ✓ Analysis started: ${operation.name}`);
            
            // Save operation info
            const operationPath = `downloads/analysis/${videoId}/gvi_operation.json`;
            await fs.mkdir(path.dirname(operationPath), { recursive: true });
            await fs.writeFile(operationPath, JSON.stringify({
                videoId,
                operationName: operation.name,
                startTime: new Date().toISOString(),
                gcsUri,
                status: 'analyzing'
            }, null, 2));
            
        } catch (error) {
            console.log(`✗ ${videoId} - Error: ${error.message}`);
        }
    }
    
    console.log('\n✅ All videos submitted for analysis');
    console.log('📊 Check status with: node check_gvi_results.js');
}

// Get all downloaded videos
async function getAllVideoIds() {
    const videoIds = [];
    const videosDir = 'downloads/videos';
    
    try {
        const users = await fs.readdir(videosDir);
        for (const user of users) {
            const userDir = path.join(videosDir, user);
            const stats = await fs.stat(userDir);
            if (stats.isDirectory()) {
                const videos = await fs.readdir(userDir);
                for (const video of videos) {
                    if (video.endsWith('.mp4')) {
                        const vidId = video.replace('.mp4', '');
                        videoIds.push(`${user}_${vidId}`);
                    }
                }
            }
        }
    } catch {}
    
    return videoIds;
}

// Run
if (require.main === module) {
    getAllVideoIds().then(videoIds => {
        console.log(`Found ${videoIds.length} videos`);
        return startGVIBatch(videoIds);
    }).catch(console.error);
}