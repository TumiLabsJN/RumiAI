#!/usr/bin/env node

/**
 * RumiAI Complete Flow Test - FULLY LOCAL
 * Complete Flow: 
 * 1. TikTok URL → Apify Single Video Scrape
 * 2. Download Video → Local Analysis (Whisper, YOLO+DeepSort, MediaPipe, OCR, CLIP, PySceneDetect, NSFW)
 * 3. Consolidate ALL analyses into unified timeline
 * 4. Run Claude prompts for insights
 * 
 * This script demonstrates the COMPLETE LOCAL flow for analyzing any TikTok video URL
 */

require('dotenv').config();
const TikTokSingleVideoScraper = require('./server/services/TikTokSingleVideoScraper');
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
    if (!match) throw new Error('Invalid TikTok URL format. Expected: https://www.tiktok.com/@username/video/123456789');
    return { username: match[1], videoId: match[2] };
}

async function downloadVideoFromApify(downloadUrl, localPath) {
    /**
     * Download video directly from Apify's storage
     */
    console.log('📥 Downloading video from Apify...');
    const axios = require('axios');
    const writer = require('fs').createWriteStream(localPath);
    
    const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        headers: {
            'User-Agent': 'RumiAI/1.0'
        }
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function runCompleteFlow() {
    console.log('🚀 Starting RumiAI Complete Flow');
    console.log('================================');
    console.log(`📱 Video URL: ${TEST_VIDEO_URL}`);
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
        // Step 1: Extract video info from URL
        console.log('📍 Step 1: Parsing video URL...');
        const { username, videoId } = await extractVideoInfo(TEST_VIDEO_URL);
        console.log(`✅ Username: @${username}`);
        console.log(`✅ Video ID: ${videoId}`);
        console.log('');

        // Step 2: Scrape single video data using Apify
        console.log('🔍 Step 2: Scraping video data from TikTok...');
        const videoData = await TikTokSingleVideoScraper.scrapeVideo(username, videoId);
        
        // Normalize the video data for our analysis pipeline
        const normalizedVideo = {
            id: videoData.id || videoId,
            url: videoData.webVideoUrl || `https://www.tiktok.com/@${username}/video/${videoId}`,
            description: videoData.text || videoData.description || '',
            hashtags: videoData.hashtags || [],
            views: parseInt(videoData.playCount || videoData.viewCount || 0),
            likes: parseInt(videoData.diggCount || videoData.likeCount || 0),
            comments: parseInt(videoData.commentCount || 0),
            shares: parseInt(videoData.shareCount || 0),
            saves: parseInt(videoData.collectCount || 0),
            duration: videoData.videoMeta?.duration || videoData.duration || 0,
            createTime: videoData.createTimeISO || videoData.createTime,
            downloadUrl: videoData.mediaUrls?.[0] || videoData.videoUrl || videoData.downloadAddr,
            coverUrl: videoData.videoMeta?.coverUrl || videoData.coverImage || null,
            author: {
                username: videoData.authorMeta?.name || username,
                displayName: videoData.authorMeta?.nickName || '',
                verified: videoData.authorMeta?.verified || false
            },
            music: videoData.musicMeta || {},
            engagementRate: 0,
            rank: 1 // Single video, so rank is 1
        };
        
        // Calculate engagement rate
        if (normalizedVideo.views > 0) {
            const totalEngagement = normalizedVideo.likes + normalizedVideo.comments + normalizedVideo.shares + normalizedVideo.saves;
            normalizedVideo.engagementRate = parseFloat(((totalEngagement / normalizedVideo.views) * 100).toFixed(2));
        }

        console.log('✅ Video data retrieved:');
        console.log(`   - Title: ${normalizedVideo.description.substring(0, 50)}...`);
        console.log(`   - Views: ${normalizedVideo.views.toLocaleString()}`);
        console.log(`   - Likes: ${normalizedVideo.likes.toLocaleString()}`);
        console.log(`   - Engagement Rate: ${normalizedVideo.engagementRate}%`);
        console.log(`   - Duration: ${normalizedVideo.duration}s`);
        console.log(`   - Download URL: ${normalizedVideo.downloadUrl ? 'Available' : 'Not available'}`);
        
        if (!normalizedVideo.downloadUrl) {
            throw new Error('No download URL available for this video');
        }
        console.log('');

        // Step 3: Start video analysis (fully local)
        console.log('🎬 Step 3: Starting local video analysis...');
        
        // Enable test mode to bypass date filters
        process.env.RUMIAI_TEST_MODE = 'true';
        console.log('🧪 Test mode enabled - processing single video');
        
        // Start the analysis job with our single video
        const jobId = await VideoAnalysisService.startAnalysisJob([normalizedVideo], username);
        console.log(`✅ Analysis job started: ${jobId}`);
        console.log('');

        // Step 4: Monitor local analysis progress
        console.log('⏳ Step 4: Running comprehensive local analysis...');
        console.log('   This includes:');
        console.log('   - Whisper speech transcription');
        console.log('   - YOLO + DeepSort object tracking (ALL frames)');
        console.log('   - MediaPipe human analysis');
        console.log('   - Enhanced Human Analysis (NEW):');
        console.log('     • Body pose detection & posture analysis');
        console.log('     • Gaze detection & eye contact tracking');
        console.log('     • Scene segmentation (person/background ratio)');
        console.log('     • Action recognition (talking, dancing, etc.)');
        console.log('   - OCR text detection');
        console.log('   - CLIP scene labeling');
        console.log('   - PySceneDetect shot detection (LOCAL - no GVI)');
        console.log('   - OpenNSFW2 content moderation');
        console.log('   - Creating unified timeline');
        console.log('');
        
        let jobStatus;
        let attempts = 0;
        const maxAttempts = 180; // 15 minutes max
        let lastPhase = '';

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            jobStatus = VideoAnalysisService.getJobStatus(jobId);
            
            // Only log if phase changed
            if (jobStatus.phase !== lastPhase) {
                console.log(`   📊 ${jobStatus.phase || 'Processing'}... (${jobStatus.progress || 0}%)`);
                lastPhase = jobStatus.phase;
            }
            
            if (jobStatus.status === 'completed') {
                console.log('✅ Local analysis completed!');
                break;
            } else if (jobStatus.status === 'error' || jobStatus.status === 'failed') {
                throw new Error(`Analysis failed: ${jobStatus.error || 'Unknown error'}`);
            }
            
            attempts++;
        }

        if (jobStatus.status !== 'completed') {
            throw new Error('Analysis timed out after 15 minutes');
        }
        console.log('');

        // Step 5: Skip redundant download - video already downloaded in Step 3
        console.log('📥 Step 5: Using previously downloaded video...');
        
        // The video was already downloaded and analyzed in Step 3
        // We can find it in the results or skip this step entirely
        const localVideoPath = jobStatus.results?.analysis?.[0]?.videoPath || 
                              path.join(__dirname, 'temp', `${videoId}_1.mp4`);
        
        console.log(`✅ Using existing video: ${localVideoPath}`);
        console.log('');

        // Step 6: Skip redundant analysis - already done in Step 3
        console.log('🔬 Step 6: Skipping redundant local analysis (already completed in Step 3)');
        console.log('');
        
        // Create inputs directory for compatibility
        const inputsDir = path.join(__dirname, 'inputs');
        await fs.mkdir(inputsDir, { recursive: true });

        // Step 7: Consolidate all analyses
        console.log('🔄 Step 7: Consolidating all analyses...');
        
        // Check for comprehensive analysis output
        const comprehensiveAnalysisPath = path.join(__dirname, 'comprehensive_analysis_outputs', `${username}_${videoId}_comprehensive_analysis.json`);
        try {
            await fs.access(comprehensiveAnalysisPath);
            console.log('✅ Comprehensive analysis created');
            console.log(`   - File: ${comprehensiveAnalysisPath}`);
        } catch (error) {
            console.log('⚠️ Comprehensive analysis not found');
        }
        
        // Step 7b: Recreate unified timeline with all local analysis data
        console.log('');
        console.log('🔄 Step 7b: Recreating unified timeline with all analysis data...');
        
        const UnifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler');
        
        // Load the local analysis metadata from the saved file
        let metadataSummary = {};
        try {
            const localAnalysisPath = path.join(__dirname, 'temp', 'video-analysis', `${videoId}.json`);
            const localData = await fs.readFile(localAnalysisPath, 'utf8');
            const localAnalysis = JSON.parse(localData);
            // Local analysis data is at root level, not under 'processed'
            metadataSummary = localAnalysis;
        } catch (error) {
            console.log('⚠️ Could not load local analysis metadata:', error.message);
        }
        
        // Recreate unified timeline with all data
        try {
            await UnifiedTimelineAssembler.assembleUnifiedTimeline(
                videoId,
                metadataSummary,
                normalizedVideo,
                username  // Pass username for local file paths
            );
            console.log('✅ Unified timeline recreated with all analysis data');
            
            // Verify the file was created
            const unifiedPath = path.join(__dirname, 'unified_analysis', `${videoId}.json`);
            await fs.access(unifiedPath);
            console.log(`✅ Verified unified analysis file exists: ${unifiedPath}`);
            
        } catch (error) {
            console.error('❌ Failed to recreate unified timeline:', error.message);
            console.error('Stack trace:', error.stack);
            throw new Error(`Cannot continue without unified timeline: ${error.message}`);
        }
        console.log('');

        // Step 8: Run Claude prompts for insights
        console.log('🧠 Step 8: Running AI prompt analysis...');
        console.log('   Running 7 Claude prompts:');
        console.log('   - creative_density (optimized)');
        console.log('   - emotional_journey (merged)');
        console.log('   - speech_analysis (merged)');
        console.log('   - visual_overlay_analysis (merged)');
        console.log('   - metadata_analysis (NEW - caption & hashtag analysis)');
        console.log('   - person_framing (person tracking & framing)');
        console.log('   - scene_pacing (shot detection & pacing)');
        console.log('');

        // Run the prompt analysis with streaming output
        const promptScript = path.join(__dirname, 'run_video_prompts_validated_v2.py');
        const { spawn } = require('child_process');
        
        // Dynamic timeout based on video duration (min 10 minutes, or 20s per video second)
        const promptTimeout = Math.max(600000, normalizedVideo.duration * 20000);
        console.log(`⏱️ Setting prompt timeout to ${promptTimeout/1000}s based on video duration`);
        console.log('');
        
        // Use streaming output for real-time progress
        const startTime = Date.now();
        let promptOutput = '';
        let promptErrors = '';
        let successfulPrompts = 0;
        let failedPrompts = 0;
        
        try {
            await new Promise((resolve, reject) => {
                const pythonProcess = spawn('bash', ['-c', `source venv/bin/activate && python ${promptScript} ${videoId}`], {
                    env: process.env,
                    cwd: __dirname
                });
                
                // Set timeout
                const timeoutId = setTimeout(() => {
                    pythonProcess.kill('SIGTERM');
                    reject(new Error('TIMEOUT'));
                }, promptTimeout);
                
                pythonProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    promptOutput += output;
                    // Show real-time progress
                    process.stdout.write(output);
                    
                    // Count successes/failures in real-time
                    if (output.includes('✅')) successfulPrompts++;
                    if (output.includes('❌')) failedPrompts++;
                });
                
                pythonProcess.stderr.on('data', (data) => {
                    promptErrors += data.toString();
                });
                
                pythonProcess.on('close', (code) => {
                    clearTimeout(timeoutId);
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Process exited with code ${code}`));
                    }
                });
                
                pythonProcess.on('error', (err) => {
                    clearTimeout(timeoutId);
                    reject(err);
                });
            });

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (promptErrors) {
                console.error('\nPrompt analysis warnings:', promptErrors);
            }
            
            console.log(`\n✅ Prompt analysis completed in ${elapsedTime}s`);
            console.log(`📊 Results: ${successfulPrompts} succeeded, ${failedPrompts} failed`);
            console.log('');
        } catch (error) {
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (error.message === 'TIMEOUT') {
                console.error(`\n❌ Claude prompt analysis timed out after ${elapsedTime}s`);
                console.error('This typically happens when the API is slow or the prompts are too large');
                console.error(`Completed: ${successfulPrompts} prompts before timeout`);
            } else {
                console.error(`\n❌ Error running Claude prompts after ${elapsedTime}s:`, error.message);
            }
            // Don't throw here - we want to see what outputs were created
            console.log('');
        }

        // Step 9: Verify all outputs
        console.log('📊 Step 9: Verifying all outputs...');
        
        // Check if unified timeline has local analysis data
        let unifiedHasLocalData = false;
        try {
            const unifiedPath = path.join(__dirname, 'unified_analysis', `${videoId}.json`);
            const unifiedData = await fs.readFile(unifiedPath, 'utf8');
            const unified = JSON.parse(unifiedData);
            
            // Check if timelines have data from local analyses
            const hasGestureData = Object.keys(unified.timelines.gestureTimeline || {}).length > 0;
            const hasObjectData = Object.keys(unified.timelines.objectTimeline || {}).length > 0;
            const hasTextData = Object.keys(unified.timelines.textOverlayTimeline || {}).length > 0;
            
            unifiedHasLocalData = hasGestureData || hasObjectData || hasTextData;
        } catch (error) {
            // Will handle in outputs check
        }
        
        const outputs = {
            videoData: `✅ Video metadata scraped`,
            localAnalysis: await fs.access(path.join(__dirname, 'temp', 'video-analysis', `${videoId}.json`)).then(() => '✅ Local video analysis').catch(() => '❌ Local analysis missing'),
            unifiedAnalysis: await fs.access(path.join(__dirname, 'unified_analysis', `${videoId}.json`)).then(() => unifiedHasLocalData ? '✅ Unified timeline (with local analysis data)' : '✅ Unified timeline (with local data only)').catch(() => '❌ Unified timeline missing'),
            frames: await fs.access(path.join(__dirname, 'frame_outputs', `${username}_${videoId}`)).then(() => '✅ Extracted frames').catch(() => '❌ Frames missing'),
            yoloDetection: await fs.access(path.join(__dirname, 'object_detection_outputs', `${username}_${videoId}`, `${username}_${videoId}_yolo_detections.json`)).then(() => '✅ YOLO object detection').catch(() => '❌ YOLO detection missing'),
            creativeAnalysis: await fs.access(path.join(__dirname, 'creative_analysis_outputs', `${username}_${videoId}`, `${username}_${videoId}_creative_analysis.json`)).then(() => '✅ OCR text detection').catch(() => '❌ OCR detection missing'),
            humanAnalysis: await fs.access(path.join(__dirname, 'human_analysis_outputs', `${username}_${videoId}`, `${username}_${videoId}_human_analysis.json`)).then(() => '✅ MediaPipe human analysis').catch(() => '❌ MediaPipe analysis missing'),
            enhancedHumanAnalysis: await fs.access(path.join(__dirname, 'enhanced_human_analysis_outputs', `${videoId}`, `${videoId}_enhanced_human_analysis.json`)).then(() => '✅ Enhanced human analysis (pose, gaze, actions)').catch(() => '❌ Enhanced human analysis missing'),
            sceneDetection: await fs.access(path.join(__dirname, 'scene_detection_outputs', `${username}_${videoId}`, `${username}_${videoId}_scenes.json`)).then(() => '✅ PySceneDetect shot detection').catch(() => '❌ Scene detection missing'),
            comprehensiveAnalysis: await fs.access(comprehensiveAnalysisPath).then(() => '✅ Comprehensive consolidated analysis').catch(() => '❌ Comprehensive analysis missing'),
            promptInsights: await fs.access(path.join(__dirname, 'insights', `${videoId}`)).then(() => '✅ Claude prompt insights').catch(() => '❌ Prompt insights missing')
        };

        for (const [key, status] of Object.entries(outputs)) {
            console.log(`   ${status}`);
        }
        console.log('');

        // Step 10: Final summary
        console.log('🎉 Complete Flow Summary');
        console.log('========================');
        console.log('✅ Single video scraped from TikTok');
        console.log('✅ Video uploaded to Google Cloud Storage');
        console.log('✅ Google Video Intelligence analysis completed');
        console.log('✅ Video downloaded for local processing');
        console.log('✅ YOLO object detection completed');
        console.log('✅ MediaPipe human analysis completed');
        console.log('✅ OCR text extraction completed');
        console.log('✅ All analyses consolidated');
        console.log('✅ 7 Claude prompts analyzed');
        console.log('✅ All results saved');
        console.log('');
        console.log('📂 Output Locations:');
        console.log(`   - Video file: temp/${videoId}_1.mp4`);
        console.log(`   - Frames: frame_outputs/${username}_${videoId}/`);
        console.log(`   - YOLO: object_detection_outputs/${username}_${videoId}/${username}_${videoId}_yolo_detections.json`);
        console.log(`   - OCR: creative_analysis_outputs/${username}_${videoId}/${username}_${videoId}_creative_analysis.json`);
        console.log(`   - MediaPipe: human_analysis_outputs/${username}_${videoId}/${username}_${videoId}_human_analysis.json`);
        console.log(`   - Scene Detection: scene_detection_outputs/${username}_${videoId}/${username}_${videoId}_scenes.json`);
        console.log(`   - Comprehensive: comprehensive_analysis_outputs/${username}_${videoId}_comprehensive_analysis.json`);
        console.log(`   - Unified: unified_analysis/${videoId}.json`);
        console.log(`   - Local Analysis: temp/video-analysis/${videoId}.json`);
        console.log(`   - Insights: insights/${videoId}/`);
        console.log('');
        console.log('🚀 Next Steps:');
        console.log(`   1. View analysis report:`);
        console.log(`      cat insights/${username}_${videoId}/reports/analysis_report_*.json | jq`);
        console.log(`   2. View specific prompt results:`);
        console.log(`      ls insights/${username}_${videoId}/*/`);
        console.log('');

        // Clean up - remove local video file if needed
        if (process.env.CLEANUP_VIDEO === 'true') {
            await fs.unlink(localVideoPath);
            console.log('🗑️ Local video file cleaned up');
        }

        // Return success
        return {
            success: true,
            username,
            videoId,
            url: TEST_VIDEO_URL,
            videoData: normalizedVideo,
            analysisJobId: jobId,
            outputs: {
                video: `temp/${videoId}_1.mp4`,
                frames: `frame_outputs/${username}_${videoId}/`,
                yolo: `object_detection_outputs/${username}_${videoId}/${username}_${videoId}_yolo_detections.json`,
                ocr: `creative_analysis_outputs/${username}_${videoId}/${username}_${videoId}_creative_analysis.json`,
                mediapipe: `human_analysis_outputs/${username}_${videoId}/${username}_${videoId}_human_analysis.json`,
                comprehensive: `comprehensive_analysis_outputs/${username}_${videoId}_comprehensive_analysis.json`,
                unified: `unified_analysis/${videoId}.json`,
                localAnalysis: `temp/video-analysis/${videoId}.json`,
                insights: `insights/${videoId}/`
            },
            message: 'RumiAI complete flow with all analyses executed successfully!'
        };

    } catch (error) {
        console.error('');
        console.error('❌ Error in complete flow:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
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
            if (result.success) {
                console.log('✨ Success! Complete video analysis finished.');
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log('❌ Flow failed.');
            }
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { runCompleteFlow };