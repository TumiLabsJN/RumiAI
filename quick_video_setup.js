#!/usr/bin/env node
/**
 * Quick setup for a single TikTok video
 */

const TikTokService = require('./server/services/TikTokService');
const insightManager = require('./server/services/InsightManager');
const fs = require('fs').promises;
const path = require('path');

async function main() {
    const username = 'latstrisomeprotein';
    const videoId = '7197152431958986026';
    const url = `https://www.tiktok.com/@${username}/video/${videoId}`;
    const fullVideoId = `${username}_${videoId}`;
    
    console.log(`\n🚀 Quick setup for ${fullVideoId}`);
    
    try {
        // Create base directories (use temp if outputs is not writable)
        try {
            await fs.mkdir('outputs/tiktok_profiles', { recursive: true });
        } catch (err) {
            console.log('⚠️  Using temp directory due to permissions');
            await fs.mkdir('temp/tiktok_profiles', { recursive: true });
        }
        await fs.mkdir('unified_analysis', { recursive: true });
        
        // Create a minimal metadata file
        const metadata = {
            id: videoId,
            author: { username },
            videoId: fullVideoId,
            createTime: new Date().toISOString(),
            desc: "Video pending full analysis",
            stats: {
                playCount: 0,
                diggCount: 0,
                commentCount: 0,
                shareCount: 0
            }
        };
        
        // Try outputs first, fall back to temp
        let baseDir = 'outputs';
        try {
            await fs.access('outputs/tiktok_profiles', fs.constants.W_OK);
        } catch {
            baseDir = 'temp';
        }
        const metadataPath = path.join(baseDir, 'tiktok_profiles', `${fullVideoId}_metadata.json`);
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        console.log(`💾 Created minimal metadata: ${metadataPath}`);
        
        // Create minimal unified analysis
        const unifiedAnalysis = {
            video_id: fullVideoId,
            platform: "tiktok",
            basic_info: {
                username,
                video_id: videoId,
                url,
                created_at: new Date().toISOString()
            },
            static_metadata: metadata,
            status: "pending_full_analysis"
        };
        
        const unifiedPath = path.join('unified_analysis', `${fullVideoId}.json`);
        await fs.writeFile(unifiedPath, JSON.stringify(unifiedAnalysis, null, 2));
        console.log(`💾 Created minimal unified analysis: ${unifiedPath}`);
        
        // Create insight folders
        console.log('\n📁 Creating insight folders...');
        const folderResult = await insightManager.createInsightFolders(fullVideoId);
        
        if (folderResult.success) {
            console.log('✅ Insight folders created');
            console.log(`📂 Base folder: ${folderResult.videoDir}`);
        }
        
        console.log(`\n✅ Quick setup complete for ${fullVideoId}!`);
        console.log('\n📝 The video is ready for Claude analysis:');
        console.log(`1. Run all prompts: python3 run_all_video_prompts.py ${fullVideoId}`);
        console.log(`2. Run specific prompts: python3 run_video_prompts_batch.py ${fullVideoId} --prompts hook_analysis cta_alignment`);
        console.log(`3. View results: python3 view_insight_results.py ${fullVideoId}`);
        
        console.log('\n⚠️  Note: This is a minimal setup. For full video analysis with timelines,');
        console.log('    you would need to run the complete flow when Apify completes.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);