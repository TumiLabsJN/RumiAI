#!/usr/bin/env node

const { Storage } = require('@google-cloud/storage');
const path = require('path');

async function testGCS() {
    console.log('🔍 Testing Google Cloud Storage access...\n');
    
    // Set credentials
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'wif-credential.json');
    console.log(`📄 Credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    
    try {
        // Initialize storage
        const storage = new Storage();
        const bucketName = 'tiktok-video-analysis-jorge';
        const bucket = storage.bucket(bucketName);
        
        console.log(`🪣 Bucket: ${bucketName}`);
        
        // Test 1: Check if bucket exists
        console.log('\n📋 Test 1: Checking bucket access...');
        const [exists] = await bucket.exists();
        console.log(`   Bucket exists: ${exists ? '✅ Yes' : '❌ No'}`);
        
        if (!exists) {
            console.log('❌ Bucket does not exist or no access');
            return;
        }
        
        // Test 2: List files
        console.log('\n📋 Test 2: Listing files in bucket...');
        const [files] = await bucket.getFiles({ maxResults: 5 });
        console.log(`   Files found: ${files.length}`);
        files.forEach(file => {
            console.log(`   - ${file.name}`);
        });
        
        // Test 3: Try a small upload
        console.log('\n📋 Test 3: Testing upload...');
        const testContent = 'Test upload from RumiAI';
        const testFileName = `test/test_${Date.now()}.txt`;
        
        const file = bucket.file(testFileName);
        await file.save(testContent);
        console.log(`   ✅ Test file uploaded: ${testFileName}`);
        
        // Test 4: Delete test file
        await file.delete();
        console.log(`   ✅ Test file deleted`);
        
        console.log('\n✅ All GCS tests passed!');
        
    } catch (error) {
        console.error('\n❌ GCS Error:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', error.errors?.[0]?.message);
        
        if (error.code === 403) {
            console.log('\n🔑 Permission issue. Check:');
            console.log('   1. Service account has Storage Admin role');
            console.log('   2. Bucket exists and is accessible');
            console.log('   3. Credentials are valid');
        }
    }
}

testGCS().catch(console.error);