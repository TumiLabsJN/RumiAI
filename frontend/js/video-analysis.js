// Video Analysis Page JavaScript

// Get video ID from URL
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id');

// Analysis types mapping
const analysisTypes = {
    'hook_analysis': 'Hook Analysis',
    'engagement_triggers': 'Engagement Triggers',
    'cta_alignment': 'CTA Alignment',
    'speech_cta_phrases': 'Speech CTA Phrases',
    'creative_density': 'Creative Density',
    'emotional_arc': 'Emotional Arc',
    'scene_pacing': 'Scene Pacing',
    'person_framing': 'Person Framing',
    'speech_quantity': 'Speech Quantity',
    'speech_tone_expression': 'Speech Tone Expression',
    'sensory_mix': 'Sensory Mix',
    'brand_product_timing': 'Brand/Product Timing',
    'engagement_tactics': 'Engagement Tactics',
    'content_style': 'Content Style',
    'audience_connection': 'Audience Connection'
};

let currentAnalysis = 'hook_analysis';
let videoData = {};
let unifiedData = {};
let promptsData = {};

async function loadVideoData() {
    if (!videoId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // Load video metadata
        await loadVideoMetadata();
        
        // Load unified analysis (contains raw data from GVI, YOLO, etc.)
        await loadUnifiedAnalysis();
        
        // Load all Claude analysis results
        await loadClaudeAnalyses();
        
        // Display initial analysis
        displayAnalysis(currentAnalysis);
        
    } catch (error) {
        console.error('Error loading video data:', error);
        document.getElementById('tabContent').innerHTML = 
            '<div class="error">Error loading video data. Please check console for details.</div>';
    }
}

async function loadVideoMetadata() {
    // Simulate loading metadata - in production this would fetch from server
    const metadataMap = {
        'nutsnmore_7462841470299606318': {
            username: 'nutsnmore',
            title: 'Healthy Banana Sundae Recipe',
            views: 1138,
            likes: 25,
            duration: 9,
            caption: '🍌🍫☀️ Whip up a healthy banana sundae with our Coconut Chocolate Almond Butter Spread'
        },
        'healthandwellnessliving_7514038807142894879': {
            username: 'healthandwellnessliving',
            title: 'Health and Wellness Tips',
            views: 2783,
            likes: 40,
            duration: 29,
            caption: 'Health and wellness living tips'
        },
        'latstrisomeprotein_7197152431958986026': {
            username: 'latstrisomeprotein',
            title: 'Protein Recipe',
            views: 0,
            likes: 0,
            duration: 0,
            caption: 'Protein recipe demonstration'
        },
        'cristiano_7515739984452701457': {
            username: 'cristiano',
            title: 'Cristiano Ronaldo Video',
            views: 0,
            likes: 0,
            duration: 13,
            caption: 'Is this the real Cristiano?'
        }
    };

    videoData = metadataMap[videoId] || {};
    displayVideoInfo();
}

function displayVideoInfo() {
    const infoDiv = document.getElementById('videoInfo');
    const engagementRate = videoData.views > 0 ? ((videoData.likes / videoData.views) * 100).toFixed(2) : 0;

    infoDiv.innerHTML = `
        <h2>@${videoData.username} - Video Analysis</h2>
        <p>${videoData.caption}</p>
        <div class="video-meta">
            <div class="stat">
                <span class="stat-label">Views</span>
                <span class="stat-value">${formatNumber(videoData.views)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Likes</span>
                <span class="stat-value">${formatNumber(videoData.likes)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Engagement Rate</span>
                <span class="stat-value">${engagementRate}%</span>
            </div>
            <div class="stat">
                <span class="stat-label">Duration</span>
                <span class="stat-value">${videoData.duration}s</span>
            </div>
        </div>
    `;
}

async function loadUnifiedAnalysis() {
    // In production, this would fetch from server
    // For demo, we'll create sample data structure
    unifiedData = {
        timelines: {
            objectTimeline: generateSampleObjectTimeline(),
            textOverlayTimeline: generateSampleTextTimeline(),
            speechTimeline: generateSampleSpeechTimeline(),
            sceneChangeTimeline: generateSampleSceneTimeline()
        },
        google_video_intelligence: {
            objectAnnotations: [],
            textAnnotations: [],
            speechTranscriptions: []
        },
        local_analysis: {
            yolo_results: [],
            ocr_results: [],
            mediapipe_results: []
        }
    };
}

async function loadClaudeAnalyses() {
    // Load Claude analysis results for each prompt
    for (const [key, name] of Object.entries(analysisTypes)) {
        promptsData[key] = {
            prompt: `Analyze the ${name} for this video...`,
            response: `Based on the video analysis, here are the key findings for ${name}...`,
            timestamp: new Date().toISOString()
        };
    }
}

function displayAnalysis(analysisType) {
    currentAnalysis = analysisType;
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === analysisType);
    });
    
    // Update title
    document.getElementById('analysisTitle').textContent = analysisTypes[analysisType];
    
    // Display raw data
    displayRawData(analysisType);
    
    // Display Claude's analysis
    displayClaudeAnalysis(analysisType);
    
    // Display prompt
    displayPrompt(analysisType);
}

