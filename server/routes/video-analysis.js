const express = require('express');
const router = express.Router();
const VideoAnalysisService = require('../services/VideoAnalysisService');
const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const analysisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 video analysis requests per windowMs
    message: {
        success: false,
        error: 'Too many video analysis requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const statusLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Allow more frequent status checks
    message: {
        success: false,
        error: 'Too many status requests. Please try again later.'
    }
});

/**
 * POST /api/video-analysis/start
 * Start asynchronous video analysis
 */
router.post('/start', analysisLimiter, async (req, res) => {
    console.log('🎬 Video analysis start request received');
    
    try {
        const { videos, username } = req.body;
        
        // Input validation
        if (!videos || !Array.isArray(videos) || videos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Videos array is required and must not be empty'
            });
        }
        
        if (!username || typeof username !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Username is required'
            });
        }

        // Validate video objects have required fields
        const invalidVideos = videos.filter(video => 
            !video.url || !video.downloadUrl || typeof video.engagementRate !== 'number'
        );
        
        if (invalidVideos.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'All videos must have url, downloadUrl, and engagementRate fields'
            });
        }

        console.log(`🎯 Starting video analysis for @${username} with ${videos.length} videos`);
        
        // Start async video analysis
        const result = await VideoAnalysisService.startVideoAnalysis(videos, username);
        
        console.log(`✅ Video analysis job started: ${result.jobId}`);
        
        res.json({
            success: true,
            data: {
                jobId: result.jobId,
                status: result.status,
                message: result.message,
                estimatedTime: '2-5 minutes',
                pollInterval: 5000 // Recommend polling every 5 seconds
            }
        });
        
    } catch (error) {
        console.error('❌ Video analysis start error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to start video analysis: ${error.message}`
        });
    }
});

/**
 * GET /api/video-analysis/status/:jobId
 * Get status of video analysis job
 */
router.get('/status/:jobId', statusLimiter, async (req, res) => {
    try {
        const { jobId } = req.params;
        
        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid jobId is required'
            });
        }

        console.log(`📊 Status check for job: ${jobId}`);
        
        const status = VideoAnalysisService.getJobStatus(jobId);
        
        if (status.status === 'not_found') {
            return res.status(404).json({
                success: false,
                error: 'Job not found or expired'
            });
        }

        // Don't include full results in status response for efficiency
        const responseData = {
            jobId,
            status: status.status,
            progress: status.progress,
            phase: status.phase,
            message: status.message,
            startTime: status.startTime,
            error: status.error
        };

        // Add completion time if completed
        if (status.status === 'completed' && status.results) {
            responseData.completedAt = status.results.completedAt;
            responseData.videosAnalyzed = status.results.videos?.length || 0;
        }

        res.json({
            success: true,
            data: responseData
        });
        
    } catch (error) {
        console.error('❌ Status check error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to get job status: ${error.message}`
        });
    }
});

/**
 * GET /api/video-analysis/results/:jobId
 * Get full results of completed video analysis
 */
router.get('/results/:jobId', statusLimiter, async (req, res) => {
    try {
        const { jobId } = req.params;
        
        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid jobId is required'
            });
        }

        console.log(`📊 Results request for job: ${jobId}`);
        
        const job = VideoAnalysisService.getJobStatus(jobId);
        
        if (job.status === 'not_found') {
            return res.status(404).json({
                success: false,
                error: 'Job not found or expired'
            });
        }

        if (job.status !== 'completed') {
            return res.status(202).json({
                success: false,
                error: `Job not completed yet. Status: ${job.status}`,
                currentStatus: {
                    status: job.status,
                    progress: job.progress,
                    message: job.message
                }
            });
        }

        if (!job.results) {
            return res.status(500).json({
                success: false,
                error: 'Job completed but results are missing'
            });
        }

        console.log(`✅ Returning results for job: ${jobId}`);
        
        res.json({
            success: true,
            data: {
                jobId,
                completedAt: job.results.completedAt,
                results: job.results
            }
        });
        
    } catch (error) {
        console.error('❌ Results retrieval error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to get job results: ${error.message}`
        });
    }
});

/**
 * DELETE /api/video-analysis/job/:jobId
 * Cancel or delete a video analysis job
 */
router.delete('/job/:jobId', statusLimiter, async (req, res) => {
    try {
        const { jobId } = req.params;
        
        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid jobId is required'
            });
        }

        console.log(`🗑️ Delete request for job: ${jobId}`);
        
        const job = VideoAnalysisService.getJobStatus(jobId);
        
        if (job.status === 'not_found') {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        // Note: In a production system, you'd want to implement proper job cancellation
        // For now, we'll just remove it from the queue
        VideoAnalysisService.jobQueue.delete(jobId);
        
        console.log(`✅ Job deleted: ${jobId}`);
        
        res.json({
            success: true,
            message: 'Job deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Job deletion error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to delete job: ${error.message}`
        });
    }
});

/**
 * GET /api/video-analysis/health
 * Health check for video analysis service
 */
router.get('/health', async (req, res) => {
    try {
        // Basic health check
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            activeJobs: VideoAnalysisService.jobQueue.size,
            services: {
                gcs: !!process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
                videoIntelligence: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
                claude: !!process.env.ANTHROPIC_API_KEY
            }
        };

        res.json({
            success: true,
            data: health
        });
        
    } catch (error) {
        console.error('❌ Health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed'
        });
    }
});

// Error handling middleware specific to video analysis routes
router.use((error, req, res, next) => {
    console.error('❌ Video Analysis Route Error:', error);
    
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON in request body'
        });
    }
    
    res.status(500).json({
        success: false,
        error: 'Internal video analysis error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
});

module.exports = router;