/**
 * UnifiedTimelineAssembler.js
 * Merges outputs from all detection pipelines into a single JSON file per video
 * with fully synchronized, timestamped timelines for Claude prompts
 */

const fs = require('fs').promises;
const path = require('path');

class UnifiedTimelineAssembler {
    constructor() {
        this.outputBasePath = path.join(__dirname, '../../');
        // Use current directory if outputs is not writable
        this.unifiedOutputDir = path.join(this.outputBasePath, 'unified_analysis');
        this.ensureOutputDirectory();
    }

    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.unifiedOutputDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create unified output directory:', error);
        }
    }

    /**
     * Main assembly function - merges all pipeline outputs for a video
     * @param {string} videoId - The video ID to process
     * @param {Object} metadataSummary - Metadata from VideoAnalysisService
     * @param {Object} videoInfo - Basic video information (duration, fps, etc.)
     * @param {string} username - Optional username for local file paths
     * @returns {Object} Unified analysis object
     */
    async assembleUnifiedTimeline(videoId, metadataSummary = {}, videoInfo = {}, username = null) {
        console.log(`🔄 Assembling unified timeline for video: ${videoId}`);
        let unifiedAnalysis = null;

        try {
            // Determine the full video ID with username prefix if needed
            const fullVideoId = username ? `${username}_${videoId}` : videoId;
            
            // Load all available pipeline outputs
            const pipelineData = await this.loadAllPipelineOutputs(videoId, fullVideoId);
            
            // Extract frame count and duration
            const frameCount = this.extractFrameCount(pipelineData);
            const duration = videoInfo.duration || this.calculateDuration(frameCount, videoInfo.fps || 1);
            
            // Extract static metadata
            const staticMetadata = this.extractStaticMetadata(pipelineData, videoInfo, metadataSummary);
            
            // Build comprehensive metadata summary BEFORE building timelines
            // If we have Whisper data, merge it into the metadata summary
            if (pipelineData.whisper) {
                metadataSummary = {
                    ...metadataSummary,
                    ...pipelineData.whisper
                };
            }
            const enhancedMetadataSummary = this.buildMetadataSummary(videoInfo, metadataSummary, staticMetadata);
            
            // Build synchronized timelines using the enhanced metadata summary
            const timelines = this.buildSynchronizedTimelines(pipelineData, frameCount, enhancedMetadataSummary);
            
            // Generate insights
            const insights = this.generateInsights(pipelineData, timelines);
            
            // Assemble final unified object
            unifiedAnalysis = {
                video_id: videoId,
                processed_at: new Date().toISOString(),
                duration_seconds: duration,
                total_frames: frameCount,
                fps: videoInfo.fps || 1,
                
                // Static metadata
                static_metadata: staticMetadata,
                
                // Enhanced metadata summary
                metadata_summary: enhancedMetadataSummary,
                
                // Synchronized timelines
                timelines: timelines,
                
                // Derived insights
                insights: insights,
                
                // Pipeline status
                pipeline_status: {
                    yolo: pipelineData.yolo !== null,
                    mediapipe: pipelineData.mediapipe !== null,
                    ocr: pipelineData.ocr !== null,
                    audio: pipelineData.audio !== null,
                    metadata: Object.keys(metadataSummary).length > 0
                }
            };
            
            // Save to file
            await this.saveUnifiedAnalysis(videoId, unifiedAnalysis);
            
            console.log(`✅ Unified timeline assembled for ${videoId}`);
            return unifiedAnalysis;
            
        } catch (error) {
            console.error(`❌ Failed to assemble unified timeline for ${videoId}:`, error);
            
            // Try to save partial results if we have them
            if (unifiedAnalysis) {
                try {
                    unifiedAnalysis.error = error.message;
                    unifiedAnalysis.partial = true;
                    await this.saveUnifiedAnalysis(videoId, unifiedAnalysis);
                    console.log(`⚠️ Saved partial unified timeline for ${videoId}`);
                } catch (saveError) {
                    console.error(`❌ Failed to save partial results:`, saveError);
                }
            }
            
            throw error;
        }
    }

    /**
     * Load outputs from all detection pipelines
     */
    async loadAllPipelineOutputs(videoId, fullVideoId) {
        // Try with full video ID (including username) first, then fall back to just video ID
        const outputs = {
            yolo: await this.loadJsonFile(`object_detection_outputs/${fullVideoId}/${fullVideoId}_yolo_detections.json`) ||
                  await this.loadJsonFile(`object_detection_outputs/${videoId}/${videoId}_yolo_detections.json`),
            mediapipe: await this.loadJsonFile(`human_analysis_outputs/${fullVideoId}/${fullVideoId}_human_analysis.json`) ||
                       await this.loadJsonFile(`human_analysis_outputs/${videoId}/${videoId}_human_analysis.json`),
            ocr: await this.loadJsonFile(`creative_analysis_outputs/${fullVideoId}/${fullVideoId}_creative_analysis.json`) ||
                 await this.loadJsonFile(`creative_analysis_outputs/${videoId}/${videoId}_creative_analysis.json`),
            audio: await this.loadJsonFile(`audio_analysis_outputs/${fullVideoId}/${fullVideoId}_audio_analysis.json`) ||
                   await this.loadJsonFile(`audio_analysis_outputs/${videoId}/${videoId}_audio_analysis.json`),
            comprehensive: await this.loadJsonFile(`comprehensive_analysis_outputs/${fullVideoId}_comprehensive_analysis.json`) ||
                          await this.loadJsonFile(`comprehensive_analysis_outputs/${videoId}_comprehensive_analysis.json`),
            whisper: await this.loadJsonFile(`speech_transcriptions/${videoId}_whisper.json`) ||
                     await this.loadJsonFile(`speech_transcriptions/${fullVideoId}_whisper.json`),
            // Add local scene detection output
            scenes: await this.loadJsonFile(`scene_detection_outputs/${fullVideoId}/${fullVideoId}_scenes.json`) ||
                    await this.loadJsonFile(`scene_detection_outputs/${videoId}/${videoId}_scenes.json`)
        };
        
        console.log(`📊 Loaded pipeline outputs - YOLO: ${!!outputs.yolo}, MediaPipe: ${!!outputs.mediapipe}, OCR: ${!!outputs.ocr}, Scene: ${!!outputs.scenes}, Whisper: ${!!outputs.whisper}`);
        
        return outputs;
    }

    /**
     * Load a JSON file, returning null if not found
     */
    async loadJsonFile(relativePath) {
        try {
            const fullPath = path.join(this.outputBasePath, relativePath);
            const data = await fs.readFile(fullPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // File doesn't exist or can't be parsed - return null
            return null;
        }
    }

    /**
     * Extract total frame count from available data
     */
    extractFrameCount(pipelineData) {
        // Try different sources for frame count
        if (pipelineData.yolo?.summary?.total_frames) {
            return pipelineData.yolo.summary.total_frames;
        }
        if (pipelineData.mediapipe?.total_frames) {
            return pipelineData.mediapipe.total_frames;
        }
        if (pipelineData.ocr?.insights?.total_frames) {
            return pipelineData.ocr.insights.total_frames;
        }
        if (pipelineData.comprehensive?.frame_count) {
            return pipelineData.comprehensive.frame_count;
        }
        // Default to 1 if no frame count found
        return 1;
    }

    /**
     * Calculate duration from frame count and fps
     */
    calculateDuration(frameCount, fps) {
        return frameCount / fps;
    }

    /**
     * Build synchronized timelines from all pipeline data
     */
    buildSynchronizedTimelines(pipelineData, frameCount, metadataSummary) {
        const timelines = {
            gestureTimeline: this.buildGestureTimeline(pipelineData.mediapipe, frameCount, metadataSummary),
            expressionTimeline: this.buildExpressionTimeline(pipelineData.mediapipe, frameCount, metadataSummary),
            objectTimeline: this.buildObjectTimeline(pipelineData.yolo, frameCount, metadataSummary),
            stickerTimeline: this.buildStickerTimeline(pipelineData.ocr, frameCount, metadataSummary),
            textOverlayTimeline: this.buildTextOverlayTimeline(pipelineData.ocr, frameCount, metadataSummary),
            sceneChangeTimeline: this.buildSceneChangeTimeline(pipelineData, frameCount, metadataSummary),
            cameraDistanceTimeline: this.buildCameraDistanceTimeline(pipelineData.mediapipe, frameCount, metadataSummary),
            speechTimeline: this.buildSpeechTimeline(pipelineData.audio, frameCount, metadataSummary),
            audioRatioTimeline: this.buildAudioRatioTimeline(pipelineData.audio, frameCount)
        };
        
        return timelines;
    }

    /**
     * Build gesture timeline from MediaPipe data
     */
    buildGestureTimeline(mediapipeData, frameCount, metadataSummary) {
        const timeline = {};
        
        // Check both possible locations for gestures
        const gestures = mediapipeData?.insights?.timeline?.gestures || mediapipeData?.timeline?.gestures;
        
        if (gestures && Array.isArray(gestures)) {
            // Group gestures by frame
            const gesturesByFrame = {};
            gestures.forEach(gesture => {
                const frame = gesture.frame;
                if (!gesturesByFrame[frame]) {
                    gesturesByFrame[frame] = [];
                }
                gesturesByFrame[frame].push(gesture.gesture);
            });
            
            // Build timeline
            Object.entries(gesturesByFrame).forEach(([frame, frameGestures]) => {
                const timestamp = this.frameToTimestamp(parseInt(frame));
                timeline[timestamp] = {
                    frame: parseInt(frame),
                    gestures: frameGestures,
                    dominant: frameGestures[0] || 'none'
                };
            });
        }
        // If no MediaPipe data, check enhanced human analysis
        else if (metadataSummary?.enhancedHumanAnalysis?.primary_actions) {
            // Convert primary actions to gesture timeline
            const actions = metadataSummary.enhancedHumanAnalysis.primary_actions;
            Object.entries(actions).forEach(([action, count]) => {
                if (count > 0 && action !== 'none') {
                    // Distribute actions across the video duration
                    // This is a simplified approach - in reality, we'd need frame-level data
                    const timestamp = this.frameToTimestamp(0);
                    timeline[timestamp] = {
                        frame: 0,
                        gestures: [action],
                        dominant: action
                    };
                }
            });
        }
        
        return timeline;
    }

    /**
     * Build expression timeline from MediaPipe data
     */
    buildExpressionTimeline(mediapipeData, frameCount) {
        const timeline = {};
        
        // Check both possible locations for expressions
        const expressions = mediapipeData?.insights?.timeline?.expressions || mediapipeData?.timeline?.expressions;
        
        if (!expressions || !Array.isArray(expressions)) {
            return timeline;
        }
        
        expressions.forEach(expression => {
            const frame = expression.frame;
            const timestamp = this.frameToTimestamp(frame);
            timeline[timestamp] = {
                frame: frame,
                expression: expression.expression || 'neutral',
                confidence: expression.confidence || 1.0
            };
        });
        
        return timeline;
    }

    /**
     * Build object timeline from YOLO data
     */
    buildObjectTimeline(yoloData, frameCount, metadataSummary) {
        const timeline = {};
        
        // First try YOLO pipeline data
        if (yoloData?.frame_summaries) {
            yoloData.frame_summaries.forEach(frameSummary => {
                const frame = frameSummary.frame_number;
                const timestamp = this.frameToTimestamp(frame);
                timeline[timestamp] = {
                    frame: frame,
                    objects: frameSummary.object_counts || {},
                    total_objects: frameSummary.total_objects || 0
                };
            });
        }
        // If no YOLO data, try metadata summary
        else if (metadataSummary?.objectAnnotations) {
            // Group objects by frame
            const objectsByFrame = {};
            
            metadataSummary.objectAnnotations.forEach(annotation => {
                if (annotation.frames && annotation.frames.length > 0) {
                    annotation.frames.forEach(frameData => {
                        const frame = frameData.frame || frameData.timeOffset || 0;
                        if (!objectsByFrame[frame]) {
                            objectsByFrame[frame] = {};
                        }
                        const objName = annotation.description || annotation.name || 'unknown';
                        objectsByFrame[frame][objName] = (objectsByFrame[frame][objName] || 0) + 1;
                    });
                }
            });
            
            // Build timeline from grouped objects
            Object.entries(objectsByFrame).forEach(([frame, objects]) => {
                const timestamp = this.frameToTimestamp(parseInt(frame));
                timeline[timestamp] = {
                    frame: parseInt(frame),
                    objects: objects,
                    total_objects: Object.values(objects).reduce((sum, count) => sum + count, 0)
                };
            });
        }
        
        return timeline;
    }

    /**
     * Build sticker timeline from OCR data
     */
    buildStickerTimeline(ocrData, frameCount) {
        const timeline = {};
        
        if (!ocrData?.frame_details) {
            return timeline;
        }
        
        ocrData.frame_details.forEach(frameDetail => {
            const frameMatch = frameDetail.frame.match(/frame_(\d+)/);
            if (frameMatch) {
                const frame = parseInt(frameMatch[1]);
                const timestamp = this.frameToTimestamp(frame);
                
                const stickers = frameDetail.creative_elements?.filter(el => 
                    el.type === 'sticker' || el.category === 'sticker' || el.element === 'sticker'
                ) || [];
                
                if (stickers.length > 0) {
                    timeline[timestamp] = {
                        frame: frame,
                        stickers: stickers.map(s => ({
                            type: s.description || 'sticker',
                            confidence: s.confidence || 0.0
                        }))
                    };
                }
            }
        });
        
        return timeline;
    }

    /**
     * Build text overlay timeline from OCR data
     */
    buildTextOverlayTimeline(ocrData, frameCount, metadataSummary) {
        const timeline = {};
        
        // First try OCR pipeline data
        if (ocrData?.frame_details) {
            ocrData.frame_details.forEach(frameDetail => {
                const frameMatch = frameDetail.frame.match(/frame_(\d+)/);
                if (frameMatch) {
                    const frame = parseInt(frameMatch[1]);
                    const timestamp = this.frameToTimestamp(frame);
                    
                    const texts = frameDetail.text_elements || [];
                    
                    if (texts.length > 0) {
                        timeline[timestamp] = {
                            frame: frame,
                            texts: texts.map(t => ({
                                text: t.text,
                                category: t.category || 'overlay_text',
                                confidence: t.confidence || 0.0,
                                bbox: t.bbox || null
                            }))
                        };
                    }
                }
            });
        }
        // If no OCR data, try metadata summary
        else if (metadataSummary?.textAnnotations) {
            metadataSummary.textAnnotations.forEach(annotation => {
                if (annotation.frames && annotation.frames.length > 0) {
                    annotation.frames.forEach(frameData => {
                        const frame = frameData.frame;
                        const timestamp = this.frameToTimestamp(frame);
                        
                        if (!timeline[timestamp]) {
                            timeline[timestamp] = {
                                frame: frame,
                                texts: []
                            };
                        }
                        
                        timeline[timestamp].texts.push({
                            text: annotation.text,
                            category: annotation.category || 'overlay_text',
                            confidence: frameData.confidence || 0.0,
                            bbox: annotation.bbox || null
                        });
                    });
                }
            });
        }
        
        return timeline;
    }

    /**
     * Build scene change timeline
     */
    buildSceneChangeTimeline(pipelineData, frameCount, metadataSummary) {
        const timeline = {};
        
        // Check for shot changes from LOCAL PySceneDetect (ONLY source)
        if (metadataSummary?.shots && Array.isArray(metadataSummary.shots)) {
            console.log(`🎬 Using local PySceneDetect data: ${metadataSummary.shots.length} shots detected`);
            
            metadataSummary.shots.forEach((shot, index) => {
                // Parse time from PySceneDetect format (already formatted by LocalVideoAnalyzer)
                const startTime = this.parseTimeOffset(shot.startTime);
                const endTime = this.parseTimeOffset(shot.endTime);
                
                // Use frame data if available (PySceneDetect provides this)
                const startFrame = shot.startFrame || Math.max(1, Math.round(startTime));
                const timestamp = this.frameToTimestamp(startFrame);
                
                // Add shot change at the start of each shot (except the first)
                if (index > 0) {
                    timeline[timestamp] = {
                        frame: startFrame,
                        type: 'shot_change',
                        description: `Shot ${index + 1} begins`,
                        startTime: startTime,
                        endTime: endTime,
                        shotDuration: endTime - startTime,
                        source: 'PySceneDetect'
                    };
                }
            });
        }
        // Check for PySceneDetect data in _raw
        else if (metadataSummary?._raw?.scenes?.shots && Array.isArray(metadataSummary._raw.scenes.shots)) {
            console.log(`🎬 Using PySceneDetect from _raw data: ${metadataSummary._raw.scenes.shots.length} shots`);
            
            metadataSummary._raw.scenes.shots.forEach((shot, index) => {
                const startTime = shot.start_time;
                const endTime = shot.end_time;
                const startFrame = shot.start_frame || Math.max(1, Math.round(startTime));
                const timestamp = this.frameToTimestamp(startFrame);
                
                if (index > 0) {
                    timeline[timestamp] = {
                        frame: startFrame,
                        type: 'shot_change',
                        description: `Shot ${index + 1} begins`,
                        startTime: startTime,
                        endTime: endTime,
                        shotDuration: endTime - startTime,
                        source: 'PySceneDetect'
                    };
                }
            });
        }
        // Try loading from standalone scene detection file
        else if (pipelineData.scenes?.shots && Array.isArray(pipelineData.scenes.shots)) {
            console.log(`🎬 Using PySceneDetect from scene detection file: ${pipelineData.scenes.shots.length} shots`);
            
            pipelineData.scenes.shots.forEach((shot, index) => {
                const startTime = shot.start_time;
                const endTime = shot.end_time;
                const startFrame = shot.start_frame || Math.max(1, Math.round(startTime));
                const timestamp = this.frameToTimestamp(startFrame);
                
                if (index > 0) {
                    timeline[timestamp] = {
                        frame: startFrame,
                        type: 'shot_change',
                        description: `Shot ${index + 1} begins`,
                        startTime: startTime,
                        endTime: endTime,
                        shotDuration: endTime - startTime,
                        source: 'PySceneDetect'
                    };
                }
            });
        } else {
            console.log(`⚠️ No PySceneDetect data available. Scene change timeline will be empty.`);
            console.log(`   Please ensure PySceneDetect is running during local video analysis.`);
        }
        
        console.log(`📊 Scene change timeline built with ${Object.keys(timeline).length} transitions (PySceneDetect only)`);
        return timeline;
    }

    /**
     * Build camera distance timeline from MediaPipe pose data
     */
    buildCameraDistanceTimeline(mediapipeData, frameCount) {
        const timeline = {};
        
        if (!mediapipeData?.timeline?.poses) {
            return timeline;
        }
        
        mediapipeData.timeline.poses.forEach(pose => {
            const frame = pose.frame;
            const timestamp = this.frameToTimestamp(frame);
            
            // Estimate camera distance based on pose size
            const distance = this.estimateCameraDistance(pose);
            
            timeline[timestamp] = {
                frame: frame,
                distance: distance,
                pose_type: pose.pose || 'unknown'
            };
        });
        
        return timeline;
    }

    /**
     * Parse time offset from various formats (e.g., "1.2s" or {seconds: 1, nanos: 200000000})
     */
    parseTimeOffset(timeOffset) {
        if (!timeOffset) return 0;
        
        // Handle string format like "1.2s"
        if (typeof timeOffset === 'string') {
            return parseFloat(timeOffset.replace('s', ''));
        }
        
        // Handle object format {seconds: 1, nanos: 200000000}
        if (typeof timeOffset === 'object') {
            const seconds = parseInt(timeOffset.seconds || 0);
            const nanos = parseInt(timeOffset.nanos || 0);
            return seconds + (nanos / 1000000000);
        }
        
        return 0;
    }

    /**
     * Build speech timeline from audio data
     */
    buildSpeechTimeline(audioData, frameCount, metadataSummary) {
        const timeline = {};
        
        // Log what data we receive
        console.log(`🎤 Building speech timeline - audioData: ${!!audioData}, metadataSummary: ${!!metadataSummary}`);
        
        // First try to get speech from transcriptions (either local analysis or Whisper format)
        if (metadataSummary?.speechTranscriptions && metadataSummary.speechTranscriptions.length > 0) {
            console.log(`🎙️ Building speech timeline from ${metadataSummary.speechTranscriptions.length} transcriptions`);
            
            // Calculate duration - use metadataSummary.duration or estimate from video
            const videoDuration = metadataSummary.duration || frameCount; // Assuming 1 fps if no duration
            
            metadataSummary.speechTranscriptions.forEach((transcription, idx) => {
                if (transcription.alternatives && transcription.alternatives.length > 0) {
                    const alternative = transcription.alternatives[0];
                    
                    // If we have word-level timestamps
                    if (alternative.words && alternative.words.length > 0) {
                        alternative.words.forEach(word => {
                            const startTime = this.parseTimeOffset(word.startTime);
                            const startFrame = Math.floor(startTime * (frameCount / videoDuration));
                            const timestamp = this.frameToTimestamp(startFrame);
                            
                            if (!timeline[timestamp]) {
                                timeline[timestamp] = {
                                    frame: startFrame,
                                    text: '',
                                    words: []
                                };
                            }
                            
                            timeline[timestamp].words.push({
                                word: word.word,
                                startTime: startTime,
                                endTime: this.parseTimeOffset(word.endTime),
                                confidence: word.confidence || alternative.confidence || 0
                            });
                        });
                    } 
                    // If we only have transcript without word timestamps
                    else if (alternative.transcript) {
                        // Place the entire transcript at the beginning
                        const timestamp = this.frameToTimestamp(1);
                        timeline[timestamp] = {
                            frame: 1,
                            text: alternative.transcript,
                            words: [],
                            confidence: alternative.confidence || 0
                        };
                    }
                }
            });
            
            // Combine words into text segments
            Object.keys(timeline).forEach(timestamp => {
                timeline[timestamp].text = timeline[timestamp].words.map(w => w.word).join(' ');
            });
        } else {
            console.log(`🔇 No speech transcriptions found in metadataSummary`);
        }
        
        // Fall back to audio data if available
        if (Object.keys(timeline).length === 0 && audioData?.speech_segments) {
            console.log(`🎵 Using audio data speech segments: ${audioData.speech_segments.length} segments`);
            audioData.speech_segments.forEach(segment => {
                const startFrame = this.timestampToFrame(segment.start_time);
                const timestamp = this.frameToTimestamp(startFrame);
                timeline[timestamp] = {
                    frame: startFrame,
                    text: segment.text || '',
                    duration: segment.duration || 0,
                    confidence: segment.confidence || 0.0
                };
            });
        }
        
        console.log(`🎙️ Speech timeline complete with ${Object.keys(timeline).length} segments`);
        return timeline;
    }

    /**
     * Build audio ratio timeline
     */
    buildAudioRatioTimeline(audioData, frameCount) {
        const timeline = {};
        
        if (!audioData?.audio_levels) {
            return timeline;
        }
        
        audioData.audio_levels.forEach((level, index) => {
            const frame = index + 1;
            const timestamp = this.frameToTimestamp(frame);
            timeline[timestamp] = {
                frame: frame,
                music_level: level.music || 0,
                speech_level: level.speech || 0,
                ratio: level.ratio || 0
            };
        });
        
        return timeline;
    }

    /**
     * Extract static metadata
     */
    extractStaticMetadata(pipelineData, videoInfo, metadataSummary) {
        const metadata = {
            captionText: videoInfo.description || metadataSummary.description || '',
            hashtags: videoInfo.hashtags || metadataSummary.hashtags || [],
            duration: videoInfo.duration || 0,
            createTime: videoInfo.createTime || null,
            author: videoInfo.author || {},
            stats: {
                views: videoInfo.views || 0,
                likes: videoInfo.likes || 0,
                comments: videoInfo.comments || 0,
                shares: videoInfo.shares || 0,
                saves: videoInfo.saves || 0,
                engagementRate: videoInfo.engagementRate || 0
            },
            music: videoInfo.music || {}
        };
        
        return metadata;
    }

    /**
     * Build comprehensive metadata summary
     */
    buildMetadataSummary(videoInfo, localAnalysisMetadata, staticMetadata) {
        // Extract topic/theme from caption
        const caption = staticMetadata.captionText || '';
        let captionTopic = 'general content';
        
        // Simple topic detection based on keywords
        if (caption.toLowerCase().includes('protein') || caption.toLowerCase().includes('macro')) {
            captionTopic = 'macro-friendly food';
        } else if (caption.toLowerCase().includes('workout') || caption.toLowerCase().includes('fitness')) {
            captionTopic = 'fitness content';
        } else if (caption.toLowerCase().includes('recipe') || caption.toLowerCase().includes('cook')) {
            captionTopic = 'recipe/cooking';
        } else if (caption.toLowerCase().includes('fashion') || caption.toLowerCase().includes('outfit')) {
            captionTopic = 'fashion content';
        } else if (caption.toLowerCase().includes('dance') || caption.toLowerCase().includes('dancing')) {
            captionTopic = 'dance content';
        }
        
        // Build the summary
        const summary = {
            // Basic video info
            videoLength: staticMetadata.duration || 0,
            videoLengthFormatted: this.formatDuration(staticMetadata.duration || 0),
            
            // Creator info
            creator: {
                username: staticMetadata.author?.username || '',
                displayName: staticMetadata.author?.displayName || '',
                verified: staticMetadata.author?.verified || false
            },
            
            // Posting info
            postingTime: staticMetadata.createTime || null,
            postingTimeFormatted: staticMetadata.createTime ? new Date(staticMetadata.createTime).toLocaleString() : null,
            
            // Hashtags
            hashtags: (staticMetadata.hashtags || []).map(h => h.name).filter(name => name),
            hashtagCount: (staticMetadata.hashtags || []).filter(h => h.name).length,
            
            // Caption analysis
            captionSentiment: this.analyzeCaptionSentiment(caption),
            captionTopic: captionTopic,
            captionLength: caption.length,
            hasEmojis: /[\u{1F300}-\u{1F9FF}]/u.test(caption),
            
            // Engagement metrics
            engagementRate: staticMetadata.stats?.engagementRate || 0,
            viewCount: staticMetadata.stats?.views || 0,
            
            // Audio/Speech data
            // Check both direct speechTranscriptions and processed.speechTranscriptions for compatibility
            hasAudio: (localAnalysisMetadata?.speechTranscriptions?.length > 0) || 
                     (localAnalysisMetadata?.processed?.speechTranscriptions?.length > 0) || 
                     (localAnalysisMetadata?.transcript?.length > 0),
            hasSpeech: ((localAnalysisMetadata?.speechTranscriptions?.length > 0 && 
                        localAnalysisMetadata.speechTranscriptions.some(t => 
                            t.alternatives?.some(a => a.transcript || (a.words && a.words.length > 0))
                        )) ||
                       (localAnalysisMetadata?.processed?.speechTranscriptions?.length > 0 && 
                        localAnalysisMetadata.processed.speechTranscriptions.some(t => 
                            t.alternatives?.some(a => a.transcript || (a.words && a.words.length > 0))
                        ))),
            transcript: localAnalysisMetadata?.transcript || '',
            wordCount: localAnalysisMetadata?.wordCount || 0,
            speechDuration: this.calculateSpeechDuration(localAnalysisMetadata?.speechTranscriptions || localAnalysisMetadata?.processed?.speechTranscriptions),
            
            // Include speechTranscriptions for timeline building
            // Check both direct and nested locations
            speechTranscriptions: localAnalysisMetadata?.speechTranscriptions || localAnalysisMetadata?.processed?.speechTranscriptions || [],
            
            // Enhanced Human Analysis data
            enhancedHumanAnalysis: localAnalysisMetadata?.enhancedHumanAnalysis || {},
            
            // Person framing metrics
            faceScreenTimeRatio: localAnalysisMetadata?.enhancedHumanAnalysis?.face_screen_time_ratio || 0,
            personScreenTimeRatio: localAnalysisMetadata?.enhancedHumanAnalysis?.person_screen_time_ratio || 0,
            eyeContactRatio: localAnalysisMetadata?.enhancedHumanAnalysis?.gaze_patterns?.eye_contact_ratio || 0,
            primaryActions: localAnalysisMetadata?.enhancedHumanAnalysis?.primary_actions || {},
            
            // GVI-specific metadata (if available) - exclude _raw data
            ...(this.filterRawData(localAnalysisMetadata) || {})
        };
        
        return summary;
    }

    /**
     * Filter out _raw data and other large debug data
     */
    filterRawData(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const filtered = {};
        for (const key in obj) {
            // Skip _raw data and other debug fields
            if (key === '_raw' || key.startsWith('_debug') || key === 'raw_data') {
                continue;
            }
            
            // Recursively filter nested objects
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (Array.isArray(obj[key])) {
                    // For arrays, check if they contain raw data
                    if (key === 'frame_analyses' || key.endsWith('_frames') || key.endsWith('_raw')) {
                        continue;
                    }
                    filtered[key] = obj[key];
                } else {
                    filtered[key] = this.filterRawData(obj[key]);
                }
            } else {
                filtered[key] = obj[key];
            }
        }
        return filtered;
    }

    /**
     * Simple sentiment analysis for caption
     */
    analyzeCaptionSentiment(caption) {
        const positive = ['love', 'great', 'amazing', 'awesome', 'best', 'happy', 'enjoy', 'perfect', 'wonderful', '😋', '😍', '❤️'];
        const negative = ['hate', 'bad', 'worst', 'terrible', 'awful', 'sad', 'angry', 'disappointed'];
        
        const lowerCaption = caption.toLowerCase();
        const positiveCount = positive.filter(word => lowerCaption.includes(word)).length;
        const negativeCount = negative.filter(word => lowerCaption.includes(word)).length;
        
        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    /**
     * Format duration in seconds to readable format
     */
    formatDuration(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Calculate total speech duration from GVI speech transcriptions
     */
    calculateSpeechDuration(speechTranscriptions) {
        if (!speechTranscriptions || speechTranscriptions.length === 0) {
            return 0;
        }

        let totalDuration = 0;
        
        speechTranscriptions.forEach(transcription => {
            if (transcription.alternatives && transcription.alternatives.length > 0) {
                const alternative = transcription.alternatives[0];
                
                // If we have word-level timestamps, calculate from first to last word
                if (alternative.words && alternative.words.length > 0) {
                    const firstWord = alternative.words[0];
                    const lastWord = alternative.words[alternative.words.length - 1];
                    
                    const startTime = this.parseTimeOffset(firstWord.startTime);
                    const endTime = this.parseTimeOffset(lastWord.endTime);
                    
                    totalDuration += (endTime - startTime);
                }
            }
        });
        
        return totalDuration;
    }

    /**
     * Generate insights from all pipeline data
     */
    generateInsights(pipelineData, timelines) {
        const insights = {
            // Primary objects detected
            primaryObjects: this.extractPrimaryObjects(pipelineData.yolo),
            
            // Dominant expressions
            dominantExpressions: this.extractDominantExpressions(pipelineData.mediapipe),
            
            // Creative density
            creativeDensity: this.calculateCreativeDensity(pipelineData.ocr),
            
            // Gesture count
            gestureCount: this.countGestures(timelines.gestureTimeline),
            
            // Text overlay frequency
            textOverlayFrequency: this.calculateTextFrequency(timelines.textOverlayTimeline),
            
            // Human presence rate
            humanPresenceRate: pipelineData.mediapipe?.human_presence || pipelineData.mediapipe?.insights?.human_presence || 0,
            
            // Object diversity
            objectDiversity: this.calculateObjectDiversity(pipelineData.yolo),
            
            // Scene complexity
            sceneComplexity: this.calculateSceneComplexity(timelines),
            
            // Engagement indicators
            engagementIndicators: this.identifyEngagementIndicators(pipelineData, timelines)
        };
        
        return insights;
    }

    /**
     * Extract primary objects from YOLO data
     */
    extractPrimaryObjects(yoloData) {
        if (!yoloData?.summary?.unique_object_types) {
            return [];
        }
        
        // Get object counts across all frames
        const objectCounts = {};
        if (yoloData.object_timeline) {
            Object.values(yoloData.object_timeline).forEach(objects => {
                objects.forEach(obj => {
                    const type = obj.object || obj.label;
                    objectCounts[type] = (objectCounts[type] || 0) + obj.count;
                });
            });
        }
        
        // Sort by frequency and return top objects
        return Object.entries(objectCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([object, count]) => ({ object, count }));
    }

    /**
     * Extract dominant expressions from MediaPipe data
     */
    extractDominantExpressions(mediapipeData) {
        if (!mediapipeData?.dominant_expressions) {
            return [];
        }
        
        return mediapipeData.dominant_expressions;
    }

    /**
     * Calculate creative density from OCR data
     */
    calculateCreativeDensity(ocrData) {
        if (!ocrData?.insights?.creative_density) {
            return 0;
        }
        
        return ocrData.insights.creative_density;
    }

    /**
     * Count total gestures
     */
    countGestures(gestureTimeline) {
        let count = 0;
        Object.values(gestureTimeline).forEach(entry => {
            count += (entry.gestures || []).length;
        });
        return count;
    }

    /**
     * Calculate text overlay frequency
     */
    calculateTextFrequency(textTimeline) {
        const framesWithText = Object.keys(textTimeline).length;
        return framesWithText;
    }

    /**
     * Calculate object diversity
     */
    calculateObjectDiversity(yoloData) {
        if (!yoloData?.summary?.unique_object_types) {
            return 0;
        }
        
        return yoloData.summary.unique_object_types.length;
    }

    /**
     * Calculate scene complexity
     */
    calculateSceneComplexity(timelines) {
        let complexity = 0;
        
        // Factor in different elements
        complexity += Object.keys(timelines.objectTimeline).length * 0.2;
        complexity += Object.keys(timelines.textOverlayTimeline).length * 0.3;
        complexity += Object.keys(timelines.gestureTimeline).length * 0.2;
        complexity += Object.keys(timelines.sceneChangeTimeline).length * 0.3;
        
        return Math.min(complexity, 10); // Cap at 10
    }

    /**
     * Identify engagement indicators
     */
    identifyEngagementIndicators(pipelineData, timelines) {
        const indicators = [];
        
        // Check for CTAs in text
        if (pipelineData.ocr?.insights?.cta_frames?.length > 0) {
            indicators.push('call_to_action_present');
        }
        
        // Check for human presence
        if (pipelineData.mediapipe?.insights?.human_presence > 0.5) {
            indicators.push('high_human_presence');
        }
        
        // Check for text hooks in first 3 seconds
        const earlyTextFrames = Object.entries(timelines.textOverlayTimeline)
            .filter(([timestamp, data]) => data.frame <= 3);
        if (earlyTextFrames.length > 0) {
            indicators.push('early_text_hook');
        }
        
        // Check for gesture variety
        if (timelines.gestureTimeline && Object.keys(timelines.gestureTimeline).length > 5) {
            indicators.push('high_gesture_variety');
        }
        
        return indicators;
    }

    /**
     * Convert frame number to timestamp
     * frame_0001.jpg = frame 1 = timestamp "0-1s"
     */
    frameToTimestamp(frameNumber) {
        const startSecond = frameNumber - 1;
        const endSecond = frameNumber;
        return `${startSecond}-${endSecond}s`;
    }

    /**
     * Convert timestamp to frame number
     */
    timestampToFrame(seconds) {
        return Math.floor(seconds) + 1;
    }

    /**
     * Estimate camera distance from pose data
     */
    estimateCameraDistance(poseData) {
        // Simple heuristic based on pose type
        const poseDistances = {
            'close-up': 'close',
            'medium-shot': 'medium',
            'full-body': 'far',
            'upper-body': 'medium',
            'standing': 'far',
            'sitting': 'medium'
        };
        
        return poseDistances[poseData.pose] || 'medium';
    }

    /**
     * Save unified analysis to file
     */
    async saveUnifiedAnalysis(videoId, analysis) {
        const filename = `${videoId}.json`;
        const filepath = path.join(this.unifiedOutputDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
        console.log(`💾 Unified analysis saved to: ${filepath}`);
        
        return filepath;
    }

    /**
     * Helper method to check if unified analysis exists
     */
    async unifiedAnalysisExists(videoId) {
        try {
            const filepath = path.join(this.unifiedOutputDir, `${videoId}.json`);
            await fs.access(filepath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Load existing unified analysis
     */
    async loadUnifiedAnalysis(videoId) {
        try {
            const filepath = path.join(this.unifiedOutputDir, `${videoId}.json`);
            const data = await fs.readFile(filepath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Failed to load unified analysis for ${videoId}:`, error);
            return null;
        }
    }
}

module.exports = new UnifiedTimelineAssembler();