function displayRawData(analysisType) {
    const rawDataDiv = document.getElementById('rawData');
    let content = '';
    
    // Show relevant timeline data based on analysis type
    if (analysisType === 'hook_analysis') {
        content = `
            <div class="timeline-entry">
                <h4>First 3 Seconds - Object Timeline</h4>
                <div class="timeline-data">${formatTimeline(unifiedData.timelines.objectTimeline, 3)}</div>
            </div>
            <div class="timeline-entry">
                <h4>First 3 Seconds - Text Overlays</h4>
                <div class="timeline-data">${formatTimeline(unifiedData.timelines.textOverlayTimeline, 3)}</div>
            </div>
            <div class="timeline-entry">
                <h4>Scene Changes</h4>
                <div class="timeline-data">${formatTimeline(unifiedData.timelines.sceneChangeTimeline, 3)}</div>
            </div>
        `;
    } else if (analysisType === 'creative_density') {
        content = `
            <div class="timeline-entry">
                <h4>All Objects Detected (YOLO + GVI)</h4>
                <div class="timeline-data">${formatFullTimeline(unifiedData.timelines.objectTimeline)}</div>
            </div>
            <div class="timeline-entry">
                <h4>Text Overlays (OCR)</h4>
                <div class="timeline-data">${formatFullTimeline(unifiedData.timelines.textOverlayTimeline)}</div>
            </div>
        `;
    } else if (analysisType.includes('speech')) {
        content = `
            <div class="timeline-entry">
                <h4>Speech Transcription</h4>
                <div class="timeline-data">${formatFullTimeline(unifiedData.timelines.speechTimeline)}</div>
            </div>
        `;
    } else {
        // Default: show all available data
        content = `
            <div class="timeline-entry">
                <h4>Complete Timeline Data</h4>
                <div class="timeline-data">${JSON.stringify(unifiedData.timelines, null, 2)}</div>
            </div>
        `;
    }
    
    rawDataDiv.innerHTML = content;
}

function displayClaudeAnalysis(analysisType) {
    const claudeDiv = document.getElementById('claudeAnalysis');
    const analysis = promptsData[analysisType];
    
    if (analysis && analysis.response) {
        claudeDiv.innerHTML = `
            <div class="analysis-result">
                <h4>Analysis Results</h4>
                <p>${analysis.response}</p>
                <p class="timestamp">Analyzed at: ${new Date(analysis.timestamp).toLocaleString()}</p>
            </div>
        `;
    } else {
        claudeDiv.innerHTML = '<p>No analysis available for this prompt yet.</p>';
    }
}

function displayPrompt(analysisType) {
    const promptDiv = document.getElementById('promptText');
    const analysis = promptsData[analysisType];
    
    if (analysis && analysis.prompt) {
        promptDiv.textContent = analysis.prompt;
    } else {
        promptDiv.textContent = 'Prompt not available';
    }
}

// Helper functions
function formatTimeline(timeline, maxSeconds = null) {
    if (!timeline || Object.keys(timeline).length === 0) {
        return 'No data available';
    }
    
    let entries = Object.entries(timeline);
    if (maxSeconds) {
        entries = entries.filter(([time]) => parseFloat(time) <= maxSeconds);
    }
    
    return entries.map(([time, data]) => 
        `${time}s: ${JSON.stringify(data, null, 2)}`
    ).join('\n\n');
}

function formatFullTimeline(timeline) {
    if (!timeline || Object.keys(timeline).length === 0) {
        return 'No data available';
    }
    
    return JSON.stringify(timeline, null, 2);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Sample data generators (for demo purposes)
function generateSampleObjectTimeline() {
    return {
        "0.00": [{"object": "person", "confidence": 0.95}],
        "1.00": [{"object": "person", "confidence": 0.94}, {"object": "food", "confidence": 0.87}],
        "2.00": [{"object": "banana", "confidence": 0.92}],
        "3.00": [{"object": "dessert", "confidence": 0.89}]
    };
}

function generateSampleTextTimeline() {
    return {
        "0.50": {"text": "Wait for it...", "confidence": 0.98},
        "2.00": {"text": "Healthy banana sundae", "confidence": 0.95},
        "4.00": {"text": "High protein!", "confidence": 0.93}
    };
}

function generateSampleSpeechTimeline() {
    return {
        "0.00": {"word": "Hey", "confidence": 0.95},
        "0.50": {"word": "everyone", "confidence": 0.94},
        "1.00": {"word": "today", "confidence": 0.96}
    };
}

function generateSampleSceneTimeline() {
    return {
        "0.00": {"type": "cut", "confidence": 1.0},
        "2.50": {"type": "cut", "confidence": 0.95},
        "5.00": {"type": "transition", "confidence": 0.87}
    };
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadVideoData();
    
    // Tab click handlers
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            displayAnalysis(btn.dataset.tab);
        });
    });
});