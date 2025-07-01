#!/usr/bin/env node
/**
 * Quick script to download and analyze a single TikTok video
 */

const { scrapeVideo } = require('./services/TikTokScraper');
const { analyzeVideo } = require('./services/VideoAnalysisService');
const { generateUnifiedAnalysis } = require('./services/UnifiedAnalysisGenerator');
const insightManager = require('./server/services/InsightManager');
const fs = require('fs').promises;
const path = require('path');

async function main() {
    const username = 'latstrisomeprotein';
    const videoId = '7197152431958986026';
    const fullVideoId = `${username}_${videoId}`;
    
    console.log(`\n🚀 Starting analysis for ${fullVideoId}`);
    
    try {
        // Step 1: Scrape video data
        console.log('\n📥 Step 1: Downloading video data...');
        const videoData = await scrapeVideo(username, videoId);
        
        if (!videoData) {
            throw new Error('Failed to scrape video data');
        }
        
        console.log('✅ Video data downloaded');
        console.log(`📊 Video stats: ${videoData.diggCount} likes, ${videoData.playCount} views`);
        
        // Save video metadata
        const metadataPath = path.join('outputs', 'tiktok_profiles', `${fullVideoId}_metadata.json`);
        await fs.mkdir(path.dirname(metadataPath), { recursive: true });
        await fs.writeFile(metadataPath, JSON.stringify(videoData, null, 2));
        console.log(`💾 Saved metadata to: ${metadataPath}`);
        
        // Step 2: Analyze video
        console.log('\n🎥 Step 2: Analyzing video content...');
        const analysisResult = await analyzeVideo(videoData.downloadAddr || videoData.playAddr);
        
        if (!analysisResult) {
            throw new Error('Failed to analyze video');
        }
        
        console.log('✅ Video analysis complete');
        
        // Step 3: Generate unified analysis
        console.log('\n🔄 Step 3: Generating unified analysis...');
        const unifiedAnalysis = await generateUnifiedAnalysis(videoData, analysisResult);
        
        // Save unified analysis
        const unifiedPath = path.join('unified_analysis', `${fullVideoId}.json`);
        await fs.mkdir(path.dirname(unifiedPath), { recursive: true });
        await fs.writeFile(unifiedPath, JSON.stringify(unifiedAnalysis, null, 2));
        console.log(`💾 Saved unified analysis to: ${unifiedPath}`);
        
        // Step 4: Create insight folders
        console.log('\n📁 Step 4: Creating insight folders...');
        const folderResult = await insightManager.createInsightFolders(fullVideoId);
        
        if (folderResult.success) {
            console.log('✅ Insight folders created');
            console.log(`📂 Base folder: ${folderResult.videoDir}`);
        }
        
        console.log(`\n✅ Setup complete for ${fullVideoId}!`);
        console.log('\n📝 Next steps:');
        console.log(`1. Run all prompts: python3 run_all_video_prompts.py ${fullVideoId}`);
        console.log(`2. Run specific prompts: python3 run_video_prompts_batch.py ${fullVideoId} --prompts hook_analysis cta_alignment`);
        console.log(`3. View results: python3 view_insight_results.py ${fullVideoId}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);