#!/usr/bin/env node
/**
 * Test metadata summary fix
 */

const UnifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler');
const fs = require('fs').promises;
const path = require('path');

async function testMetadataFix() {
    const videoId = '7372639293631679790';
    const username = 'nutsnmore';
    
    console.log('Testing metadata summary fix...\n');
    
    // Load existing GVI metadata
    let metadataSummary = {};
    try {
        const gviPath = path.join(__dirname, 'temp', 'video-analysis', `${videoId}.json`);
        const gviData = await fs.readFile(gviPath, 'utf8');
        const gviAnalysis = JSON.parse(gviData);
        metadataSummary = gviAnalysis.analysis || {};
    } catch (error) {
        console.log('No GVI metadata found, using empty object');
    }
    
    // Create test video info
    const videoInfo = {
        id: videoId,
        description: "Got a sweet tooth you just can't kick, but still want to hit those protein goals? This is for you!! Try adding a spoonful of your favorite flavor Nuts N More spread to plain Greek yogurt for a guilt free sweet treat. 😋\n\n#protein #nutspread #macros #healthy #healthytreat #macrofriendly #nutsnmore",
        hashtags: [
            { name: "protein" },
            { name: "nutspread" },
            { name: "macros" },
            { name: "healthy" },
            { name: "healthytreat" },
            { name: "macrofriendly" },
            { name: "nutsnmore" }
        ],
        duration: 12,
        createTime: "2024-05-24T18:45:58.000Z",
        author: {
            username: "nutsnmore",
            displayName: "nuts 'n more",
            verified: false
        },
        views: 3032,
        likes: 53,
        comments: 1,
        shares: 0,
        engagementRate: 1.78
    };
    
    // Recreate unified timeline
    console.log('Regenerating unified timeline with enhanced metadata...');
    await UnifiedTimelineAssembler.assembleUnifiedTimeline(
        videoId,
        metadataSummary,
        videoInfo,
        username
    );
    
    // Load and check the result
    const unifiedPath = path.join(__dirname, 'unified_analysis', `${videoId}.json`);
    const unifiedData = await fs.readFile(unifiedPath, 'utf8');
    const unified = JSON.parse(unifiedData);
    
    console.log('\nMetadata Summary:');
    console.log(JSON.stringify(unified.metadata_summary, null, 2));
    
    console.log('\n✅ Test complete!');
}

testMetadataFix().catch(console.error);