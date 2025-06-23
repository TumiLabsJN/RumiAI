#!/usr/bin/env node

/**
 * Debug script to analyze TikTokService.analyzeProfile output
 * and examine the complete structure of video objects from Apify
 * 
 * This script will:
 * 1. Call TikTokService.analyzeProfile for @russwong.md
 * 2. Print the first video's complete structure
 * 3. Highlight all available fields, especially video download URLs
 */

require('dotenv').config();
const TikTokService = require('./server/services/TikTokService');
const util = require('util');

async function debugApifyVideoStructure() {
    console.log('========================================');
    console.log('🔍 DEBUG: Apify Video Object Structure');
    console.log('========================================\n');

    try {
        // Check if environment variables are set
        console.log('📋 Environment Check:');
        console.log(`   - APIFY_TOKEN configured: ${!!process.env.APIFY_TOKEN}`);
        console.log(`   - MIN_VIEWS_THRESHOLD: ${process.env.MIN_VIEWS_THRESHOLD || '10000 (default)'}`);
        console.log(`   - ANALYSIS_DAYS: ${process.env.ANALYSIS_DAYS || '30 (default)'}\n`);

        // Call analyzeProfile for @russwong.md
        console.log('🚀 Calling TikTokService.analyzeProfile for @russwong.md...\n');
        const analysisResult = await TikTokService.analyzeProfile('russwong.md');

        // Print summary statistics
        console.log('📊 Analysis Summary:');
        console.log(`   - Username: @${analysisResult.username}`);
        console.log(`   - Total Videos: ${analysisResult.totalVideos}`);
        console.log(`   - Recent Videos: ${analysisResult.recentVideos}`);
        console.log(`   - Videos Analyzed: ${analysisResult.allVideosAnalyzed.length}`);
        console.log(`   - Analysis Window: ${analysisResult.analysisWindow}`);
        console.log(`   - Data Source: ${analysisResult.dataSource}\n`);

        // Check if we have any videos to examine
        if (!analysisResult.allVideosAnalyzed || analysisResult.allVideosAnalyzed.length === 0) {
            console.log('❌ No videos found in the analysis results!');
            return;
        }

        // Get the first video
        const firstVideo = analysisResult.allVideosAnalyzed[0];

        console.log('========================================');
        console.log('📹 FIRST VIDEO - COMPLETE STRUCTURE');
        console.log('========================================\n');

        // Use util.inspect for deep object inspection with colors
        console.log(util.inspect(firstVideo, {
            showHidden: false,
            depth: null,
            colors: true,
            maxArrayLength: null
        }));

        console.log('\n========================================');
        console.log('🔑 KEY FIELDS ANALYSIS');
        console.log('========================================\n');

        // Analyze specific fields that might contain download URLs
        console.log('📌 Video URLs and Download Links:');
        const urlFields = [
            'downloadUrl',
            'videoUrl',
            'url',
            'webVideoUrl',
            'playAddr',
            'downloadAddr',
            'videoMeta',
            'video'
        ];

        urlFields.forEach(field => {
            if (firstVideo[field]) {
                console.log(`   - ${field}: ${typeof firstVideo[field] === 'object' 
                    ? util.inspect(firstVideo[field], { depth: 2, colors: true })
                    : firstVideo[field]}`);
            }
        });

        console.log('\n📌 Cover/Thumbnail URLs:');
        const coverFields = [
            'coverUrl',
            'covers',
            'thumbnail',
            'thumbnailUrl',
            'cover',
            'dynamicCover',
            'originCover'
        ];

        coverFields.forEach(field => {
            if (firstVideo[field]) {
                console.log(`   - ${field}: ${typeof firstVideo[field] === 'object' 
                    ? util.inspect(firstVideo[field], { depth: 2, colors: true })
                    : firstVideo[field]}`);
            }
        });

        console.log('\n📌 Video Metadata:');
        const metaFields = [
            'duration',
            'width',
            'height',
            'format',
            'bitrate',
            'definition',
            'ratio',
            'videoMeta'
        ];

        metaFields.forEach(field => {
            if (firstVideo[field] !== undefined) {
                console.log(`   - ${field}: ${typeof firstVideo[field] === 'object' 
                    ? util.inspect(firstVideo[field], { depth: 2, colors: true })
                    : firstVideo[field]}`);
            }
        });

        // List all top-level keys to see what's available
        console.log('\n📋 All Top-Level Fields:');
        Object.keys(firstVideo).forEach(key => {
            const value = firstVideo[key];
            const valueType = Array.isArray(value) ? 'array' : typeof value;
            console.log(`   - ${key} (${valueType})`);
        });

        // If we have more videos, show a summary of download URLs
        if (analysisResult.allVideosAnalyzed.length > 1) {
            console.log('\n========================================');
            console.log('🎬 ALL VIDEOS - DOWNLOAD URL SUMMARY');
            console.log('========================================\n');

            analysisResult.allVideosAnalyzed.slice(0, 5).forEach((video, index) => {
                console.log(`Video ${index + 1} (Rank ${video.rank}):`);
                console.log(`   - ID: ${video.id}`);
                console.log(`   - Views: ${video.views.toLocaleString()}`);
                console.log(`   - Download URL: ${video.downloadUrl || 'NOT FOUND'}`);
                console.log(`   - Web URL: ${video.url}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nFull error details:');
        console.error(error);
    }

    console.log('\n========================================');
    console.log('✅ Debug script completed');
    console.log('========================================');
}

// Run the debug script
debugApifyVideoStructure()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });