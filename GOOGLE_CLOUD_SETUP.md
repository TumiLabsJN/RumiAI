# Google Cloud Setup for RumiAI

This document provides comprehensive instructions for setting up Google Cloud authentication for the RumiAI TikTok analyzer.

## Overview

RumiAI uses **Application Default Credentials (ADC)** with **Workload Identity Federation (WIF)** for secure, CLI-free authentication to Google Cloud services.

## ⚠️ Important: No gcloud CLI Dependencies

This application **DOES NOT** require the `gcloud` CLI to be installed and **NEVER** executes gcloud commands. All authentication is handled through:
- Google Cloud Node.js SDKs
- Application Default Credentials (ADC)
- WIF JSON credential files

## Setup Instructions

### 1. Local Development Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Configure your credentials:**
   ```bash
   # Edit .env file
   GOOGLE_APPLICATION_CREDENTIALS=./wif-credential.json
   GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name
   ```

3. **Place your WIF credential file:**
   - Obtain your WIF JSON credential file from Google Cloud Console
   - Save it as `wif-credential.json` in the project root
   - Or use any path and update the `GOOGLE_APPLICATION_CREDENTIALS` variable

4. **Validate your setup:**
   ```bash
   npm run validate
   ```

### 2. Docker Environment Setup

The Docker environment is pre-configured to use WIF credentials:

```dockerfile
# Dockerfile already includes:
ENV GOOGLE_APPLICATION_CREDENTIALS="/app/wif-credential.json"
COPY wif-credential-docker.json /app/wif-credential.json
```

### 3. Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to WIF JSON file | `./wif-credential.json` |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | GCS bucket name | `your-bucket-name` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLOUD_PROJECT_ID` | GCP Project ID | Auto-detected from credentials |
| `APIFY_TOKEN` | Apify API token | None |
| `PORT` | Server port | 3001 |

## Common Issues and Solutions

### ❌ ENOENT Error: "gcloud does not exist"

**Problem:** Environment variable is set to `gcloud` instead of a file path.

**Solution:**
```bash
# Wrong:
GOOGLE_APPLICATION_CREDENTIALS=gcloud

# Correct:
GOOGLE_APPLICATION_CREDENTIALS=./wif-credential.json
```

### ❌ File Not Found Error

**Problem:** Credential file path is incorrect or file doesn't exist.

**Solutions:**
1. Check file exists: `ls -la wif-credential.json`
2. Use absolute path: `GOOGLE_APPLICATION_CREDENTIALS=/full/path/to/wif-credential.json`
3. Verify file permissions: `chmod 644 wif-credential.json`

### ❌ Authentication Error (401/403)

**Problem:** Invalid credentials or insufficient permissions.

**Solutions:**
1. Verify WIF JSON file is valid
2. Check bucket permissions in Google Cloud Console
3. Ensure service account has required roles:
   - `Storage Admin` or `Storage Object Admin`
   - `Video Intelligence API User` (for video analysis)

## Testing Your Setup

### 1. Run the Validation Script
```bash
npm run validate
```

### 2. Start with Validation
```bash
npm run start:safe
```

### 3. Manual Testing
```bash
# Test credential validation
node -e "
const CredentialValidator = require('./server/utils/credentialValidator');
CredentialValidator.validateCredentials();
console.log('✅ Credentials are valid!');
"
```

## Architecture

### Authentication Flow
1. Application reads `GOOGLE_APPLICATION_CREDENTIALS` environment variable
2. `CredentialValidator` validates the path and file accessibility
3. Google Cloud SDKs automatically use ADC to authenticate
4. No manual token management or CLI commands required

### Upload Process
1. **File Preparation:** Local video file is prepared for upload
2. **SDK Upload:** Uses `@google-cloud/storage` SDK's `bucket.upload()` method
3. **Features:**
   - Resumable uploads for large files
   - CRC32C data integrity validation
   - Comprehensive metadata tagging
   - Detailed error handling and logging

### Security Features
- **No hardcoded credentials:** All credentials loaded from environment
- **Path validation:** Prevents CLI command injection
- **File accessibility checks:** Validates credentials file before use
- **Comprehensive error handling:** Clear error messages for troubleshooting

## Troubleshooting

### Enable Debug Logging
```bash
export DEBUG=gcs:*
npm start
```

### Check Credential File Contents
```bash
# Verify JSON structure (without exposing secrets)
node -e "
const fs = require('fs');
const creds = JSON.parse(fs.readFileSync('./wif-credential.json'));
console.log('Type:', creds.type);
console.log('Universe Domain:', creds.universe_domain);
"
```

### Verify Bucket Access
```bash
# Run validation to test bucket access
npm run validate
```

## Production Deployment

### Google Cloud Run / GKE
- Use Workload Identity for automatic credential injection
- No credential files needed in production
- Set `GOOGLE_CLOUD_STORAGE_BUCKET` environment variable

### Other Platforms
- Include WIF JSON file in deployment
- Set `GOOGLE_APPLICATION_CREDENTIALS` to file path
- Ensure file permissions are correct (644)

## Support

If you encounter issues:

1. Run `npm run validate` to diagnose problems
2. Check the `GOOGLE_CLOUD_SETUP.md` troubleshooting section
3. Verify your WIF credentials in Google Cloud Console
4. Ensure all required environment variables are set

For security concerns, never commit credential files to version control.