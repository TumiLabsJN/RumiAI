const { ApifyClient } = require('apify-client');
const moment = require('moment');

class TikTokService {
    constructor() {
        this.client = new ApifyClient({
            token: process.env.APIFY_TOKEN
        });
        this.actorId = 'clockworks/tiktok-scraper';
        this.minViews = parseInt(process.env.MIN_VIEWS_THRESHOLD) || 10000;
        this.analysisDays = parseInt(process.env.ANALYSIS_DAYS) || 30;
    }

    async analyzeProfile(username) {
        console.log(`📱 Starting profile analysis for: @${username}`);
        console.log(`🔑 Apify token configured: ${!!process.env.APIFY_TOKEN}`);
        console.log(`🎭 Actor ID: ${this.actorId}`);
        
        try {
            console.log(`📱 Scraping TikTok profile: @${username}`);
            
            const input = {
                profiles: [`https://www.tiktok.com/@${username}`],
                resultsPerPage: 100,
                shouldDownloadVideos: true,
                shouldDownloadCovers: true,
                proxyConfiguration: {
                    useApifyProxy: true
                }
            };

            console.log('🚀 Calling Apify actor with input:', input);
            
            const run = await this.client.actor(this.actorId).call(input);
            console.log('📋 Apify run completed:', run.id);
            
            const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
            console.log(`📊 Retrieved ${items?.length || 0} items from dataset`);

            if (!items || items.length === 0) {
                console.log(`⚠️ No videos found for @${username}, using mock data`);
                return this.getMockProfileData(username);
            }

            console.log(`📊 Found ${items.length} videos, implementing smart time window analysis`);
            console.log('📝 Sample video data:', JSON.stringify(items[0], null, 2).substring(0, 500));
            
            // Smart Time Window Analysis - Professional Competitor Intelligence
            const analysisResult = this.performSmartTimeWindowAnalysis(items, username);
            
            if (analysisResult.requiresFallback) {
                console.log('📊 Professional Analysis: No sufficient recent content found');
                const mockData = this.getMockProfileData(username);
                mockData.realDataAttempted = true;
                mockData.totalVideosFound = items.length;
                mockData.professionalNote = analysisResult.professionalMessage;
                mockData.accountStatus = analysisResult.accountStatus;
                return mockData;
            }
            
            return {
                username,
                totalVideos: items.length,
                recentVideos: analysisResult.filteredVideos.length,
                allVideosAnalyzed: analysisResult.topVideos,
                analysisDate: new Date().toISOString(),
                analysisWindow: analysisResult.analysisWindow,
                contentRecency: analysisResult.contentRecency,
                postingFrequency: analysisResult.postingFrequency,
                professionalInsight: analysisResult.professionalMessage,
                isHistoricalAnalysis: analysisResult.isHistoricalAnalysis || false,
                historicalPeriod: analysisResult.historicalPeriod || null,
                criteria: {
                    minViews: this.minViews,
                    daysPeriod: analysisResult.daysAnalyzed,
                    analysisType: 'comprehensive_metadata',
                    timeWindowUsed: analysisResult.timeWindowUsed
                },
                dataSource: 'apify'
            };

        } catch (error) {
            console.error('❌ TikTok scraping error:', error);
            console.error('❌ Error details:', error.message);
            console.log('🔄 Falling back to mock data due to error');
            
            // Return mock data instead of throwing error
            return this.getMockProfileData(username);
        }
    }

    getMockProfileData(username) {
        console.log(`🎭 Generating comprehensive mock data for @${username} - 23 videos from past 60 days`);
        
        return {
            username,
            totalVideos: 45,
            recentVideos: 23,
            allVideosAnalyzed: this.generateComprehensiveMockVideos(username, 23),
            analysisDate: new Date().toISOString(),
            criteria: {
                minViews: this.minViews,
                daysPeriod: this.analysisDays,
                analysisType: 'comprehensive_metadata'
            },
            dataSource: 'mock'
        };
    }

