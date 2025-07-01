#!/usr/bin/env node

/**
 * Pre-startup validation script for RumiAI
 * Validates Google Cloud configuration before running the main application
 * Prevents runtime errors related to misconfigured credentials
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CredentialValidator = require('./server/utils/credentialValidator');

async function validateSetup() {
    console.log('🔍 RumiAI Setup Validation\n');
    
    try {
        // Validate Google Cloud credentials
        console.log('📋 Checking Google Cloud configuration...');
        const result = CredentialValidator.validateCredentials(true);
        
        // Check required environment variables
        const requiredEnvVars = [
            'GOOGLE_CLOUD_STORAGE_BUCKET',
            'GOOGLE_APPLICATION_CREDENTIALS'
        ];
        
        const optionalEnvVars = [
            'APIFY_TOKEN',
            'GOOGLE_CLOUD_PROJECT_ID',
            'PORT'
        ];
        
        console.log('\n📋 Environment Variables Check:');
        
        // Check required variables
        let missingRequired = [];
        requiredEnvVars.forEach(varName => {
            const value = process.env[varName];
            if (value) {
                console.log(`✅ ${varName}: ${value.length > 50 ? value.substring(0, 47) + '...' : value}`);
            } else {
                console.log(`❌ ${varName}: NOT SET`);
                missingRequired.push(varName);
            }
        });
        
        // Check optional variables
        console.log('\n📋 Optional Environment Variables:');
        optionalEnvVars.forEach(varName => {
            const value = process.env[varName];
            if (value) {
                console.log(`✅ ${varName}: ${value.length > 50 ? value.substring(0, 47) + '...' : value}`);
            } else {
                console.log(`⚠️  ${varName}: NOT SET (optional)`);
            }
        });
        
        if (missingRequired.length > 0) {
            console.log(`\n❌ Missing required environment variables: ${missingRequired.join(', ')}`);
            CredentialValidator.logSetupInstructions();
            process.exit(1);
        }
        
        // Test Google Cloud Storage access
        console.log('\n🧪 Testing Google Cloud Storage access...');
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage();
        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
        const bucket = storage.bucket(bucketName);
        
        try {
            const [exists] = await bucket.exists();
            if (exists) {
                console.log(`✅ Google Cloud Storage bucket '${bucketName}' is accessible`);
            } else {
                console.log(`⚠️  Google Cloud Storage bucket '${bucketName}' does not exist or is not accessible`);
                console.log('💡 Make sure the bucket exists and your credentials have access');
            }
        } catch (error) {
            console.log(`❌ Failed to access Google Cloud Storage: ${error.message}`);
            console.log('💡 Check your credentials and bucket permissions');
        }
        
        console.log('\n✅ Setup validation completed successfully!');
        console.log('🚀 You can now run the RumiAI application\n');
        
    } catch (error) {
        console.error(`\n❌ Setup validation failed: ${error.message}`);
        CredentialValidator.logSetupInstructions();
        process.exit(1);
    }
}

// Run validation if this script is executed directly
if (require.main === module) {
    validateSetup().catch(error => {
        console.error('💥 Validation script failed:', error.message);
        process.exit(1);
    });
}

module.exports = { validateSetup };