#!/usr/bin/env node
/**
 * Test scene detection fix
 */

const UnifiedTimelineAssembler = require('./server/services/UnifiedTimelineAssembler');
const fs = require('fs').promises;
const path = require('path');

async function testSceneDetection() {
    const videoId = '7372639293631679790';
    const username = 'nutsnmore';
    
    console.log('Testing scene detection fix...\n');
    
    // Load existing GVI analysis
    let gviData = {};
    try {
        const gviPath = path.join(__dirname, 'temp', 'video-analysis', `${videoId}.json`);
        const gviContent = await fs.readFile(gviPath, 'utf8');
        const gviAnalysis = JSON.parse(gviContent);
        // Get the processed data which contains shots
        gviData = gviAnalysis.processed || {};
        console.log(`Found ${gviData.shots?.length || 0} shots in GVI data`);
        if (gviData.shots?.length > 0) {
            console.log('First few shots:');
            gviData.shots.slice(0, 3).forEach((shot, i) => {
                const start = shot.startTime ? `${shot.startTime.seconds || 0}.${shot.startTime.nanos || 0}` : '0';
                const end = shot.endTime ? `${shot.endTime.seconds || 0}.${shot.endTime.nanos || 0}` : '0';
                console.log(`  Shot ${i + 1}: ${start}s - ${end}s`);
            });
        }
    } catch (error) {
        console.log('No GVI data found:', error.message);
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
    
    // Recreate unified timeline with GVI data including shots
    console.log('\nRegenerating unified timeline with scene detection...');
    await UnifiedTimelineAssembler.assembleUnifiedTimeline(
        videoId,
        gviData,  // Pass the full GVI processed data
        videoInfo,
        username
    );
    
    // Load and check the result
    const unifiedPath = path.join(__dirname, 'unified_analysis', `${videoId}.json`);
    const unifiedData = await fs.readFile(unifiedPath, 'utf8');
    const unified = JSON.parse(unifiedData);
    
    console.log('\nScene Change Timeline:');
    const sceneChanges = unified.timelines.sceneChangeTimeline || {};
    console.log(`Total scene changes: ${Object.keys(sceneChanges).length}`);
    
    if (Object.keys(sceneChanges).length > 0) {
        console.log('\nScene changes detected:');
        Object.entries(sceneChanges).forEach(([timestamp, data]) => {
            console.log(`  ${timestamp}: ${data.description} (frame ${data.frame})`);
        });
    } else {
        console.log('No scene changes detected in timeline');
    }
    
    console.log('\n✅ Test complete!');
}

testSceneDetection().catch(console.error);