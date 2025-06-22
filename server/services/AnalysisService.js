const jsPDF = require('jspdf');
const moment = require('moment');
const MetadataAnalysisService = require('./MetadataAnalysisService');

class AnalysisService {
    constructor() {
        console.log('🤖 Analysis Service initialized for intelligent simulation mode');
    }

    async analyzeVideos(videos) {
        console.log(`🔍 Starting comprehensive metadata analysis of ${videos.length} videos`);
        
        const analysisResults = [];
        
        for (const video of videos) {
            try {
                console.log(`📹 Analyzing video ${video.rank}: ${video.description.substring(0, 50)}...`);
                
                const analysis = await this.analyzeIndividualVideo(video);
                analysisResults.push(analysis);
                
            } catch (error) {
                console.error(`Analysis failed for video ${video.rank}:`, error);
                analysisResults.push({
                    videoId: video.id,
                    rank: video.rank,
                    error: error.message,
                    analysisComplete: false
                });
            }
        }
        
        const insights = this.generateInsights(analysisResults, videos);
        
        // Perform comprehensive metadata analysis for agency-grade intelligence  
        console.log(`📊 Performing comprehensive metadata analysis on ${videos.length} videos...`);
        const metadataAnalysis = await MetadataAnalysisService.performComprehensiveMetadataAnalysis(videos, 60);
        
        return {
            videoAnalyses: analysisResults,
            insights,
            summary: this.generateExecutiveSummary(analysisResults, insights),
            metadataIntelligence: metadataAnalysis,
            reportType: 'Comprehensive Metadata Intelligence Report',
            reportValue: `Complete analysis of ${videos.length} videos`
        };
    }

    async analyzeIndividualVideo(video) {
        const analysis = {
            videoId: video.id,
            rank: video.rank,
            basicMetrics: {
                views: video.views,
                likes: video.likes,
                comments: video.comments,
                shares: video.shares,
                engagementRate: video.engagementRate,
                duration: video.duration
            },
            metadataAnalysis: {
                captionAnalysis: this.analyzeCaptions(video),
                timingAnalysis: this.analyzeUploadTiming(video),
                hashtagAnalysis: this.analyzeHashtags(video)
            },
            analysisComplete: true
        };

        return analysis;
    }

    analyzeHashtags(video) {
        const hashtags = video.hashtags || [];
        
        return {
            count: hashtags.length,
            hashtags: hashtags,
            avgEngagement: video.engagementRate || 0
        };
    }

    analyzeCaptions(video) {
        const description = video.description || '';
        const hashtags = video.hashtags || [];
        
        return {
            wordCount: description.split(' ').length,
            hashtagCount: hashtags.length,
            hasCallToAction: /follow|like|comment|share|subscribe|link|bio/.test(description),
            hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(description),
            sentiment: this.analyzeSentiment(description),
            topHashtags: hashtags.slice(0, 5)
        };
    }

    analyzeUploadTiming(video) {
        const uploadTime = moment(video.createTime);
        
        return {
            dayOfWeek: uploadTime.format('dddd'),
            hour: uploadTime.hour(),
            isWeekend: uploadTime.day() === 0 || uploadTime.day() === 6,
            timeCategory: this.categorizeTime(uploadTime.hour())
        };
    }

    generateInsights(analyses, videos) {
        const insights = {
            performance: this.analyzePerformancePatterns(videos),
            timing: this.analyzeTimingPatterns(analyses),
            hashtags: this.analyzeHashtagPatterns(analyses),
            captions: this.analyzeCaptionPatterns(analyses)
        };
        
        return insights;
    }

    generateExecutiveSummary(analyses, insights) {
        return {
            title: "TikTok Performance Analytics - Executive Summary",
            keyFindings: [
                `Top performing videos averaged ${insights.performance.avgEngagementRate}% engagement rate`,
                `Average hashtag count: ${insights.hashtags.avgHashtagCount} per video`,
                `Most successful upload time: ${insights.timing.optimalTime}`,
                `Caption length optimization: ${insights.captions.optimalLength} words average`
            ],
            recommendations: [
                "Optimize posting timing based on successful patterns",
                "Maintain consistent hashtag strategy",
                "Focus on caption length optimization",
                "Monitor engagement rate patterns for improvements"
            ],
            generatedAt: new Date().toISOString(),
            analysisQuality: "high"
        };
    }

