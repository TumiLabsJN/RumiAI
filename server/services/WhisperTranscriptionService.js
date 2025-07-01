const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class WhisperTranscriptionService {
    constructor() {
        this.tempDir = '/tmp/whisper_audio';
        this.ensureTempDir();
    }

    async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create temp directory:', error);
        }
    }

    /**
     * Transcribe video using OpenAI Whisper
     * @param {string} videoPath - Path to video file
     * @param {string} videoId - Video ID for naming
     * @returns {Object} Transcription result with segments and metadata
     */
    async transcribeVideo(videoPath, videoId) {
        console.log(`🎤 Starting Whisper transcription for ${videoId}`);
        
        try {
            // First extract audio from video
            const audioPath = await this.extractAudio(videoPath, videoId);
            
            // Run Whisper transcription
            const transcription = await this.runWhisper(audioPath, videoId);
            
            // Clean up audio file
            try {
                await fs.unlink(audioPath);
            } catch (e) {
                console.log('Could not delete temp audio file:', e.message);
            }
            
            return transcription;
        } catch (error) {
            console.error('❌ Whisper transcription failed:', error);
            return {
                speechTranscriptions: [],
                transcript: '',
                wordCount: 0,
                segments: []
            };
        }
    }

    /**
     * Extract audio from video file
     */
    async extractAudio(videoPath, videoId) {
        const audioPath = path.join(this.tempDir, `${videoId}_audio.wav`);
        
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-i', videoPath,
                '-vn', // No video
                '-acodec', 'pcm_s16le', // WAV format
                '-ar', '16000', // 16kHz sample rate for Whisper
                '-ac', '1', // Mono audio
                audioPath,
                '-y' // Overwrite if exists
            ]);

            let errorOutput = '';
            
            ffmpeg.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`));
                } else {
                    console.log(`✅ Audio extracted to ${audioPath}`);
                    resolve(audioPath);
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Run Whisper transcription on audio file
     */
    async runWhisper(audioPath, videoId) {
        return new Promise((resolve, reject) => {
            // Get the path to the venv python
            const venvPath = path.join(__dirname, '../../venv/bin/python');
            
            // Run whisper with word-level timestamps using venv python
            const whisper = spawn(venvPath, [
                '-c',
                `
import whisper
import json
import sys
import os
import warnings

# Suppress all warnings including Triton
warnings.filterwarnings("ignore")
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:128'

# Redirect stdout temporarily to capture Whisper's print statements
import io
old_stdout = sys.stdout
sys.stdout = io.StringIO()

try:
    # Load the model
    model = whisper.load_model("base")
    
    # Try to transcribe with word timestamps, fall back if it fails
    try:
        # First attempt with word timestamps
        result = model.transcribe("${audioPath}", word_timestamps=True, verbose=False)
        has_word_timestamps = True
    except Exception as e:
        # Fall back to segment-only timestamps
        result = model.transcribe("${audioPath}", word_timestamps=False, verbose=False)
        has_word_timestamps = False
finally:
    # Restore stdout
    sys.stdout = old_stdout

# Format output for compatibility with GVI structure
segments = []
speech_transcriptions = []

for segment in result.get("segments", []):
    # Create segment for timeline
    segments.append({
        "start": segment["start"],
        "end": segment["end"],
        "text": segment["text"].strip()
    })
    
    # Create word-level data
    words = []
    
    if has_word_timestamps and "words" in segment:
        # Use actual word timestamps
        for word_data in segment.get("words", []):
            words.append({
                "word": word_data["word"].strip(),
                "startTime": {"seconds": int(word_data["start"]), "nanos": int((word_data["start"] % 1) * 1e9)},
                "endTime": {"seconds": int(word_data["end"]), "nanos": int((word_data["end"] % 1) * 1e9)},
                "confidence": word_data.get("probability", 0.9)
            })
    else:
        # Distribute words evenly across segment time
        text_words = segment["text"].strip().split()
        if text_words:
            segment_duration = segment["end"] - segment["start"]
            word_duration = segment_duration / len(text_words)
            
            for i, word in enumerate(text_words):
                word_start = segment["start"] + (i * word_duration)
                word_end = segment["start"] + ((i + 1) * word_duration)
                
                words.append({
                    "word": word,
                    "startTime": {"seconds": int(word_start), "nanos": int((word_start % 1) * 1e9)},
                    "endTime": {"seconds": int(word_end), "nanos": int((word_end % 1) * 1e9)},
                    "confidence": 0.8  # Lower confidence for estimated timestamps
                })
    
    if segment["text"].strip():  # Only add if there's actual text
        speech_transcriptions.append({
            "alternatives": [{
                "transcript": segment["text"].strip(),
                "confidence": segment.get("avg_logprob", -0.5) + 1.5 if has_word_timestamps else 0.85,
                "words": words
            }],
            "languageCode": result.get("language", "en-US")
        })

# Output JSON result
output = {
    "speechTranscriptions": speech_transcriptions,
    "transcript": result["text"].strip(),
    "wordCount": len(result["text"].split()),
    "segments": segments,
    "language": result.get("language", "en"),
    "duration": max([s["end"] for s in segments]) if segments else 0
}

print(json.dumps(output))
`
            ]);

            let output = '';
            let errorOutput = '';

            whisper.stdout.on('data', (data) => {
                output += data.toString();
            });

            whisper.stderr.on('data', (data) => {
                errorOutput += data.toString();
                // Ignore Whisper's progress output
                if (!data.toString().includes('Detecting language') && 
                    !data.toString().includes('transcribe:')) {
                    console.log('Whisper:', data.toString().trim());
                }
            });

            whisper.on('close', (code) => {
                if (code !== 0) {
                    console.error('Whisper error output:', errorOutput);
                    reject(new Error(`Whisper failed with code ${code}`));
                } else {
                    try {
                        // Extract JSON from output - handle "Detected language" prefix
                        let jsonStr = output;
                        
                        // Find the first { and extract from there
                        const jsonStart = output.indexOf('{');
                        if (jsonStart !== -1) {
                            jsonStr = output.substring(jsonStart);
                        }
                        
                        // Parse the JSON
                        const result = JSON.parse(jsonStr);
                        console.log(`✅ Whisper transcription complete: ${result.wordCount} words, ${result.segments.length} segments`);
                        if (result.transcript) {
                            console.log(`📝 Transcript preview: ${result.transcript.substring(0, 100)}...`);
                        }
                        resolve(result);
                    } catch (e) {
                        console.error('Failed to parse Whisper output:', e);
                        console.error('Raw output:', output);
                        reject(e);
                    }
                }
            });

            whisper.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Save transcription results
     */
    async saveTranscription(videoId, transcription) {
        const outputPath = path.join('speech_transcriptions', `${videoId}_whisper.json`);
        await fs.mkdir('speech_transcriptions', { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(transcription, null, 2));
        console.log(`💾 Saved Whisper transcription to ${outputPath}`);
        return outputPath;
    }
}

module.exports = new WhisperTranscriptionService();