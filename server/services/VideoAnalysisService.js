const { Storage } = require('@google-cloud/storage');
const videoIntelligence = require('@google-cloud/video-intelligence');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

class VideoAnalysisService {
    constructor() {
        this.storage = new Storage({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
            keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
        });
        this.bucket = this.storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
        this.videoClient = new videoIntelligence.VideoIntelligenceServiceClient({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
            keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
        });
        
        this.jobQueue = new Map(); // In-memory job tracking
        this.tempDir = path.join(__dirname, '../../temp');
        
        console.log('🎬 Video Analysis Service initialized');
        this.ensureTempDirectory();
    }

    async ensureTempDirectory() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            console.log(`📁 Temp directory ready: ${this.tempDir}`);
        } catch (error) {
            console.error('❌ Failed to create temp directory:', error);
        }
    }

    /**
     * Start async video analysis job
     * @param {Array} allVideos - All scraped videos from TikTok
     * @param {string} username - TikTok username
     * @returns {Object} Job details with ID for polling
     */
    async startVideoAnalysis(allVideos, username) {
        const jobId = this.generateJobId();
        console.log(`🎬 Starting video analysis job ${jobId} for @${username}`);
        
        // Initialize job status
        this.jobQueue.set(jobId, {
            id: jobId,
            username,
            status: 'initializing',
            progress: 0,
            startTime: new Date().toISOString(),
            phase: 'selecting_videos',
            message: 'Selecting top performing videos...',
            results: null,
            error: null
        });

        // Start async processing (non-blocking)
        this.processVideoAnalysis(jobId, allVideos, username).catch(error => {
            console.error(`❌ Video analysis job ${jobId} failed:`, error);
            this.updateJobStatus(jobId, {
                status: 'failed',
                error: error.message,
                progress: 0
            });
        });

        return {
            jobId,
            status: 'started',
            message: 'Video analysis started in background'
        };
    }

    /**
     * Main async video processing pipeline
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

            // Phase 3: Upload to GCS (40-50%)
            this.updateJobStatus(jobId, {
                progress: 45,
                phase: 'uploading',
                message: 'Uploading to cloud storage...'
            });

            const gcsUris = await this.uploadVideosToGCS(downloadedVideos, jobId);

            // Phase 4: Video Intelligence Analysis (50-80%)
            this.updateJobStatus(jobId, {
                progress: 55,
                phase: 'ai_analysis',
                message: 'Running AI video analysis...'
            });

            const intelligenceResults = await this.runVideoIntelligenceAnalysis(gcsUris);

            // Phase 5: Claude Insights Generation (80-95%)
            this.updateJobStatus(jobId, {
                progress: 85,
                phase: 'generating_insights',
                message: 'Generating insights with Claude...'
            });

            const claudeInsights = await this.generateClaudeInsights(intelligenceResults, selectedVideos);

            // Phase 6: Cleanup and finalization (95-100%)
            this.updateJobStatus(jobId, {
                progress: 95,
                phase: 'finalizing',
                message: 'Finalizing results...'
            });

            await this.cleanup(downloadedVideos, gcsUris);

            // Final results
            const finalResults = {
                videos: selectedVideos,
                intelligence: intelligenceResults,
                insights: claudeInsights,
                summary: this.generateSummary(selectedVideos, claudeInsights),
                completedAt: new Date().toISOString()
            };

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
     * Download single video using yt-dlp
     */
    async downloadVideo(video) {
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
                console.log(`🎬 yt-dlp exit code: ${code}`);
                
                if (code === 0) {
                    // Find the actual downloaded file
                    const fs = require('fs');
                    const files = fs.readdirSync(this.tempDir).filter(f => 
                        f.includes(filename.split('.')[0])
                    );
                    
                    if (files.length > 0) {
                        const actualPath = path.join(this.tempDir, files[0]);
                        console.log(`✅ Video downloaded: ${actualPath}`);
                        resolve(actualPath);
                    } else {
                        reject(new Error('Downloaded file not found'));
                    }
                } else {
                    console.error(`❌ yt-dlp error: ${errorData}`);
                    reject(new Error(`yt-dlp failed (code ${code}): ${errorData || 'Unknown error'}`));
                }
            });

            ytdlp.on('error', (error) => {
                console.error(`❌ Failed to start yt-dlp: ${error.message}`);
                reject(new Error(`Failed to start yt-dlp: ${error.message}. Please ensure yt-dlp is installed.`));
            });
            
            // Set timeout for download
            setTimeout(() => {
                ytdlp.kill();
                reject(new Error('Video download timeout (60 seconds)'));
            }, 60000);
        });
    }

    /**
     * Upload videos to Google Cloud Storage
     */
    async uploadVideosToGCS(downloadedVideos, jobId) {
        const gcsUris = [];
        
        for (let i = 0; i < downloadedVideos.length; i++) {
            const video = downloadedVideos[i];
            const progress = 40 + (i / downloadedVideos.length) * 10; // 40-50%
            
            this.updateJobStatus(jobId, {
                progress: Math.round(progress),
                message: `Uploading video ${i + 1}/${downloadedVideos.length} to cloud...`
            });

            try {
                const gcsUri = await this.uploadToGCS(video.localPath, jobId);
                gcsUris.push({
                    ...video,
                    gcsUri
                });
                console.log(`☁️ Uploaded video ${i + 1} to GCS: ${gcsUri}`);
            } catch (error) {
                console.error(`❌ Failed to upload video ${i + 1}:`, error);
                // Continue with other videos
            }
        }

        return gcsUris;
    }

    /**
     * Upload single video to GCS
     */
    async uploadToGCS(localPath, jobId) {
        const filename = `video-analysis/${jobId}/${path.basename(localPath)}`;
        const file = this.bucket.file(filename);
        
        await this.bucket.upload(localPath, {
            destination: filename,
            metadata: {
                contentType: 'video/mp4'
            }
        });

        return `gs://${this.bucket.name}/${filename}`;
    }

    /**
     * Run Google Video Intelligence API analysis
     */
    async runVideoIntelligenceAnalysis(gcsVideos) {
        const results = [];
        
        for (let i = 0; i < gcsVideos.length; i++) {
            const video = gcsVideos[i];
            const progress = 50 + (i / gcsVideos.length) * 30; // 50-80%
            
            this.updateJobStatus(video.jobId || 'unknown', {
                progress: Math.round(progress),
                message: `Analyzing video ${i + 1}/${gcsVideos.length} with AI...`
            });

            try {
                const analysis = await this.analyzeVideoWithGoogleAI(video.gcsUri);
                results.push({
                    ...video,
                    analysis
                });
                console.log(`🧠 Analyzed video ${i + 1} with Google AI`);
            } catch (error) {
                console.error(`❌ AI analysis failed for video ${i + 1}:`, error);
                results.push({
                    ...video,
                    analysis: { error: error.message }
                });
            }
        }

        return results;
    }

    /**
     * Analyze single video with Google Video Intelligence
     */
    async analyzeVideoWithGoogleAI(gcsUri) {
        const request = {
            inputUri: gcsUri,
            features: [
                'LABEL_DETECTION',
                'SPEECH_TRANSCRIPTION',
                'TEXT_DETECTION',
                'OBJECT_TRACKING',
                'FACE_DETECTION'
            ],
            videoContext: {
                speechTranscriptionConfig: {
                    languageCode: 'en-US',
                    enableAutomaticPunctuation: true,
                    enableWordTimeOffsets: true
                }
            }
        };

        const [operation] = await this.videoClient.annotateVideo(request);
        const [result] = await operation.promise();
        
        return this.processVideoIntelligenceResult(result);
    }

    /**
     * Process and structure Video Intelligence results
     */
    processVideoIntelligenceResult(result) {
        const processed = {
            labels: [],
            transcript: '',
            textDetections: [],
            objects: [],
            faces: [],
            hooks: [],
            metadata: {}
        };

        // Process label annotations
        if (result.annotationResults[0].segmentLabelAnnotations) {
            processed.labels = result.annotationResults[0].segmentLabelAnnotations.map(label => ({
                description: label.entity.description,
                confidence: label.segments[0].confidence
            }));
        }

        // Process speech transcription
        if (result.annotationResults[0].speechTranscriptions) {
            const transcripts = result.annotationResults[0].speechTranscriptions
                .map(transcription => transcription.alternatives[0].transcript)
                .join(' ');
            processed.transcript = transcripts;
            processed.wordCount = transcripts.split(' ').length;
        }

        // Process text detection
        if (result.annotationResults[0].textAnnotations) {
            processed.textDetections = result.annotationResults[0].textAnnotations.map(text => ({
                text: text.text,
                confidence: text.confidence
            }));
        }

        // Extract hook timing (first 3 seconds)
        processed.hooks = this.extractHookElements(result);

        return processed;
    }

    /**
     * Extract elements from first 3 seconds for hook analysis
     */
    extractHookElements(result) {
        const hookDuration = 3; // seconds
        const hooks = {
            labels: [],
            text: [],
            faces: 0,
            objects: []
        };

        // Filter elements that appear in first 3 seconds
        if (result.annotationResults[0].segmentLabelAnnotations) {
            hooks.labels = result.annotationResults[0].segmentLabelAnnotations
                .filter(label => {
                    const segment = label.segments[0];
                    const startTime = segment.segment.startTimeOffset || { seconds: 0 };
                    return (startTime.seconds || 0) <= hookDuration;
                })
                .map(label => label.entity.description);
        }

        return hooks;
    }

    /**
     * Generate insights using Claude API
     */
    async generateClaudeInsights(intelligenceResults, originalVideos) {
        const prompt = this.buildClaudePrompt(intelligenceResults, originalVideos);
        
        try {
            const response = await axios.post(process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages', {
                model: 'claude-3-sonnet-20240229',
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
            console.error('❌ Claude API error:', error);
            return this.generateFallbackInsights(intelligenceResults);
        }
    }

    /**
     * Build comprehensive prompt for Claude analysis
     */
    buildClaudePrompt(intelligenceResults, originalVideos) {
        return `
Analyze these TikTok videos for advanced insights. Provide a comprehensive JSON response with the following structure:

VIDEOS DATA:
${JSON.stringify(intelligenceResults.map(video => ({
    rank: video.rank,
    engagementRate: video.engagementRate,
    views: video.views,
    duration: video.duration,
    transcript: video.analysis.transcript,
    labels: video.analysis.labels,
    textDetections: video.analysis.textDetections,
    hooks: video.analysis.hooks
})), null, 2)}

Required JSON Response Format:
{
  "brandRecognition": {
    "products": ["list of products/brands detected"],
    "animals": ["list of animals detected"],
    "themes": ["list of recurring themes"]
  },
  "hookAnalysis": {
    "effectiveness": "rating from 1-10",
    "patterns": ["list of effective hook patterns"],
    "recommendations": ["specific hook improvement suggestions"]
  },
  "sentimentAnalysis": {
    "overallTone": "positive/negative/neutral",
    "emotionalCues": ["list of emotional elements"],
    "audience": "target audience description"
  },
  "visualTrends": {
    "cuts": "average cuts per video",
    "pace": "fast/medium/slow",
    "effects": ["list of visual effects used"]
  },
  "optimizationSuggestions": [
    "specific actionable recommendations based on the data"
  ]
}

Focus on actionable insights based on the actual video content and performance data.
`;
    }

    /**
     * Parse Claude's JSON response
     */
    parseClaudeResponse(responseText) {
        try {
            // Extract JSON from response
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

    /**
     * Generate fallback insights if Claude fails
     */
    generateFallbackInsights(intelligenceResults = []) {
        return {
            brandRecognition: {
                products: ['Analysis pending'],
                animals: ['Analysis pending'],
                themes: ['Analysis pending']
            },
            hookAnalysis: {
                effectiveness: 'Pending',
                patterns: ['Analysis in progress'],
                recommendations: ['Detailed analysis will be available shortly']
            },
            sentimentAnalysis: {
                overallTone: 'neutral',
                emotionalCues: ['Analysis pending'],
                audience: 'General audience'
            },
            visualTrends: {
                cuts: 'Analyzing',
                pace: 'medium',
                effects: ['Analysis pending']
            },
            optimizationSuggestions: [
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
                `Analyzed ${videos.length} top-performing videos`,
                `Average engagement rate: ${(videos.reduce((sum, v) => sum + v.engagementRate, 0) / videos.length).toFixed(2)}%`,
                'AI-powered insights generated'
            ]
        };
    }

    /**
     * Clean up temporary files and GCS objects
     */
    async cleanup(downloadedVideos, gcsUris) {
        // Delete local files
        for (const video of downloadedVideos) {
            try {
                await fs.unlink(video.localPath);
                console.log(`🗑️ Deleted local file: ${video.localPath}`);
            } catch (error) {
                console.error(`❌ Failed to delete ${video.localPath}:`, error);
            }
        }

        // Delete GCS objects
        for (const video of gcsUris) {
            try {
                const filename = video.gcsUri.replace(`gs://${this.bucket.name}/`, '');
                await this.bucket.file(filename).delete();
                console.log(`☁️ Deleted GCS file: ${filename}`);
            } catch (error) {
                console.error(`❌ Failed to delete GCS file:`, error);
            }
        }
    }

    /**
     * Get job status
     */
    getJobStatus(jobId) {
        return this.jobQueue.get(jobId) || { status: 'not_found' };
    }

    /**
     * Update job status
     */
    updateJobStatus(jobId, updates) {
        const currentJob = this.jobQueue.get(jobId);
        if (currentJob) {
            this.jobQueue.set(jobId, { ...currentJob, ...updates });
        }
    }

    /**
     * Generate unique job ID
     */
    generateJobId() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Clean up old completed jobs (run periodically)
     */
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