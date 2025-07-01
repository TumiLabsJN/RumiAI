#!/usr/bin/env node

/**
 * Check GVI Analysis Results
 */

const path = require('path');
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'wif-credential.json');

const videoIntelligence = require('@google-cloud/video-intelligence');
const fs = require('fs').promises;

async function checkGVIResults() {
    const client = new videoIntelligence.VideoIntelligenceServiceClient();
    
    console.log('📊 Checking GVI Analysis Status');
    console.log('================================\n');
    
    // Find all operation files
    const analysisDir = 'downloads/analysis';
    const videoIds = await fs.readdir(analysisDir);
    
    let completed = 0;
    let inProgress = 0;
    let failed = 0;
    
    for (const videoId of videoIds) {
        const operationPath = path.join(analysisDir, videoId, 'gvi_operation.json');
        const resultsPath = path.join(analysisDir, videoId, 'google_video_intelligence.json');
        
        try {
            // Check if already have results
            try {
                const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
                console.log(`✅ ${videoId}`);
                console.log(`   Status: Completed`);
                console.log(`   Objects: ${results.objectAnnotations?.length || 0}`);
                console.log(`   Text: ${results.textAnnotations?.length || 0}`);
                console.log(`   Speech: ${results.speechTranscriptions?.length || 0}`);
                completed++;
                continue;
            } catch {}
            
            // Check operation status
            const opData = JSON.parse(await fs.readFile(operationPath, 'utf8'));
            
            console.log(`⏳ ${videoId}`);
            console.log(`   Operation: ${opData.operationName}`);
            
            try {
                const [operation] = await client.operationsClient.getOperation({
                    name: opData.operationName
                });
                
                if (operation.done) {
                    if (operation.response) {
                        // Save results
                        const result = videoIntelligence.protos.google.cloud.videointelligence.v1.AnnotateVideoResponse.decode(
                            operation.response.value
                        );
                        
                        const analysisResult = result.annotationResults[0];
                        await fs.writeFile(resultsPath, JSON.stringify(analysisResult, null, 2));
                        
                        console.log(`   Status: Just Completed! ✅`);
                        console.log(`   Objects: ${analysisResult.objectAnnotations?.length || 0}`);
                        console.log(`   Text: ${analysisResult.textAnnotations?.length || 0}`);
                        console.log(`   Speech: ${analysisResult.speechTranscriptions?.length || 0}`);
                        completed++;
                        
                        // Update operation file
                        opData.status = 'completed';
                        opData.completedTime = new Date().toISOString();
                        await fs.writeFile(operationPath, JSON.stringify(opData, null, 2));
                        
                    } else if (operation.error) {
                        console.log(`   Status: Failed ❌`);
                        console.log(`   Error: ${operation.error.message}`);
                        failed++;
                    }
                } else {
                    const elapsed = Math.round((Date.now() - new Date(opData.startTime)) / 1000);
                    console.log(`   Status: In Progress (${elapsed}s)`);
                    console.log(`   Progress: ${operation.metadata?.progress || 0}%`);
                    inProgress++;
                }
            } catch (error) {
                console.log(`   Status: Error checking - ${error.message}`);
                failed++;
            }
            
        } catch {
            // No operation file
        }
        
        console.log('');
    }
    
    console.log('📊 Summary:');
    console.log(`   Completed: ${completed}`);
    console.log(`   In Progress: ${inProgress}`);
    console.log(`   Failed: ${failed}`);
    
    if (inProgress > 0) {
        console.log('\n⏳ Check again in 30 seconds...');
    } else if (completed > 0) {
        console.log('\n✅ All analyses complete!');
        console.log('🚀 Ready to run Claude prompts with full video context');
    }
}

if (require.main === module) {
    checkGVIResults().catch(console.error);
}