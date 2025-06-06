const express = require('express');
const path = require('path');

console.log('🧪 Testing minimal server...');

const app = express();
const PORT = 3002;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.send('<h1>✅ Tumi Labs TikTok Analyzer - Server Test</h1><p>Server is working!</p>');
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', port: PORT, timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Test server running on port ${PORT}`);
    console.log(`🔗 Visit: http://localhost:${PORT}`);
    console.log(`🩺 Health: http://localhost:${PORT}/health`);
});

server.on('error', (error) => {
    console.error('❌ Server error:', error);
});