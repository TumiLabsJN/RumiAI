#!/usr/bin/env node

/**
 * RumiAI Complete Flow Test
 * Flow: TikTok URL → Apify → Download to GCS → Video Analysis → Local Processing
 */

require('dotenv').config();
const TikTokService = require('./server/services/TikTokService');
const VideoAnalysisService = require('./server/services/VideoAnalysisService');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs').promises;

// Get video URL from command line or use default
const TEST_VIDEO_URL = process.argv[2] || 'https://www.tiktok.com/@cristiano/video/7515739984452701457';

async function extractVideoInfo(url) {
    const match = url.match(/@([^/]+)\/video\/(\d+)/);
    if (!match) throw new Error('Invalid TikTok URL format');
    return { username: match[1], videoId: match[2] };
}

async function runCompleteFlow() {
    console.log('🚀 Starting RumiAI Complete Flow Test');
    console.log('===================================');
    console.log(`📱 Test Video: ${TEST_VIDEO_URL}`);
    console.log('');

    // Show usage if needed
    if (process.argv[2] === '--help' || process.argv[2] === '-h') {
        console.log('Usage: node test_rumiai_complete_flow.js [TikTok Video URL]');
        console.log('');
        console.log('Examples:');
        console.log('  node test_rumiai_complete_flow.js');
        console.log('  node test_rumiai_complete_flow.js https://www.tiktok.com/@cristiano/video/7515739984452701457');
        console.log('  node test_rumiai_complete_flow.js https://www.tiktok.com/@username/video/1234567890');
        process.exit(0);
    }

    try {
        // Step 1: Extract username from URL
        let { username, videoId } = await extractVideoInfo(TEST_VIDEO_URL);
        console.log(`✅ Extracted username: @${username}`);
        console.log(`✅ Video ID: ${videoId}`);
        console.log('');

        // Step 2: Use Apify to get video metadata (including download URL)
        console.log('📥 Step 2: Getting video data from Apify...');
        const profileData = await TikTokService.analyzeProfile(username);
        
        // Find our specific video in the results
        let targetVideo = profileData.allVideosAnalyzed.find(v => 
            v.url.includes(videoId) || v.id === videoId
        );

        if (!targetVideo) {
            console.log(`⚠️ Specific video ${videoId} not found in Apify results`);
            console.log(`📌 Using most recent video instead...`);
            
            // Use the first (most recent) video from the results
            targetVideo = profileData.allVideosAnalyzed[0];
            if (!targetVideo) {
                throw new Error('No videos found in Apify results');
            }
            
            // Update videoId to match the actual video we're processing
            const urlMatch = targetVideo.url.match(/video\/(\d+)/);
            if (urlMatch) {
                videoId = urlMatch[1];
            }
        }

        console.log('✅ Found video in Apify results:');
        console.log(`   - URL: ${targetVideo.url}`);
        console.log(`   - Download URL: ${targetVideo.downloadUrl}`);
        console.log(`   - Views: ${targetVideo.views}`);
        console.log(`   - Engagement Rate: ${targetVideo.engagementRate}%`);
        console.log('');

        // Step 3: Start async video analysis (downloads to GCS)
        console.log('☁️ Step 3: Starting async video analysis (uploads to GCS)...');
        const videos = [{
            url: targetVideo.url,
            downloadUrl: targetVideo.downloadUrl,
            engagementRate: targetVideo.engagementRate,
            id: targetVideo.id,
            views: targetVideo.views,
            likes: targetVideo.likes,
            comments: targetVideo.comments,
            shares: targetVideo.shares
        }];

        const analysisJob = await VideoAnalysisService.startVideoAnalysis(videos, username);
        console.log(`✅ Analysis job started: ${analysisJob.jobId}`);
        console.log('');

        // Step 4: Poll for job completion
        console.log('⏳ Step 4: Waiting for GCS upload and GVI analysis...');
        let jobStatus;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            jobStatus = VideoAnalysisService.getJobStatus(analysisJob.jobId);
            
            console.log(`   Status: ${jobStatus.status} - ${jobStatus.phase || 'Processing'}`);
            
            if (jobStatus.status === 'completed') {
                console.log('✅ Video analysis completed!');
                break;
            } else if (jobStatus.status === 'error') {
                throw new Error(`Analysis failed: ${jobStatus.error}`);
            }
            
            attempts++;
        }

        if (jobStatus.status !== 'completed') {
            throw new Error('Analysis timed out after 5 minutes');
        }

        // Extract GCS path from results
        const gcsPath = jobStatus.results?.videos?.[0]?.gcsUri;
        if (!gcsPath) {
            throw new Error('No GCS path found in results');
        }

        console.log(`✅ Video uploaded to GCS: ${gcsPath}`);
        console.log('');

        // Step 5: Download from GCS for local processing
        console.log('📥 Step 5: Downloading video from GCS for local processing...');
        
        // Create a unique filename for this test
        const localVideoPath = path.join(__dirname, 'inputs', `${username}_${videoId}.mp4`);
        await fs.mkdir(path.join(__dirname, 'inputs'), { recursive: true });

        // Use the download_from_gcs.js script
        const downloadScript = path.join(__dirname, 'download_from_gcs.js');
        const { stdout, stderr } = await execAsync(
            `node ${downloadScript} "${gcsPath}" "${localVideoPath}"`,
            { env: { ...process.env, NODE_NO_WARNINGS: '1' } }
        );

        if (stderr && !stderr.includes('DeprecationWarning')) {
            console.error('Download stderr:', stderr);
        }

        console.log('✅ Video downloaded to:', localVideoPath);
        
        // Verify file exists
        const stats = await fs.stat(localVideoPath);
        console.log(`✅ File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log('');

        // Step 6: Run local processing pipeline
        console.log('🔬 Step 6: Running local processing pipeline...');
        console.log('   - Frame extraction');
        console.log('   - YOLO object detection');
        console.log('   - Creative elements detection (OCR)');
        console.log('   - MediaPipe human detection');
        console.log('');

        // Activate virtual environment and run the integrated pipeline
        const pipelineScript = path.join(__dirname, 'integrated_full_pipeline.py');
        const { stdout: pipelineOut, stderr: pipelineErr } = await execAsync(
            `source venv/bin/activate && python ${pipelineScript} once`,
            { 
                shell: '/bin/bash',
                env: { 
                    ...process.env,
                    VIDEO_PATH: localVideoPath,
                    VIDEO_ID: `${username}_${videoId}`
                }
            }
        );

        if (pipelineErr) {
            console.error('Pipeline stderr:', pipelineErr);
        }

        console.log('Pipeline output:', pipelineOut);
        console.log('');

        // Step 7: Display results summary
        console.log('📊 Step 7: Results Summary');
        console.log('==========================');
        console.log('✅ Apify data retrieved');
        console.log('✅ Video uploaded to GCS');
        console.log('✅ Google Video Intelligence analysis completed');
        console.log('✅ Video downloaded from GCS');
        console.log('✅ Local pipeline processing completed');
        console.log('');
        console.log('📁 Check these directories for detailed results:');
        console.log(`   - inputs/${username}_${videoId}.mp4 (downloaded video)`);
        console.log(`   - frame_outputs/${username}_${videoId}/ (extracted frames)`);
        console.log(`   - object_detection_outputs/${username}_${videoId}/ (YOLO results)`);
        console.log(`   - creative_analysis_outputs/${username}_${videoId}/ (OCR results)`);
        console.log(`   - human_analysis_outputs/${username}_${videoId}/ (MediaPipe results)`);
        console.log(`   - comprehensive_analysis_outputs/ (final analysis)`);
        console.log('');

        // Return the complete flow results
        return {
            success: true,
            username,
            videoId,
            apifyData: targetVideo,
            gcsPath,
            localPath: localVideoPath,
            gviResults: jobStatus.results,
            message: 'Complete RumiAI flow executed successfully!'
        };

    } catch (error) {
        console.error('❌ Error in complete flow:', error.message);
        console.error('Stack:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run if called directly
if (require.main === module) {
    runCompleteFlow()
        .then(result => {
            console.log('🎉 Complete flow test finished!');
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { runCompleteFlow };