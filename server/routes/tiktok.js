const express = require('express');
const router = express.Router();
const TikTokService = require('../services/TikTokService');

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
        
        res.json({
            success: true,
            data: result,
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