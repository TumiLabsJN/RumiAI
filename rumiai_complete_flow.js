#!/usr/bin/env node

/**
 * RumiAI Complete Dynamic Video Analysis Flow
 * 
 * Usage: node rumiai_complete_flow.js <TikTok Video URL>
 * 
 * Complete pipeline:
 * 1. Scrape video metadata from TikTok
 * 2. Download video file
 * 3. Upload to Google Cloud Storage
 * 4. Run Google Video Intelligence API
 * 5. Run local YOLO/MediaPipe/OCR analysis
 * 6. Generate unified timeline
 * 7. Run Claude prompts
 * 8. Generate reports
 */

require('dotenv').config();

// Set Google Cloud credentials
const path = require('path');
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'wif-credential.json');

const SingleVideoScraper = require('./server/services/TikTokSingleVideoScraper');
const UnifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler');
const insightManager = require('./server/services/InsightManager');
const fs = require('fs').promises;
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

async function runCompleteFlow() {
    if (!VIDEO_URL || VIDEO_URL === '--help' || VIDEO_URL === '-h') {
        console.log('Usage: node rumiai_complete_flow.js <TikTok Video URL>');
        console.log('');
        console.log('Example:');
        console.log('  node rumiai_complete_flow.js https://www.tiktok.com/@username/video/1234567890');
        process.exit(0);
    }

    console.log('🚀 RumiAI Complete Video Analysis Flow');
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
        console.log('📥 Step 3: Downloading video file...');
        const videoPath = await downloadVideoFile(videoData, username, videoId);
        
        if (!videoPath) {
            throw new Error('Failed to download video file');
        }
        console.log(`✅ Video downloaded to: ${videoPath}`);

        // Step 4: Start asynchronous GVI analysis
        console.log('\n☁️ Step 4: Starting Google Video Intelligence analysis...');
        console.log('   This runs asynchronously in the background');
        
        try {
            // Use the batch GVI starter script
            const { stdout } = await execAsync(
                `node start_gvi_batch.js ${fullVideoId}`,
                { env: process.env }
            );
            console.log(stdout);
        } catch (error) {
            console.log('⚠️  GVI analysis start failed:', error.message);
        }

        // Step 5: Run local video analysis
        console.log('\n🔬 Step 5: Running local video analysis...');
        console.log('   - Frame extraction');
        console.log('   - YOLO object detection');
        console.log('   - OCR text detection');
        console.log('   - Audio extraction');
        
        try {
            // Create analysis directory
            const analysisDir = path.join('downloads', 'analysis', fullVideoId);
            await fs.mkdir(analysisDir, { recursive: true });
            
            // Run basic analysis first
            const { stdout } = await execAsync(
                `python3 services/basic_video_analysis.py "${videoPath}" "${fullVideoId}"`,
                { 
                    maxBuffer: 10 * 1024 * 1024,
                    timeout: 180000 // 3 minute timeout
                }
            );
            console.log(stdout);
            
        } catch (error) {
            console.log('⚠️  Local analysis warning:', error.message);
        }

        // Step 6: Generate initial unified analysis
        console.log('\n🔄 Step 6: Generating unified analysis...');
        
        // Prepare video info
        const videoInfo = {
            duration: videoData.videoMeta?.duration || 0,
            fps: 30, // Default FPS for TikTok
            width: videoData.videoMeta?.width || 0,
            height: videoData.videoMeta?.height || 0,
            format: videoData.videoMeta?.format || 'mp4'
        };
        
        // Generate unified timeline
        const unifiedAnalysis = await UnifiedTimelineAssembler.assembleUnifiedTimeline(
            fullVideoId,
            { metadata: videoData },
            videoInfo
        );
        
        // Save unified analysis
        const unifiedPath = path.join('unified_analysis', `${fullVideoId}.json`);
        await fs.mkdir(path.dirname(unifiedPath), { recursive: true });
        await fs.writeFile(unifiedPath, JSON.stringify(unifiedAnalysis, null, 2));
        console.log(`💾 Saved unified analysis to: ${unifiedPath}`);

        // Step 7: Update unified analysis with all data sources
        console.log('\n🔄 Step 7: Updating unified analysis with all data sources...');
        
        try {
            const { stdout } = await execAsync(
                `python3 update_unified_analysis.py ${fullVideoId}`,
                { env: process.env }
            );
            console.log(stdout);
        } catch (error) {
            console.log('⚠️  Update warning:', error.message);
        }

        // Step 8: Create insight folders and metadata
        console.log('\n📁 Step 8: Creating insight folders...');
        const folderResult = await insightManager.createInsightFolders(fullVideoId);
        
        if (folderResult.success) {
            console.log('✅ Insight folders created');
            console.log(`📂 Base folder: ${folderResult.videoDir}`);
        }

        // Step 9: Check GVI status and update if ready
        console.log('\n⏳ Step 9: Checking Google Video Intelligence status...');
        
        let gviComplete = false;
        let attempts = 0;
        const maxAttempts = 20; // ~100 seconds
        
        while (!gviComplete && attempts < maxAttempts) {
            try {
                const { stdout } = await execAsync(`node check_gvi_results.js | grep "${fullVideoId}"`);
                if (stdout.includes('Completed')) {
                    gviComplete = true;
                    console.log('✅ GVI analysis complete!');
                    
                    // Update unified analysis with GVI data
                    await execAsync(`python3 update_unified_analysis.py ${fullVideoId}`);
                    console.log('✅ Updated unified analysis with GVI data');
                    break;
                }
            } catch {}
            
            if (!gviComplete) {
                process.stdout.write(`\r⏳ Waiting for GVI... (${attempts * 5}s)`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;
            }
        }
        
        if (!gviComplete) {
            console.log('\n⚠️  GVI analysis still processing - continue checking later');
        }

        // Step 10: Run Claude prompts
        console.log('\n🤖 Step 10: Running Claude prompts...');
        
        const hasApiKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here';
        
        if (hasApiKey) {
            console.log('✅ Anthropic API key found');
            
            try {
                // Run all prompts
                const { stdout } = await execAsync(
                    `cd ${__dirname} && source .env && export ANTHROPIC_API_KEY && python3 run_all_video_prompts.py ${fullVideoId}`,
                    { 
                        shell: '/bin/bash',
                        env: process.env,
                        timeout: 300000 // 5 minute timeout
                    }
                );
                console.log(stdout);
            } catch (error) {
                console.log('⚠️  Some prompts may have failed:', error.message);
            }
        } else {
            console.log('⚠️  No Anthropic API key found');
            console.log('   Set ANTHROPIC_API_KEY in .env to enable Claude analysis');
        }

        // Final summary
        console.log('\n✅ Complete video analysis pipeline finished!');
        console.log('');
        console.log('📊 Video Summary:');
        console.log(`   - Title: ${videoData.text || 'No description'}`);
        console.log(`   - Author: @${username}`);
        console.log(`   - Views: ${videoData.playCount?.toLocaleString() || 0}`);
        console.log(`   - Likes: ${videoData.diggCount?.toLocaleString() || 0}`);
        console.log(`   - Comments: ${videoData.commentCount?.toLocaleString() || 0}`);
        console.log(`   - Engagement Rate: ${((videoData.diggCount / Math.max(videoData.playCount, 1)) * 100).toFixed(2)}%`);
        
        console.log('\n📂 Output locations:');
        console.log(`   - Video: ${videoPath}`);
        console.log(`   - Metadata: ${metadataPath}`);
        console.log(`   - Unified Analysis: ${unifiedPath}`);
        console.log(`   - Insights: insights/${fullVideoId}/`);
        
        console.log('\n📝 Next steps:');
        
        if (!gviComplete) {
            console.log(`1. Check GVI status and update:`);
            console.log(`   node check_gvi_results.js`);
            console.log(`   python3 update_unified_analysis.py ${fullVideoId}`);
            console.log(`   python3 run_all_video_prompts.py ${fullVideoId}`);
            console.log('');
        }
        
        console.log(`2. View insight results:`);
        console.log(`   python3 view_insight_results.py ${fullVideoId}`);
        console.log('');
        console.log(`3. Generate comprehensive report:`);
        console.log(`   python3 generate_insight_report.py ${fullVideoId}`);
        
        return {
            success: true,
            videoId: fullVideoId,
            videoPath,
            metadataPath,
            unifiedPath,
            gviComplete
        };

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the flow if called directly
if (require.main === module) {
    runCompleteFlow()
        .then(result => {
            console.log('\n🎉 Analysis complete!');
            process.exit(0);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { runCompleteFlow };