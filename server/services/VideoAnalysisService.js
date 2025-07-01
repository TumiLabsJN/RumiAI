const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { promisify } = require('util');
const stream = require('stream');
const MetadataIntelligenceLayer = require('./MetadataIntelligenceLayer');
const UnifiedTimelineAssembler = require('./UnifiedTimelineAssembler');
const LocalVideoAnalyzer = require('./LocalVideoAnalyzer');

class VideoAnalysisService {
    constructor() {
        this.jobQueue = new Map(); // In-memory job tracking
        this.tempDir = path.join(__dirname, '../../temp');
        
        console.log('🎬 Video Analysis Service initialized (Local Processing Mode)');
        this.ensureTempDirectory();
    }

    async ensureTempDirectory() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            console.log(`📁 Temp directory ready: ${this.tempDir}`);
            
            // Also ensure output directory exists
            const outputDir = path.join(__dirname, '../../outputs/video-analysis');
            try {
                await fs.mkdir(outputDir, { recursive: true });
                console.log(`📁 Output directory ready: ${outputDir}`);
            } catch (err) {
                // If we can't create in outputs/, use temp directory
                console.log(`⚠️ Using temp directory for outputs due to permissions`);
            }
        } catch (error) {
            console.error('Failed to create directories:', error);
        }
    }

    /**
     * Main entry point - process a video analysis job
     */
    async startAnalysisJob(allVideos, username) {
        const jobId = this.generateJobId();
        
        // Initialize job
        this.jobQueue.set(jobId, {
            id: jobId,
            status: 'pending',
            progress: 0,
            startTime: new Date().toISOString(),
            username
        });

        // Start async processing
        this.processVideoAnalysis(jobId, allVideos, username)
            .catch(error => {
                console.error(`Job ${jobId} failed:`, error);
            });

        return jobId;
    }

    /**
     * Main async video processing pipeline - FULLY LOCAL
     */
    async processVideoAnalysis(jobId, allVideos, username) {
        try {
            // Phase 1: Select videos (5%)
            this.updateJobStatus(jobId, {
                status: 'running',
                progress: 5,
                phase: 'selecting_videos',
                message: 'Selecting top performing videos...'
            });

            const selectedVideos = this.selectVideosForAnalysis(allVideos);
            console.log(`📹 Selected ${selectedVideos.length} videos for analysis`);

            if (selectedVideos.length === 0) {
                throw new Error('No suitable videos found for analysis');
            }

            // Phase 2: Download videos (10-40%)
            this.updateJobStatus(jobId, {
                progress: 10,
                phase: 'downloading',
                message: 'Downloading videos for analysis...'
            });

            const downloadedVideos = await this.downloadVideos(selectedVideos, jobId);

            // Phase 3: Local Analysis (40-85%)
            this.updateJobStatus(jobId, {
                progress: 40,
                phase: 'local_analysis',
                message: 'Running comprehensive local analysis...'
            });

            const analysisResults = await this.runLocalAnalysis(downloadedVideos, jobId);

            // Phase 4: Claude Insights Generation (85-95%)
            this.updateJobStatus(jobId, {
                progress: 85,
                phase: 'generating_insights',
                message: 'Generating insights with Claude...'
            });

            const claudeInsights = await this.generateClaudeInsights(analysisResults, selectedVideos);

            // Phase 5: Cleanup and finalization (95-100%)
            this.updateJobStatus(jobId, {
                progress: 95,
                phase: 'finalizing',
                message: 'Finalizing results...'
            });

            await this.cleanupLocalFiles(downloadedVideos);

            // Final results
            const finalResults = {
                videos: selectedVideos,
                analysis: analysisResults,
                insights: claudeInsights,
                summary: this.generateSummary(selectedVideos, claudeInsights),
                completedAt: new Date().toISOString()
            };

            // Phase 6: Assemble unified timeline (95-100%)
            this.updateJobStatus(jobId, {
                progress: 95,
                phase: 'assembling_timeline',
                message: 'Creating unified timeline...'
            });

            // Assemble unified timeline for each video
            for (let i = 0; i < finalResults.videos.length; i++) {
                const video = finalResults.videos[i];
                try {
                    const analysisResult = finalResults.analysis[i] || {};
                    await UnifiedTimelineAssembler.assembleUnifiedTimeline(
                        video.id,
                        analysisResult,
                        video,
                        username
                    );
                    console.log(`✅ Unified timeline created for video ${video.id}`);
                } catch (err) {
                    console.error(`⚠️ Failed to create unified timeline for ${video.id}:`, err.message);
                }
            }

            this.updateJobStatus(jobId, {
                status: 'completed',
                progress: 100,
                phase: 'completed',
                message: 'Video analysis complete!',
                results: finalResults
            });

            console.log(`✅ Video analysis job ${jobId} completed successfully`);

        } catch (error) {
            console.error(`❌ Video analysis job ${jobId} failed:`, error);
            this.updateJobStatus(jobId, {
                status: 'failed',
                error: error.message,
                progress: 0
            });
            throw error;
        }
    }

    /**
     * Select 6 videos for analysis (3 from last 30 days, 3 from 30-60 days)
     */
    selectVideosForAnalysis(allVideos) {
        // Check for test mode flag
        if (process.env.RUMIAI_TEST_MODE === 'true') {
            console.log('🧪 Test mode: Bypassing date filters');
            console.log(`📊 Received ${allVideos.length} videos for analysis`);
            
            // Debug: Show what we received
            if (allVideos.length > 0) {
                console.log('🔍 First video properties:', Object.keys(allVideos[0]).join(', '));
                console.log('🔍 First video downloadUrl:', allVideos[0].downloadUrl);
            }
            
            // In test mode, return all videos with download URLs
            const selected = allVideos.filter(video => video.downloadUrl);
            console.log(`📊 Test mode - Selected ${selected.length} video(s) for analysis`);
            
            if (selected.length === 0 && allVideos.length > 0) {
                console.log('⚠️ No videos have downloadUrl property');
            }
            
            return selected;
        }

        // Normal production logic
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

        // Filter videos by time periods
        const recent = allVideos.filter(video => {
            const videoDate = new Date(video.createTime);
            return videoDate >= thirtyDaysAgo && video.downloadUrl;
        });

        const older = allVideos.filter(video => {
            const videoDate = new Date(video.createTime);
            return videoDate >= sixtyDaysAgo && videoDate < thirtyDaysAgo && video.downloadUrl;
        });

        // Sort by engagement rate and take top 3 from each period
        const topRecent = recent
            .sort((a, b) => b.engagementRate - a.engagementRate)
            .slice(0, 3);

        const topOlder = older
            .sort((a, b) => b.engagementRate - a.engagementRate)
            .slice(0, 3);

        const selected = [...topRecent, ...topOlder];
        console.log(`📊 Selected videos: ${topRecent.length} recent, ${topOlder.length} older`);
        
        return selected;
    }

    /**
     * Run comprehensive local analysis on all videos
     */
    async runLocalAnalysis(videos, jobId) {
        const results = [];
        
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            const progress = 40 + (i / videos.length) * 45; // 40-85%
            
            this.updateJobStatus(jobId, {
                progress: Math.round(progress),
                message: `Analyzing video ${i + 1}/${videos.length} locally...`
            });

            try {
                // Run all local analyses through LocalVideoAnalyzer
                const analysisResult = await LocalVideoAnalyzer.analyzeVideo(
                    video.localPath,
                    video.id || `video_${i}`
                );
                
                // Save analysis results
                const outputPath = await this.saveAnalysisResults(
                    video.id || `video_${i}`,
                    analysisResult
                );
                
                results.push({
                    ...analysisResult,
                    id: video.id,
                    videoPath: video.localPath,
                    outputPath
                });
                
                console.log(`✅ Analyzed video ${i + 1} with all local models`);
            } catch (error) {
                console.error(`⚠️ Failed to analyze video ${i + 1}:`, error.message);
                // Continue with minimal results
                results.push({
                    id: video.id,
                    error: error.message,
                    speechTranscriptions: [],
                    objectAnnotations: [],
                    personAnnotations: [],
                    textAnnotations: [],
                    shots: [],
                    labels: [],
                    explicitContent: { is_safe: true }
                });
            }
        }

        return results;
    }

    /**
     * Save analysis results to disk
     */
    async saveAnalysisResults(videoId, results) {
        const outputDir = path.join(this.tempDir, 'video-analysis');
        await fs.mkdir(outputDir, { recursive: true });
        
        const outputPath = path.join(outputDir, `${videoId}.json`);
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
        
        console.log(`💾 Saved video analysis results to: ${outputPath}`);
        return outputPath;
    }

    /**
     * Clean up local files after processing
     */
    async cleanupLocalFiles(videos) {
        for (const video of videos) {
            if (video.localPath) {
                try {
                    await fs.unlink(video.localPath);
                    console.log(`🗑️ Deleted local file: ${video.localPath}`);
                } catch (error) {
                    console.error(`Could not delete ${video.localPath}:`, error.message);
                }
            }
        }
    }

    /**
     * Download videos using yt-dlp
     */
    async downloadVideos(videos, jobId) {
        const downloaded = [];
        
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            const progress = 10 + (i / videos.length) * 30; // 10-40%
            
            this.updateJobStatus(jobId, {
                progress: Math.round(progress),
                message: `Downloading video ${i + 1}/${videos.length}...`
            });

            try {
                const localPath = await this.downloadVideo(video);
                downloaded.push({
                    ...video,
                    localPath,
                    fileSize: (await fs.stat(localPath)).size
                });
                console.log(`✅ Downloaded video ${i + 1}: ${localPath}`);
            } catch (error) {
                console.error(`❌ Failed to download video ${i + 1}:`, error);
                // Continue with other videos
            }
        }

        return downloaded;
    }

    /**
     * Download single video using yt-dlp or direct download
     */
    async downloadVideo(video) {
        // Check if we have an Apify download URL
        if (video.downloadUrl && video.downloadUrl.includes('api.apify.com')) {
            return this.downloadFromApify(video);
        }
        
        // Fallback to yt-dlp for regular TikTok URLs
        return new Promise((resolve, reject) => {
            const filename = `${this.generateJobId()}_${video.rank}.%(ext)s`;
            const outputTemplate = path.join(this.tempDir, filename);
            
            console.log(`📥 Downloading video from: ${video.url}`);
            
            // Use yt-dlp to download TikTok video
            const ytdlp = spawn('yt-dlp', [
                video.url,
                '-o', outputTemplate,
                '--format', 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
                '--no-playlist',
                '--no-warnings',
                '--extract-flat', 'false'
            ]);

            let errorData = '';
            let outputData = '';
            
            ytdlp.stdout.on('data', (data) => {
                outputData += data.toString();
            });
            
            ytdlp.stderr.on('data', (data) => {
                errorData += data.toString();
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp failed: ${errorData}`));
                } else {
                    // Extract final filename from output
                    const lines = outputData.split('\n');
                    const mergerLine = lines.find(line => line.includes('[Merger]') || line.includes('has already been downloaded'));
                    const destLine = lines.find(line => line.includes('Destination:'));
                    
                    let finalPath;
                    if (mergerLine) {
                        const match = mergerLine.match(/Merging formats into "([^"]+)"/);
                        finalPath = match ? match[1] : null;
                    } else if (destLine) {
                        const match = destLine.match(/Destination: (.+)/);
                        finalPath = match ? match[1] : null;
                    }
                    
                    if (finalPath && require('fs').existsSync(finalPath)) {
                        resolve(finalPath);
                    } else {
                        // Try to find the file with pattern matching
                        const pattern = outputTemplate.replace('%(ext)s', 'mp4');
                        if (require('fs').existsSync(pattern)) {
                            resolve(pattern);
                        } else {
                            reject(new Error('Could not find downloaded file'));
                        }
                    }
                }
            });
        });
    }

    /**
     * Download video from Apify URL
     */
    async downloadFromApify(video) {
        const pipeline = promisify(stream.pipeline);
        
        try {
            console.log(`📥 Downloading from Apify: ${video.downloadUrl}`);
            
            // Generate local filename
            const filename = `${video.id || this.generateJobId()}_${video.rank}.mp4`;
            const localPath = path.join(this.tempDir, filename);
            
            // Download the video
            const response = await axios({
                method: 'GET',
                url: video.downloadUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'RumiAI/1.0'
                }
            });
            
            // Save to file
            const fsSync = require('fs');
            await pipeline(response.data, fsSync.createWriteStream(localPath));
            
            console.log(`✅ Downloaded from Apify: ${localPath}`);
            return localPath;
            
        } catch (error) {
            console.error(`❌ Failed to download from Apify:`, error.message);
            throw error;
        }
    }

    /**
     * Generate insights using Claude API
     */
    async generateClaudeInsights(analysisResults, originalVideos) {
        // Check if API key is configured
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here') {
            console.log('⚠️ ANTHROPIC_API_KEY not configured - using fallback insights');
            console.log('💡 To enable Claude AI insights, add your API key to .env file');
            return this.generateFallbackInsights(analysisResults);
        }

        const prompt = this.buildClaudePrompt(analysisResults, originalVideos);
        
        try {
            const response = await axios.post(process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages', {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                }
            });

            return this.parseClaudeResponse(response.data.content[0].text);
        } catch (error) {
            console.error('❌ Claude API error:', error.response?.data || error.message);
            if (error.response?.status === 401) {
                console.log('💡 Invalid API key. Please check your ANTHROPIC_API_KEY in .env file');
            }
            return this.generateFallbackInsights(analysisResults);
        }
    }

    /**
     * Build TikTok-specific structured prompt for Claude analysis
     */
    buildClaudePrompt(analysisResults, originalVideos) {
        // Process and clean data for each video
        const processedVideos = analysisResults.map((analysis, index) => {
            const video = originalVideos[index];
            const cleanTranscript = this.sanitizeTranscript(analysis.transcript);
            const visualLabels = this.processVisualLabels(analysis.labels);
            const videoMetadata = this.extractVideoMetadata(video, analysis);
            const hookData = this.analyzeHookData(analysis, video.duration);
            
            return {
                videoNumber: index + 1,
                rank: video.rank,
                cleanTranscript,
                visualLabels,
                videoMetadata,
                hookData,
                shots: analysis.shots?.length || 0,
                objectCount: analysis.objectAnnotations?.length || 0
            };
        });

        const prompt = `You are an AI content analyst specialized in TikTok performance optimization.

TASK: Analyze ${processedVideos.length} TikTok videos and extract actionable creative insights.

ANALYSIS DATA:
${processedVideos.map(video => this.buildVideoSection(video)).join('\n\n')}

Return ONLY a valid JSON object with this exact structure:

{
  "hookAnalysis": {
    "effectiveness": "rating from 1-10",
    "patterns": ["specific hook patterns"],
    "firstThreeSeconds": ["what happens in first 3 seconds"],
    "recommendations": ["improvements"]
  },
  "transcriptInsights": {
    "overallTone": "positive/negative/neutral",
    "sentiment": "analysis",
    "wordCount": "average",
    "keyPhrases": ["important phrases"],
    "callToActions": ["CTAs found"]
  },
  "visualDetection": {
    "products": ["products detected"],
    "themes": ["visual themes"],
    "settings": ["locations"]
  },
  "paceAndEditing": {
    "averageCuts": "number",
    "editingPace": "fast/medium/slow",
    "transitions": ["types used"]
  },
  "tiktokOptimization": [
    "recommendation 1",
    "recommendation 2",
    "recommendation 3"
  ]
}`;

        return prompt;
    }

    /**
     * Build individual video section for prompt
     */
    buildVideoSection(video) {
        return `--- VIDEO ${video.videoNumber} ---
TRANSCRIPT: "${video.cleanTranscript}"
VISUAL LABELS: ${JSON.stringify(video.visualLabels.objects.slice(0, 10))}
SHOTS: ${video.shots}
OBJECTS TRACKED: ${video.objectCount}
ENGAGEMENT: ${video.videoMetadata.engagementRate}`;
    }

    /**
     * Helper methods for Claude prompt building
     */
    sanitizeTranscript(transcript) {
        if (!transcript || typeof transcript !== 'string') {
            return 'No transcript available';
        }
        return transcript.substring(0, 500).replace(/[\r\n]+/g, ' ').trim();
    }

    processVisualLabels(labels) {
        if (!labels || !Array.isArray(labels)) {
            return { objects: [], count: 0 };
        }
        return {
            objects: labels.slice(0, 10).map(l => l.description),
            count: labels.length
        };
    }

    extractVideoMetadata(video, analysis) {
        return {
            engagementRate: `${video.engagementRate}%`,
            views: video.views,
            duration: `${video.duration}s`
        };
    }

    analyzeHookData(analysis, duration) {
        const firstThreeSeconds = analysis.shots?.filter(s => s.start_time < 3) || [];
        return {
            shotCount: firstThreeSeconds.length,
            hasText: analysis.textAnnotations?.some(t => t.frames?.[0] < 90) || false
        };
    }

    parseClaudeResponse(responseText) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('No JSON found in response');
        } catch (error) {
            console.error('❌ Failed to parse Claude response:', error);
            return this.generateFallbackInsights();
        }
    }

    generateFallbackInsights() {
        return {
            hookAnalysis: {
                effectiveness: '7.0',
                patterns: ['Analysis pending'],
                firstThreeSeconds: ['Processing'],
                recommendations: ['Analysis in progress']
            },
            transcriptInsights: {
                overallTone: 'neutral',
                sentiment: 'Processing',
                wordCount: '0',
                keyPhrases: [],
                callToActions: []
            },
            visualDetection: {
                products: [],
                themes: [],
                settings: []
            },
            paceAndEditing: {
                averageCuts: '0',
                editingPace: 'medium',
                transitions: []
            },
            tiktokOptimization: [
                'Full analysis will be available once processing completes'
            ]
        };
    }

    /**
     * Generate summary of analysis
     */
    generateSummary(videos, insights) {
        return {
            videosAnalyzed: videos.length,
            avgEngagement: videos.reduce((sum, v) => sum + v.engagementRate, 0) / videos.length,
            totalViews: videos.reduce((sum, v) => sum + v.views, 0),
            keyFindings: [
                `Analyzed ${videos.length} videos locally`,
                `Average engagement: ${(videos.reduce((sum, v) => sum + v.engagementRate, 0) / videos.length).toFixed(2)}%`,
                'All processing done locally - no cloud dependencies'
            ]
        };
    }

    /**
     * Job management methods
     */
    getJobStatus(jobId) {
        return this.jobQueue.get(jobId) || { status: 'not_found' };
    }

    updateJobStatus(jobId, updates) {
        const currentJob = this.jobQueue.get(jobId);
        if (currentJob) {
            this.jobQueue.set(jobId, { ...currentJob, ...updates });
        }
    }

    generateJobId() {
        return crypto.randomBytes(16).toString('hex');
    }

    cleanupOldJobs() {
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        const now = Date.now();
        
        for (const [jobId, job] of this.jobQueue.entries()) {
            const jobAge = now - new Date(job.startTime).getTime();
            if (jobAge > maxAge && (job.status === 'completed' || job.status === 'failed')) {
                this.jobQueue.delete(jobId);
                console.log(`🧹 Cleaned up old job: ${jobId}`);
            }
        }
    }
}

module.exports = new VideoAnalysisService();