    generateComprehensiveMockVideos(username, count) {
        const videos = [];
        const contentTypes = [
            { type: 'trending', hashtags: ['trending', 'viral', 'fyp', 'popular'], baseViews: 2000000, captionLength: 'short' },
            { type: 'educational', hashtags: ['educational', 'tips', 'learning', 'howto'], baseViews: 800000, captionLength: 'long' },
            { type: 'entertainment', hashtags: ['funny', 'entertainment', 'comedy', 'fun'], baseViews: 1500000, captionLength: 'short' },
            { type: 'lifestyle', hashtags: ['lifestyle', 'daily', 'routine', 'life'], baseViews: 900000, captionLength: 'medium' },
            { type: 'product', hashtags: ['product', 'review', 'unboxing', 'demo'], baseViews: 600000, captionLength: 'extended' },
            { type: 'behind_scenes', hashtags: ['bts', 'behindthescenes', 'process', 'making'], baseViews: 700000, captionLength: 'medium' },
            { type: 'story', hashtags: ['story', 'storytime', 'experience', 'life'], baseViews: 1100000, captionLength: 'long' },
            { type: 'tutorial', hashtags: ['tutorial', 'diy', 'stepbystep', 'guide'], baseViews: 850000, captionLength: 'extended' }
        ];

        // Define duration buckets with realistic distribution
        const durationBuckets = [
            { range: '15s and under', min: 8, max: 15, weight: 0.15, avgEngagement: 18.2 }, // 15% short, highest engagement
            { range: '16-30s', min: 16, max: 30, weight: 0.45, avgEngagement: 16.6 }, // 45% medium-short
            { range: '31-60s', min: 31, max: 60, weight: 0.35, avgEngagement: 17.92 }, // 35% medium-long, second highest
            { range: '60s+', min: 61, max: 120, weight: 0.05, avgEngagement: 15.4 } // 5% long, lowest engagement
        ];

        for (let i = 1; i <= count; i++) {
            const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
            const daysAgo = Math.floor(Math.random() * 60); // Past 60 days
            const createDate = new Date();
            createDate.setDate(createDate.getDate() - daysAgo);
            
            // Select duration based on weighted distribution
            const rand = Math.random();
            let cumWeight = 0;
            let selectedBucket = durationBuckets[1]; // default to 16-30s
            for (const bucket of durationBuckets) {
                cumWeight += bucket.weight;
                if (rand <= cumWeight) {
                    selectedBucket = bucket;
                    break;
                }
            }
            const duration = selectedBucket.min + Math.floor(Math.random() * (selectedBucket.max - selectedBucket.min + 1));
            
            // Generate caption based on content type
            const captionTemplates = {
                'short': [`${contentType.type} vibes! #${contentType.hashtags.join(' #')}`],
                'medium': [`Check out this amazing ${contentType.type} content I created! What do you think? #${contentType.hashtags.join(' #')}`],
                'long': [`Hey everyone! I'm so excited to share this ${contentType.type} content with you all. It took me hours to create and I really hope you enjoy it as much as I enjoyed making it! Let me know your thoughts in the comments below! #${contentType.hashtags.join(' #')}`],
                'extended': [`Welcome back to my channel! Today I wanted to dive deep into ${contentType.type} content and share some insights I've learned over the years. This has been a passion project of mine and I've put countless hours into perfecting this approach. I genuinely believe this will help so many of you who are struggling with the same challenges I faced when I started. Make sure to save this post and share it with anyone who might benefit from these tips! Your support means the world to me and keeps me motivated to create more content like this! #${contentType.hashtags.join(' #')}`]
            };
            
            const description = captionTemplates[contentType.captionLength][0];
            
            const views = contentType.baseViews + Math.floor(Math.random() * 1000000);
            const likes = Math.floor(views * (0.08 + Math.random() * 0.12)); // 8-20% like rate
            const comments = Math.floor(views * (0.005 + Math.random() * 0.015)); // 0.5-2% comment rate  
            const shares = Math.floor(views * (0.002 + Math.random() * 0.008)); // 0.2-1% share rate
            const engagementRate = parseFloat(((likes + comments + shares) / views * 100).toFixed(2));

            videos.push({
                rank: i,
                id: `mock_v${i}`,
                url: `https://tiktok.com/@${username}/video/${i}`,
                description: description,
                hashtags: contentType.hashtags,
                views: views,
                likes: likes,
                comments: comments,
                shares: shares,
                engagementRate: engagementRate,
                duration: duration,
                createTime: createDate.toISOString(),
                coverUrl: null
            });
        }

        return videos.sort((a, b) => b.engagementRate - a.engagementRate);
    }

