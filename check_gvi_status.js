#!/usr/bin/env node

/**
 * Check GVI analysis status
 */

const fs = require('fs').promises;
const path = require('path');

async function checkStatus(videoId) {
    const statusPath = `downloads/analysis/${videoId}/gvi_status.json`;
    const resultsPath = `downloads/analysis/${videoId}/google_video_intelligence.json`;
    
    try {
        // Check if status file exists
        const status = JSON.parse(await fs.readFile(statusPath, 'utf8'));
        
        console.log(`📊 GVI Status for ${videoId}`);
        console.log(`   Status: ${status.status}`);
        console.log(`   Started: ${status.startTime}`);
        
        if (status.status === 'completed') {
            console.log(`   ✅ Completed: ${status.completedTime}`);
            
            // Check results
            try {
                const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
                console.log(`\n📊 Analysis Results:`);
                console.log(`   Objects: ${results.objectAnnotations?.length || 0}`);
                console.log(`   Text: ${results.textAnnotations?.length || 0}`);
                console.log(`   Speech: ${results.speechTranscriptions?.length || 0}`);
                console.log(`   Shots: ${results.shotAnnotations?.length || 0}`);
                console.log(`   Persons: ${results.personAnnotations?.length || 0}`);
            } catch (err) {
                console.log(`   ⚠️  Results file not found`);
            }
        } else if (status.status === 'failed') {
            console.log(`   ❌ Failed: ${status.error}`);
        } else {
            console.log(`   ⏳ In progress...`);
            if (status.operationName) {
                console.log(`   Operation: ${status.operationName}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ No GVI analysis found for ${videoId}`);
        console.log(`   Run: node start_gvi_async.js ${videoId}`);
    }
}

// Run if called directly
if (require.main === module) {
    const videoId = process.argv[2] || 'latstrisomeprotein_7197152431958986026';
    checkStatus(videoId);
}

module.exports = { checkStatus };