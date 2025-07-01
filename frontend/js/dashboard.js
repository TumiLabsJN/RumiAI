// Dashboard JavaScript - Loads and displays all analyzed videos

async function loadVideoList() {
    try {
        // For now, we'll hardcode the videos we know about
        // In production, this would come from an API
        const videos = [
            {
                id: 'nutsnmore_7462841470299606318',
                username: 'nutsnmore',
                videoId: '7462841470299606318',
                title: 'Healthy Banana Sundae Recipe',
                views: 1138,
                likes: 25,
                comments: 0,
                shares: 0,
                duration: 9,
                analysisComplete: true,
                promptsCompleted: 16
            },
            {
                id: 'healthandwellnessliving_7514038807142894879',
                username: 'healthandwellnessliving',
                videoId: '7514038807142894879',
                title: 'Health and Wellness Tips',
                views: 2783,
                likes: 40,
                comments: 0,
                shares: 0,
                duration: 29,
                analysisComplete: true,
                promptsCompleted: 15
            },
            {
                id: 'latstrisomeprotein_7197152431958986026',
                username: 'latstrisomeprotein',
                videoId: '7197152431958986026',
                title: 'Protein Recipe',
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0,
                duration: 0,
                analysisComplete: true,
                promptsCompleted: 0
            },
            {
                id: 'cristiano_7515739984452701457',
                username: 'cristiano',
                videoId: '7515739984452701457',
                title: 'Cristiano Ronaldo Video',
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0,
                duration: 13,
                analysisComplete: true,
                promptsCompleted: 16
            }
        ];

        displayVideos(videos);
    } catch (error) {
        console.error('Error loading videos:', error);
        document.getElementById('videoGrid').innerHTML = '<p>Error loading videos</p>';
    }
}

function displayVideos(videos) {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '';

    videos.forEach(video => {
        const card = createVideoCard(video);
        grid.appendChild(card);
    });
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => window.location.href = `video-analysis.html?id=${video.id}`;

    const engagementRate = video.views > 0 ? ((video.likes / video.views) * 100).toFixed(2) : 0;
    const completionRate = (video.promptsCompleted / 15 * 100).toFixed(0);

    card.innerHTML = `
        <h3>@${video.username}</h3>
        <p>${video.title}</p>
        
        <div class="video-stats">
            <div class="stat">
                <span class="stat-label">Views</span>
                <span class="stat-value">${formatNumber(video.views)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Likes</span>
                <span class="stat-value">${formatNumber(video.likes)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Engagement</span>
                <span class="stat-value">${engagementRate}%</span>
            </div>
            <div class="stat">
                <span class="stat-label">Duration</span>
                <span class="stat-value">${video.duration}s</span>
            </div>
        </div>
        
        <div class="analysis-status">
            <p><strong>Analysis Progress:</strong> ${video.promptsCompleted}/15 prompts</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${completionRate}%"></div>
            </div>
        </div>
    `;

    return card;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Load videos when page loads
document.addEventListener('DOMContentLoaded', loadVideoList);