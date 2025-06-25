const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class TikTokSingleVideoScraper {
    constructor() {
        this.client = new ApifyClient({
            token: process.env.APIFY_TOKEN
        });
        // Use the TikTok scraper that supports single video URLs
        this.actorId = 'clockworks/tiktok-scraper';
    }

    async scrapeVideo(username, videoId) {
        const videoUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;
        console.log(`📱 Starting single video scrape: ${videoUrl}`);
        console.log(`🔑 Apify token configured: ${!!process.env.APIFY_TOKEN}`);
        
        try {
            const input = {
                // Scrape single video by providing direct URL
                postURLs: [videoUrl],
                resultsPerPage: 1,
                shouldDownloadVideos: true,
                shouldDownloadCovers: true,
                shouldDownloadSubtitles: true,
                proxyConfiguration: {
                    useApifyProxy: true
                }
            };

            console.log('🚀 Starting Apify actor for single video:', input);
            console.log(`🌟 SINGLE VIDEO SCRAPE TRIGGERED - ${videoId} - TIMESTAMP: ${new Date().toISOString()}`);
            
            // Start the actor run
            const run = await this.client.actor(this.actorId).start(input);
            console.log('📋 Apify run started:', run.id);
            
            // Poll for completion (shorter timeout for single video)
            const completedRun = await this.pollApifyRunUntilComplete(run.id, 120000); // 2 minutes max
            console.log('📋 Apify run completed:', completedRun.id);
            
            // Retrieve the single video data
            const { items } = await this.client.dataset(completedRun.defaultDatasetId).listItems();
            console.log(`📊 Retrieved ${items?.length || 0} items from dataset`);

            if (!items || items.length === 0) {
                throw new Error(`Failed to scrape video ${videoId}`);
            }

            const videoData = items[0];
            console.log('✅ Video data retrieved successfully');
            console.log(`📊 Video stats: ${videoData.diggCount} likes, ${videoData.playCount} views`);
            
            // Download video file if URL is available
            if (videoData.videoUrl || videoData.downloadAddr) {
                await this.downloadVideoFile(videoData, username, videoId);
            }
            
            return videoData;
            
        } catch (error) {
            console.error(`❌ Failed to scrape video ${videoId}:`, error.message);
            throw error;
        }
    }

    async pollApifyRunUntilComplete(runId, maxWaitTime = 120000) { // 2 minutes max for single video
        const startTime = Date.now();
        const pollInterval = 3000; // Check every 3 seconds
        
        console.log(`🔄 Polling Apify run ${runId} for completion...`);
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const run = await this.client.run(runId).get();
                console.log(`📊 Run status: ${run.status}`);
                
                if (run.status === 'SUCCEEDED') {
                    console.log(`✅ Apify run completed successfully after ${Math.round((Date.now() - startTime) / 1000)}s`);
                    return run;
                } else if (run.status === 'FAILED' || run.status === 'ABORTED') {
                    throw new Error(`Apify run ${run.status.toLowerCase()}: ${run.statusMessage || 'Unknown error'}`);
                } else if (run.status === 'RUNNING' || run.status === 'READY') {
                    console.log(`⏳ Run still processing, checking again in ${pollInterval/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                } else {
                    console.log(`⚠️ Unexpected run status: ${run.status}`);
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            } catch (error) {
                console.error(`❌ Error polling run status: ${error.message}`);
                throw error;
            }
        }
        
        throw new Error(`Apify run timed out after ${maxWaitTime/1000} seconds`);
    }

    async downloadVideoFile(videoData, username, videoId) {
        const videoUrl = videoData.videoUrl || videoData.downloadAddr;
        if (!videoUrl) {
            console.log('⚠️  No video URL available for download');
            return null;
        }

        try {
            console.log('📥 Downloading video file...');
            
            // Create video directory
            const videoDir = path.join('downloads', 'videos', username);
            await fs.mkdir(videoDir, { recursive: true });
            
            const videoPath = path.join(videoDir, `${videoId}.mp4`);
            
            // Download video
            const response = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream',
                timeout: 60000, // 1 minute timeout
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
            console.log(`✅ Video downloaded: ${videoPath} (${Math.round(stats.size / 1024 / 1024 * 10) / 10} MB)`);
            
            // Save video metadata
            const metadataPath = path.join(videoDir, `${videoId}_metadata.json`);
            await fs.writeFile(metadataPath, JSON.stringify(videoData, null, 2));
            
            return videoPath;
            
        } catch (error) {
            console.error('❌ Failed to download video:', error.message);
            return null;
        }
    }

    async getVideoMetadata(username, videoId) {
        // First check if we already have the metadata
        const metadataPath = path.join('downloads', 'videos', username, `${videoId}_metadata.json`);
        
        try {
            const data = await fs.readFile(metadataPath, 'utf8');
            console.log('📁 Found existing metadata');
            return JSON.parse(data);
        } catch (error) {
            // Metadata doesn't exist, need to scrape
            console.log('📥 Metadata not found, scraping video...');
            return await this.scrapeVideo(username, videoId);
        }
    }
}

module.exports = new TikTokSingleVideoScraper();