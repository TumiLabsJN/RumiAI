const express = require('express');
const router = express.Router();
const TikTokService = require('../services/TikTokService');
const VideoAnalysisService = require('../services/VideoAnalysisService');

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
        if (result.allVideosAnalyzed && result.allVideosAnalyzed.length > 0) {
            try {
                console.log('🎬 Starting background video analysis...');
                const videoJobResult = await VideoAnalysisService.startVideoAnalysis(
                    result.allVideosAnalyzed, 
                    username
                );
                videoAnalysisJob = {
                    jobId: videoJobResult.jobId,
                    status: videoJobResult.status,
                    message: 'Video analysis started in background'
                };
                console.log(`🎬 Video analysis job started: ${videoJobResult.jobId}`);
            } catch (videoError) {
                console.error('❌ Failed to start video analysis:', videoError);
                // Don't fail the main response, just log the error
                videoAnalysisJob = {
                    error: 'Failed to start video analysis',
                    message: videoError.message
                };
            }
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