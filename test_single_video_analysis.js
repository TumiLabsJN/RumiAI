#!/usr/bin/env node

/**
 * Test single video analysis
 * Directly test VideoAnalysisService with a known video
 */

require('dotenv').config();
const VideoAnalysisService = require('./server/services/VideoAnalysisService');

async function testSingleVideo() {
    console.log('🎬 Testing single video analysis');
    console.log('================================');
    
    try {
        // Create a test video object with all required fields
        const testVideo = {
            rank: 1,
            id: '7499153276298890551',
            url: 'https://www.tiktok.com/@russwong.md/video/7499153276298890551',
            description: 'Test video for RumiAI pipeline',
            hashtags: [],
            views: 15700,
            likes: 294,
            comments: 15,
            shares: 9,
            engagementRate: 2.03,
            duration: 6,
            createTime: '2025-04-30T17:04:50.000Z', // Recent date to pass filters
            downloadUrl: 'https://api.apify.com/v2/key-value-stores/0kIh2AccAA7E5sD2R/records/video-russwongmd-20250430170450-7499153276298890551',
            coverUrl: 'https://p16-sign-sg.tiktokcdn.com/test-cover.jpg',
            author: {
                username: 'russwong.md',
                displayName: 'Dr. Russell Wong',
                verified: false
            }
        };

        console.log('📊 Test video details:');
        console.log(`   - ID: ${testVideo.id}`);
        console.log(`   - URL: ${testVideo.url}`);
        console.log(`   - Download URL: ${testVideo.downloadUrl}`);
        console.log(`   - Engagement Rate: ${testVideo.engagementRate}%`);
        console.log(`   - Create Time: ${testVideo.createTime}`);
        console.log('');

        // Start video analysis with a single video
        console.log('🚀 Starting video analysis...');
        const result = await VideoAnalysisService.startVideoAnalysis([testVideo], 'russwong.md');
        
        console.log('✅ Analysis job started:');
        console.log(`   - Job ID: ${result.jobId}`);
        console.log(`   - Status: ${result.status}`);
        console.log('');

        // Poll for completion
        console.log('⏳ Waiting for analysis to complete...');
        let attempts = 0;
        const maxAttempts = 60;
        let jobStatus;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            jobStatus = VideoAnalysisService.getJobStatus(result.jobId);
            
            console.log(`   Status: ${jobStatus.status} - ${jobStatus.phase || 'Processing'} (${jobStatus.progress}%)`);
            
            if (jobStatus.status === 'completed') {
                console.log('✅ Analysis completed!');
                break;
            } else if (jobStatus.status === 'error' || jobStatus.status === 'failed') {
                console.error(`❌ Analysis failed: ${jobStatus.error}`);
                break;
            }
            
            attempts++;
        }

        if (jobStatus && jobStatus.status === 'completed') {
            console.log('\n📊 Results:');
            console.log(JSON.stringify(jobStatus.results, null, 2));
        }

        return jobStatus;

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        return null;
    }
}

// Run the test
if (require.main === module) {
    testSingleVideo()
        .then(result => {
            console.log('\n✅ Test completed');
            process.exit(result?.status === 'completed' ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { testSingleVideo };