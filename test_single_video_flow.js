#!/usr/bin/env node

/**
 * Single TikTok Video Analysis Flow
 * Optimized for analyzing one video at a time
 */

require('dotenv').config();

// Set Google Cloud credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'wif-credential.json');
const SingleVideoScraper = require('./server/services/TikTokSingleVideoScraper');
const VideoAnalysisService = require('./server/services/VideoAnalysisService');
const UnifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler');
const insightManager = require('./server/services/InsightManager');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');

// Get video URL from command line
const VIDEO_URL = process.argv[2];

async function extractVideoInfo(url) {
    const match = url.match(/@([^/]+)\/video\/(\d+)/);
    if (!match) throw new Error('Invalid TikTok URL format');
    return { username: match[1], videoId: match[2] };
}

async function downloadVideoFile(videoData, username, videoId) {
    const downloadUrl = videoData.videoMeta?.downloadAddr || videoData.mediaUrls?.[0];
    if (!downloadUrl) {
        console.error('❌ No video download URL available');
        return null;
    }

    try {
        // Create video directory
        const videoDir = path.join('downloads', 'videos', username);
        await fs.mkdir(videoDir, { recursive: true });
        
        const videoPath = path.join(videoDir, `${videoId}.mp4`);
        
        // Check if already downloaded
        try {
            const stats = await fs.stat(videoPath);
            if (stats.size > 0) {
                console.log('✅ Video already downloaded');
                return videoPath;
            }
        } catch {}
        
        // Download video
        console.log(`📥 Downloading from: ${downloadUrl}`);
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 120000, // 2 minute timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Save to file
        const writer = require('fs').createWriteStream(videoPath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        const stats = await fs.stat(videoPath);
        console.log(`✅ Video size: ${Math.round(stats.size / 1024 / 1024 * 10) / 10} MB`);
        
        return videoPath;
        
    } catch (error) {
        console.error('❌ Failed to download video:', error.message);
        return null;
    }
}

async function runLocalVideoAnalysis(videoPath, videoId) {
    console.log('\n🔬 Running complete local video analysis...');
    
    try {
        // Use the complete analysis script
        const analysisScriptPath = path.join(__dirname, 'services', 'complete_video_analysis.py');
        
        try {
            await fs.access(analysisScriptPath);
            console.log('🎯 Running comprehensive analysis:');
            console.log('   - YOLO object detection');
            console.log('   - MediaPipe pose/gesture detection');
            console.log('   - OCR text detection');
            console.log('   - Audio extraction');
            console.log('   - Speech transcription');
            
            const { stdout, stderr } = await execAsync(
                `python3 ${analysisScriptPath} "${videoPath}" "${videoId}"`,
                { 
                    maxBuffer: 50 * 1024 * 1024, // 50MB buffer
                    timeout: 300000 // 5 minute timeout
                }
            );
            
            if (stdout) {
                console.log(stdout);
            }
            
            if (stderr && !stderr.includes('Warning')) {
                console.log('⚠️ Analysis warnings:', stderr);
            }
            
            // Load complete analysis results
            const analysisResultPath = path.join('downloads', 'analysis', videoId, 'complete_analysis.json');
            try {
                const analysisData = await fs.readFile(analysisResultPath, 'utf8');
                return JSON.parse(analysisData);
            } catch (error) {
                console.log('⚠️ Could not load analysis results:', error.message);
                return null;
            }
            
        } catch (error) {
            console.log('⚠️ Complete analysis script not available:', error.message);
            console.log('   Falling back to basic analysis...');
            
            // Try basic analysis
            const basicScriptPath = path.join(__dirname, 'services', 'basic_video_analysis.py');
            try {
                const { stdout, stderr } = await execAsync(
                    `python3 ${basicScriptPath} "${videoPath}" "${videoId}"`,
                    { maxBuffer: 10 * 1024 * 1024 }
                );
                
                if (stdout) {
                    console.log(stdout);
                }
                
                // Load basic analysis results
                const basicResultPath = path.join('downloads', 'analysis', videoId, 'basic_analysis.json');
                const analysisData = await fs.readFile(basicResultPath, 'utf8');
                return JSON.parse(analysisData);
                
            } catch (basicError) {
                console.log('❌ Basic analysis also failed:', basicError.message);
                return null;
            }
        }
        
    } catch (error) {
        console.error('❌ Local analysis error:', error.message);
        return null;
    }
}

async function runSingleVideoFlow() {
    if (!VIDEO_URL || VIDEO_URL === '--help' || VIDEO_URL === '-h') {
        console.log('Usage: node test_single_video_flow.js <TikTok Video URL>');
        console.log('');
        console.log('Example:');
        console.log('  node test_single_video_flow.js https://www.tiktok.com/@username/video/1234567890');
        process.exit(0);
    }

    console.log('🚀 Starting Single Video Analysis Flow');
    console.log('=====================================');
    console.log(`📱 Video URL: ${VIDEO_URL}`);
    console.log('');

    try {
        // Step 1: Extract video info
        const { username, videoId } = await extractVideoInfo(VIDEO_URL);
        const fullVideoId = `${username}_${videoId}`;
        console.log(`✅ Username: @${username}`);
        console.log(`✅ Video ID: ${videoId}`);
        console.log(`✅ Full ID: ${fullVideoId}`);
        console.log('');

        // Step 2: Scrape single video with Apify
        console.log('📥 Step 2: Scraping video metadata from TikTok...');
        const videoData = await SingleVideoScraper.scrapeVideo(username, videoId);
        
        // Save metadata
        const metadataDir = path.join('outputs', 'tiktok_profiles');
        await fs.mkdir(metadataDir, { recursive: true }).catch(() => {
            // Try temp directory if outputs is not writable
            return fs.mkdir(path.join('temp', 'tiktok_profiles'), { recursive: true });
        });
        
        const metadataPath = path.join(
            (await fs.access(metadataDir).then(() => metadataDir).catch(() => 'temp/tiktok_profiles')),
            `${fullVideoId}_metadata.json`
        );
        await fs.writeFile(metadataPath, JSON.stringify(videoData, null, 2));
        console.log(`💾 Saved metadata to: ${metadataPath}`);
        console.log('');

        // Step 3: Download the actual video file
        console.log('\n📥 Step 3: Downloading video file...');
        const videoPath = await downloadVideoFile(videoData, username, videoId);
        
        if (!videoPath) {
            throw new Error('Failed to download video file');
        }
        console.log(`✅ Video downloaded to: ${videoPath}`);

        // Step 4: Upload video to GCS and run Google Video Intelligence API
        console.log('\n☁️ Step 4: Uploading video to Google Cloud Storage...');
        let analysisResult = null;
        
        try {
            // Upload video to GCS
            const gcsResult = await VideoAnalysisService.uploadToGCS(videoPath, fullVideoId);
            const gcsUri = gcsResult.gcsUri;
            console.log(`✅ Video uploaded to: ${gcsUri}`);
            
            console.log('\n🎥 Step 5: Running Google Video Intelligence API analysis...');
            // Run Video Intelligence API
            const gcsVideos = [{
                videoId: fullVideoId,
                gcsUri: gcsUri,
                localPath: videoPath
            }];
            
            const analysisResults = await VideoAnalysisService.runVideoIntelligenceAnalysis(gcsVideos);
            analysisResult = analysisResults[fullVideoId];
            
            if (analysisResult) {
                console.log('✅ Video analysis complete');
                console.log(`   - Objects detected: ${analysisResult.objectAnnotations?.length || 0}`);
                console.log(`   - Text detected: ${analysisResult.textAnnotations?.length || 0}`);
                console.log(`   - Speech transcribed: ${analysisResult.speechTranscriptions?.length || 0}`);
                console.log(`   - Scenes detected: ${analysisResult.shotAnnotations?.length || 0}`);
                
                // Save analysis results
                const analysisPath = path.join('downloads', 'analysis', fullVideoId, 'google_video_intelligence.json');
                await fs.mkdir(path.dirname(analysisPath), { recursive: true });
                await fs.writeFile(analysisPath, JSON.stringify(analysisResult, null, 2));
                console.log(`💾 Saved analysis to: ${analysisPath}`);
            }
        } catch (error) {
            console.error('❌ Video analysis failed:', error.message);
            // Continue with local analysis even if cloud analysis fails
        }

        // Step 6: Run local YOLO analysis
        console.log('\n🎯 Step 6: Running local YOLO analysis...');
        let localAnalysis = null;
        localAnalysis = await runLocalVideoAnalysis(videoPath, fullVideoId);

        // Step 7: Generate complete unified analysis with all timelines
        console.log('\n🔄 Step 7: Generating complete unified analysis with all timelines...');
        
        // Combine all analysis results
        const combinedAnalysis = {
            google_video_intelligence: analysisResult || {},
            local_analysis: localAnalysis || {},
            metadata: videoData
        };

        // Create comprehensive video info
        const videoInfo = {
            duration: videoData.videoMeta?.duration || 0,
            fps: 30, // Default FPS for TikTok
            width: videoData.videoMeta?.width || 0,
            height: videoData.videoMeta?.height || 0,
            format: videoData.videoMeta?.format || 'mp4'
        };
        
        // Generate unified timeline with all data
        const unifiedAnalysis = await UnifiedTimelineAssembler.assembleUnifiedTimeline(
            fullVideoId,
            combinedAnalysis,
            videoInfo
        );
        
        // Merge local analysis timelines if available
        if (localAnalysis && localAnalysis.timelines) {
            Object.assign(unifiedAnalysis.timelines, localAnalysis.timelines);
        }
        
        // Add speech transcription if available
        if (localAnalysis && localAnalysis.speech && localAnalysis.speech.transcribed) {
            unifiedAnalysis.timelines.speechTimeline = localAnalysis.speech.segments || {};
        }
        
        // Save unified analysis
        const unifiedPath = path.join('unified_analysis', `${fullVideoId}.json`);
        await fs.mkdir(path.dirname(unifiedPath), { recursive: true });
        await fs.writeFile(unifiedPath, JSON.stringify(unifiedAnalysis, null, 2));
        console.log(`💾 Saved unified analysis to: ${unifiedPath}`);

        // Step 8: Create insight folders
        console.log('\n📁 Step 8: Creating insight folders...');
        const folderResult = await insightManager.createInsightFolders(fullVideoId);
        
        if (folderResult.success) {
            console.log('✅ Insight folders created');
            console.log(`📂 Base folder: ${folderResult.videoDir}`);
        }

        // Step 9: Run Claude prompts if API key is available
        console.log('\n🤖 Step 9: Running Claude prompts...');
        
        const hasApiKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here';
        
        if (hasApiKey) {
            console.log('✅ Anthropic API key found');
            
            // Run a few key prompts
            const keyPrompts = ['hook_analysis', 'engagement_triggers', 'cta_alignment'];
            console.log(`📝 Running ${keyPrompts.length} key prompts: ${keyPrompts.join(', ')}`);
            
            try {
                // Run prompts using Python script
                const { stdout } = await execAsync(
                    `cd ${__dirname} && python3 run_video_prompts_batch.py ${fullVideoId} --prompts "7,5,3"`,
                    { env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } }
                );
                console.log(stdout);
            } catch (error) {
                console.log('⚠️  Could not run Claude prompts:', error.message);
                console.log('   You can run them manually later');
            }
        } else {
            console.log('⚠️  No Anthropic API key found');
            console.log('   Set ANTHROPIC_API_KEY environment variable to enable Claude analysis');
        }

        // Summary and final report
        console.log('\n✅ Complete video analysis pipeline finished!');
        console.log('');
        console.log('📊 Summary:');
        console.log(`   - Video: ${videoData.text || 'No description'}`);
        console.log(`   - Views: ${videoData.playCount?.toLocaleString() || 0}`);
        console.log(`   - Likes: ${videoData.diggCount?.toLocaleString() || 0}`);
        console.log(`   - Comments: ${videoData.commentCount?.toLocaleString() || 0}`);
        console.log(`   - Engagement Rate: ${((videoData.diggCount / videoData.playCount) * 100).toFixed(2)}%`);
        
        console.log('\n📂 Output files:');
        console.log(`   - Video: ${videoPath}`);
        console.log(`   - Metadata: ${metadataPath}`);
        console.log(`   - Unified Analysis: ${unifiedPath}`);
        if (analysisResult) {
            console.log(`   - Google Analysis: downloads/analysis/${fullVideoId}/google_video_intelligence.json`);
        }
        if (localAnalysis) {
            console.log(`   - YOLO Analysis: downloads/analysis/${fullVideoId}/yolo_results.json`);
        }
        
        console.log('\n📝 Next steps:');
        console.log(`1. Run all Claude prompts:`);
        console.log(`   python3 run_all_video_prompts.py ${fullVideoId}`);
        console.log('');
        console.log(`2. View results:`);
        console.log(`   python3 view_insight_results.py ${fullVideoId}`);
        console.log('');
        console.log(`3. Generate report:`);
        console.log(`   python3 generate_insight_report.py ${fullVideoId}`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the flow
runSingleVideoFlow().catch(console.error);