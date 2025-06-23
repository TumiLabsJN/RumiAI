const { Storage } = require('@google-cloud/storage');
const videoIntelligence = require('@google-cloud/video-intelligence');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const CredentialValidator = require('../utils/credentialValidator');

class VideoAnalysisService {
    constructor() {
        // Validate Google Cloud credentials using shared validator
        CredentialValidator.validateCredentials(true);
        
        // Initialize Google Cloud Storage with explicit credentials to bypass gcloud config
        const credentialPath = CredentialValidator.getResolvedCredentialPath();
        this.storage = new Storage({
            keyFilename: credentialPath
        });
        this.bucket = this.storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'tiktok-video-analysis-jorge');
        
        // Initialize Video Intelligence client with explicit credentials
        this.videoClient = new videoIntelligence.VideoIntelligenceServiceClient({
            keyFilename: credentialPath
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
            
            // Also ensure output directory exists
            const outputDir = path.join(__dirname, '../../outputs/video-analysis');
            await fs.mkdir(outputDir, { recursive: true });
            console.log(`📁 Output directory ready: ${outputDir}`);
        } catch (error) {
            console.error('❌ Failed to create directories:', error);
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
     * Upload single video to GCS using Node.js SDK with ADC
     */
    async uploadToGCS(localPath, jobId) {
        const filename = `video-analysis/${jobId}/${path.basename(localPath)}`;
        const gcsUri = `gs://${this.bucket.name}/${filename}`;
        
        console.log(`📂 [VideoAnalysisService] Local file: ${localPath}`);
        console.log(`🎯 [VideoAnalysisService] Destination: ${gcsUri}`);
        
        try {
            // Get file stats for logging
            const stats = await fs.stat(localPath);
            console.log(`📊 [VideoAnalysisService] File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Upload using Google Cloud Storage SDK with ADC
            console.log(`☁️  [VideoAnalysisService] Uploading to GCS using Node.js SDK...`);
            
            const [file] = await this.bucket.upload(localPath, {
                destination: filename,
                metadata: {
                    contentType: 'video/mp4',
                    metadata: {
                        uploadedAt: new Date().toISOString(),
                        originalFilename: path.basename(localPath),
                        uploadMethod: 'nodejs-sdk-adc',
                        service: 'VideoAnalysisService',
                        jobId: jobId
                    }
                },
                resumable: true, // Enable resumable uploads for large files
                validation: 'crc32c' // Enable data integrity validation
            });
            
            console.log(`✅ [VideoAnalysisService] Upload successful`);
            console.log(`📊 [VideoAnalysisService] GCS file: ${file.name}`);
            console.log(`🔒 [VideoAnalysisService] Generation: ${file.generation}`);
            
            return gcsUri;
            
        } catch (error) {
            console.error(`❌ [VideoAnalysisService] Upload failed: ${error.message}`);
            console.error(`📊 [VideoAnalysisService] Error details:`, {
                code: error.code,
                message: error.message,
                localPath,
                filename,
                bucketName: this.bucket.name
            });
            
            // Additional error context for ADC-related issues
            if (error.code === 401 || error.code === 403) {
                console.error(`🔑 [VideoAnalysisService] Authentication error. Ensure GOOGLE_APPLICATION_CREDENTIALS is set correctly.`);
                console.error(`💡 [VideoAnalysisService] Current GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET'}`);
            }
            
            throw error;
        }
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
                // Generate video ID from video data
                const videoId = video.id || `${video.username || 'unknown'}_${video.rank || i}`;
                const analysis = await this.analyzeVideoWithGoogleAI(video.gcsUri, videoId);
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
    async analyzeVideoWithGoogleAI(gcsUri, videoId = null) {
        const request = {
            inputUri: gcsUri,
            features: [
                'LABEL_DETECTION',
                'SHOT_CHANGE_DETECTION',
                'EXPLICIT_CONTENT_DETECTION',
                'TEXT_DETECTION',
                'OBJECT_TRACKING',
                'PERSON_DETECTION',
                'SPEECH_TRANSCRIPTION'
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
        
        // Process the result
        const processed = this.processVideoIntelligenceResult(result);
        
        // Save the raw and processed results if videoId is provided
        if (videoId) {
            await this.saveVideoAnalysisResults(videoId, result, processed);
        }
        
        return processed;
    }

    /**
     * Process and structure Video Intelligence results
     */
    processVideoIntelligenceResult(result) {
        const processed = {
            labels: [],
            shots: [],
            explicitContent: null,
            textAnnotations: [],
            objectAnnotations: [],
            personAnnotations: [],
            speechTranscriptions: []
        };

        // Safely access annotation results
        const annotations = result.annotationResults && result.annotationResults[0] ? result.annotationResults[0] : {};

        // Process label annotations
        if (annotations.segmentLabelAnnotations) {
            processed.labels = annotations.segmentLabelAnnotations.map(label => ({
                description: label.entity.description,
                confidence: label.segments[0].confidence,
                segments: label.segments
            }));
        }

        // Process shot label annotations (additional labels per shot)
        if (annotations.shotLabelAnnotations) {
            processed.shotLabels = annotations.shotLabelAnnotations.map(label => ({
                description: label.entity.description,
                segments: label.segments
            }));
        }

        // Process shot change detection
        if (annotations.shotAnnotations) {
            processed.shots = annotations.shotAnnotations.map(shot => ({
                startTime: shot.startTimeOffset,
                endTime: shot.endTimeOffset
            }));
        }

        // Process explicit content detection
        if (annotations.explicitAnnotation) {
            processed.explicitContent = {
                frames: annotations.explicitAnnotation.frames || []
            };
        }

        // Process text detection - store full annotation data
        if (annotations.textAnnotations) {
            processed.textAnnotations = annotations.textAnnotations.map(text => ({
                text: text.text || '',
                confidence: text.confidence || 0,
                frames: text.frames || [],
                segments: text.segments || []
            }));
        }

        // Process object tracking - store full annotation data
        if (annotations.objectAnnotations) {
            processed.objectAnnotations = annotations.objectAnnotations.map(obj => ({
                entity: obj.entity ? {
                    entityId: obj.entity.entityId,
                    description: obj.entity.description || '',
                    languageCode: obj.entity.languageCode
                } : null,
                confidence: obj.confidence || 0,
                frames: obj.frames || [],
                tracks: obj.tracks || []
            }));
        }

        // Process person detection - store full annotation data
        if (annotations.personDetectionAnnotations) {
            processed.personAnnotations = annotations.personDetectionAnnotations.map(person => ({
                tracks: person.tracks || [],
                version: person.version || null
            }));
        }

        // Process speech transcription - store full annotation data
        if (annotations.speechTranscriptions) {
            processed.speechTranscriptions = annotations.speechTranscriptions.map(transcription => ({
                alternatives: transcription.alternatives || [],
                languageCode: transcription.languageCode || 'en-US'
            }));
            
            // Also create a simple transcript string for backward compatibility
            processed.transcript = annotations.speechTranscriptions
                .map(transcription => transcription.alternatives && transcription.alternatives[0] ? 
                     transcription.alternatives[0].transcript : '')
                .join(' ');
            processed.wordCount = processed.transcript.split(' ').filter(word => word.length > 0).length;
        }

        // Extract hook timing (first 3 seconds) for analysis
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
     * Build TikTok-specific structured prompt for Claude analysis
     */
    buildClaudePrompt(intelligenceResults, originalVideos) {
        // Process and clean data for each video
        const processedVideos = intelligenceResults.map((video, index) => {
            const cleanTranscript = this.sanitizeTranscript(video.analysis.transcript);
            const visualLabels = this.processVisualLabels(video.analysis.labels);
            const videoMetadata = this.extractVideoMetadata(video, originalVideos[index]);
            const hookData = this.analyzeHookData(video.analysis.hooks, video.duration);
            
            return {
                videoNumber: index + 1,
                rank: video.rank,
                cleanTranscript,
                visualLabels,
                videoMetadata,
                hookData
            };
        });

        // Count total tokens to manage Claude's limits
        const estimatedTokens = this.estimateTokenCount(processedVideos);
        console.log(`📊 Estimated prompt tokens: ${estimatedTokens}`);

        // Chunk if necessary (Claude-3-Sonnet has ~200k context limit)
        const finalVideos = estimatedTokens > 150000 ? 
            this.chunkLargeTranscripts(processedVideos) : 
            processedVideos;

        const prompt = `You are an AI content analyst specialized in TikTok performance optimization for creators and brands.

TASK: Analyze ${finalVideos.length} TikTok videos and extract actionable creative insights focused on:
- Hook effectiveness (first 3 seconds)
- TikTok algorithm optimization
- Engagement-driving elements
- Viral potential indicators
- Content strategy recommendations

ANALYSIS DATA:
${finalVideos.map(video => this.buildVideoSection(video)).join('\n\n')}

ENGAGEMENT CONTEXT:
${this.buildEngagementContext(originalVideos)}

TikTok Algorithm Considerations:
- Vertical video format optimized for mobile
- Algorithm favors watch time, completion rate, and immediate engagement
- Hook quality in first 3 seconds is critical for algorithm promotion
- Trending sounds and effects boost discoverability
- Authentic, relatable content performs better than polished production

Return ONLY a valid JSON object with this exact structure:

{
  "hookAnalysis": {
    "effectiveness": "rating from 1-10 with decimal precision",
    "patterns": ["specific hook patterns that work well", "opening techniques used"],
    "firstThreeSeconds": ["what happens in the critical first 3 seconds of top videos"],
    "recommendations": ["specific improvements to hook strategy", "timing adjustments"]
  },
  "transcriptInsights": {
    "overallTone": "positive/negative/neutral/mixed",
    "sentiment": "detailed sentiment analysis of spoken content",
    "wordCount": "average word count per video",
    "keyPhrases": ["most impactful phrases", "repeated themes"],
    "callToActions": ["identified CTAs", "effectiveness assessment"]
  },
  "visualDetection": {
    "products": ["specific products/brands detected"],
    "animals": ["animals or pets identified"],
    "logos": ["brand logos or text overlays"],
    "themes": ["recurring visual themes", "consistent styling"],
    "settings": ["common locations or backgrounds"]
  },
  "paceAndEditing": {
    "averageCuts": "estimated cuts per video",
    "editingPace": "fast/medium/slow",
    "transitions": ["transition types used", "editing techniques"],
    "effects": ["TikTok effects and filters used"],
    "visualStyle": "description of overall visual approach"
  },
  "tiktokOptimization": [
    "specific TikTok algorithm optimization recommendations",
    "engagement-driving improvements",
    "hook timing adjustments",
    "content format suggestions",
    "trend utilization strategies"
  ]
}

Focus on TikTok-specific insights that can directly improve engagement and algorithm performance.`;

        return prompt;
    }

    /**
     * Build individual video section for prompt
     */
    buildVideoSection(video) {
        return `--- VIDEO ${video.videoNumber} (Rank #${video.rank}) ---

TRANSCRIPT:
"""
${video.cleanTranscript}
"""

VISUAL ELEMENTS DETECTED:
${JSON.stringify(video.visualLabels, null, 2)}

VIDEO PERFORMANCE DATA:
${JSON.stringify(video.videoMetadata, null, 2)}

HOOK ANALYSIS (First 3 Seconds):
${JSON.stringify(video.hookData, null, 2)}`;
    }

    /**
     * Build engagement context across all videos
     */
    buildEngagementContext(originalVideos) {
        const totalVideos = originalVideos.length;
        const avgEngagement = originalVideos.reduce((sum, v) => sum + v.engagementRate, 0) / totalVideos;
        const totalViews = originalVideos.reduce((sum, v) => sum + v.views, 0);
        const avgDuration = originalVideos.reduce((sum, v) => sum + (v.duration || 30), 0) / totalVideos;

        return `Total Videos Analyzed: ${totalVideos}
Average Engagement Rate: ${avgEngagement.toFixed(2)}%
Total Combined Views: ${totalViews.toLocaleString()}
Average Video Duration: ${avgDuration.toFixed(1)} seconds
Analysis Period: Mix of recent (0-30 days) and historical (30-60 days) content`;
    }

    /**
     * Sanitize transcript for prompt safety
     */
    sanitizeTranscript(transcript) {
        if (!transcript || typeof transcript !== 'string') {
            return 'No transcript available';
        }

        return transcript
            .replace(/["""]/g, '"')  // Normalize quotes
            .replace(/[\r\n]+/g, ' ')  // Replace line breaks with spaces
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .trim()
            .substring(0, 2000);  // Limit length to prevent token overflow
    }

    /**
     * Process visual labels into structured format
     */
    processVisualLabels(labels) {
        if (!labels || !Array.isArray(labels)) {
            return { objects: [], confidence: 'low', count: 0 };
        }

        const processed = labels
            .filter(label => label.confidence > 0.5)  // Only high-confidence labels
            .map(label => ({
                description: label.description,
                confidence: Math.round(label.confidence * 100) / 100
            }))
            .slice(0, 20);  // Limit to top 20 labels

        return {
            objects: processed,
            confidence: processed.length > 0 ? 'high' : 'low',
            count: processed.length
        };
    }

    /**
     * Extract video metadata
     */
    extractVideoMetadata(video, originalVideo) {
        return {
            rank: video.rank,
            engagementRate: `${video.engagementRate}%`,
            views: video.views.toLocaleString(),
            likes: video.likes.toLocaleString(),
            comments: video.comments.toLocaleString(),
            shares: video.shares.toLocaleString(),
            duration: `${video.duration}s`,
            createTime: video.createTime,
            timePeriod: video.rank <= 3 ? 'Recent (0-30 days)' : 'Historical (30-60 days)'
        };
    }

    /**
     * Analyze hook data from first 3 seconds
     */
    analyzeHookData(hooks, duration) {
        if (!hooks) {
            return { elements: [], timing: 'unknown', effectiveness: 'unknown' };
        }

        return {
            elements: hooks.labels || [],
            textOverlays: hooks.text || [],
            faceCount: hooks.faces || 0,
            objects: hooks.objects || [],
            timing: '0-3 seconds',
            duration: `${duration}s total`
        };
    }

    /**
     * Estimate token count for prompt management
     */
    estimateTokenCount(processedVideos) {
        const basePromptTokens = 1500;  // Base prompt structure
        const videoTokens = processedVideos.reduce((total, video) => {
            const transcriptTokens = Math.ceil((video.cleanTranscript?.length || 0) / 4);
            const metadataTokens = 200;  // Estimated for metadata
            return total + transcriptTokens + metadataTokens;
        }, 0);

        return basePromptTokens + videoTokens;
    }

    /**
     * Chunk large transcripts if needed
     */
    chunkLargeTranscripts(processedVideos) {
        console.log('⚠️ Large transcript detected, applying chunking...');
        
        return processedVideos.map(video => ({
            ...video,
            cleanTranscript: video.cleanTranscript.substring(0, 1000) + 
                (video.cleanTranscript.length > 1000 ? '... [truncated for length]' : '')
        }));
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
            hookAnalysis: {
                effectiveness: '7.0',
                patterns: ['Analysis in progress'],
                firstThreeSeconds: ['Video content analysis pending'],
                recommendations: ['Detailed hook analysis will be available shortly']
            },
            transcriptInsights: {
                overallTone: 'neutral',
                sentiment: 'Analysis pending - transcript processing in progress',
                wordCount: 'Calculating...',
                keyPhrases: ['Analysis pending'],
                callToActions: ['CTA analysis in progress']
            },
            visualDetection: {
                products: ['Analysis pending'],
                animals: ['Analysis pending'],
                logos: ['Analysis pending'],
                themes: ['Analysis pending'],
                settings: ['Analysis pending']
            },
            paceAndEditing: {
                averageCuts: 'Analyzing',
                editingPace: 'medium',
                transitions: ['Analysis pending'],
                effects: ['Analysis pending'],
                visualStyle: 'Analysis in progress'
            },
            tiktokOptimization: [
                'Full TikTok optimization analysis will be available once processing completes',
                'Algorithm insights pending video intelligence completion',
                'Engagement recommendations being generated'
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
     * Save video analysis results to JSON files
     */
    async saveVideoAnalysisResults(videoId, rawResult, processedResult) {
        try {
            const outputDir = path.join(__dirname, '../../outputs/video-analysis');
            
            // Ensure output directory exists
            await fs.mkdir(outputDir, { recursive: true });
            
            // Create filename based on video ID
            const filename = `${videoId}.json`;
            const filepath = path.join(outputDir, filename);
            
            // Combine raw and processed results
            const fullResult = {
                videoId: videoId,
                timestamp: new Date().toISOString(),
                processed: processedResult,
                raw: rawResult
            };
            
            // Write JSON file
            await fs.writeFile(filepath, JSON.stringify(fullResult, null, 2), 'utf8');
            console.log(`💾 Saved video analysis results to: ${filepath}`);
            
        } catch (error) {
            console.error(`❌ Failed to save video analysis results for ${videoId}:`, error);
            // Don't throw - we don't want to fail the entire analysis if save fails
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