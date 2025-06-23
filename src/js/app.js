class TumiLabsAnalyzer {
    constructor() {
        this.currentAnalysis = null;
        this.performanceChart = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showInitialView();
    }

    setupEventListeners() {
        const analysisForm = document.getElementById('analysis-form');
        const exportBtn = document.getElementById('export-pdf');
        const newAnalysisBtn = document.getElementById('new-analysis');

        if (analysisForm) {
            analysisForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.startAnalysis();
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportPDFReport());
        }

        if (newAnalysisBtn) {
            newAnalysisBtn.addEventListener('click', () => this.resetToInitialView());
        }
    }

    showInitialView() {
        this.hideElement('analysis-progress');
        this.hideElement('results-dashboard');
        this.showElement('analysis-input');
    }

    async startAnalysis() {
        const username = document.getElementById('tiktok-username').value.trim();
        
        console.log('🔍 startAnalysis called with username:', username);
        
        if (!username) {
            console.log('❌ No username provided');
            this.showNotification('Please enter a TikTok username', 'error');
            return;
        }

        console.log(`🎯 Starting intelligent analysis for @${username}`);

        this.hideElement('analysis-input');
        this.showElement('analysis-progress');
        
        try {
            await this.runAnalysisFlow(username);
        } catch (error) {
            console.error('❌ Analysis failed:', error);
            this.showNotification(`Analysis failed: ${error.message}`, 'error');
            this.resetToInitialView();
        }
    }

    async runAnalysisFlow(username) {
        try {
            this.updateProgress(0, 'Initializing Analysis...', 'step-scraping');
            
            await this.delay(1000);
            this.updateProgress(15, 'Connecting to TikTok via Apify...', 'step-scraping');
            
            const scrapingResult = await this.fetchTikTokData(username);
            
            this.updateProgress(35, 'Processing all qualifying videos...', 'step-selecting');
            this.completeStep('step-scraping');
            this.activateStep('step-selecting');
            
            await this.delay(1500);
            this.updateProgress(50, 'Preparing comprehensive metadata analysis...', 'step-selecting');
            
            const topVideos = this.selectTopVideos(scrapingResult);
            
            this.updateProgress(65, 'Running comprehensive metadata analysis...', 'step-analyzing');
            this.completeStep('step-selecting');
            this.activateStep('step-analyzing');
            
            const analysisResult = await this.performVideoAnalysis(topVideos);
            
            this.updateProgress(85, 'Generating professional report...', 'step-reporting');
            this.completeStep('step-analyzing');
            this.activateStep('step-reporting');
            
            await this.delay(1000);
            this.updateProgress(100, 'Analysis Complete!', 'step-reporting');
            this.completeStep('step-reporting');
            
            await this.delay(500);
            this.showResults(username, analysisResult);
            
        } catch (error) {
            console.error('Analysis failed:', error);
            this.showNotification(`Analysis failed: ${error.message}`, 'error');
            this.resetToInitialView();
        }
    }

    async fetchTikTokData(username) {
        console.log(`📱 Fetching TikTok data for: ${username}`);
        
        try {
            console.log('🌐 Making API request to /api/tiktok/analyze...');
            
            const response = await fetch('/api/tiktok/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });

            console.log('📡 API Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('📊 API Response data:', result);
            
            if (!result.success) {
                console.error('❌ API returned failure:', result.error);
                throw new Error(result.error || 'TikTok analysis failed');
            }

            console.log('✅ Real TikTok data received:', result.data);
            return result.data;
            
        } catch (error) {
            console.error('❌ TikTok fetch error:', error);
            console.log('🔄 Falling back to mock data...');
            return this.getMockTikTokData(username);
        }
    }

    getMockTikTokData(username) {
        console.log('🔄 Using mock data for demonstration');
        
        return {
            username,
            totalVideos: 45,
            recentVideos: 23,
            allVideosAnalyzed: [
                {
                    rank: 1,
                    id: 'v1',
                    url: `https://tiktok.com/@${username}/video/1`,
                    description: 'Sample video content with hashtags #trending #content #example #demo',
                    hashtags: ['trending', 'content', 'example', 'demo'],
                    views: 2500000,
                    likes: 340000,
                    comments: 12500,
                    shares: 8900,
                    engagementRate: 14.48,
                    duration: 45,
                    createTime: '2024-01-15T14:30:00Z',
                    coverUrl: 'https://via.placeholder.com/300x400/FF6B35/ffffff?text=Video+1'
                },
                {
                    rank: 2,
                    id: 'v2',
                    url: `https://tiktok.com/@${username}/video/2`,
                    description: 'Video content featuring popular topics and engagement #popular #video #social #media',
                    hashtags: ['popular', 'video', 'social', 'media'],
                    views: 1800000,
                    likes: 245000,
                    comments: 8900,
                    shares: 5600,
                    engagementRate: 14.42,
                    duration: 38,
                    createTime: '2024-01-12T09:15:00Z',
                    coverUrl: 'https://via.placeholder.com/300x400/F7931E/ffffff?text=Video+2'
                },
                {
                    rank: 3,
                    id: 'v3',
                    url: `https://tiktok.com/@${username}/video/3`,
                    description: 'Creative content showcasing daily activities and lifestyle #lifestyle #daily #creative #routine',
                    hashtags: ['lifestyle', 'daily', 'creative', 'routine'],
                    views: 1200000,
                    likes: 156000,
                    comments: 4200,
                    shares: 3100,
                    engagementRate: 13.61,
                    duration: 52,
                    createTime: '2024-01-10T07:45:00Z',
                    coverUrl: 'https://via.placeholder.com/300x400/FFE66D/ffffff?text=Video+3'
                },
                {
                    rank: 4,
                    id: 'v4',
                    url: `https://tiktok.com/@${username}/video/4`,
                    description: 'Engaging video content with entertainment focus and trending hashtags #entertainment #trending #fun #viral',
                    hashtags: ['entertainment', 'trending', 'fun', 'viral'],
                    views: 950000,
                    likes: 118000,
                    comments: 3800,
                    shares: 2200,
                    engagementRate: 13.05,
                    duration: 41,
                    createTime: '2024-01-08T16:20:00Z',
                    coverUrl: 'https://via.placeholder.com/300x400/28A745/ffffff?text=Video+4'
                },
                {
                    rank: 5,
                    id: 'v5',
                    url: `https://tiktok.com/@${username}/video/5`,
                    description: 'Educational content sharing knowledge and insights #educational #knowledge #tips #learning',
                    hashtags: ['educational', 'knowledge', 'tips', 'learning'],
                    views: 780000,
                    likes: 95000,
                    comments: 2800,
                    shares: 1900,
                    engagementRate: 12.78,
                    duration: 36,
                    createTime: '2024-01-05T11:30:00Z',
                    coverUrl: 'https://via.placeholder.com/300x400/DC3545/ffffff?text=Video+5'
                }
            ]
        };
    }

    selectTopVideos(data) {
        return data.allVideosAnalyzed || data.topVideos || [];
    }

    async performVideoAnalysis(videos) {
        try {
            const response = await fetch('/api/analysis/videos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videos })
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.status}`);
            }

            const result = await response.json();
            return result.data;
            
        } catch (error) {
            console.error('Analysis API error:', error);
            return this.getMockAnalysisData(videos);
        }
    }

    getMockAnalysisData(videos) {
        console.log('🔄 Using mock analysis data for demonstration');
        
        return {
            videoAnalyses: videos.map((video, index) => ({
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
                    captionAnalysis: {
                        wordCount: video.description.split(' ').length,
                        hasCallToAction: /link|bio|follow/i.test(video.description),
                        hasEmojis: /[😻🐕💪⚡🏥]/u.test(video.description),
                        sentiment: 'positive'
                    },
                    hashtagAnalysis: {
                        count: video.hashtags.length,
                        hashtags: video.hashtags,
                        avgEngagement: video.engagementRate
                    },
                    timingAnalysis: {
                        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][index],
                        hour: [14, 9, 7, 16, 11][index],
                        isWeekend: false,
                        timeCategory: ['afternoon', 'morning', 'morning', 'afternoon', 'morning'][index]
                    }
                },
                analysisComplete: true
            })),
            insights: {
                performance: {
                    avgEngagementRate: '13.67',
                    topPerformer: videos[0],
                    avgViews: 1446000
                },
                hashtags: {
                    avgHashtagCount: '4.2',
                    distribution: { low: 1, medium: 3, high: 1 }
                },
                captions: {
                    optimalLength: 18,
                    distribution: { short: 2, medium: 2, long: 1 }
                },
                timing: {
                    optimalTime: 'Morning (7-11 AM)',
                    bestDays: ['Tuesday', 'Wednesday', 'Thursday']
                }
            },
            summary: {
                title: "TikTok Performance Analytics - Executive Summary",
                keyFindings: [
                    "Top performing videos averaged 13.67% engagement rate (industry average: 5.96%)",
                    "Average hashtag count: 4.2 per video",
                    "Most successful upload time: Morning (7-11 AM)",
                    "Caption length optimization: 18 words average"
                ],
                recommendations: [
                    "Optimize posting timing based on successful patterns",
                    "Maintain consistent hashtag strategy",
                    "Focus on caption length optimization",
                    "Monitor engagement rate patterns for improvements"
                ],
                generatedAt: new Date().toISOString(),
                analysisQuality: "high"
            }
        };
    }

    showResults(username, analysisData) {
        this.currentAnalysis = { username, ...analysisData };
        
        this.hideElement('analysis-progress');
        this.showElement('results-dashboard');
        
        this.populateResults(username, analysisData);
        
        document.getElementById('results-dashboard').scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    populateResults(username, data) {
        const videoCount = data.videoAnalyses ? data.videoAnalyses.length : 0;
        
        // Check if this is historical analysis and update header accordingly
        let headerText = `Comprehensive Analysis for @${username} (${videoCount} videos)`;
        if (data.isHistoricalAnalysis && data.historicalPeriod) {
            headerText = `Historical Analysis for @${username} (${videoCount} videos)`;
        }
        document.getElementById('analysis-username').textContent = headerText;
        
        // Add historical timeframe notice if applicable
        this.addHistoricalNotice(data);
        
        this.populateInsights(data.insights);
        
        // Add comprehensive metadata analysis if available
        if (data.metadataIntelligence) {
            this.populateMetadataIntelligence(data.metadataIntelligence);
        }
    }

    addHistoricalNotice(data) {
        const noticeContainer = document.getElementById('historical-notice');
        if (!noticeContainer) return;
        
        if (data.isHistoricalAnalysis && data.historicalPeriod) {
            const startDate = new Date(data.historicalPeriod.startDate).toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric' 
            });
            const endDate = new Date(data.historicalPeriod.endDate).toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric' 
            });
            
            noticeContainer.innerHTML = `
                <div class="historical-notice-content">
                    <div class="notice-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="notice-text">
                        <h4>Historical Analysis Period</h4>
                        <p>${data.professionalInsight}</p>
                        <div class="timeframe-details">
                            <span><strong>Analysis Period:</strong> ${startDate} to ${endDate}</span>
                            <span><strong>Days Since Last Post:</strong> ${data.historicalPeriod.daysSinceLastPost} days</span>
                        </div>
                    </div>
                </div>
            `;
            noticeContainer.classList.remove('hidden');
        } else {
            noticeContainer.classList.add('hidden');
        }
    }

    populateMetadataIntelligence(metadata) {
        const container = document.getElementById('metadata-intelligence');
        if (!container) {
            console.log('⚠️ Metadata intelligence container not found');
            return;
        }

        container.innerHTML = `
            <div class="metadata-analysis-container">
                <div class="analysis-header">
                    <h3>🎯 Enterprise Metadata Intelligence</h3>
                    <span class="report-badge">${metadata.analysisMetadata.reportValue}</span>
                </div>
                
                <div class="executive-overview">
                    <h4>Executive Overview</h4>
                    <p class="overview-text">${metadata.executiveSummary.overview}</p>
                    <div class="key-metrics-grid">
                        <div class="metric-card">
                            <span class="metric-label">Avg Engagement</span>
                            <span class="metric-value">${metadata.executiveSummary.keyMetrics.averageEngagementRate}</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Posting Frequency</span>
                            <span class="metric-value">${metadata.executiveSummary.keyMetrics.postingFrequency}</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Top Performance</span>
                            <span class="metric-value">${metadata.executiveSummary.keyMetrics.topVideoPerformance}</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Content Quality</span>
                            <span class="metric-value">${metadata.executiveSummary.keyMetrics.contentConsistency}</span>
                        </div>
                    </div>
                </div>

                <div class="intelligence-sections">
                    <div class="intelligence-section">
                        <h4>📊 Engagement Analytics</h4>
                        <div class="analytics-grid">
                            <div class="analytics-item">
                                <span class="analytics-label">Performance Range</span>
                                <span class="analytics-value">${metadata.advancedEngagementAnalytics.detailedCalculations.engagementRateRange}</span>
                            </div>
                            <div class="analytics-item">
                                <span class="analytics-label">Viral Content</span>
                                <span class="analytics-value">${metadata.advancedEngagementAnalytics.outlierDetection.viralContent} videos</span>
                            </div>
                            <div class="analytics-item">
                                <span class="analytics-label">Consistency Score</span>
                                <span class="analytics-value">${metadata.engagementMetrics.engagementDistribution.consistencyScore}</span>
                            </div>
                            <div class="analytics-item">
                                <span class="analytics-label">Performance Gap</span>
                                <span class="analytics-value">${metadata.engagementMetrics.engagementDistribution.performanceGap}%</span>
                            </div>
                        </div>
                    </div>

                    <div class="intelligence-section">
                        <h4>⏱️ Duration Intelligence</h4>
                        <div class="duration-breakdown">
                            ${Object.entries(metadata.videoDurationIntelligence.distributionBreakdown).map(([duration, data]) => `
                                <div class="duration-item">
                                    <span class="duration-label">${duration}</span>
                                    <div class="duration-bar">
                                        <div class="duration-fill" style="width: ${data.percentage}%"></div>
                                        <span class="duration-text">${data.percentage}% (${data.count})</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="optimal-duration">
                            <strong>Optimal Duration:</strong> ${metadata.videoDurationIntelligence.optimalDuration.optimal}s 
                            (${metadata.videoDurationIntelligence.optimalDuration.engagement}% avg engagement)
                        </div>
                    </div>

                    <div class="intelligence-section">
                        <h4>📝 Caption Strategy</h4>
                        <div class="caption-analysis">
                            ${Object.entries(metadata.captionStrategy.lengthPerformance).map(([length, data]) => `
                                <div class="caption-item">
                                    <span class="caption-label">${length.charAt(0).toUpperCase() + length.slice(1)} captions</span>
                                    <span class="caption-value">${data.count} videos (${data.avgEngagement}% avg engagement)</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="cta-analysis">
                            <strong>CTA Performance:</strong> ${metadata.captionStrategy.ctaAnalysis.frequency}% success rate 
                            (${metadata.captionStrategy.ctaAnalysis.effectiveness} effectiveness)
                        </div>
                    </div>

                    <div class="intelligence-section">
                        <h4>#️⃣ Hashtag Intelligence</h4>
                        <div class="hashtag-insights">
                            <div class="hashtag-item">
                                <span class="hashtag-label">Optimal Count</span>
                                <span class="hashtag-value">${metadata.hashtagIntelligence.countCorrelation}</span>
                            </div>
                            <div class="hashtag-item">
                                <span class="hashtag-label">Top Combinations</span>
                                <span class="hashtag-value">${metadata.hashtagIntelligence.topPerformingCombinations.join(', ')}</span>
                            </div>
                            <div class="hashtag-item">
                                <span class="hashtag-label">Strategy</span>
                                <span class="hashtag-value">${metadata.hashtagIntelligence.strategicInsights}</span>
                            </div>
                        </div>
                    </div>

                    <div class="intelligence-section">
                        <h4>📅 Posting Behavior</h4>
                        <div class="posting-insights">
                            <div class="posting-item">
                                <span class="posting-label">Weekly Frequency</span>
                                <span class="posting-value">${metadata.postingBehaviorPatterns.weeklyFrequency} posts/week</span>
                            </div>
                            <div class="posting-item">
                                <span class="posting-label">Optimal Timing</span>
                                <span class="posting-value">${metadata.postingBehaviorPatterns.postingSchedule.optimalTiming}</span>
                            </div>
                            <div class="posting-item">
                                <span class="posting-label">Pattern Detection</span>
                                <span class="posting-value">${metadata.postingBehaviorPatterns.patternDetection}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="competitive-advantages">
                    <h4>🚀 Competitive Advantages</h4>
                    <ul class="advantages-list">
                        ${metadata.competitiveAdvantages.identifiedAdvantages.map(advantage => `
                            <li>${advantage}</li>
                        `).join('')}
                    </ul>
                    <div class="market-position">
                        <strong>Market Position:</strong> ${metadata.competitiveAdvantages.marketPosition}
                    </div>
                </div>

                <div class="strategic-recommendations">
                    <h4>💡 Strategic Recommendations</h4>
                    
                    ${metadata.strategicRecommendations.immediateActions.length > 0 ? `
                        <div class="recommendation-category">
                            <h5>Immediate Actions (High Priority)</h5>
                            <ul class="recommendation-list">
                                ${metadata.strategicRecommendations.immediateActions.map(rec => `
                                    <li>
                                        <strong>${rec.recommendation}</strong>
                                        <span class="expected-impact">Expected Impact: ${rec.expectedImpact}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${metadata.strategicRecommendations.mediumTermStrategy.length > 0 ? `
                        <div class="recommendation-category">
                            <h5>Medium-Term Strategy</h5>
                            <ul class="recommendation-list">
                                ${metadata.strategicRecommendations.mediumTermStrategy.map(rec => `
                                    <li>
                                        <strong>${rec.recommendation}</strong>
                                        <span class="expected-impact">Expected Impact: ${rec.expectedImpact}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>

                <div class="analysis-metadata">
                    <div class="metadata-footer">
                        <span>Analysis Date: ${new Date(metadata.analysisMetadata.analysisDate).toLocaleDateString()}</span>
                        <span>Videos Analyzed: ${metadata.analysisMetadata.videosAnalyzed}</span>
                        <span>Confidence: ${metadata.analysisMetadata.confidenceLevel}</span>
                        <span class="report-type">${metadata.analysisMetadata.reportType}</span>
                    </div>
                </div>
            </div>
        `;
    }

    populateExecutiveSummary(summary) {
        const container = document.getElementById('executive-summary');
        
        container.innerHTML = `
            <div class="summary-section">
                <h4>Key Findings</h4>
                <ul class="findings-list">
                    ${summary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
                </ul>
            </div>
            <div class="summary-section">
                <h4>Strategic Recommendations</h4>
                <ul class="recommendations-list">
                    ${summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            <div class="summary-meta">
                <small>Analysis completed on ${new Date(summary.generatedAt).toLocaleDateString()} with ${summary.analysisQuality} confidence</small>
            </div>
        `;
    }

    populateTopVideos(analyses) {
        const container = document.getElementById('top-videos-grid');
        
        container.innerHTML = analyses.map(analysis => {
            const metrics = analysis.basicMetrics;
            const metadata = analysis.metadataAnalysis;
            
            return `
                <div class="video-card">
                    <div class="video-thumbnail">
                        <img src="https://via.placeholder.com/300x200/FF6B35/ffffff?text=Video+${analysis.rank}" 
                             alt="Video ${analysis.rank} thumbnail" 
                             loading="lazy">
                        <div class="video-rank">#${analysis.rank}</div>
                    </div>
                    <div class="video-info">
                        <div class="video-metrics">
                            <span><i class="fas fa-eye"></i> ${this.formatNumber(metrics.views)}</span>
                            <span><i class="fas fa-heart"></i> ${this.formatNumber(metrics.likes)}</span>
                            <span><i class="fas fa-chart-line"></i> ${metrics.engagementRate}%</span>
                        </div>
                        <div class="video-metadata">
                            <div class="highlight-tags">
                                <span class="tag hashtag-tag">${metadata.hashtagAnalysis.count} hashtags</span>
                                <span class="tag caption-tag">${metadata.captionAnalysis.wordCount} words</span>
                                <span class="tag timing-tag">${metadata.timingAnalysis.timeCategory}</span>
                                ${metadata.captionAnalysis.hasCallToAction ? '<span class="tag cta-tag">CTA</span>' : ''}
                            </div>
                        </div>
                        <div class="video-description">
                            Performance: ${metrics.engagementRate}% engagement • Duration: ${metrics.duration}s
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }


    populateInsights(insights) {
        this.populatePerformanceInsights(insights.performance);
        this.populateTimingInsights(insights.timing);
        this.populateHashtagInsights(insights.hashtags);
        this.populateCaptionInsights(insights.captions);
    }

    populatePerformanceInsights(performance) {
        const container = document.getElementById('performance-insights');
        
        container.innerHTML = `
            <div class="insight-item">
                <span class="insight-label">Avg Engagement Rate</span>
                <span class="insight-value">${performance.avgEngagementRate}%</span>
            </div>
            <div class="insight-item">
                <span class="insight-label">Avg Views</span>
                <span class="insight-value">${this.formatNumber(performance.avgViews)}</span>
            </div>
            <div class="insight-item">
                <span class="insight-label">Top Performer</span>
                <span class="insight-value">${performance.topPerformer ? this.formatNumber(performance.topPerformer.views) + ' views' : 'N/A'}</span>
            </div>
        `;
    }

    populateHashtagInsights(hashtags) {
        const container = document.getElementById('hashtag-insights');
        
        container.innerHTML = `
            <div class="insight-item">
                <span class="insight-label">Avg Hashtag Count</span>
                <span class="insight-value">${hashtags.avgHashtagCount}</span>
            </div>
            <div class="insight-item">
                <span class="insight-label">Low Usage (≤3)</span>
                <span class="insight-value">${hashtags.distribution.low} videos</span>
            </div>
            <div class="insight-item">
                <span class="insight-label">High Usage (>6)</span>
                <span class="insight-value">${hashtags.distribution.high} videos</span>
            </div>
        `;
    }

    populateCaptionInsights(captions) {
        const container = document.getElementById('caption-insights');
        
        container.innerHTML = `
            <div class="insight-item">
                <span class="insight-label">Optimal Length</span>
                <span class="insight-value">${captions.optimalLength} words</span>
            </div>
            <div class="insight-item">
                <span class="insight-label">Short Captions (≤10)</span>
                <span class="insight-value">${captions.distribution.short} videos</span>
            </div>
            <div class="insight-item">
                <span class="insight-label">Long Captions (>25)</span>
                <span class="insight-value">${captions.distribution.long} videos</span>
            </div>
        `;
    }

    populateTimingInsights(timing) {
        const container = document.getElementById('timing-insights');
        
        container.innerHTML = `
            <div class="insight-item">
                <span class="insight-label">Optimal Upload Time</span>
                <span class="insight-value">${timing.optimalTime}</span>
            </div>
            <div class="insight-item">
                <span class="insight-label">Best Days</span>
                <span class="insight-value">${timing.bestDays.join(', ')}</span>
            </div>
        `;
    }


    createPerformanceChart(analyses) {
        const ctx = document.getElementById('performance-chart').getContext('2d');
        
        if (this.performanceChart) {
            this.performanceChart.destroy();
        }
        
        const labels = analyses.map(a => `Video ${a.rank}`);
        const engagementData = analyses.map(a => a.basicMetrics.engagementRate);
        const viewsData = analyses.map(a => a.basicMetrics.views / 1000000);
        
        this.performanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Engagement Rate (%)',
                        data: engagementData,
                        backgroundColor: 'rgba(255, 107, 53, 0.8)',
                        borderColor: 'rgba(255, 107, 53, 1)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Views (Millions)',
                        data: viewsData,
                        backgroundColor: 'rgba(247, 147, 30, 0.8)',
                        borderColor: 'rgba(247, 147, 30, 1)',
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Video Performance Metrics (All Analyzed Videos)',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Engagement Rate (%)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Views (Millions)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    async exportPDFReport() {
        if (!this.currentAnalysis) {
            this.showNotification('No analysis data to export', 'error');
            return;
        }

        try {
            const response = await fetch('/api/analysis/export-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    analysisData: this.currentAnalysis,
                    username: this.currentAnalysis.username
                })
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tiktok-analysis-${this.currentAnalysis.username}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showNotification('Report exported successfully!', 'success');

        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Export failed. Please try again.', 'error');
        }
    }

    resetToInitialView() {
        this.currentAnalysis = null;
        document.getElementById('tiktok-username').value = '';
        
        if (this.performanceChart) {
            this.performanceChart.destroy();
            this.performanceChart = null;
        }
        
        this.showInitialView();
    }

    updateProgress(percentage, message, activeStep) {
        document.getElementById('progress-percentage').textContent = `${percentage}%`;
        document.getElementById('progress-title').textContent = message;
        document.getElementById('progress-fill').style.width = `${percentage}%`;
        
        if (activeStep) {
            this.activateStep(activeStep);
        }
    }

    activateStep(stepId) {
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
        
        const activeStepEl = document.getElementById(stepId);
        if (activeStepEl) {
            activeStepEl.classList.add('active');
        }
    }

    completeStep(stepId) {
        const stepEl = document.getElementById(stepId);
        if (stepEl) {
            stepEl.classList.remove('active');
            stepEl.classList.add('completed');
        }
    }

    showElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('hidden');
            element.classList.add('fade-in-up');
        }
    }

    hideElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('hidden');
            element.classList.remove('fade-in-up');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            background: ${type === 'error' ? '#DC3545' : type === 'success' ? '#28A745' : '#FF6B35'};
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const analyzer = new TumiLabsAnalyzer();

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .findings-list, .recommendations-list {
        list-style: none;
        padding: 0;
        margin: 1rem 0;
    }
    
    .findings-list li, .recommendations-list li {
        padding: 0.5rem 0;
        padding-left: 1.5rem;
        position: relative;
        border-bottom: 1px solid var(--border-color);
    }
    
    .findings-list li:before {
        content: '📊';
        position: absolute;
        left: 0;
    }
    
    .recommendations-list li:before {
        content: '💡';
        position: absolute;
        left: 0;
    }
    
    .summary-section {
        margin-bottom: 2rem;
    }
    
    .summary-section h4 {
        color: var(--primary-color);
        margin-bottom: 1rem;
        font-size: 1.1rem;
    }
    
    .summary-meta {
        text-align: center;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
        color: var(--medium-gray);
    }
    
    .highlight-tags {
        margin: 0.5rem 0;
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    
    .tag {
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .hashtag-tag { background: rgba(255, 107, 53, 0.1); color: var(--primary-color); }
    .caption-tag { background: rgba(40, 167, 69, 0.1); color: var(--success-color); }
    .timing-tag { background: rgba(255, 193, 7, 0.1); color: var(--warning-color); }
    .cta-tag { background: rgba(220, 53, 69, 0.1); color: var(--danger-color); }
`;
document.head.appendChild(style);