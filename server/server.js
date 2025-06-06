const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

console.log('🔧 Starting Tumi Labs TikTok Analyzer...');

const app = express();
const PORT = process.env.PORT || 3001;

// Add comprehensive error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

app.use(cors());
app.use(express.json());

// Enhanced static file serving with proper MIME types
app.use(express.static(path.join(__dirname, '../public'), {
    setHeaders: (res, filePath, stat) => {
        console.log('📁 Serving static file:', filePath);
        
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        }
    }
}));

console.log('✅ Express middleware configured');
console.log('📁 Static files served from:', path.join(__dirname, '../public'));

// Test route first
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Debug routes for static files
app.get('/css/styles.css', (req, res) => {
    const cssPath = path.join(__dirname, '../public/css/styles.css');
    console.log('🎨 CSS requested, serving from:', cssPath);
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(cssPath);
});

app.get('/js/app.js', (req, res) => {
    const jsPath = path.join(__dirname, '../public/js/app.js');
    console.log('⚡ JS requested, serving from:', jsPath);
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(jsPath);
});

// Try to load routes with error handling
let tiktokRoutes, analysisRoutes, videoAnalysisRoutes;

try {
    console.log('📱 Loading TikTok routes...');
    tiktokRoutes = require('./routes/tiktok');
    console.log('✅ TikTok routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading TikTok routes:', error.message);
    console.error('Stack:', error.stack);
}

try {
    console.log('🔍 Loading Analysis routes...');
    analysisRoutes = require('./routes/analysis');
    console.log('✅ Analysis routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading Analysis routes:', error.message);
    console.error('Stack:', error.stack);
}

try {
    console.log('🎬 Loading Video Analysis routes...');
    videoAnalysisRoutes = require('./routes/video-analysis');
    console.log('✅ Video Analysis routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading Video Analysis routes:', error.message);
    console.error('Stack:', error.stack);
}

// Only add routes if they loaded successfully
if (tiktokRoutes) {
    app.use('/api/tiktok', tiktokRoutes);
    console.log('✅ TikTok API routes mounted');
}

if (analysisRoutes) {
    app.use('/api/analysis', analysisRoutes);
    console.log('✅ Analysis API routes mounted');
}

if (videoAnalysisRoutes) {
    app.use('/api/video-analysis', videoAnalysisRoutes);
    console.log('✅ Video Analysis API routes mounted');
}

app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } catch (error) {
        console.error('❌ Error serving index.html:', error);
        res.status(500).send('Server Error');
    }
});

// Add error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Express Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
});

const server = app.listen(PORT, '0.0.0.0', (error) => {
    if (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
    console.log(`🚀 Tumi Labs TikTok Analyzer running on port ${PORT}`);
    console.log(`📊 Visit http://localhost:${PORT} to start analyzing`);
    console.log(`🔧 Health check: http://localhost:${PORT}/health`);
});

server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Try a different port.`);
    }
    process.exit(1);
});