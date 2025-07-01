const fs = require('fs').promises;

class TimelineSynchronizer {
    constructor(masterTimeline) {
        this.master = masterTimeline;
        
        // Validate master timeline
        if (!this.master.fps || !this.master.total_frames || !this.master.duration) {
            throw new Error('Master timeline must include fps, total_frames, and duration');
        }
        
        console.log(`📐 Timeline Synchronizer initialized:`);
        console.log(`   - FPS: ${this.master.fps}`);
        console.log(`   - Total Frames: ${this.master.total_frames}`);
        console.log(`   - Duration: ${this.master.duration}s`);
    }
    
    /**
     * Core conversion functions based on master timeline
     */
    frameToTime(frame) {
        return frame / this.master.fps;
    }
    
    timeToFrame(time) {
        return Math.round(time * this.master.fps);
    }
    
    /**
     * Validate and clamp timestamp to video bounds
     */
    validateTimestamp(timestamp, source) {
        if (timestamp < 0) {
            console.warn(`⚠️ ${source}: Negative timestamp ${timestamp}, clamping to 0`);
            return 0;
        }
        
        if (timestamp > this.master.duration) {
            console.warn(`⚠️ ${source}: Timestamp ${timestamp} exceeds duration ${this.master.duration}, clamping`);
            return this.master.duration;
        }
        
        return timestamp;
    }
    
    /**
     * Validate and clamp frame number to video bounds
     */
    validateFrameNumber(frame, source) {
        if (frame < 0) {
            console.warn(`⚠️ ${source}: Negative frame ${frame}, clamping to 0`);
            return 0;
        }
        
        if (frame >= this.master.total_frames) {
            if (frame === this.master.total_frames) {
                // Frame equals total frames - this is common for the last frame
                return this.master.total_frames - 1;
            }
            console.warn(`⚠️ ${source}: Frame ${frame} exceeds total ${this.master.total_frames}, clamping`);
            return this.master.total_frames - 1;
        }
        
        return Math.floor(frame);
    }
    
    /**
     * Align Whisper timestamps to video timeline
     * Whisper may have slight duration mismatches
     */
    alignWhisperToVideo(whisperData) {
        if (!whisperData || !whisperData.duration) {
            console.log('⏭️ No Whisper data to align');
            return whisperData;
        }
        
        const whisperDuration = whisperData.duration;
        const alignmentFactor = this.master.duration / whisperDuration;
        
        console.log(`🎤 Aligning Whisper timeline:`);
        console.log(`   - Whisper Duration: ${whisperDuration}s`);
        console.log(`   - Video Duration: ${this.master.duration}s`);
        console.log(`   - Alignment Factor: ${alignmentFactor.toFixed(3)}`);
        
        // If durations are very close (within 1%), don't adjust
        if (Math.abs(alignmentFactor - 1.0) < 0.01) {
            console.log('   ✅ Durations match closely, no adjustment needed');
            return whisperData;
        }
        
        // Adjust all timestamps in speechTranscriptions
        if (whisperData.speechTranscriptions) {
            whisperData.speechTranscriptions = whisperData.speechTranscriptions.map(transcription => {
                if (transcription.alternatives) {
                    transcription.alternatives = transcription.alternatives.map(alt => {
                        if (alt.words) {
                            alt.words = alt.words.map(word => {
                                const startTime = this.parseTimeOffset(word.startTime);
                                const endTime = this.parseTimeOffset(word.endTime);
                                
                                return {
                                    ...word,
                                    startTime: this.formatTimeOffset(startTime * alignmentFactor),
                                    endTime: this.formatTimeOffset(endTime * alignmentFactor)
                                };
                            });
                        }
                        return alt;
                    });
                }
                return transcription;
            });
        }
        
        // Adjust segments
        if (whisperData.segments) {
            whisperData.segments = whisperData.segments.map(segment => ({
                ...segment,
                start: segment.start * alignmentFactor,
                end: segment.end * alignmentFactor
            }));
        }
        
        // Update duration
        whisperData.duration = this.master.duration;
        
        return whisperData;
    }
    
