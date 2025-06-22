const express = require('express');
const router = express.Router();
const AnalysisService = require('../services/AnalysisService');

router.post('/videos', async (req, res) => {
    try {
        const { videos } = req.body;
        
        if (!videos || !Array.isArray(videos)) {
            return res.status(400).json({ error: 'Videos array is required' });
        }

        console.log(`🔍 Analyzing ${videos.length} videos for insights`);
        
        const analysis = await AnalysisService.analyzeVideos(videos);
        
        res.json({
            success: true,
            data: analysis
        });
        
    } catch (error) {
        console.error('Video analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/export-report', async (req, res) => {
    try {
        const { analysisData, username } = req.body;
        
        const reportBuffer = await AnalysisService.generatePDFReport(analysisData, username);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="tiktok-analysis-${username}.pdf"`);
        res.send(reportBuffer);
        
    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;