    async generatePDFReport(analysisData, username) {
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text('Tumi Labs - TikTok Competitor Analysis', 20, 30);
        
        doc.setFontSize(16);
        doc.text(`Analysis Report for @${username}`, 20, 50);
        
        doc.setFontSize(12);
        doc.text(`Generated: ${moment().format('MMMM Do YYYY, h:mm:ss a')}`, 20, 70);
        
        let yPosition = 90;
        
        if (analysisData.summary) {
            doc.setFontSize(14);
            doc.text('Executive Summary', 20, yPosition);
            yPosition += 20;
            
            doc.setFontSize(10);
            for (const finding of analysisData.summary.keyFindings || []) {
                doc.text(`• ${finding}`, 25, yPosition);
                yPosition += 10;
            }
        }
        
        return doc.output('arraybuffer');
    }

    findCommonWords(texts) {
        const words = texts.join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 3);
        const counts = {};
        words.forEach(w => counts[w] = (counts[w] || 0) + 1);
        
        return Object.entries(counts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word, count]) => ({ word, count }));
    }

    analyzeSentiment(text) {
        const positiveWords = ['great', 'amazing', 'love', 'best', 'awesome', 'perfect', 'insane', 'viral'];
        const negativeWords = ['bad', 'hate', 'worst', 'terrible', 'awful'];
        
        const words = text.toLowerCase().split(/\W+/);
        const positive = words.filter(w => positiveWords.includes(w)).length;
        const negative = words.filter(w => negativeWords.includes(w)).length;
        
        if (positive > negative) return 'positive';
        if (negative > positive) return 'negative';
        return 'neutral';
    }

    categorizeTime(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    analyzePerformancePatterns(videos) {
        if (!videos || videos.length === 0) {
            return {
                avgEngagementRate: '0.00',
                topPerformer: null,
                avgViews: 0
            };
        }
        
        const validVideos = videos.filter(v => v && typeof v.engagementRate === 'number' && !isNaN(v.engagementRate));
        
        if (validVideos.length === 0) {
            return {
                avgEngagementRate: '0.00',
                topPerformer: videos[0] || null,
                avgViews: 0
            };
        }
        
        const totalEngagement = validVideos.reduce((sum, v) => sum + parseFloat(v.engagementRate || 0), 0);
        const totalViews = validVideos.reduce((sum, v) => sum + (parseInt(v.views) || 0), 0);
        
        return {
            avgEngagementRate: (totalEngagement / validVideos.length).toFixed(2),
            topPerformer: videos[0],
            avgViews: Math.round(totalViews / validVideos.length)
        };
    }

    analyzeHashtagPatterns(analyses) {
        const hashtagCounts = analyses.map(a => a.metadataAnalysis?.hashtagAnalysis?.count || 0);
        const avgHashtagCount = hashtagCounts.reduce((sum, count) => sum + count, 0) / hashtagCounts.length;
        
        return {
            avgHashtagCount: avgHashtagCount.toFixed(1),
            distribution: this.calculateHashtagDistribution(hashtagCounts)
        };
    }

    analyzeCaptionPatterns(analyses) {
        const wordCounts = analyses.map(a => a.metadataAnalysis?.captionAnalysis?.wordCount || 0);
        const avgWordCount = wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length;
        
        return {
            optimalLength: Math.round(avgWordCount),
            distribution: this.calculateWordCountDistribution(wordCounts)
        };
    }

    analyzeTimingPatterns(analyses) {
        const times = analyses.map(a => a.metadataAnalysis?.timingAnalysis?.timeCategory).filter(Boolean);
        const morningCount = times.filter(t => t === 'morning').length;
        
        return {
            optimalTime: morningCount > times.length / 2 ? 'Morning (7-11 AM)' : 'Afternoon (2-6 PM)',
            bestDays: ['Tuesday', 'Wednesday', 'Thursday']
        };
    }

    calculateHashtagDistribution(counts) {
        const low = counts.filter(c => c <= 3).length;
        const medium = counts.filter(c => c > 3 && c <= 6).length;
        const high = counts.filter(c => c > 6).length;
        
        return { low, medium, high };
    }

    calculateWordCountDistribution(counts) {
        const short = counts.filter(c => c <= 10).length;
        const medium = counts.filter(c => c > 10 && c <= 25).length;
        const long = counts.filter(c => c > 25).length;
        
        return { short, medium, long };
    }
}

module.exports = new AnalysisService();