    performSmartTimeWindowAnalysis(videos, username) {
        console.log('🎯 Initiating Smart Time Window Analysis - Enterprise Intelligence Mode');
        
        const timeWindows = [
            { days: 30, minVideos: 3, label: 'Recent Content Analysis', description: 'Analysis based on recent content (last 30 days)' },
            { days: 90, minVideos: 3, label: 'Quarterly Content Pattern Analysis', description: 'Analysis based on quarterly content patterns (last 90 days)' },
            { days: 180, minVideos: 2, label: 'Historical Content Pattern Analysis', description: 'Analysis based on historical content patterns (last 6 months)' }
        ];
        
        for (const window of timeWindows) {
            console.log(`📊 Testing ${window.days}-day window (minimum ${window.minVideos} videos required)`);
            
            const filteredVideos = this.filterVideosByTimeWindow(videos, window.days);
            console.log(`📈 Found ${filteredVideos.length} videos in ${window.days}-day window`);
            
            if (filteredVideos.length >= window.minVideos) {
                const topVideos = this.selectTopPerformers(filteredVideos);
                
                if (topVideos.length > 0) {
                    const postingFrequency = this.calculatePostingFrequency(filteredVideos, window.days);
                    const contentRecency = this.assessContentRecency(filteredVideos);
                    
                    console.log(`✅ Successfully analyzed using ${window.days}-day window`);
                    
                    return {
                        requiresFallback: false,
                        filteredVideos,
                        topVideos,
                        daysAnalyzed: window.days,
                        timeWindowUsed: window.label,
                        analysisWindow: window.description,
                        professionalMessage: `Comprehensive metadata analysis of ${filteredVideos.length} videos from past ${window.days} days. ${window.description}. Content frequency: ${postingFrequency.description}. ${contentRecency.insight}`,
                        contentRecency,
                        postingFrequency
                    };
                }
            }
        }
        
        // No sufficient content found in recent windows - try historical analysis
        console.log('📊 Professional Assessment: No recent content found, attempting historical analysis');
        
        const lastVideoDate = this.getLastVideoDate(videos);
        const daysSinceLastPost = moment().diff(moment(lastVideoDate), 'days');
        
        // If we have a last video date, try 60-day analysis backward from that date
        if (lastVideoDate && daysSinceLastPost <= 365) { // Within past year
            console.log(`📅 Attempting historical analysis: 60 days backward from ${moment(lastVideoDate).format('YYYY-MM-DD')}`);
            
            const historicalVideos = this.filterHistoricalVideos(videos, lastVideoDate, 60);
            console.log(`📈 Found ${historicalVideos.length} videos in historical 60-day window`);
            
            if (historicalVideos.length >= 3) {
                const topVideos = this.selectTopPerformers(historicalVideos);
                const postingFrequency = this.calculatePostingFrequency(historicalVideos);
                const contentRecency = this.assessContentRecency(historicalVideos);
                
                const startDate = moment(lastVideoDate).subtract(60, 'days');
                const endDate = moment(lastVideoDate);
                
                console.log(`✅ Successfully analyzed using historical window: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
                
                return {
                    requiresFallback: false,
                    filteredVideos: historicalVideos,
                    topVideos,
                    daysAnalyzed: 60,
                    timeWindowUsed: 'Historical Content Analysis',
                    analysisWindow: `Analysis of historical content from ${startDate.format('MMMM D, YYYY')} to ${endDate.format('MMMM D, YYYY')}`,
                    professionalMessage: `@${username} has not produced content in the past ${daysSinceLastPost} days. Analysis shows performance data from ${startDate.format('MMMM D, YYYY')} to ${endDate.format('MMMM D, YYYY')} (60-day period ending with their most recent post).`,
                    contentRecency,
                    postingFrequency,
                    isHistoricalAnalysis: true,
                    historicalPeriod: {
                        startDate: startDate.format('YYYY-MM-DD'),
                        endDate: endDate.format('YYYY-MM-DD'),
                        daysSinceLastPost
                    }
                };
            }
        }
        
        // Still no sufficient content - provide professional assessment
        let accountStatus, professionalMessage;
        
        if (daysSinceLastPost > 365) {
            accountStatus = 'INACTIVE_EXTENDED';
            professionalMessage = `Account Analysis: No content published in over a year (last post: ${moment(lastVideoDate).format('MMMM YYYY')}). This creator appears to be inactive or have shifted to other platforms.`;
        } else if (daysSinceLastPost > 180) {
            accountStatus = 'INACTIVE_RECENT';
            professionalMessage = `Account Analysis: No content published in the last 6 months (last post: ${moment(lastVideoDate).format('MMMM YYYY')}). Creator may be on hiatus or transitioning strategy.`;
        } else if (daysSinceLastPost > 90) {
            accountStatus = 'LOW_ACTIVITY';
            professionalMessage = `Account Analysis: Limited recent activity detected (last post: ${moment(lastVideoDate).fromNow()}). Creator may be in a content hiatus.`;
        } else {
            accountStatus = 'INSUFFICIENT_DATA';
            professionalMessage = `Account Analysis: Recent content exists but engagement levels fall below analytical thresholds for meaningful insights.`;
        }
        
        return {
            requiresFallback: true,
            accountStatus,
            professionalMessage,
            lastActivity: lastVideoDate,
            daysSinceLastPost
        };
    }

    filterVideosByTimeWindow(videos, days) {
        const cutoffDate = moment().subtract(days, 'days');
        
        return videos.filter(video => {
            const videoDate = moment(video.createTimeISO || video.createTime || video.publishedAt);
            const views = parseInt(video.playCount || video.viewCount || video.views) || 0;
            
            const isRecent = videoDate.isAfter(cutoffDate);
            const hasMinViews = views >= this.minViews;
            
            return isRecent && hasMinViews;
        });
    }

    filterHistoricalVideos(videos, lastVideoDate, days) {
        const endDate = moment(lastVideoDate);
        const startDate = endDate.clone().subtract(days, 'days');
        
        console.log(`📅 Historical filter: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
        
        return videos.filter(video => {
            const videoDate = moment(video.createTimeISO || video.createTime || video.publishedAt);
            const views = parseInt(video.playCount || video.viewCount || video.views) || 0;
            
            const isInHistoricalWindow = videoDate.isBetween(startDate, endDate, 'day', '[]');
            const hasMinViews = views >= this.minViews;
            
            if (isInHistoricalWindow && hasMinViews) {
                console.log(`📹 Historical video: ${videoDate.format('YYYY-MM-DD')} - ${views} views`);
            }
            
            return isInHistoricalWindow && hasMinViews;
        });
    }

    calculatePostingFrequency(videos, windowDays) {
        const postsPerWeek = (videos.length / windowDays) * 7;
        
        let description, insight;
        
        if (postsPerWeek >= 7) {
            description = 'Daily+ posting (High frequency)';
            insight = 'Aggressive content strategy with daily+ uploads';
        } else if (postsPerWeek >= 3.5) {
            description = '4-7 posts per week (High frequency)';
            insight = 'Consistent high-frequency posting schedule';
        } else if (postsPerWeek >= 1) {
            description = '1-3 posts per week (Moderate frequency)';
            insight = 'Steady content cadence with regular uploads';
        } else if (postsPerWeek >= 0.5) {
            description = '2-4 posts per month (Low frequency)';
            insight = 'Conservative posting strategy, focus on quality over quantity';
        } else {
            description = 'Sporadic posting (Very low frequency)';
            insight = 'Irregular content schedule, may indicate resource constraints';
        }
        
        return {
            postsPerWeek: parseFloat(postsPerWeek.toFixed(1)),
            description,
            insight,
            totalPosts: videos.length,
            windowDays
        };
    }

    assessContentRecency(videos) {
        const sortedVideos = videos.sort((a, b) => 
            moment(b.createTimeISO || b.createTime || b.publishedAt).unix() - 
            moment(a.createTimeISO || a.createTime || a.publishedAt).unix()
        );
        
        const latestVideo = sortedVideos[0];
        const latestDate = moment(latestVideo.createTimeISO || latestVideo.createTime || latestVideo.publishedAt);
        const daysAgo = moment().diff(latestDate, 'days');
        
        let recencyStatus, insight;
        
        if (daysAgo <= 7) {
            recencyStatus = 'VERY_RECENT';
            insight = 'Content is highly current with recent uploads';
        } else if (daysAgo <= 30) {
            recencyStatus = 'RECENT';
            insight = 'Content represents current strategy and trends';
        } else if (daysAgo <= 90) {
            recencyStatus = 'MODERATELY_RECENT';
            insight = 'Content may reflect evolving strategy patterns';
        } else {
            recencyStatus = 'HISTORICAL';
            insight = 'Analysis based on historical content patterns';
        }
        
        return {
            status: recencyStatus,
            insight,
            latestPostDate: latestDate.format('MMMM Do, YYYY'),
            daysAgo,
            latestPostRelative: latestDate.fromNow()
        };
    }

    getLastVideoDate(videos) {
        if (!videos || videos.length === 0) return null;
        
        const sortedVideos = videos.sort((a, b) => 
            moment(b.createTimeISO || b.createTime || b.publishedAt).unix() - 
            moment(a.createTimeISO || a.createTime || a.publishedAt).unix()
        );
        
        return sortedVideos[0].createTimeISO || sortedVideos[0].createTime || sortedVideos[0].publishedAt;
    }

    filterRecentVideos(videos) {
        const cutoffDate = moment().subtract(this.analysisDays, 'days');
        
        return videos.filter(video => {
            // Handle multiple possible date formats from Apify
            const videoDate = moment(video.createTimeISO || video.createTime || video.publishedAt);
            const views = parseInt(video.playCount || video.viewCount || video.views) || 0;
            
            console.log(`📅 Video date: ${videoDate.format()}, Views: ${views}, Threshold: ${this.minViews}`);
            
            const isRecent = videoDate.isAfter(cutoffDate);
            const hasMinViews = views >= this.minViews;
            
            return isRecent && hasMinViews;
        });
    }

    selectTopPerformers(videos) {
        if (!videos || videos.length === 0) {
            console.log('⚠️ No videos to select from');
            return [];
        }
        
        console.log(`🔝 Processing all ${videos.length} videos for comprehensive metadata analysis`);
        
        return videos
            .map(video => {
                const engagementRate = this.calculateEngagementRate(video);
                console.log(`📊 Video engagement: ${engagementRate}% for video with ${video.playCount || video.viewCount || video.views} views`);
                
                return {
                    ...video,
                    engagementRate
                };
            })
            .sort((a, b) => b.engagementRate - a.engagementRate)
            .map((video, index) => ({
                rank: index + 1,
                id: video.id || `video_${index}`,
                url: video.webVideoUrl || video.url || `https://tiktok.com/@${video.authorMeta?.name || 'unknown'}/video/${video.id}`,
                description: video.text || video.description || 'No description available',
                hashtags: video.hashtags || [],
                views: parseInt(video.playCount || video.viewCount || video.views) || 0,
                likes: parseInt(video.diggCount || video.likeCount || video.likes) || 0,
                comments: parseInt(video.commentCount || video.comments) || 0,
                shares: parseInt(video.shareCount || video.shares) || 0,
                engagementRate: parseFloat(video.engagementRate) || 0,
                duration: video.videoMeta?.duration || video.duration || 0,
                createTime: video.createTimeISO || video.createTime || video.publishedAt,
                downloadUrl: video.videoUrl || video.downloadUrl,
                coverUrl: video.covers?.[0] || video.thumbnail || null,
                author: {
                    username: video.authorMeta?.name || video.author?.username || '',
                    displayName: video.authorMeta?.nickName || video.author?.displayName || '',
                    verified: video.authorMeta?.verified || video.author?.verified || false
                }
            }));
    }

    calculateEngagementRate(video) {
        // Handle multiple possible field names from Apify
        const views = parseInt(video.playCount || video.viewCount || video.views) || 0;
        const likes = parseInt(video.diggCount || video.likeCount || video.likes) || 0;
        const comments = parseInt(video.commentCount || video.comments) || 0;
        const shares = parseInt(video.shareCount || video.shares) || 0;
        
        if (views === 0) {
            console.log('⚠️ Video has 0 views, returning 0% engagement');
            return 0;
        }
        
        const totalEngagement = likes + comments + shares;
        const engagementRate = parseFloat(((totalEngagement / views) * 100).toFixed(2));
        
        console.log(`📊 Engagement calc: ${totalEngagement} total / ${views} views = ${engagementRate}%`);
        
        return engagementRate;
    }

    async getJobStatus(jobId) {
        try {
            const run = await this.client.run(jobId).get();
            return {
                status: run.status,
                progress: run.stats || {},
                finishedAt: run.finishedAt
            };
        } catch (error) {
            throw new Error(`Failed to get job status: ${error.message}`);
        }
    }
}

module.exports = new TikTokService();