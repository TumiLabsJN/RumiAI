const { ApifyClient } = require('apify-client');
require('dotenv').config();

async function debugApifyRaw() {
    console.log('Starting Apify raw response debug...\n');
    
    // Initialize the ApifyClient with your API token
    const client = new ApifyClient({
        token: process.env.APIFY_TOKEN,
    });

    try {
        // Prepare the Actor input
        const input = {
            profiles: ['cristiano'],
            resultsPerPage: 1, // Just get 1 video for debugging
            shouldDownloadVideos: true,
            shouldDownloadCovers: false,
            shouldDownloadSubtitles: false,
            shouldDownloadSlideshowImages: false,
        };

        console.log('Running TikTok scraper with input:', JSON.stringify(input, null, 2));
        console.log('\n');

        // Run the Actor and wait for it to finish
        const run = await client.actor("clockworks/tiktok-scraper").call(input);

        console.log('Run finished. Getting dataset items...\n');

        // Fetch the results from the dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (items.length === 0) {
            console.log('No items returned from the scraper.');
            return;
        }

        console.log(`Got ${items.length} item(s). Analyzing first item structure...\n`);
        console.log('='.repeat(80));
        console.log('COMPLETE RAW RESPONSE STRUCTURE:');
        console.log('='.repeat(80));
        console.log(JSON.stringify(items[0], null, 2));
        console.log('\n');

        // Now let's search for potential video URL fields
        console.log('='.repeat(80));
        console.log('SEARCHING FOR VIDEO URL FIELDS:');
        console.log('='.repeat(80));
        
        const firstItem = items[0];
        const videoUrlFields = [];
        
        // Recursive function to find all fields containing 'video', 'download', 'url', 'addr', or 'link'
        function findVideoFields(obj, path = '') {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                const lowerKey = key.toLowerCase();
                
                if (lowerKey.includes('video') || 
                    lowerKey.includes('download') || 
                    lowerKey.includes('url') || 
                    lowerKey.includes('addr') || 
                    lowerKey.includes('link') ||
                    lowerKey.includes('play')) {
                    
                    if (typeof value === 'string' && (value.includes('http') || value.includes('//'))) {
                        videoUrlFields.push({ path: currentPath, value: value });
                    } else if (typeof value === 'object' && value !== null) {
                        videoUrlFields.push({ path: currentPath, value: JSON.stringify(value, null, 2) });
                    }
                }
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    findVideoFields(value, currentPath);
                } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                    value.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            findVideoFields(item, `${currentPath}[${index}]`);
                        }
                    });
                }
            }
        }
        
        findVideoFields(firstItem);
        
        console.log('\nFound potential video URL fields:');
        videoUrlFields.forEach(field => {
            console.log(`\nPath: ${field.path}`);
            console.log(`Value: ${field.value}`);
            console.log('-'.repeat(40));
        });

        // Also check for specific known TikTok API fields
        console.log('\n\n' + '='.repeat(80));
        console.log('CHECKING SPECIFIC TIKTOK FIELDS:');
        console.log('='.repeat(80));
        
        const checkFields = [
            'video',
            'videoMeta',
            'videoData',
            'videoUrl',
            'videoUrlNoWaterMark',
            'downloadAddr',
            'playAddr',
            'dynamicCover',
            'originCover',
            'reflowCover',
            'videoApiUrlNoWaterMark',
            'videoPlayUrl',
            'videoDownloadUrl'
        ];
        
        checkFields.forEach(field => {
            if (firstItem[field]) {
                console.log(`\n${field}:`, JSON.stringify(firstItem[field], null, 2));
            }
        });

    } catch (error) {
        console.error('Error:', error);
        if (error.message) {
            console.error('Error message:', error.message);
        }
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the debug script
debugApifyRaw().catch(console.error);