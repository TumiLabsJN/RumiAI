require('dotenv').config();

console.log('🔧 Environment Variables Check:');
console.log('APIFY_TOKEN exists:', !!process.env.APIFY_TOKEN);
console.log('APIFY_TOKEN length:', process.env.APIFY_TOKEN ? process.env.APIFY_TOKEN.length : 0);
console.log('APIFY_TOKEN preview:', process.env.APIFY_TOKEN ? process.env.APIFY_TOKEN.substring(0, 15) + '...' : 'NOT SET');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);