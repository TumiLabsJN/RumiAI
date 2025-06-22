const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Google Cloud credentials validator
 * Prevents ENOENT errors by validating GOOGLE_APPLICATION_CREDENTIALS
 */
class CredentialValidator {
    /**
     * Validate Google Cloud credentials configuration
     * @param {boolean} throwOnError - Whether to throw error or return validation result
     * @returns {Object} Validation result with success status and resolved path
     */
    static validateCredentials(throwOnError = true) {
        const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        
        // Check if environment variable is set
        if (!credPath) {
            const error = 'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set';
            if (throwOnError) {
                console.error('❌ ' + error);
                console.error('💡 Please set it to the path of your WIF JSON file');
                console.error('💡 Example: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/wif-credential.json');
                throw new Error(error);
            }
            return { success: false, error, resolvedPath: null };
        }
        
        // Validate that the credential path is not a gcloud command
        if (credPath === 'gcloud' || 
            credPath.includes('gcloud storage') || 
            credPath.startsWith('gcloud ') ||
            credPath.includes('gcloud auth') ||
            credPath.endsWith('gcloud')) {
            
            const error = 'GOOGLE_APPLICATION_CREDENTIALS is set to a gcloud command instead of a file path';
            if (throwOnError) {
                console.error('❌ ' + error);
                console.error(`💡 Current value: "${credPath}"`);
                console.error('💡 This should be a path to a JSON credentials file, not a gcloud command');
                console.error('💡 Example: export GOOGLE_APPLICATION_CREDENTIALS=./wif-credential.json');
                throw new Error('GOOGLE_APPLICATION_CREDENTIALS must be a file path, not a gcloud command');
            }
            return { success: false, error, resolvedPath: null };
        }
        
        // Resolve relative paths from the current working directory
        const resolvedPath = path.resolve(credPath);
        
        // Check if the credentials file exists and is readable
        try {
            fs.accessSync(resolvedPath, fs.constants.R_OK);
            
            // Additional validation: check for WIF file with invalid gcloud reference
            try {
                const credContent = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
                if (credContent.credential_source && 
                    credContent.credential_source.file === 'gcloud') {
                    const errorMsg = 'WIF credential file contains invalid "file": "gcloud" configuration';
                    if (throwOnError) {
                        console.error(`❌ ${errorMsg}`);
                        console.error(`💡 The credential file at ${resolvedPath} is misconfigured`);
                        console.error(`💡 The "file": "gcloud" should point to an actual token file, not the string "gcloud"`);
                        console.error(`💡 This WIF configuration requires gcloud CLI, which conflicts with our goal`);
                        console.error(`💡 Please use a standard service account JSON file instead`);
                        console.error(`💡 Or reconfigure the WIF file to use executable source type`);
                        throw new Error(errorMsg);
                    }
                    return { success: false, error: errorMsg, resolvedPath };
                }
            } catch (jsonError) {
                // If it's not JSON or has other issues, continue with original validation
                if (jsonError.message.includes('WIF credential file')) {
                    throw jsonError; // Re-throw our custom error
                }
                // For other JSON errors, just log a warning and continue
                console.warn(`⚠️  Could not parse credential file as JSON: ${jsonError.message}`);
            }
            
            console.log(`✅ Google Cloud credentials validated: ${resolvedPath}`);
            return { success: true, resolvedPath, originalPath: credPath };
        } catch (error) {
            const errorMsg = `Cannot access credentials file: ${resolvedPath}`;
            if (throwOnError) {
                console.error(`❌ ${errorMsg}`);
                console.error(`💡 Original path: ${credPath}`);
                console.error(`💡 Make sure the file exists and is readable`);
                console.error(`💡 Error: ${error.message}`);
                throw new Error(errorMsg);
            }
            return { success: false, error: errorMsg, resolvedPath };
        }
    }
    
    /**
     * Check if credentials are valid without throwing
     * @returns {boolean} True if credentials are valid
     */
    static isValidCredentials() {
        const result = this.validateCredentials(false);
        return result.success;
    }
    
    /**
     * Get the resolved credential path
     * @returns {string|null} Resolved path or null if invalid
     */
    static getResolvedCredentialPath() {
        const result = this.validateCredentials(false);
        return result.success ? result.resolvedPath : null;
    }
    
    /**
     * Log environment setup recommendations
     */
    static logSetupInstructions() {
        console.log('\n📋 Google Cloud Credentials Setup:');
        console.log('  Local Development:');
        console.log('    export GOOGLE_APPLICATION_CREDENTIALS=./wif-credential.json');
        console.log('  Docker Environment:');
        console.log('    GOOGLE_APPLICATION_CREDENTIALS=/app/wif-credential.json');
        console.log('  Environment Variables:');
        console.log('    GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name');
        console.log('    GOOGLE_CLOUD_PROJECT_ID=your-project-id\n');
    }
}

module.exports = CredentialValidator;