    /**
     * Parse time offset from various formats
     */
    parseTimeOffset(timeOffset) {
        if (!timeOffset) return 0;
        
        // Handle number
        if (typeof timeOffset === 'number') {
            return timeOffset;
        }
        
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
     * Format time as offset object
     */
    formatTimeOffset(time) {
        const seconds = Math.floor(time);
        const nanos = Math.round((time - seconds) * 1e9);
        return { seconds, nanos };
    }
    
    /**
     * Validate object tracking results
     */
    validateObjectTracking(trackingData) {
        if (!trackingData || !trackingData.objectAnnotations) {
            return trackingData;
        }
        
        console.log(`📦 Validating ${trackingData.objectAnnotations.length} object tracks`);
        
        trackingData.objectAnnotations = trackingData.objectAnnotations.map(obj => {
            if (obj.frames) {
                obj.frames = obj.frames.map(frameData => {
                    const validFrame = this.validateFrameNumber(frameData.frame, `Object ${obj.trackId}`);
                    const validTimestamp = this.validateTimestamp(frameData.timestamp, `Object ${obj.trackId}`);
                    
                    return {
                        ...frameData,
                        frame: validFrame,
                        timestamp: validTimestamp
                    };
                });
            }
            return obj;
        });
        
        return trackingData;
    }
    
    /**
     * Validate scene detection results
     */
    validateSceneChanges(sceneData) {
        if (!sceneData || !sceneData.shots) {
            return sceneData;
        }
        
        console.log(`🎬 Validating ${sceneData.shots.length} scene changes`);
        
        sceneData.shots = sceneData.shots.map(shot => ({
            ...shot,
            start_time: this.validateTimestamp(shot.start_time, 'Scene Detection'),
            end_time: this.validateTimestamp(shot.end_time, 'Scene Detection'),
            start_frame: this.validateFrameNumber(shot.start_frame, 'Scene Detection'),
            end_frame: this.validateFrameNumber(shot.end_frame, 'Scene Detection')
        }));
        
        return sceneData;
    }
    
    /**
     * Validate scene labels from CLIP
     */
    validateSceneLabels(labelData) {
        if (!labelData || !labelData.frame_labels) {
            return labelData;
        }
        
        console.log(`🏷️ Validating scene labels for ${labelData.frame_labels.length} frames`);
        
        labelData.frame_labels = labelData.frame_labels.map(frameLabel => ({
            ...frameLabel,
            frame_number: this.validateFrameNumber(frameLabel.frame_number, 'CLIP'),
            timestamp: this.validateTimestamp(frameLabel.timestamp, 'CLIP')
        }));
        
        return labelData;
    }
    
    /**
     * Validate content moderation results
     */
    validateContentModeration(nsfwData) {
        if (!nsfwData || !nsfwData.frame_results) {
            return nsfwData;
        }
        
        console.log(`🛡️ Validating content moderation for ${nsfwData.frame_results.length} frames`);
        
        nsfwData.frame_results = nsfwData.frame_results.map(result => ({
            ...result,
            frame_number: this.validateFrameNumber(result.frame_number, 'NSFW'),
            timestamp: this.validateTimestamp(result.timestamp, 'NSFW')
        }));
        
        return nsfwData;
    }
    
    /**
     * Validate human analysis from MediaPipe
     */
    validateHumanAnalysis(humanData) {
        if (!humanData || !humanData.timeline) {
            return humanData;
        }
        
        console.log(`👤 Validating human analysis`);
        
        // Validate expressions
        if (humanData.timeline.expressions) {
            humanData.timeline.expressions = humanData.timeline.expressions.map(expr => ({
                ...expr,
                frame: this.validateFrameNumber(expr.frame, 'MediaPipe Expression')
            }));
        }
        
        // Validate poses
        if (humanData.timeline.poses) {
            humanData.timeline.poses = humanData.timeline.poses.map(pose => ({
                ...pose,
                frame: this.validateFrameNumber(pose.frame, 'MediaPipe Pose')
            }));
        }
        
        // Validate gestures
        if (humanData.timeline.gestures) {
            humanData.timeline.gestures = humanData.timeline.gestures.map(gesture => ({
                ...gesture,
                frame: this.validateFrameNumber(gesture.frame, 'MediaPipe Gesture')
            }));
        }
        
        return humanData;
    }
    
    /**
     * Validate text detection from OCR
     */
    validateTextDetection(ocrData) {
        if (!ocrData || !ocrData.frame_details) {
            return ocrData;
        }
        
        console.log(`📝 Validating text detection for ${ocrData.frame_details.length} frames`);
        
        ocrData.frame_details = ocrData.frame_details.map(detail => {
            // Extract frame number from filename
            const frameMatch = detail.frame.match(/frame_(\d+)/);
            if (frameMatch) {
                const frameNum = parseInt(frameMatch[1]);
                const validFrame = this.validateFrameNumber(frameNum, 'OCR');
                
                // Update frame filename if needed
                if (validFrame !== frameNum) {
                    detail.frame = detail.frame.replace(`frame_${frameNum}`, `frame_${validFrame}`);
                }
            }
            
            return detail;
        });
        
        return ocrData;
    }
    
    /**
     * Validate all analysis results
     */
    async validateAllResults(results) {
        const [whisper, yolo, mediapipe, ocr, scenes, labels, nsfw] = results;
        
        console.log('\n🔄 Synchronizing all timelines...\n');
        
        return {
            whisper: this.alignWhisperToVideo(whisper),
            yolo: this.validateObjectTracking(yolo),
            mediapipe: this.validateHumanAnalysis(mediapipe),
            ocr: this.validateTextDetection(ocr),
            scenes: this.validateSceneChanges(scenes),
            labels: this.validateSceneLabels(labels),
            nsfw: this.validateContentModeration(nsfw)
        };
    }
}

module.exports = TimelineSynchronizer;