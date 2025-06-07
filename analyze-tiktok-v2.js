#!/usr/bin/env node

// Load environment variables FIRST
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Now load other modules
const { ApifyClient } = require('apify-client');
const { Storage } = require('@google-cloud/storage');
const videoIntelligence = require('@google-cloud/video-intelligence');
const axios = require('axios');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const moment = require('moment');
const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');

class TikTokVideoAnalyzer {
    constructor() {
        // Initialize Apify client
        this.apifyClient = new ApifyClient({
            token: process.env.APIFY_TOKEN
        });
        
        // Initialize Google Cloud clients
        this.storage = new Storage({
            projectId: 'tumi-video-analysis'
        });
        this.bucket = this.storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'tiktok-video-analysis-jorge');
        this.videoClient = new videoIntelligence.VideoIntelligenceServiceClient({
            projectId: 'tumi-video-analysis'
        });
        
        this.tempDir = path.join(__dirname, 'temp', 'videos');
        this.actorId = 'clockworks/tiktok-scraper';
    }

    async ensureTempDirectory() {
        await fs.mkdir(this.tempDir, { recursive: true });
    }

    async fetchTikTokVideosWithApify(username, retries = 2) {
        console.log(`📱 [Apify] Attempting to fetch videos for @${username}...`);
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const input = {
                    profiles: [`https://www.tiktok.com/@${username}`],
                    resultsPerPage: 100,
                    shouldDownloadVideos: true,
                    shouldDownloadCovers: true,
                    shouldDownloadSubtitles: false,
                    proxyConfiguration: {
                        useApifyProxy: true,
                        apifyProxyGroups: ['RESIDENTIAL']
                    }
                };

                console.log(`🚀 [Apify] Starting scraper (attempt ${attempt + 1}/${retries + 1})...`);
                console.log(`📊 [Apify] Input configuration:`, JSON.stringify(input, null, 2));
                
                const run = await this.apifyClient.actor(this.actorId).start(input);
                console.log(`⏳ [Apify] Run started with ID: ${run.id}`);
                
                // Wait for the run to finish
                console.log(`⏳ [Apify] Waiting for completion...`);
                const waitResult = await this.apifyClient.run(run.id).waitForFinish();
                
                console.log(`📊 [Apify] Run status: ${waitResult.status}`);
                console.log(`📊 [Apify] Run stats:`, JSON.stringify(waitResult.stats, null, 2));
                
                if (waitResult.status !== 'SUCCEEDED') {
                    throw new Error(`Apify run failed with status: ${waitResult.status}`);
                }
                
                // Get the dataset
                const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
                console.log(`✅ [Apify] Retrieved ${items.length} items from dataset`);
                
                if (items.length === 0 && attempt < retries) {
                    console.log(`⚠️  [Apify] No items found, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                    continue;
                }
                
                // Log sample data for debugging
                if (items.length > 0) {
                    console.log(`📊 [Apify] Sample item structure:`, JSON.stringify(items[0], null, 2).substring(0, 500));
                }
                
                return items;
                
            } catch (error) {
                console.error(`❌ [Apify] Attempt ${attempt + 1} failed:`, error.message);
                if (error.response) {
                    console.error(`📊 [Apify] Error response:`, error.response.data);
                }
                
                if (attempt === retries) {
                    console.error(`❌ [Apify] All attempts failed`);
                    return null;
                }
                
                console.log(`⏳ [Apify] Waiting before retry...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        return null;
    }

    async fetchTikTokVideosWithScraping(username) {
        console.log(`🌐 [Scraper] Attempting to fetch videos for @${username} using web scraping...`);
        
        try {
            const url = `https://www.tiktok.com/@${username}`;
            console.log(`🔗 [Scraper] Fetching: ${url}`);
            
            // First try with simple HTTP request
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 30000
            });
            
            console.log(`📊 [Scraper] Response status: ${response.status}`);
            
            // Try to extract video data from the HTML
            const $ = cheerio.load(response.data);
            const scriptData = $('script#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
            
            if (scriptData) {
                console.log(`✅ [Scraper] Found data script`);
                const jsonData = JSON.parse(scriptData);
                console.log(`📊 [Scraper] Parsed data structure:`, Object.keys(jsonData));
                
                // Extract video items from the data structure
                // This structure may vary, so we need to explore it
                const videos = this.extractVideosFromScriptData(jsonData);
                console.log(`📊 [Scraper] Extracted ${videos.length} videos`);
                
                return videos;
            } else {
                console.log(`⚠️  [Scraper] No data script found, trying alternative parsing...`);
                
                // Try to find video links directly
                const videoLinks = [];
                $('a[href*="/video/"]').each((i, elem) => {
                    const href = $(elem).attr('href');
                    if (href && href.includes('/video/')) {
                        videoLinks.push(href);
                    }
                });
                
                console.log(`📊 [Scraper] Found ${videoLinks.length} video links`);
                
                if (videoLinks.length === 0) {
                    throw new Error('No video links found in HTML');
                }
                
                // Return basic video data
                return videoLinks.slice(0, 10).map((link, index) => ({
                    id: link.split('/').pop(),
                    webVideoUrl: `https://www.tiktok.com${link}`,
                    text: `Video ${index + 1}`,
                    playCount: 0,
                    diggCount: 0,
                    commentCount: 0,
                    shareCount: 0
                }));
            }
            
        } catch (error) {
            console.error(`❌ [Scraper] Web scraping failed:`, error.message);
            return null;
        }
    }

    extractVideosFromScriptData(data) {
        const videos = [];
        
        try {
            // Navigate through possible data structures
            // TikTok's structure changes frequently, so we need to be flexible
            const possiblePaths = [
                data?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.stats?.videoCount,
                data?.__DEFAULT_SCOPE__?.['webapp.video-detail'],
                data?.ItemModule,
                data?.items
            ];
            
            for (const path of possiblePaths) {
                if (path && typeof path === 'object') {
                    console.log(`📊 [Scraper] Exploring data path:`, Object.keys(path).slice(0, 5));
                }
            }
            
            // Try to extract from ItemModule
            if (data.ItemModule) {
                Object.entries(data.ItemModule).forEach(([key, item]) => {
                    if (item?.video) {
                        videos.push({
                            id: item.id,
                            text: item.desc || '',
                            webVideoUrl: `https://www.tiktok.com/@${item.author}/video/${item.id}`,
                            videoUrl: item.video.downloadAddr || item.video.playAddr,
                            playCount: parseInt(item.stats?.playCount || 0),
                            diggCount: parseInt(item.stats?.diggCount || 0),
                            commentCount: parseInt(item.stats?.commentCount || 0),
                            shareCount: parseInt(item.stats?.shareCount || 0),
                            videoMeta: {
                                duration: item.video.duration
                            }
                        });
                    }
                });
            }
            
        } catch (error) {
            console.error(`❌ [Scraper] Error extracting videos:`, error.message);
        }
        
        return videos;
    }

    async fetchTikTokVideosWithPuppeteer(username) {
        console.log(`🎭 [Puppeteer] Attempting to fetch videos for @${username} using headless browser...`);
        
        let browser = null;
        try {
            // Use Chrome/Chromium executable
            const executablePath = process.platform === 'win32' 
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                : process.platform === 'darwin'
                ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
                : '/usr/bin/google-chrome-stable';
                
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            const url = `https://www.tiktok.com/@${username}`;
            console.log(`🔗 [Puppeteer] Navigating to: ${url}`);
            
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            console.log(`✅ [Puppeteer] Page loaded`);
            
            // Wait for video elements
            await page.waitForSelector('[data-e2e="user-post-item"]', { timeout: 10000 }).catch(() => {
                console.log(`⚠️  [Puppeteer] No video elements found`);
            });
            
            // Extract video data
            const videos = await page.evaluate(() => {
                const items = [];
                document.querySelectorAll('[data-e2e="user-post-item"]').forEach((elem, index) => {
                    const link = elem.querySelector('a')?.href;
                    if (link && link.includes('/video/')) {
                        items.push({
                            id: link.split('/').pop(),
                            webVideoUrl: link,
                            text: elem.querySelector('[data-e2e="video-desc"]')?.textContent || `Video ${index + 1}`,
                            playCount: 0,
                            diggCount: 0,
                            commentCount: 0,
                            shareCount: 0
                        });
                    }
                });
                return items;
            });
            
            console.log(`✅ [Puppeteer] Found ${videos.length} videos`);
            return videos;
            
        } catch (error) {
            console.error(`❌ [Puppeteer] Browser scraping failed:`, error.message);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async fetchTikTokVideos(username) {
        console.log(`\n🔍 Starting multi-method video fetch for @${username}\n`);
        
        // Method 1: Try Apify first (if token exists)
        if (process.env.APIFY_TOKEN) {
            const apifyVideos = await this.fetchTikTokVideosWithApify(username);
            if (apifyVideos && apifyVideos.length > 0) {
                console.log(`✅ Successfully fetched ${apifyVideos.length} videos using Apify`);
                return apifyVideos;
            }
        } else {
            console.log(`⚠️  No APIFY_TOKEN found, skipping Apify method`);
        }
        
        // Method 2: Try web scraping
        console.log(`\n🔄 Trying alternative method: Web scraping...`);
        const scrapedVideos = await this.fetchTikTokVideosWithScraping(username);
        if (scrapedVideos && scrapedVideos.length > 0) {
            console.log(`✅ Successfully fetched ${scrapedVideos.length} videos using web scraping`);
            return scrapedVideos;
        }
        
        // Method 3: Try Puppeteer (requires Chrome)
        console.log(`\n🔄 Trying alternative method: Headless browser...`);
        const puppeteerVideos = await this.fetchTikTokVideosWithPuppeteer(username);
        if (puppeteerVideos && puppeteerVideos.length > 0) {
            console.log(`✅ Successfully fetched ${puppeteerVideos.length} videos using Puppeteer`);
            return puppeteerVideos;
        }
        
        // All methods failed
        throw new Error('All video fetching methods failed. The account may be private or does not exist.');
    }

    async downloadVideo(videoUrl, filename) {
        console.log(`📥 Downloading: ${filename}`);
        const filePath = path.join(this.tempDir, filename);
        
        try {
            const response = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.tiktok.com/'
                },
                timeout: 60000
            });
            
            await pipeline(response.data, createWriteStream(filePath));
            
            const stats = await fs.stat(filePath);
            console.log(`✅ Downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            return filePath;
        } catch (error) {
            console.error(`❌ Download failed: ${error.message}`);
            throw error;
        }
    }

    async uploadToGCS(localPath, gcsPath) {
        console.log(`☁️  Uploading to GCS using Node.js SDK...`);
        
        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'tiktok-video-analysis-jorge';
        const gcsUri = `gs://${bucketName}/${gcsPath}`;
        
        console.log(`📂 Local file: ${localPath}`);
        console.log(`🎯 Destination: ${gcsUri}`);
        
        try {
            // Get file stats for logging
            const stats = await fs.stat(localPath);
            console.log(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Upload using Node.js SDK
            console.log(`📤 Starting upload...`);
            const [file] = await this.bucket.upload(localPath, {
                destination: gcsPath,
                metadata: {
                    contentType: 'video/mp4',
                    metadata: {
                        uploadedAt: new Date().toISOString(),
                        originalFilename: path.basename(localPath),
                        uploadMethod: 'nodejs-sdk'
                    }
                },
                resumable: true, // Enable resumable uploads for large files
                validation: 'crc32c' // Enable data integrity validation
            });
            
            console.log(`✅ Upload successful`);
            console.log(`✅ Uploaded: ${gcsUri}`);
            console.log(`📊 GCS file: ${file.name}`);
            console.log(`🔒 Generation: ${file.generation}`);
            
            return gcsUri;
            
        } catch (error) {
            console.error(`❌ Upload failed: ${error.message}`);
            console.error(`📊 Error details:`, {
                code: error.code,
                message: error.message,
                localPath,
                gcsPath,
                bucketName
            });
            throw error;
        }
    }

    async analyzeWithVideoIntelligence(gcsUri) {
        console.log(`🔍 Starting video analysis...`);
        console.log(`📹 Video URI: ${gcsUri}`);
        console.log(`🔬 Using Video Intelligence Node.js SDK...`);
        
        const request = {
            inputUri: gcsUri,
            features: [
                'LABEL_DETECTION',
                'SHOT_CHANGE_DETECTION',
                'EXPLICIT_CONTENT_DETECTION'
            ],
            videoContext: {
                labelDetectionConfig: {
                    labelDetectionMode: 'SHOT_MODE',
                    model: 'builtin/stable'
                }
            }
        };

        console.log(`📊 Analysis request:`, JSON.stringify(request, null, 2));
        
        try {
            console.log(`📤 Submitting analysis request...`);
            const [operation] = await this.videoClient.annotateVideo(request);
            console.log(`⏳ Analysis operation started: ${operation.name}`);
            console.log(`⏳ Waiting for completion (this may take 30-60 seconds)...`);
            
            const [operationResult] = await operation.promise();
            console.log(`✅ Video Intelligence analysis complete!`);
            
            const annotations = operationResult.annotationResults[0];
            
            // Log detailed results summary
            console.log(`📊 Analysis results summary:`);
            console.log(`   - Labels detected: ${annotations.segmentLabelAnnotations?.length || 0}`);
            console.log(`   - Shots detected: ${annotations.shotAnnotations?.length || 0}`);
            console.log(`   - Explicit content frames: ${annotations.explicitAnnotation?.frames?.length || 0}`);
            
            if (annotations.segmentLabelAnnotations?.length > 0) {
                const topLabels = annotations.segmentLabelAnnotations
                    .slice(0, 3)
                    .map(label => label.entity.description)
                    .join(', ');
                console.log(`   - Top labels: ${topLabels}`);
            }
            
            return annotations;
            
        } catch (error) {
            console.error(`❌ Video Intelligence analysis failed: ${error.message}`);
            console.error(`📊 Error details:`, {
                code: error.code,
                message: error.message,
                gcsUri,
                requestFeatures: request.features
            });
            throw error;
        }
    }

    formatResults(video, analysisResults) {
        const results = {
            video: {
                id: video.id,
                description: video.text || video.desc || 'No description',
                url: video.webVideoUrl,
                stats: {
                    views: parseInt(video.playCount || video.plays || 0),
                    likes: parseInt(video.diggCount || video.likes || 0),
                    comments: parseInt(video.commentCount || video.comments || 0),
                    shares: parseInt(video.shareCount || video.shares || 0)
                },
                duration: video.videoMeta?.duration || video.duration || 0,
                createTime: video.createTimeISO || video.createTime
            },
            analysis: {
                labels: [],
                shots: [],
                explicitContent: null
            }
        };

        // Process labels
        if (analysisResults.segmentLabelAnnotations) {
            results.analysis.labels = analysisResults.segmentLabelAnnotations
                .map(label => ({
                    name: label.entity.description,
                    confidence: Math.round((label.confidence || 0) * 100) / 100
                }))
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 10);
        }

        // Process shots
        if (analysisResults.shotAnnotations) {
            results.analysis.shots = {
                total: analysisResults.shotAnnotations.length,
                averageDuration: this.calculateAverageShotDuration(analysisResults.shotAnnotations)
            };
        }

        // Process explicit content
        if (analysisResults.explicitAnnotation) {
            const frames = analysisResults.explicitAnnotation.frames || [];
            results.analysis.explicitContent = {
                analyzed: true,
                flaggedFrames: frames.filter(f => 
                    f.pornographyLikelihood === 'LIKELY' || 
                    f.pornographyLikelihood === 'VERY_LIKELY'
                ).length
            };
        }

        return results;
    }

    calculateAverageShotDuration(shots) {
        if (!shots || shots.length === 0) return 0;
        
        let totalDuration = 0;
        shots.forEach(shot => {
            const start = this.timeToSeconds(shot.startTimeOffset);
            const end = this.timeToSeconds(shot.endTimeOffset);
            totalDuration += (end - start);
        });
        
        return Math.round((totalDuration / shots.length) * 100) / 100;
    }

    timeToSeconds(timeOffset) {
        if (!timeOffset) return 0;
        const seconds = parseInt(timeOffset.seconds || 0);
        const nanos = parseInt(timeOffset.nanos || 0);
        return seconds + nanos / 1e9;
    }

    displayResults(results) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 TIKTOK VIDEO ANALYSIS RESULTS');
        console.log('='.repeat(80));
        
        console.log(`\n📹 Video: ${results.video.description.substring(0, 60)}...`);
        console.log(`🔗 URL: ${results.video.url}`);
        if (results.video.createTime) {
            console.log(`📅 Posted: ${moment(results.video.createTime).fromNow()}`);
        }
        console.log(`⏱️  Duration: ${results.video.duration} seconds`);
        
        console.log('\n📈 ENGAGEMENT METRICS:');
        console.log(`   👁️  Views: ${results.video.stats.views.toLocaleString()}`);
        console.log(`   ❤️  Likes: ${results.video.stats.likes.toLocaleString()}`);
        console.log(`   💬 Comments: ${results.video.stats.comments.toLocaleString()}`);
        console.log(`   🔄 Shares: ${results.video.stats.shares.toLocaleString()}`);
        
        console.log('\n🏷️  TOP DETECTED LABELS:');
        results.analysis.labels.forEach((label, i) => {
            console.log(`   ${i + 1}. ${label.name} (${label.confidence * 100}% confidence)`);
        });
        
        console.log('\n🎬 VIDEO COMPOSITION:');
        console.log(`   Total shots: ${results.analysis.shots.total}`);
        console.log(`   Average shot duration: ${results.analysis.shots.averageDuration}s`);
        
        if (results.analysis.explicitContent) {
            console.log('\n⚠️  CONTENT MODERATION:');
            console.log(`   Explicit frames detected: ${results.analysis.explicitContent.flaggedFrames}`);
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
    }

    async cleanupTempFile(filePath) {
        try {
            await fs.unlink(filePath);
            console.log(`🧹 Cleaned up temporary file`);
        } catch (error) {
            console.error(`⚠️  Cleanup failed: ${error.message}`);
        }
    }

    async analyze(username, options = {}) {
        const { limit = 1, skipVideoDownload = false } = options;
        
        console.log(`\n🚀 TikTok Video Analyzer v2.0`);
        console.log(`👤 Analyzing: @${username}`);
        console.log(`📊 Videos to analyze: ${limit}`);
        console.log(`⚙️  Skip video download: ${skipVideoDownload}\n`);
        
        try {
            // Setup
            await this.ensureTempDirectory();
            
            // Fetch videos using multiple methods
            const videos = await this.fetchTikTokVideos(username);
            
            if (!videos || videos.length === 0) {
                throw new Error('No videos found for this user');
            }
            
            console.log(`\n📋 Processing ${Math.min(videos.length, limit)} video(s)...\n`);
            
            const allResults = [];
            let successCount = 0;
            
            for (let i = 0; i < Math.min(videos.length, limit); i++) {
                const video = videos[i];
                
                console.log(`\n${'─'.repeat(60)}`);
                console.log(`📹 Processing video ${i + 1}/${Math.min(videos.length, limit)}`);
                console.log(`📝 Description: ${(video.text || 'Untitled').substring(0, 50)}...`);
                console.log(`${'─'.repeat(60)}\n`);
                
                if (skipVideoDownload) {
                    console.log(`⏭️  Skipping video download and analysis (dry run)`);
                    allResults.push({
                        video: {
                            id: video.id,
                            description: video.text || 'No description',
                            url: video.webVideoUrl,
                            stats: {
                                views: parseInt(video.playCount || 0),
                                likes: parseInt(video.diggCount || 0),
                                comments: parseInt(video.commentCount || 0),
                                shares: parseInt(video.shareCount || 0)
                            }
                        },
                        analysis: {
                            skipped: true,
                            reason: 'Dry run mode'
                        }
                    });
                    successCount++;
                    continue;
                }
                
                let tempFile = null;
                
                try {
                    // Check if we have a download URL from multiple possible fields
                    const videoUrl = video.videoMeta?.downloadAddr || 
                                   video.mediaUrls?.[0] || 
                                   video.downloadUrl || 
                                   video.videoUrl || 
                                   video.downloadAddr;
                    
                    if (!videoUrl) {
                        console.log(`⚠️  No download URL available for this video`);
                        console.log(`📊 Available fields:`, Object.keys(video));
                        console.log(`📊 VideoMeta:`, video.videoMeta ? Object.keys(video.videoMeta) : 'None');
                        console.log(`📊 MediaUrls:`, video.mediaUrls?.length || 0);
                        continue;
                    }
                    
                    console.log(`🔗 Using video URL: ${videoUrl.substring(0, 100)}...`);
                    
                    // Download
                    const filename = `${username}_${video.id || Date.now()}.mp4`;
                    tempFile = await this.downloadVideo(videoUrl, filename);
                    
                    // Upload to GCS
                    const gcsPath = `videos/${username}/${filename}`;
                    const gcsUri = await this.uploadToGCS(tempFile, gcsPath);
                    
                    // Analyze
                    const analysisResults = await this.analyzeWithVideoIntelligence(gcsUri);
                    
                    // Format results
                    const formattedResults = this.formatResults(video, analysisResults);
                    
                    // Display
                    this.displayResults(formattedResults);
                    
                    allResults.push(formattedResults);
                    successCount++;
                    
                } catch (videoError) {
                    console.error(`❌ Failed to process video: ${videoError.message}`);
                    allResults.push({
                        video: {
                            id: video.id,
                            description: video.text || 'No description',
                            url: video.webVideoUrl
                        },
                        error: videoError.message
                    });
                } finally {
                    if (tempFile) {
                        await this.cleanupTempFile(tempFile);
                    }
                }
            }
            
            // Save all results
            const outputFile = `${username}_analysis_${Date.now()}.json`;
            await fs.writeFile(outputFile, JSON.stringify(allResults, null, 2));
            console.log(`\n💾 Complete results saved to: ${outputFile}`);
            console.log(`📊 Successfully analyzed ${successCount}/${Math.min(videos.length, limit)} videos`);
            
            return allResults;
            
        } catch (error) {
            console.error(`\n❌ Analysis failed: ${error.message}`);
            throw error;
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node analyze-tiktok-v2.js @username [options]');
        console.log('');
        console.log('Examples:');
        console.log('  node analyze-tiktok-v2.js @nike                 # Analyze 1 video');
        console.log('  node analyze-tiktok-v2.js @nike --limit=3       # Analyze 3 videos');
        console.log('  node analyze-tiktok-v2.js @nike --dry-run       # Test without downloading');
        console.log('');
        console.log('Options:');
        console.log('  --limit=N      Number of videos to analyze (default: 1)');
        console.log('  --dry-run      Fetch video info without downloading/analyzing');
        process.exit(1);
    }
    
    const username = args[0].replace('@', '');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1;
    const skipVideoDownload = args.includes('--dry-run');
    
    const analyzer = new TikTokVideoAnalyzer();
    await analyzer.analyze(username, { limit, skipVideoDownload });
}

if (require.main === module) {
    main().catch(error => {
        console.error('\n💥 Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = TikTokVideoAnalyzer;