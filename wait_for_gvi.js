#!/usr/bin/env node

/**
 * Wait for Google Video Intelligence analysis to complete
 * Polls until completion or timeout
 */

const videoIntelligence = require('@google-cloud/video-intelligence').v1;
const fs = require('fs').promises;
const path = require('path');

// Initialize client
const client = new videoIntelligence.VideoIntelligenceServiceClient();

async function waitForGVIAnalysis(videoId, maxWaitMinutes = 10) {
    console.log(`⏳ Waiting for GVI analysis of ${videoId}...`);
    
    // Check for operation file
    const operationPath = path.join('downloads', 'analysis', videoId, 'gvi_operation.json');
    
    try {
        const operationData = JSON.parse(await fs.readFile(operationPath, 'utf8'));
        const operationName = operationData.operationName;
        
        if (!operationName) {
            console.log('❌ No operation name found');
            return false;
        }
        
        // Poll for completion
        const startTime = Date.now();
        const maxWaitMs = maxWaitMinutes * 60 * 1000;
        let attempts = 0;
        
        while (Date.now() - startTime < maxWaitMs) {
            attempts++;
            
            try {
                const [operation] = await client.operationsClient.getOperation({
                    name: operationName
                });
                
                if (operation.done) {
                    console.log(`✅ Analysis completed after ${Math.round((Date.now() - startTime) / 1000)}s`);
                    
                    if (operation.error) {
                        console.error('❌ Analysis failed:', operation.error.message);
                        return false;
                    }
                    
                    // Save results
                    const annotateResults = videoIntelligence.protos.google.cloud.videointelligence.v1.AnnotateVideoResponse.decode(
                        operation.response.value
                    );
                    
                    const results = annotateResults.annotationResults[0];
                    const outputPath = path.join('downloads', 'analysis', videoId, 'google_video_intelligence.json');
                    
                    // Count detections
                    const stats = {
                        objects: results.objectAnnotations?.length || 0,
                        text: results.textAnnotations?.length || 0,
                        speech: results.speechTranscriptions?.length || 0,
                        scenes: results.shotAnnotations?.length || 0
                    };
                    
                    console.log('📊 Results:');
                    console.log(`   Objects: ${stats.objects}`);
                    console.log(`   Text: ${stats.text}`);
                    console.log(`   Speech: ${stats.speech}`);
                    console.log(`   Scenes: ${stats.scenes}`);
                    
                    // Save full results
                    await fs.writeFile(outputPath, JSON.stringify({
                        ...results,
                        timestamp: new Date().toISOString(),
                        videoId: videoId,
                        stats: stats
                    }, null, 2));
                    
                    console.log(`💾 Saved to: ${outputPath}`);
                    
                    // Update operation file
                    operationData.status = 'completed';
                    operationData.completedTime = new Date().toISOString();
                    await fs.writeFile(operationPath, JSON.stringify(operationData, null, 2));
                    
                    return true;
                } else {
                    // Still processing
                    const progress = operation.metadata?.annotationProgress?.[0]?.progressPercent || 0;
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    
                    process.stdout.write(`\r⏳ Progress: ${progress}% (${elapsed}s elapsed, attempt ${attempts})`);
                    
                    // Dynamic wait time based on video length
                    const waitTime = progress < 50 ? 10000 : 5000; // 10s for first half, 5s for second half
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            } catch (error) {
                console.error(`\n⚠️  Error checking status: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        console.log(`\n⏱️  Timeout after ${maxWaitMinutes} minutes`);
        return false;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function main() {
    const videoId = process.argv[2];
    const maxWaitMinutes = parseInt(process.argv[3]) || 10;
    
    if (!videoId) {
        console.log('Usage: node wait_for_gvi.js <video_id> [max_wait_minutes]');
        console.log('Example: node wait_for_gvi.js nutsnmore_7482131638315388203 15');
        process.exit(1);
    }
    
    const success = await waitForGVIAnalysis(videoId, maxWaitMinutes);
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { waitForGVIAnalysis };