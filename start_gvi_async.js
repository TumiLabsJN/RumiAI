#!/usr/bin/env node

/**
 * Start GVI analysis asynchronously
 * Returns immediately after starting the upload
 */

const path = require('path');
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'wif-credential.json');

const { Storage } = require('@google-cloud/storage');
const videoIntelligence = require('@google-cloud/video-intelligence');
const fs = require('fs').promises;

async function startGVIAsync(videoId) {
    const username = videoId.split('_')[0];
    const vidNum = videoId.split('_')[1];
    const videoPath = `downloads/videos/${username}/${vidNum}.mp4`;
    
    console.log(`🚀 Starting async GVI analysis for ${videoId}`);
    
    try {
        // Initialize clients
        const storage = new Storage();
        const bucket = storage.bucket('tiktok-video-analysis-jorge');
        const client = new videoIntelligence.VideoIntelligenceServiceClient();
        
        // Upload to GCS in background
        const gcsPath = `video-analysis/${videoId}/${vidNum}.mp4`;
        console.log(`📤 Starting upload to gs://${bucket.name}/${gcsPath}`);
        
        // Start upload (don't await)
        bucket.upload(videoPath, {
            destination: gcsPath,
            metadata: { contentType: 'video/mp4' }
        }).then(() => {
            console.log(`✅ Upload complete: ${gcsPath}`);
            
            // Start Video Intelligence analysis
            const gcsUri = `gs://${bucket.name}/${gcsPath}`;
            return analyzeVideo(gcsUri, videoId);
        }).catch(err => {
            console.error(`❌ Upload failed: ${err.message}`);
        });
        
        console.log(`✅ Upload started in background`);
        console.log(`📊 Check status with: node check_gvi_status.js ${videoId}`);
        
        // Save status
        const statusPath = `downloads/analysis/${videoId}/gvi_status.json`;
        await fs.mkdir(path.dirname(statusPath), { recursive: true });
        await fs.writeFile(statusPath, JSON.stringify({
            status: 'uploading',
            startTime: new Date().toISOString(),
            videoId,
            videoPath,
            gcsPath: `gs://${bucket.name}/${gcsPath}`
        }, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function analyzeVideo(gcsUri, videoId) {
    console.log(`🎥 Starting Video Intelligence analysis for ${gcsUri}`);
    
    const client = new videoIntelligence.VideoIntelligenceServiceClient();
    
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
    
    // Start analysis (long-running operation)
    const [operation] = await client.annotateVideo(request);
    
    // Save operation name
    const statusPath = `downloads/analysis/${videoId}/gvi_status.json`;
    const status = JSON.parse(await fs.readFile(statusPath, 'utf8'));
    status.status = 'analyzing';
    status.operationName = operation.name;
    await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
    
    console.log(`📊 Analysis started: ${operation.name}`);
    
    // Check results periodically
    operation.promise().then(async ([response]) => {
        console.log(`✅ Analysis complete for ${videoId}`);
        
        // Save results
        const resultsPath = `downloads/analysis/${videoId}/google_video_intelligence.json`;
        await fs.writeFile(resultsPath, JSON.stringify(response.annotationResults[0], null, 2));
        
        // Update status
        status.status = 'completed';
        status.completedTime = new Date().toISOString();
        await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
        
    }).catch(async err => {
        console.error(`❌ Analysis failed: ${err.message}`);
        status.status = 'failed';
        status.error = err.message;
        await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
    });
}

// Run if called directly
if (require.main === module) {
    const videoId = process.argv[2] || 'latstrisomeprotein_7197152431958986026';
    startGVIAsync(videoId);
}

module.exports = { startGVIAsync };