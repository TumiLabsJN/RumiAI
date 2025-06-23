class TumiLabsAnalyzer {
    constructor() {
        this.currentAnalysis = null;
        this.performanceChart = null;
        this.abortController = null;
        this.progressInterval = null;
        this.videoAnalysisJobId = null;
        this.videoAnalysisPolling = null;
        this.videoAnalysisError = null;
        this.isAnalysisRunning = false; // Prevent multiple submissions
        this.requestCounter = 0; // Track request count
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showInitialView();
        this.addDebugInfo();
    }
    
    addDebugInfo() {
        console.log('🔧 TumiLabs Analyzer Debug Info:', {
            currentUrl: window.location.href,
            origin: window.location.origin,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });
    }

    setupEventListeners() {
        const analysisForm = document.getElementById('analysis-form');
        const exportBtn = document.getElementById('export-pdf');
        // const newAnalysisBtn = document.getElementById('new-analysis'); // Removed from UI
        const cancelBtn = document.getElementById('cancel-analysis');
        const retryBtn = document.getElementById('retry-analysis');

        if (analysisForm) {
            analysisForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.startAnalysis();
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportPDFReport());
        }

        // if (newAnalysisBtn) {
        //     newAnalysisBtn.addEventListener('click', () => this.resetToInitialView());
        // } // Removed from UI

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelAnalysis());
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryAnalysis());
        }
    }

    showInitialView() {
        this.hideElement('analysis-progress');
        this.hideElement('results-dashboard');
        this.showElement('analysis-input');
    }

    async startAnalysis() {
        // 🚨 CRITICAL: Prevent multiple concurrent requests
        if (this.isAnalysisRunning) {
            console.log('⚠️ Analysis already running - ignoring duplicate request');
            this.showNotification('Analysis already in progress', 'info');
            return;
        }

        const username = document.getElementById('tiktok-username').value.trim();
        
        console.log('🔍 startAnalysis called with username:', username);
        
        if (!username) {
            console.log('❌ No username provided');
            this.showNotification('Please enter a TikTok username', 'error');
            return;
        }

        // Set analysis running flag and disable button
        this.isAnalysisRunning = true;
        this.disableAnalysisButton();
        this.requestCounter++;
        console.log(`🎯 Starting analysis #${this.requestCounter} for @${username}`);

        this.hideElement('analysis-input');
        this.showElement('analysis-progress');
        this.showCancelButton();
        
        let analysisError = null;
        
        try {
            await this.runAnalysisFlow(username);
            this.hideCancelButton(); // Success - hide cancel button
        } catch (error) {
            analysisError = error;
            
            if (error.name === 'AbortError') {
                console.log('🚫 Analysis cancelled by user');
                this.showNotification('Analysis cancelled', 'info');
                this.resetToInitialView();
            } else {
                console.error('❌ Analysis failed:', error);
                
                // Show specific error messages based on the type of failure
                if (error.message.includes('timeout') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
                    this.updateProgress(27, 'TikTok data temporarily unavailable', 'step-scraping');
                    this.hideCancelButton();
                    this.showRetryButton();
                    this.showNotification('TikTok data unavailable. Click "Try Again" to retry.', 'error');
                } else if (error.message.includes('No videos found')) {
                    this.showNotification(`Analysis failed: ${error.message}`, 'error');
                    this.resetToInitialView();
                } else if (error.message.includes('Insufficient analyzable content')) {
                    this.showNotification(`Analysis failed: ${error.message}`, 'error');
                    this.resetToInitialView();
                } else {
                    this.showNotification(`Analysis failed: ${error.message}`, 'error');
                    this.resetToInitialView();
                }
            }
        } finally {
            // 🚨 CRITICAL: Always re-enable analysis button
            this.isAnalysisRunning = false;
            this.enableAnalysisButton();
            console.log(`✅ Analysis #${this.requestCounter} completed/failed - button re-enabled`);
        }
    }

    async runAnalysisFlow(username) {
        try {
            // Phase 1: Data Collection (0% → 30%)
            this.updateProgress(0, 'Initializing Analysis...', 'step-scraping');
            this.activateStep('step-scraping');
            
            await this.delay(300);
            this.updateProgress(10, 'Connecting to TikTok via Apify...', 'step-scraping');
            
            await this.delay(200);
            this.updateProgress(20, 'Establishing data connection...', 'step-scraping');
            
            // Enhanced data collection with proper progress synchronization
            const scrapingResult = await this.fetchTikTokDataWithProgress(username);
            
            // 30% reached - Data Collection Complete
            this.updateProgress(30, 'Data collection complete', 'step-scraping');
            this.completeStep('step-scraping');
            await this.delay(300);
            
            // Phase 2: Video Processing (30% → 50%)
            this.activateStep('step-selecting');
            this.updateProgress(35, 'Processing video metadata...', 'step-selecting');
            
            await this.delay(200);
            this.updateProgress(40, 'Filtering qualifying videos...', 'step-selecting');
            
            const topVideos = this.selectTopVideos(scrapingResult);
            
            await this.delay(150);
            this.updateProgress(45, 'Analyzing video performance...', 'step-selecting');
            
            await this.delay(250);
            this.updateProgress(50, 'Video processing complete', 'step-selecting');
            this.completeStep('step-selecting');
            await this.delay(300);
            
            // Phase 3: Intelligence Analysis (50% → 75%)
            this.activateStep('step-analyzing');
            this.updateProgress(55, 'Processing insights and patterns...', 'step-analyzing');
            
            const analysisResult = await this.performVideoAnalysisWithProgress(topVideos);
            
            this.updateProgress(75, 'Intelligence analysis complete', 'step-analyzing');
            this.completeStep('step-analyzing');
            await this.delay(300);
            
            // Phase 4: Report Generation (75% → 90%)
            this.activateStep('step-reporting');
            this.updateProgress(80, 'Generating comprehensive report...', 'step-reporting');
            
            await this.delay(300);
            this.updateProgress(85, 'Finalizing analytics dashboard...', 'step-reporting');
            
            await this.delay(200);
            this.updateProgress(90, 'Report generation complete', 'step-reporting');
            
            await this.delay(400);
            this.updateProgress(100, 'Analysis complete!', 'step-reporting');
            this.completeStep('step-reporting');
            
            // Mark all steps as completed
            this.markAllStepsCompleted();
            
            await this.delay(500);
            this.showResults(username, analysisResult);
            
        } catch (error) {
            console.error('Analysis failed:', error);
            this.showNotification(`Analysis failed: ${error.message}`, 'error');
            this.resetToInitialView();
        }
    }

    async fetchTikTokDataWithProgress(username) {
        console.log(`📱 Fetching TikTok data for: ${username}`);
        
        try {
            // Micro-progress updates for better UX (22% → 30%)
            this.updateProgress(22, 'Scraping TikTok videos...', 'step-scraping');
            await this.delay(200);
            
            this.updateProgress(25, 'Connecting to TikTok API...', 'step-scraping');
            await this.delay(150);
            
            this.updateProgress(27, 'Downloading video metadata...', 'step-scraping');
            console.log('🌐 Making API request to /api/tiktok/analyze...');
            
            // Add timeout and progress feedback during API call
            const result = await this.fetchWithProgressAndTimeout(username);
            
            // CRITICAL: Clear any progress intervals before setting final progress
            this.clearProgressInterval();
            
            this.updateProgress(30, 'Processing scraped data...', 'step-scraping');
            console.log('✅ Real TikTok data received:', result);
            return result;
            
        } catch (error) {
            console.error('❌ TikTok fetch error:', error);
            
            // Clear any lingering progress intervals
            this.clearProgressInterval();
            
            // Throw the error instead of using mock data
            throw error;
        }
    }

    async fetchWithProgressAndTimeout(username) {
        const maxRetries = 0; // 🚨 URGENT FIX: NO RETRIES - ONE REQUEST ONLY
        const timeoutMs = 600000; // 10 minute timeout for real TikTok analysis
        
        for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
            try {
                console.log(`📡 API attempt ${retryCount + 1} of ${maxRetries + 1}`);
                
                // Clean up any previous intervals
                if (this.progressInterval) {
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                }
                
                // Create new AbortController for this attempt
                this.abortController = new AbortController();
                
                // Start micro-progress feedback during API call
                this.progressInterval = this.startApiProgressFeedback();
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs/60000} minutes - TikTok analysis is taking longer than expected. This may indicate high server load or complex account analysis.`)), timeoutMs)
                );
                
                // 🚨 CRITICAL: Log every fetch call to track duplicates
                console.log(`🌐 FETCHING /api/tiktok/analyze for @${username} (Request #${this.requestCounter})`);
                console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
                
                const fetchPromise = fetch('/api/tiktok/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username }),
                    signal: this.abortController.signal
                });
                
                const response = await Promise.race([fetchPromise, timeoutPromise]);
                
                // CRITICAL: Clear progress interval immediately on API response
                this.clearProgressInterval();
                
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

                console.log(`✅ API successful on attempt ${retryCount + 1}`);
                
                // Check if video analysis was started
                if (result.videoAnalysis) {
                    if (result.videoAnalysis.jobId) {
                        this.videoAnalysisJobId = result.videoAnalysis.jobId;
                        console.log(`🎬 Video analysis job ID: ${this.videoAnalysisJobId}`);
                    } else if (result.videoAnalysis.error) {
                        console.log(`🎬 Video analysis failed to start: ${result.videoAnalysis.message}`);
                        // Store the error to show in UI
                        this.videoAnalysisError = {
                            error: result.videoAnalysis.error,
                            message: result.videoAnalysis.message,
                            details: result.videoAnalysis.details
                        };
                    }
                }
                
                return result.data;
                
            } catch (error) {
                // Clear progress interval on error
                if (this.progressInterval) {
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                }
                
                console.error(`❌ API attempt ${retryCount + 1} failed:`, error.message);
                
                // Enhanced error logging for debugging
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    console.error('🌐 Network Error Details:', {
                        error: error.message,
                        type: 'Network/CORS/Server Connection Issue',
                        possibleCauses: [
                            'Server not responding',
                            'CORS policy blocking request', 
                            'Network connectivity issues',
                            'Server overloaded or crashed'
                        ]
                    });
                }
                
                // If this is not the last attempt, show retry message and wait
                if (retryCount < maxRetries) {
                    const retryDelay = (retryCount + 1) * 1000; // 1s, 2s delays
                    // Show confident messaging without retry counters
                    const confidentMessages = [
                        'Deep analysis in progress...',
                        'Building comprehensive insights...',
                        'Finalizing engagement analysis...'
                    ];
                    console.log(`🔄 Retry attempt ${retryCount + 2}/${maxRetries + 1} - internal logging only`);
                    this.updateProgress(27, confidentMessages[retryCount] || 'Processing comprehensive analysis...', 'step-scraping');
                    await this.delay(retryDelay);
                    this.updateProgress(27, 'Optimizing data quality...', 'step-scraping');
                    continue; // Try again
                }
                
                // All retries failed - throw the error
                console.error(`❌ All ${maxRetries + 1} attempts failed.`);
                throw error;
            }
        }
    }

    startApiProgressFeedback() {
        let progressStep = 27;
        const messages = [
            'Deep analysis in progress...',
            'Connecting to TikTok servers...',
            'Downloading video metadata...',
            'Processing engagement data...',
            'Analyzing audience behavior...',
            'Extracting performance metrics...',
            'Building comprehensive insights...',
            'Processing content strategy data...',
            'Generating competitive insights...',
            'Finalizing personalized report...',
            'TikTok analysis taking longer than usual...',
            'Complex account analysis in progress...',
            'Almost ready with your insights...',
            'Quality analysis takes time - please wait...'
        ];
        let messageIndex = 0;
        
        return setInterval(() => {
            if (progressStep < 29.5 && this.progressInterval) { // Check if interval should still be running
                progressStep += 0.5;
                const message = messages[messageIndex % messages.length];
                this.updateProgress(Math.floor(progressStep), message, 'step-scraping');
                
                if (progressStep % 1 === 0) { // Change message every full percentage
                    messageIndex++;
                }
            }
        }, 2000); // Update every 2 seconds
    }


    selectTopVideos(data) {
        return data.allVideosAnalyzed || data.topVideos || [];
    }

    async performVideoAnalysisWithProgress(videos) {
        try {
            // Intelligence Analysis Phase (55% → 70%)
            this.updateProgress(60, 'Analyzing engagement patterns...', 'step-analyzing');
            await this.delay(200);
            
            this.updateProgress(65, 'Processing intelligence metrics...', 'step-analyzing');
            
            const response = await fetch('/api/analysis/videos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videos })
            });

            this.updateProgress(70, 'Finalizing insights...', 'step-analyzing');
            await this.delay(150);
            
            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.status}`);
            }

            const result = await response.json();
            return result.data;
            
        } catch (error) {
            console.error('Analysis API error:', error);
            throw error;
        }
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
        // document.getElementById('analysis-username').textContent = headerText; // Element removed from UI
        
        // Add historical timeframe notice if applicable
        this.addHistoricalNotice(data);
        
        // this.populateInsights(data.insights); // Removed insights grid from UI
        
        // Add comprehensive metadata analysis if available
        if (data.metadataIntelligence) {
            this.populateMetadataIntelligence(data.metadataIntelligence);
        }
        
        // Always initialize video analysis section
        this.initVideoAnalysisSection();
        
        if (this.videoAnalysisJobId) {
            console.log('🎬 Starting video analysis polling...');
            this.startVideoAnalysisPolling();
        } else if (this.videoAnalysisError) {
            console.log('🎬 Showing video analysis error...');
            this.showVideoAnalysisError(this.videoAnalysisError.message, this.videoAnalysisError.details);
        } else {
            console.log('🎬 Video analysis not configured, showing setup message...');
            this.showVideoAnalysisUnavailable();
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
                                <span class="analytics-value">${parseFloat(metadata.engagementMetrics.engagementDistribution.consistencyScore).toFixed(2)}</span>
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
                                        <span class="duration-text">${data.percentage}% (${data.count} videos)${data.engagement !== 'N/A' ? ` - Avg: ${data.engagement}% engagement` : ' - No videos'}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="optimal-duration">
                            <strong>Optimal Duration:</strong> ${metadata.videoDurationIntelligence.optimalDuration.optimal !== 'N/A' ? `${metadata.videoDurationIntelligence.optimalDuration.optimal}s (${metadata.videoDurationIntelligence.optimalDuration.engagement}% avg engagement)` : 'Insufficient data for recommendation'}
                        </div>
                    </div>

                    <div class="intelligence-section">
                        <h4>📝 Caption Strategy</h4>
                        <div class="caption-legend">
                            <strong>📝 Caption Length Guide:</strong> Short captions: 1-10 words, Medium captions: 11-25 words, Long captions: 26-50 words, Extended captions: 51+ words
                        </div>
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
                        backgroundColor: 'rgba(130, 54, 251, 0.8)',
                        borderColor: 'rgba(130, 54, 251, 1)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Views (Millions)',
                        data: viewsData,
                        backgroundColor: 'rgba(107, 70, 193, 0.8)',
                        borderColor: 'rgba(107, 70, 193, 1)',
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
        
        // Clean up any ongoing operations
        if (this.abortController) {
            this.abortController = null;
        }
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        
        if (this.performanceChart) {
            this.performanceChart.destroy();
            this.performanceChart = null;
        }
        
        // Clean up video analysis polling
        if (this.videoAnalysisPolling) {
            clearInterval(this.videoAnalysisPolling);
            this.videoAnalysisPolling = null;
        }
        
        this.videoAnalysisJobId = null;
        this.videoAnalysisError = null;
        
        // 🚨 CRITICAL: Reset analysis running flag
        this.isAnalysisRunning = false;
        this.enableAnalysisButton();
        
        this.hideCancelButton();
        this.hideRetryButton();
        this.showInitialView();
    }

    updateProgress(percentage, message, activeStep) {
        // Ensure we're not overriding a higher percentage (prevent regression)
        const currentPercentage = parseInt(document.getElementById('progress-percentage').textContent) || 0;
        if (percentage < currentPercentage && currentPercentage > 30) {
            console.log(`⚠️ Prevented progress regression: ${percentage}% < ${currentPercentage}%`);
            return;
        }
        
        document.getElementById('progress-percentage').textContent = `${percentage}%`;
        
        // Add spinner for long operations
        const showSpinner = message.includes('Downloading') || message.includes('This may take') || message.includes('Connecting');
        const spinnerHtml = showSpinner ? '<div class="progress-spinner"></div>' : '';
        document.getElementById('progress-title').innerHTML = `${spinnerHtml}${message}`;
        
        document.getElementById('progress-fill').style.width = `${percentage}%`;
        
        if (activeStep) {
            this.activateStep(activeStep);
        }
        
        console.log(`📊 Progress: ${percentage}% - ${message}`);
    }
    
    clearProgressInterval() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
            console.log('🧹 Progress interval cleared');
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

    markAllStepsCompleted() {
        const steps = ["step-scraping", "step-selecting", "step-analyzing", "step-reporting"];
        steps.forEach(stepId => {
            const stepEl = document.getElementById(stepId);
            if (stepEl) {
                stepEl.classList.remove("active");
                stepEl.classList.add("completed");
            }
        });
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
            background: ${type === 'error' ? '#DC3545' : type === 'success' ? '#28A745' : '#8236FB'};
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

    cancelAnalysis() {
        console.log('🚫 User requested analysis cancellation');
        
        // Abort any ongoing fetch requests
        if (this.abortController) {
            this.abortController.abort();
        }
        
        // Clear any progress intervals
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        
        // Reset to initial view
        this.resetToInitialView();
        this.showNotification('Analysis cancelled successfully', 'info');
    }

    showCancelButton() {
        const cancelBtn = document.getElementById('cancel-analysis');
        if (cancelBtn) {
            cancelBtn.classList.remove('hidden');
        }
    }

    hideCancelButton() {
        const cancelBtn = document.getElementById('cancel-analysis');
        if (cancelBtn) {
            cancelBtn.classList.add('hidden');
        }
    }

    showRetryButton() {
        const retryBtn = document.getElementById('retry-analysis');
        if (retryBtn) {
            retryBtn.classList.remove('hidden');
        }
    }

    hideRetryButton() {
        const retryBtn = document.getElementById('retry-analysis');
        if (retryBtn) {
            retryBtn.classList.add('hidden');
        }
    }

    retryAnalysis() {
        console.log('🔄 User requested analysis retry');
        const username = document.getElementById('tiktok-username').value.trim();
        
        if (username) {
            this.hideRetryButton();
            this.showCancelButton();
            this.startAnalysis();
        } else {
            this.showNotification('Please enter a username to retry', 'error');
            this.resetToInitialView();
        }
    }

    disableAnalysisButton() {
        const submitBtn = document.querySelector('#analysis-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Analyzing...';
            console.log('🚫 Analysis button disabled');
        }
    }

    enableAnalysisButton() {
        const submitBtn = document.querySelector('#analysis-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Analyze Performance';
            console.log('✅ Analysis button enabled');
        }
    }

    startDynamicProgress(startPercent, endPercent, baseMessage) {
        let currentPercent = startPercent;
        const increment = (endPercent - startPercent) / 20; // Update every ~500ms over ~10 seconds
        
        const messages = [
            `${baseMessage}`,
            `${baseMessage.replace('...', '')} (processing data...)`,
            `${baseMessage.replace('...', '')} (analyzing patterns...)`,
            `${baseMessage.replace('...', '')} (calculating metrics...)`
        ];
        
        let messageIndex = 0;
        
        return setInterval(() => {
            if (currentPercent < endPercent) {
                currentPercent = Math.min(currentPercent + increment, endPercent);
                
                // Cycle through messages every few updates
                if (Math.floor(currentPercent) % 3 === 0) {
                    messageIndex = (messageIndex + 1) % messages.length;
                }
                
                this.updateProgress(
                    Math.floor(currentPercent), 
                    messages[messageIndex],
                    null // Don't change active step during dynamic updates
                );
            }
        }, 500); // Update every 500ms
    }

    // Video Analysis Methods
    initVideoAnalysisSection() {
        console.log('🎬 Initializing video analysis section');
        
        // Create video analysis section if it doesn't exist
        const resultsContainer = document.getElementById('results-dashboard');
        if (!resultsContainer) return;
        
        let videoSection = document.getElementById('video-analysis-section');
        if (!videoSection) {
            videoSection = document.createElement('div');
            videoSection.id = 'video-analysis-section';
            videoSection.className = 'card video-analysis-card';
            videoSection.innerHTML = `
                <div class="video-analysis-header">
                    <h3>🎬 Advanced Video Analysis</h3>
                    <div id="video-analysis-status" class="video-status">
                        <span class="status-text">Initializing AI analysis...</span>
                        <div class="status-progress">
                            <div id="video-progress-fill" class="video-progress-fill" style="width: 0%"></div>
                        </div>
                        <span id="video-progress-percentage" class="progress-percentage">0%</span>
                    </div>
                </div>
                <div id="video-analysis-content" class="video-analysis-content">
                    <div class="analysis-placeholder">
                        <div class="placeholder-icon">🧠</div>
                        <p>AI-powered video analysis is processing your content...</p>
                        <p class="placeholder-subtitle">This may take 2-5 minutes to complete</p>
                    </div>
                </div>
            `;
            resultsContainer.appendChild(videoSection);
        }
        
        // Show the section
        videoSection.classList.remove('hidden');
    }

    startVideoAnalysisPolling() {
        if (!this.videoAnalysisJobId) return;
        
        console.log(`🔄 Starting video analysis polling for job: ${this.videoAnalysisJobId}`);
        
        this.videoAnalysisPolling = setInterval(async () => {
            try {
                const status = await this.checkVideoAnalysisStatus();
                this.updateVideoAnalysisDisplay(status);
                
                if (status.status === 'completed') {
                    clearInterval(this.videoAnalysisPolling);
                    await this.loadVideoAnalysisResults();
                } else if (status.status === 'failed') {
                    clearInterval(this.videoAnalysisPolling);
                    this.showVideoAnalysisError(status.error);
                }
            } catch (error) {
                console.error('❌ Video analysis polling error:', error);
                // Continue polling unless it's a critical error
            }
        }, 5000); // Poll every 5 seconds
    }

    async checkVideoAnalysisStatus() {
        const response = await fetch(`/api/video-analysis/status/${this.videoAnalysisJobId}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to get video analysis status');
        }
        
        return result.data;
    }

    updateVideoAnalysisDisplay(status) {
        const statusElement = document.getElementById('video-analysis-status');
        const progressFill = document.getElementById('video-progress-fill');
        const progressPercentage = document.getElementById('video-progress-percentage');
        const statusText = statusElement.querySelector('.status-text');
        
        if (statusText) {
            statusText.textContent = status.message || 'Processing...';
        }
        
        if (progressFill) {
            progressFill.style.width = `${status.progress}%`;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${status.progress}%`;
        }
        
        console.log(`🎬 Video analysis progress: ${status.progress}% - ${status.message}`);
    }

    async loadVideoAnalysisResults() {
        try {
            console.log('📊 Loading video analysis results...');
            
            const response = await fetch(`/api/video-analysis/results/${this.videoAnalysisJobId}`);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to load video analysis results');
            }
            
            this.displayVideoAnalysisResults(result.data.results);
            
        } catch (error) {
            console.error('❌ Failed to load video analysis results:', error);
            this.showVideoAnalysisError(error.message);
        }
    }

    displayVideoAnalysisResults(results) {
        console.log('🎬 Displaying video analysis results:', results);
        
        const contentContainer = document.getElementById('video-analysis-content');
        if (!contentContainer) return;
        
        const insights = results.insights;
        const videos = results.videos;
        const summary = results.summary;
        
        contentContainer.innerHTML = `
            <div class="video-results-container">
                <!-- Performance Snapshot -->
                <div class="video-section">
                    <h4>📊 Performance Snapshot</h4>
                    <div class="video-grid">
                        ${videos.map((video, index) => `
                            <div class="video-card">
                                <div class="video-rank">#${video.rank}</div>
                                <div class="video-metrics">
                                    <span class="metric"><i class="fas fa-eye"></i> ${this.formatNumber(video.views)}</span>
                                    <span class="metric"><i class="fas fa-chart-line"></i> ${video.engagementRate}%</span>
                                    <span class="metric"><i class="fas fa-clock"></i> ${video.duration}s</span>
                                </div>
                                <div class="video-period">${index < 3 ? 'Recent (0-30 days)' : 'Historical (30-60 days)'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Hook Analysis -->
                <div class="video-section">
                    <h4>🎯 Hook Effectiveness Analysis</h4>
                    <div class="hook-analysis">
                        <div class="hook-rating">
                            <span class="hook-score">${insights.hookAnalysis.effectiveness}</span>
                            <span class="hook-label">Hook Effectiveness Rating</span>
                        </div>
                        <div class="hook-patterns">
                            <h5>Effective Patterns:</h5>
                            <ul>
                                ${insights.hookAnalysis.patterns.map(pattern => `<li>${pattern}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="hook-first-seconds">
                            <h5>First 3 Seconds Analysis:</h5>
                            <ul>
                                ${insights.hookAnalysis.firstThreeSeconds.map(element => `<li>${element}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="hook-recommendations">
                            <h5>Hook Improvements:</h5>
                            <ul>
                                ${insights.hookAnalysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Visual Detection -->
                <div class="video-section">
                    <h4>🏷️ Visual Detection & Content Recognition</h4>
                    <div class="recognition-grid">
                        <div class="recognition-category">
                            <h5>Products Detected:</h5>
                            <div class="recognition-tags">
                                ${insights.visualDetection.products.map(product => 
                                    `<span class="recognition-tag product-tag">${product}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="recognition-category">
                            <h5>Animals Detected:</h5>
                            <div class="recognition-tags">
                                ${insights.visualDetection.animals.map(animal => 
                                    `<span class="recognition-tag animal-tag">${animal}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="recognition-category">
                            <h5>Logos & Text:</h5>
                            <div class="recognition-tags">
                                ${insights.visualDetection.logos.map(logo => 
                                    `<span class="recognition-tag logo-tag">${logo}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="recognition-category">
                            <h5>Themes:</h5>
                            <div class="recognition-tags">
                                ${insights.visualDetection.themes.map(theme => 
                                    `<span class="recognition-tag theme-tag">${theme}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="recognition-category">
                            <h5>Settings:</h5>
                            <div class="recognition-tags">
                                ${insights.visualDetection.settings.map(setting => 
                                    `<span class="recognition-tag setting-tag">${setting}</span>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Transcript Insights -->
                <div class="video-section">
                    <h4>💭 Transcript & Sentiment Analysis</h4>
                    <div class="transcript-insights">
                        <div class="sentiment-overview">
                            <span class="sentiment-tone sentiment-${insights.transcriptInsights.overallTone}">
                                ${insights.transcriptInsights.overallTone.toUpperCase()}
                            </span>
                            <span class="sentiment-detail">${insights.transcriptInsights.sentiment}</span>
                        </div>
                        <div class="transcript-metrics">
                            <div class="transcript-metric">
                                <span class="transcript-label">Average Word Count:</span>
                                <span class="transcript-value">${insights.transcriptInsights.wordCount}</span>
                            </div>
                        </div>
                        <div class="key-phrases">
                            <h5>Key Phrases:</h5>
                            <div class="phrase-tags">
                                ${insights.transcriptInsights.keyPhrases.map(phrase => 
                                    `<span class="phrase-tag">${phrase}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="cta-analysis">
                            <h5>Call-to-Actions:</h5>
                            <div class="cta-tags">
                                ${insights.transcriptInsights.callToActions.map(cta => 
                                    `<span class="cta-tag">${cta}</span>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pace and Editing -->
                <div class="video-section">
                    <h4>🎬 Pace & Editing Analysis</h4>
                    <div class="pace-editing">
                        <div class="editing-metrics">
                            <div class="editing-metric">
                                <span class="editing-label">Average Cuts:</span>
                                <span class="editing-value">${insights.paceAndEditing.averageCuts}</span>
                            </div>
                            <div class="editing-metric">
                                <span class="editing-label">Editing Pace:</span>
                                <span class="editing-value pace-${insights.paceAndEditing.editingPace}">${insights.paceAndEditing.editingPace.toUpperCase()}</span>
                            </div>
                            <div class="editing-metric">
                                <span class="editing-label">Visual Style:</span>
                                <span class="editing-value">${insights.paceAndEditing.visualStyle}</span>
                            </div>
                        </div>
                        <div class="transitions-analysis">
                            <h5>Transition Techniques:</h5>
                            <div class="transition-tags">
                                ${insights.paceAndEditing.transitions.map(transition => 
                                    `<span class="transition-tag">${transition}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="effects-used">
                            <h5>Effects & Filters:</h5>
                            <div class="effect-tags">
                                ${insights.paceAndEditing.effects.map(effect => 
                                    `<span class="effect-tag">${effect}</span>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TikTok Optimization -->
                <div class="video-section">
                    <h4>🚀 TikTok Algorithm Optimization</h4>
                    <div class="tiktok-optimization">
                        <ul class="optimization-list">
                            ${insights.tiktokOptimization.map(suggestion => 
                                `<li class="optimization-item">
                                    <i class="fas fa-rocket"></i>
                                    ${suggestion}
                                </li>`
                            ).join('')}
                        </ul>
                        <div class="optimization-note">
                            <p><strong>Note:</strong> These recommendations are specifically tailored for TikTok's algorithm and engagement patterns based on your video analysis.</p>
                        </div>
                    </div>
                </div>

                <!-- Analysis Summary -->
                <div class="video-section">
                    <h4>📈 Analysis Summary</h4>
                    <div class="analysis-summary">
                        <div class="summary-metrics">
                            <div class="summary-metric">
                                <span class="summary-label">Videos Analyzed:</span>
                                <span class="summary-value">${summary.videosAnalyzed}</span>
                            </div>
                            <div class="summary-metric">
                                <span class="summary-label">Avg Engagement:</span>
                                <span class="summary-value">${summary.avgEngagement.toFixed(2)}%</span>
                            </div>
                            <div class="summary-metric">
                                <span class="summary-label">Total Views:</span>
                                <span class="summary-value">${this.formatNumber(summary.totalViews)}</span>
                            </div>
                        </div>
                        <div class="key-findings">
                            <h5>Key Findings:</h5>
                            <ul>
                                ${summary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Update status to show completion
        this.updateVideoAnalysisDisplay({
            progress: 100,
            message: 'Video analysis complete! 🎉'
        });
        
        console.log('✅ Video analysis results displayed successfully');
    }

    showVideoAnalysisError(errorMessage, details = null) {
        const contentContainer = document.getElementById('video-analysis-content');
        if (!contentContainer) return;
        
        const detailsHtml = details && process.env.NODE_ENV === 'development' ? 
            `<details class="error-details">
                <summary>Technical Details</summary>
                <pre>${details}</pre>
            </details>` : '';
        
        contentContainer.innerHTML = `
            <div class="analysis-error">
                <div class="error-icon">❌</div>
                <h4>Video Analysis Failed</h4>
                <p>${errorMessage}</p>
                <p class="error-subtitle">The metadata analysis above is still valid and complete.</p>
                ${detailsHtml}
            </div>
        `;
        
        // Update status to show error
        this.updateVideoAnalysisDisplay({
            progress: 0,
            message: 'Video analysis failed'
        });
        
        console.error('❌ Video analysis failed:', errorMessage);
    }

    showVideoAnalysisUnavailable() {
        const contentContainer = document.getElementById('video-analysis-content');
        if (!contentContainer) return;
        
        contentContainer.innerHTML = `
            <div class="analysis-placeholder">
                <div class="placeholder-icon">🔧</div>
                <h4>Video Analysis Setup Required</h4>
                <p>Advanced video analysis requires additional configuration:</p>
                <ul style="text-align: left; max-width: 400px; margin: 1rem auto;">
                    <li>Google Cloud Video Intelligence API</li>
                    <li>Google Cloud Storage bucket</li>
                    <li>Claude AI API access</li>
                    <li>yt-dlp video downloader</li>
                </ul>
                <p class="placeholder-subtitle">See SETUP.md for configuration instructions</p>
                <p class="error-subtitle">The metadata analysis above provides comprehensive insights without video analysis.</p>
            </div>
        `;
        
        // Update status to show setup needed
        this.updateVideoAnalysisDisplay({
            progress: 0,
            message: 'Setup required for video analysis'
        });
        
        console.log('🔧 Video analysis requires additional setup');
    }
// Additional methods for enhanced progress tracking
// These should be added to the TumiLabsAnalyzer class

async simulateDataCollectionProgress(phases) {
    for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        this.updateProgress(phase.percent, phase.message, 'step-scraping');
        
        // Add some variation in timing to feel realistic
        const delay = 2000 + Math.random() * 1000; // 2-3 seconds per phase
        await this.delay(delay);
    }
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
    
    .hashtag-tag { background: rgba(130, 54, 251, 0.1); color: var(--primary-color); }
    .caption-tag { background: rgba(40, 167, 69, 0.1); color: var(--success-color); }
    .timing-tag { background: rgba(255, 193, 7, 0.1); color: var(--warning-color); }
    .cta-tag { background: rgba(220, 53, 69, 0.1); color: var(--danger-color); }
    
    .historical-notice {
        background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
        border: 1px solid #90caf9;
        border-radius: 12px;
        margin: 1rem 0;
        padding: 0;
        overflow: hidden;
    }
    
    .historical-notice-content {
        display: flex;
        align-items: flex-start;
        padding: 1.5rem;
        gap: 1rem;
    }
    
    .notice-icon {
        color: #1976d2;
        font-size: 1.5rem;
        margin-top: 0.2rem;
    }
    
    .notice-text h4 {
        color: #1976d2;
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
        font-weight: 600;
    }
    
    .notice-text p {
        margin: 0 0 1rem 0;
        color: #333;
        line-height: 1.5;
    }
    
    .timeframe-details {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.9rem;
        color: #666;
    }
    
    .timeframe-details span {
        display: block;
    }
`;
document.head.appendChild(style);