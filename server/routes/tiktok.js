const express = require('express');
const router = express.Router();
const TikTokService = require('../services/TikTokService');

// Try to load VideoAnalysisService, but don't fail if it's not available
let VideoAnalysisService = null;
try {
    VideoAnalysisService = require('../services/VideoAnalysisService');
    console.log('✅ VideoAnalysisService loaded successfully');
} catch (error) {
    console.warn('⚠️ VideoAnalysisService not available:', error.message);
}

router.post('/analyze', async (req, res) => {
    console.log('📥 Received analyze request');
    console.log('📋 Request body:', req.body);
    
    try {
        const { username } = req.body;
        
        console.log(`👤 Extracted username: "${username}"`);
        
        if (!username) {
            console.log('❌ No username provided in request');
            return res.status(400).json({ error: 'Username is required' });
        }

        console.log(`🎯 Starting analysis for @${username}`);
        
        const result = await TikTokService.analyzeProfile(username);
        
        console.log('✅ Analysis completed successfully');
        console.log('📊 Result preview:', {
            username: result.username,
            totalVideos: result.totalVideos,
            videosAnalyzed: result.allVideosAnalyzed?.length || 0,
            analysisType: result.criteria?.analysisType || 'comprehensive_metadata'
        });

        // Start video analysis asynchronously (non-blocking)
        let videoAnalysisJob = null;
        
        if (!VideoAnalysisService) {
            console.log('🎬 VideoAnalysisService not loaded - video analysis unavailable');
            videoAnalysisJob = {
                error: 'Service not available',
                message: 'Video analysis service is not configured. See SETUP.md for configuration instructions.'
            };
        } else if (result.allVideosAnalyzed && result.allVideosAnalyzed.length > 0) {
            try {
                console.log('🎬 Starting background video analysis...');
                console.log(`🎬 Videos available for analysis: ${result.allVideosAnalyzed.length}`);
                console.log(`🎬 Sample video data:`, JSON.stringify(result.allVideosAnalyzed[0], null, 2));
                
                // Check if required environment variables are set
                const requiredEnvVars = [
                    'GOOGLE_CLOUD_PROJECT_ID',
                    'GOOGLE_CLOUD_STORAGE_BUCKET',
                    'ANTHROPIC_API_KEY'
                ];
                
                const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
                if (missingVars.length > 0) {
                    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}. See SETUP.md for configuration.`);
                }
                
                const videoJobResult = await VideoAnalysisService.startVideoAnalysis(
                    result.allVideosAnalyzed, 
                    username
                );
                videoAnalysisJob = {
                    jobId: videoJobResult.jobId,
                    status: videoJobResult.status,
                    message: 'Video analysis started in background'
                };
                console.log(`🎬 Video analysis job started successfully: ${videoJobResult.jobId}`);
            } catch (videoError) {
                console.error('❌ Failed to start video analysis:', videoError);
                console.error('❌ Video error stack:', videoError.stack);
                // Don't fail the main response, just log the error
                videoAnalysisJob = {
                    error: 'Failed to start video analysis',
                    message: videoError.message,
                    details: process.env.NODE_ENV === 'development' ? videoError.stack : undefined
                };
            }
        } else {
            console.log('🎬 No videos available for video analysis');
            videoAnalysisJob = {
                error: 'No videos available',
                message: 'No qualifying videos found for video analysis'
            };
        }
        
        res.json({
            success: true,
            data: result,
            videoAnalysis: videoAnalysisJob,
            message: `Analysis completed for @${username}`
        });
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message || 'Analysis failed'
        });
    }
});

router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const status = await TikTokService.getJobStatus(jobId);
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;