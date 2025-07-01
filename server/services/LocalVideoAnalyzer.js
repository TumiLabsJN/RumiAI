const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const TimelineSynchronizer = require('./TimelineSynchronizer');
const WhisperTranscriptionService = require('./WhisperTranscriptionService');

class LocalVideoAnalyzer {
    constructor() {
        this.pythonPath = path.join(__dirname, '../../venv/bin/python');
        this.pythonScriptsPath = path.join(__dirname, '../../python');
        this.outputPath = path.join(__dirname, '../../local_analysis_outputs');
        this.ensureOutputDirectories();
    }
    
    async ensureOutputDirectories() {
        try {
            await fs.mkdir(this.outputPath, { recursive: true });
            await fs.mkdir(path.join(this.outputPath, 'frames'), { recursive: true });
            // Scene detection output directory is created when needed
            await fs.mkdir(path.join(this.outputPath, 'scene_labels'), { recursive: true });
            await fs.mkdir(path.join(this.outputPath, 'content_moderation'), { recursive: true });
            await fs.mkdir(path.join(this.outputPath, 'object_tracking'), { recursive: true });
        } catch (error) {
            console.error('Failed to create output directories:', error);
        }
    }
    
    /**
     * Extract video metadata for master timeline
     */
    async extractVideoMetadata(videoPath) {
        return new Promise((resolve, reject) => {
            const script = path.join(this.pythonScriptsPath, 'frame_sampler.py');
            
            const process = spawn(this.pythonPath, [script, videoPath, 'metadata']);
            
            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            process.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Metadata extraction failed: ${errorOutput}`));
                } else {
                    try {
                        // Parse metadata from output
                        const lines = output.trim().split('\n');
                        const metadataLine = lines.find(line => line.includes('Video metadata:'));
                        if (metadataLine) {
                            const metadataStr = metadataLine.replace('Video metadata: ', '');
                            const metadata = eval(`(${metadataStr})`); // Safe since we control the output
                            
                            resolve({
                                fps: metadata.fps,
                                total_frames: metadata.frame_count,
                                duration: metadata.duration,
                                width: metadata.width,
                                height: metadata.height
                            });
                        } else {
                            reject(new Error('Could not parse metadata'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }
    
    /**
     * Run Whisper transcription
     */
    async runWhisper(videoPath, videoId) {
        console.log('🎤 Running Whisper transcription...');
        const transcription = await WhisperTranscriptionService.transcribeVideo(videoPath, videoId);
        
        // Save the transcription for future use
        if (transcription && transcription.speechTranscriptions && transcription.speechTranscriptions.length > 0) {
            await WhisperTranscriptionService.saveTranscription(videoId, transcription);
            console.log('   💾 Saved Whisper transcription');
        }
        
        return transcription;
    }
    
    /**
     * Run YOLO with DeepSort tracking (with frame sampling for performance)
     */
    async runYOLOWithDeepSort(videoPath, videoId) {
        // Process every 3rd frame for faster performance (frame_skip=2 means skip 2, process 1)
        const frameSkip = process.env.YOLO_FRAME_SKIP || '2';
        console.log(`📦 Running YOLO + DeepSort object tracking (frame skip: ${frameSkip})...`);
        
        return new Promise((resolve, reject) => {
            const script = path.join(this.pythonScriptsPath, 'object_tracking.py');
            const outputFile = path.join(this.outputPath, 'object_tracking', `${videoId}_tracking.json`);
            
            const process = spawn(this.pythonPath, [
                script,
                videoPath,
                '--frame-skip', frameSkip
            ]);
            
            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
                // Log progress updates
                const progressMatch = data.toString().match(/Processed (\d+)\/(\d+) frames/);
                if (progressMatch) {
                    const [_, current, total] = progressMatch;
                    console.log(`   📊 Progress: ${current}/${total} frames`);
                }
            });
            
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            process.on('close', async (code) => {
                if (code !== 0) {
                    console.error('YOLO tracking error:', errorOutput);
                    reject(new Error(`Object tracking failed: ${errorOutput}`));
                } else {
                    try {
                        // Read the output file created by the Python script
                        const trackingFile = videoPath.replace('.mp4', '_tracking.json');
                        const data = await fs.readFile(trackingFile, 'utf8');
                        const result = JSON.parse(data);
                        
                        // Clean up temp file
                        try {
                            await fs.unlink(trackingFile);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                        
                        console.log(`   ✅ Tracked ${result.total_tracks} objects across ${result.total_frames} frames`);
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }
    
    /**
     * Run MediaPipe human analysis (sampled frames)
     */
    async runMediaPipe(videoPath, videoId) {
        console.log('👤 Running MediaPipe human analysis...');
        
        // Extract username from video path if available
        const pathMatch = videoPath.match(/([^/]+)_(\d+)\.mp4$/);
        const fullVideoId = pathMatch ? `${pathMatch[1]}_${pathMatch[2]}` : videoId;
        
        // First, extract frames if not already done
        const frameDir = path.join(__dirname, '../../frame_outputs', fullVideoId);
        if (!await this.checkDirectoryExists(frameDir)) {
            console.log('   📷 Extracting frames for MediaPipe...');
            await this.extractFrames(videoPath, fullVideoId);
        }
        
        // Run MediaPipe analysis
        return new Promise((resolve, reject) => {
            const script = path.join(this.pythonScriptsPath, '../mediapipe_human_detector.py');
            
            const process = spawn(this.pythonPath, [
                script,
                fullVideoId
            ]);
            
            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            process.on('close', async (code) => {
                if (code !== 0) {
                    console.error('MediaPipe error:', errorOutput);
                    // Return empty analysis on error
                    resolve({
                        total_frames: 0,
                        human_presence: 0,
                        timeline: { expressions: [], poses: [], gestures: [] }
                    });
                } else {
                    // Read the output file
                    try {
                        const analysisPath = path.join(
                            __dirname, 
                            '../../human_analysis_outputs',
                            fullVideoId,
                            `${fullVideoId}_human_analysis.json`
                        );
                        const data = await fs.readFile(analysisPath, 'utf8');
                        const parsed = JSON.parse(data);
                        const insights = parsed.insights || parsed;
                        console.log(`   ✅ Human analysis complete: presence=${insights.human_presence}, frames=${insights.total_frames}`);
                        resolve(insights);
                    } catch (error) {
                        console.error('   ❌ Failed to read MediaPipe output:', error.message);
                        resolve({
                            total_frames: 0,
                            human_presence: 0,
                            timeline: { expressions: [], poses: [], gestures: [] }
                        });
                    }
                }
            });
        });
    }
    
    /**
     * Run OCR text detection (sampled frames)
     */
    async runOCR(videoPath, videoId) {
        console.log('📝 Running OCR text detection...');
        
        // Extract username from video path if available
        const pathMatch = videoPath.match(/([^/]+)_(\d+)\.mp4$/);
        const fullVideoId = pathMatch ? `${pathMatch[1]}_${pathMatch[2]}` : videoId;
        
        // First, extract frames if not already done
        const frameDir = path.join(__dirname, '../../frame_outputs', fullVideoId);
        if (!await this.checkDirectoryExists(frameDir)) {
            console.log('   📷 Extracting frames for OCR...');
            await this.extractFrames(videoPath, fullVideoId);
        }
        
        // Run creative elements detection (includes OCR and stickers)
        return new Promise((resolve, reject) => {
            const script = path.join(this.pythonScriptsPath, '../detect_tiktok_creative_elements.py');
            
            const process = spawn(this.pythonPath, [
                script,
                fullVideoId
            ]);
            
            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            process.on('close', async (code) => {
                if (code !== 0) {
                    console.error('OCR error:', errorOutput);
                    // Return empty analysis on error
                    resolve({
                        total_frames: 0,
                        text_coverage: 0,
                        frame_details: []
                    });
                } else {
                    // Read the output file
                    try {
                        const analysisPath = path.join(
                            __dirname, 
                            '../../creative_analysis_outputs',
                            fullVideoId,
                            `${fullVideoId}_creative_analysis.json`
                        );
                        const data = await fs.readFile(analysisPath, 'utf8');
                        const parsed = JSON.parse(data);
                        const textCount = parsed.frame_details?.reduce((sum, frame) => 
                            sum + (frame.text_elements?.length || 0), 0) || 0;
                        const stickerCount = parsed.frame_details?.reduce((sum, frame) => 
                            sum + (frame.creative_elements?.filter(el => el.type === 'sticker' || el.category === 'sticker').length || 0), 0) || 0;
                        console.log(`   ✅ Creative analysis complete: ${textCount} text elements, ${stickerCount} stickers detected`);
                        resolve(parsed);
                    } catch (error) {
                        console.error('   ❌ Failed to read OCR output:', error.message);
                        resolve({
                            total_frames: 0,
                            text_coverage: 0,
                            frame_details: []
                        });
                    }
                }
            });
        });
    }
    
    /**
     * Run PySceneDetect for shot detection
     */
    async runSceneDetect(videoPath, videoId) {
        console.log('🎬 Running scene detection...');
        
        return new Promise(async (resolve, reject) => {
            const script = path.join(this.pythonScriptsPath, 'scene_detection.py');
            const outputDir = path.join(this.outputPath.replace(videoId, ''), 'scene_detection_outputs', videoId);
            
            // Ensure output directory exists
            await fs.mkdir(outputDir, { recursive: true });
            
            const process = spawn(this.pythonPath, [
                script,
                videoPath
            ]);
            
            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            process.on('close', async (code) => {
                if (code !== 0) {
                    console.error('Scene detection error:', errorOutput);
                    reject(new Error(`Scene detection failed: ${errorOutput}`));
                } else {
                    try {
                        const result = JSON.parse(output);
                        console.log(`   ✅ Detected ${result.total_scenes} scenes`);
                        
                        // Save scene detection results to file
                        const outputPath = path.join(outputDir, `${videoId}_scenes.json`);
                        await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
                        console.log(`   💾 Saved scene detection to: ${outputPath}`);
                        
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }
    
    /**
     * Run CLIP for scene labeling
     */
    async runCLIP(videoPath, videoId) {
        console.log('🏷️ Running CLIP scene labeling...');
        
        return new Promise((resolve, reject) => {
            const script = path.join(this.pythonScriptsPath, 'scene_labeling.py');
            const outputFile = path.join(this.outputPath, 'scene_labels', `${videoId}_labels.json`);
            
            const process = spawn(this.pythonPath, [
                script,
                videoPath,
                outputFile
            ]);
            
            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            process.on('close', async (code) => {
                if (code !== 0) {
                    console.error('CLIP labeling error:', errorOutput);
                    reject(new Error(`Scene labeling failed: ${errorOutput}`));
                } else {
                    try {
                        const data = await fs.readFile(outputFile, 'utf8');
                        const result = JSON.parse(data);
                        console.log(`   ✅ Labeled ${result.frame_count} frames`);
                        console.log(`   📋 Top labels: ${result.labels.slice(0, 5).map(l => l.description).join(', ')}`);
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }
    
    /**
     * Run Enhanced Human Analysis (Body Pose, Gaze, Scene Segmentation, Action Recognition)
     */
    async runEnhancedHumanAnalysis(videoPath, videoId) {
        console.log('🧍 Running enhanced human analysis (pose, gaze, segmentation, actions)...');
        
        // First ensure frames are extracted
        const framesDir = path.join(__dirname, '../../frame_outputs', videoId);
        const framesDirExists = await this.checkDirectoryExists(framesDir);
        
        if (!framesDirExists) {
            console.log('   📸 Extracting frames first...');
            await this.extractFrames(videoPath, videoId);
        }
        
        return new Promise((resolve, reject) => {
            const script = path.join(__dirname, '../../enhanced_human_analyzer.py');
            
            const process = spawn(this.pythonPath, [
                script,
                videoId
            ]);
            
            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            process.on('close', async (code) => {
                if (code !== 0) {
                    console.error('Enhanced human analysis error:', errorOutput);
                    // Return empty analysis on error
                    resolve({
                        summary: {
                            face_screen_time_ratio: 0,
                            person_screen_time_ratio: 0,
                            subject_absence_count: 0
                        }
                    });
                } else {
                    try {
                        const analysisPath = path.join(
                            __dirname,
                            '../../enhanced_human_analysis_outputs',
                            videoId,
                            `${videoId}_enhanced_human_analysis.json`
                        );
                        const data = await fs.readFile(analysisPath, 'utf8');
                        const parsed = JSON.parse(data);
                        
                        console.log(`   ✅ Enhanced analysis complete:`);
                        console.log(`      - Face screen time: ${(parsed.summary.face_screen_time_ratio * 100).toFixed(1)}%`);
                        console.log(`      - Eye contact ratio: ${(parsed.summary.gaze_patterns.eye_contact_ratio * 100).toFixed(1)}%`);
                        console.log(`      - Primary actions detected: ${Object.keys(parsed.summary.primary_actions).join(', ')}`);
                        
                        resolve(parsed);
                    } catch (error) {
                        console.error('   ❌ Failed to read enhanced analysis:', error.message);
                        resolve({
                            summary: {
                                face_screen_time_ratio: 0,
                                person_screen_time_ratio: 0,
                                subject_absence_count: 0
                            }
                        });
                    }
                }
            });
        });
    }

    /**
     * Run OpenNSFW2 content moderation
     */
    async runNSFW(videoPath, videoId) {
        console.log('🛡️ Running content moderation...');
        
        return new Promise((resolve, reject) => {
            const script = path.join(this.pythonScriptsPath, 'content_moderation.py');
            
            const process = spawn(this.pythonPath, [
                script,
                videoPath
            ]);
            
            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
                // Log important warnings but don't fail
                if (!data.toString().includes('not found')) {
                    console.log('   ⚠️', data.toString().trim());
                }
            });
            
            process.on('close', async (code) => {
                if (code !== 0) {
                    console.error('Content moderation error:', errorOutput);
                    reject(new Error(`Content moderation failed: ${errorOutput}`));
                } else {
                    try {
                        // Read the output file created by the Python script
                        const moderationFile = videoPath.replace('.mp4', '_moderation.json');
                        const data = await fs.readFile(moderationFile, 'utf8');
                        const result = JSON.parse(data);
                        
                        // Clean up temp file
                        try {
                            await fs.unlink(moderationFile);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                        
                        console.log(`   ✅ Safety rating: ${result.explicitContent.safety_rating}`);
                        resolve(result);
                    } catch (e) {
                        // If moderation fails, return safe defaults
                        console.log('   ⚠️ Content moderation unavailable, assuming safe content');
                        resolve({
                            explicitContent: {
                                is_safe: true,
                                safety_rating: 'unknown',
                                avg_nsfw_score: 0,
                                max_nsfw_score: 0,
                                explicit_frame_count: 0,
                                explicit_frames: []
                            },
                            frame_results: []
                        });
                    }
                }
            });
        });
    }
    
    /**
     * Main analysis orchestration
     */
    async analyzeVideo(videoPath, videoId) {
        console.log(`\n🎥 Starting local video analysis for ${videoId}`);
        console.log(`📍 Video path: ${videoPath}\n`);
        
        try {
            // 1. Extract metadata and create master timeline
            console.log('📊 Extracting video metadata...');
            const metadata = await this.extractVideoMetadata(videoPath);
            const timeline = new TimelineSynchronizer(metadata);
            
            // 2. Run all analyses in parallel
            console.log('\n🚀 Running parallel analysis...\n');
            
            const results = await Promise.all([
                // Audio/Speech
                this.runWhisper(videoPath, videoId)
                    .then(r => timeline.alignWhisperToVideo(r)),
                
                // Object Detection & Tracking (ALL FRAMES)
                this.runYOLOWithDeepSort(videoPath, videoId)
                    .then(r => timeline.validateObjectTracking(r)),
                
                // Human Analysis
                this.runMediaPipe(videoPath, videoId)
                    .then(r => timeline.validateHumanAnalysis(r)),
                
                // Enhanced Human Analysis (Body Pose, Gaze, Scene Segmentation, Actions)
                this.runEnhancedHumanAnalysis(videoPath, videoId)
                    .then(r => r), // No validation needed, already structured
                
                // Text Detection  
                this.runOCR(videoPath, videoId)
                    .then(r => timeline.validateTextDetection(r)),
                
                // Scene Detection
                this.runSceneDetect(videoPath, videoId)
                    .then(r => timeline.validateSceneChanges(r)),
                
                // Scene Understanding (CLIP only, no BLIP-2)
                this.runCLIP(videoPath, videoId)
                    .then(r => timeline.validateSceneLabels(r)),
                
                // Content Moderation
                this.runNSFW(videoPath, videoId)
                    .then(r => timeline.validateContentModeration(r))
            ]);
            
            // 3. Structure results matching GVI format
            const [whisper, yolo, mediapipe, enhancedHuman, ocr, scenes, labels, nsfw] = results;
            
            console.log('\n✅ All local analyses complete!\n');
            
            return {
                // Speech from Whisper
                speechTranscriptions: whisper.speechTranscriptions || [],
                transcript: whisper.transcript || '',
                wordCount: whisper.wordCount || 0,
                speechSegments: whisper.segments || [],
                
                // Object tracking from YOLO + DeepSort
                objectAnnotations: yolo.objectAnnotations || [],
                
                // Person detection from MediaPipe
                personAnnotations: this.formatPersonAnnotations(mediapipe),
                
                // Text detection from OCR
                textAnnotations: this.formatTextAnnotations(ocr),
                
                // Scene changes from PySceneDetect (format to match GVI)
                shots: this.formatShots(scenes.shots || []),
                
                // Scene labels from CLIP
                labels: labels.labels || [],
                
                // Content moderation from OpenNSFW2
                explicitContent: nsfw.explicitContent || {},
                
                // Enhanced Human Analysis (new)
                enhancedHumanAnalysis: enhancedHuman.summary || {},
                
                // Metadata
                metadata: metadata,
                
                // Raw results for debugging
                _raw: { whisper, yolo, mediapipe, enhancedHuman, ocr, scenes, labels, nsfw }
            };
            
        } catch (error) {
            console.error('❌ Local analysis failed:', error);
            throw error;
        }
    }
    
    /**
     * Format MediaPipe data to match GVI person annotations
     */
    formatPersonAnnotations(mediapipeData) {
        if (!mediapipeData || !mediapipeData.timeline) {
            return [];
        }
        
        // Convert MediaPipe timeline to person annotations
        const personTracks = {};
        
        // Process poses
        if (mediapipeData.timeline.poses) {
            mediapipeData.timeline.poses.forEach(pose => {
                const trackId = 'person_1'; // MediaPipe doesn't track IDs
                if (!personTracks[trackId]) {
                    personTracks[trackId] = { frames: [] };
                }
                
                personTracks[trackId].frames.push({
                    frame: pose.frame,
                    pose: pose.pose,
                    actions: pose.actions || []
                });
            });
        }
        
        // Convert to array format
        return Object.entries(personTracks).map(([trackId, data]) => ({
            trackId: trackId,
            frames: data.frames
        }));
    }
    
    /**
     * Format OCR data to match GVI text annotations
     */
    formatTextAnnotations(ocrData) {
        if (!ocrData || !ocrData.frame_details) {
            return [];
        }
        
        const textAnnotations = [];
        
        // Process each frame's text elements
        ocrData.frame_details.forEach(frameDetail => {
            if (frameDetail.text_elements && frameDetail.text_elements.length > 0) {
                frameDetail.text_elements.forEach(textElement => {
                    // Extract frame number from frame name (e.g., "frame_0000_t0.00.jpg" -> 0)
                    const frameMatch = frameDetail.frame.match(/frame_(\d+)/);
                    const frameNumber = frameMatch ? parseInt(frameMatch[1]) : 0;
                    
                    textAnnotations.push({
                        text: textElement.text,
                        frames: [{
                            frame: frameNumber,
                            timestamp: frameNumber / 30.0, // Assuming 30fps
                            confidence: textElement.confidence || 1.0
                        }],
                        category: textElement.category || 'overlay_text'
                    });
                });
            }
        });
        
        return textAnnotations;
    }
    
    /**
     * Format shots to match GVI shot structure
     */
    formatShots(shots) {
        if (!shots || !Array.isArray(shots)) {
            return [];
        }
        
        return shots.map(shot => ({
            startTime: `${shot.start_time}s`,
            endTime: `${shot.end_time}s`,
            startFrame: shot.start_frame,
            endFrame: shot.end_frame
        }));
    }
    
    /**
     * Check if directory exists
     */
    async checkDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Extract frames from video
     */
    async extractFrames(videoPath, videoId) {
        return new Promise((resolve, reject) => {
            const script = path.join(this.pythonScriptsPath, '../automated_video_pipeline.py');
            
            // Set environment variable for the script
            const env = { ...process.env, VIDEO_ID: videoId, VIDEO_PATH: videoPath };
            
            const proc = spawn(this.pythonPath, [script, 'once'], { env });
            
            let output = '';
            let errorOutput = '';
            
            proc.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            proc.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            proc.on('close', (code) => {
                if (code !== 0) {
                    console.error('Frame extraction error:', errorOutput);
                    reject(new Error(`Frame extraction failed: ${errorOutput}`));
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = new LocalVideoAnalyzer();