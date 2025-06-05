class TikTokCompetitorAnalyzer {
    constructor() {
        this.competitors = [];
        this.init();
    }

    init() {
        this.loadCompetitors();
        this.setupEventListeners();
        this.initChart();
    }

    setupEventListeners() {
        const form = document.getElementById('add-competitor-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCompetitor();
        });
    }

    addCompetitor() {
        const nameInput = document.getElementById('competitor-name');
        const urlInput = document.getElementById('competitor-url');
        
        const competitor = {
            id: Date.now(),
            name: nameInput.value.trim(),
            url: urlInput.value.trim(),
            followers: Math.floor(Math.random() * 1000000) + 10000,
            engagement: (Math.random() * 10 + 1).toFixed(2),
            addedDate: new Date().toLocaleDateString()
        };

        this.competitors.push(competitor);
        this.saveCompetitors();
        this.renderCompetitors();
        this.updateChart();
        
        nameInput.value = '';
        urlInput.value = '';
    }

    loadCompetitors() {
        const saved = localStorage.getItem('tiktok-competitors');
        if (saved) {
            this.competitors = JSON.parse(saved);
        } else {
            this.competitors = [
                {
                    id: 1,
                    name: "Sample Competitor",
                    url: "https://tiktok.com/@sample",
                    followers: 500000,
                    engagement: "8.5",
                    addedDate: new Date().toLocaleDateString()
                }
            ];
        }
        this.renderCompetitors();
    }

    saveCompetitors() {
        localStorage.setItem('tiktok-competitors', JSON.stringify(this.competitors));
    }

    renderCompetitors() {
        const container = document.getElementById('competitor-list');
        
        if (this.competitors.length === 0) {
            container.innerHTML = '<p>No competitors added yet.</p>';
            return;
        }

        container.innerHTML = this.competitors.map(competitor => `
            <div class="competitor-item" style="padding: 1rem; margin: 0.5rem 0; background: #f9f9f9; border-radius: 5px;">
                <h3>${competitor.name}</h3>
                <p><strong>Followers:</strong> ${competitor.followers.toLocaleString()}</p>
                <p><strong>Engagement Rate:</strong> ${competitor.engagement}%</p>
                <p><strong>Added:</strong> ${competitor.addedDate}</p>
                <a href="${competitor.url}" target="_blank" style="color: #ff0050;">View Profile</a>
                <button onclick="analyzer.removeCompetitor(${competitor.id})" style="margin-left: 1rem; background: #ff4444;">Remove</button>
            </div>
        `).join('');
    }

    removeCompetitor(id) {
        this.competitors = this.competitors.filter(c => c.id !== id);
        this.saveCompetitors();
        this.renderCompetitors();
        this.updateChart();
    }

    initChart() {
        const ctx = document.getElementById('analytics-chart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.competitors.map(c => c.name),
                datasets: [{
                    label: 'Followers',
                    data: this.competitors.map(c => c.followers),
                    backgroundColor: 'rgba(255, 0, 80, 0.6)',
                    borderColor: 'rgba(255, 0, 80, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    updateChart() {
        if (this.chart) {
            this.chart.data.labels = this.competitors.map(c => c.name);
            this.chart.data.datasets[0].data = this.competitors.map(c => c.followers);
            this.chart.update();
        }
    }
}

// Initialize the application
const analyzer = new TikTokCompetitorAnalyzer();