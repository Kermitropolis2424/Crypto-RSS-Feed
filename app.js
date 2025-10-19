// RSS Feed Configuration
const RSS_FEEDS = [
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', color: '#F7931A' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', color: '#00D4AA' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/', color: '#6B46C1' },
    { name: 'Bitcoin.com', url: 'https://news.bitcoin.com/feed/', color: '#4CAF50' },
    { name: 'NewsBTC', url: 'https://www.newsbtc.com/feed/', color: '#FF9800' },
    { name: 'CryptoPotato', url: 'https://cryptopotato.com/feed/', color: '#E91E63' },
    { name: 'U.Today', url: 'https://u.today/rss', color: '#2196F3' }
];

// Application State
let allArticles = [];
let filteredArticles = [];
let currentFilter = 'all';
let currentSearchTerm = '';
let updateInterval;
let isLoading = false;

// DOM Elements
const newsGrid = document.getElementById('news-grid');
const loadingContainer = document.getElementById('loading-container');
const articleCountEl = document.getElementById('article-count');
const lastUpdatedEl = document.getElementById('last-updated');
const searchInput = document.getElementById('search-input');
const filterButtons = document.querySelectorAll('.filter-btn');
const updateNotification = document.getElementById('update-notification');

// Utility Functions
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function truncateText(text, maxLength = 200) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function generateUniqueId(article) {
    return btoa(encodeURIComponent(article.title + article.link)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
}

function cleanHtmlText(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    return div.textContent || div.innerText || '';
}

// RSS Parsing Functions
async function fetchRSSFeed(feed) {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
    
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('XML parsing error');
        }
        
        return parseRSSItems(xmlDoc, feed);
    } catch (error) {
        console.warn(`Failed to fetch ${feed.name}:`, error);
        return [];
    }
}

function parseRSSItems(xmlDoc, feed) {
    const items = xmlDoc.querySelectorAll('item');
    const articles = [];
    
    items.forEach((item, index) => {
        if (index >= 20) return; // Limit to 20 articles per feed
        
        const title = item.querySelector('title')?.textContent?.trim();
        const link = item.querySelector('link')?.textContent?.trim();
        const description = item.querySelector('description')?.textContent?.trim();
        const pubDate = item.querySelector('pubDate')?.textContent?.trim();
        
        if (title && link) {
            const article = {
                id: generateUniqueId({ title, link }),
                title: cleanHtmlText(title),
                link: link,
                description: truncateText(cleanHtmlText(description || '')),
                pubDate: pubDate ? new Date(pubDate) : new Date(),
                source: feed.name,
                sourceColor: feed.color
            };
            
            articles.push(article);
        }
    });
    
    return articles;
}

// Article Management
function addNewArticles(newArticles) {
    let addedCount = 0;
    
    newArticles.forEach(article => {
        const existingIndex = allArticles.findIndex(existing => 
            existing.id === article.id || existing.link === article.link
        );
        
        if (existingIndex === -1) {
            allArticles.push(article);
            addedCount++;
        }
    });
    
    // Sort by publication date (newest first)
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    
    return addedCount;
}

function filterArticles() {
    filteredArticles = allArticles.filter(article => {
        const matchesSource = currentFilter === 'all' || article.source === currentFilter;
        const matchesSearch = !currentSearchTerm || 
            article.title.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
            article.description.toLowerCase().includes(currentSearchTerm.toLowerCase());
        
        return matchesSource && matchesSearch;
    });
}

// UI Rendering
function createArticleCard(article) {
    const card = document.createElement('div');
    card.className = 'article-card';
    card.style.setProperty('--source-color', article.sourceColor);
    
    card.innerHTML = `
        <div class="article-source" style="background-color: ${article.sourceColor}">
            ${article.source}
        </div>
        <a href="${article.link}" target="_blank" class="article-title">
            ${article.title}
        </a>
        <p class="article-description">
            ${article.description}
        </p>
        <div class="article-meta">
            <span class="article-date">${formatRelativeTime(article.pubDate)}</span>
            <a href="${article.link}" target="_blank" class="article-link">Read More →</a>
        </div>
    `;
    
    return card;
}

function renderArticles() {
    filterArticles();
    
    if (filteredArticles.length === 0) {
        newsGrid.innerHTML = `
            <div class="no-articles" style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 20px;
                color: var(--text-secondary);
                font-size: 1.2rem;
            ">
                ${currentSearchTerm ? 'No articles found matching your search.' : 'No articles available.'}
            </div>
        `;
        return;
    }
    
    newsGrid.innerHTML = '';
    
    filteredArticles.forEach((article, index) => {
        const card = createArticleCard(article);
        card.style.animationDelay = `${index * 0.05}s`;
        newsGrid.appendChild(card);
    });
    
    updateStats();
}

function updateStats() {
    articleCountEl.textContent = allArticles.length;
    lastUpdatedEl.textContent = new Date().toLocaleTimeString();
}

function showUpdateNotification(newCount) {
    if (newCount > 0) {
        const notification = updateNotification;
        notification.querySelector('.notification-text').textContent = 
            `${newCount} new article${newCount !== 1 ? 's' : ''} loaded!`;
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

function showLoading() {
    loadingContainer.style.display = 'flex';
    newsGrid.style.display = 'none';
}

function hideLoading() {
    loadingContainer.style.display = 'none';
    newsGrid.style.display = 'grid';
}

// Data Fetching
async function fetchAllFeeds(showNotification = false) {
    if (isLoading) return;
    
    isLoading = true;
    
    if (allArticles.length === 0) {
        showLoading();
    }
    
    try {
        const feedPromises = RSS_FEEDS.map(feed => fetchRSSFeed(feed));
        const feedResults = await Promise.allSettled(feedPromises);
        
        let newArticles = [];
        feedResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                newArticles = newArticles.concat(result.value);
            } else {
                console.warn(`Feed ${RSS_FEEDS[index].name} failed to load:`, result.reason);
            }
        });
        
        const addedCount = addNewArticles(newArticles);
        
        if (showNotification && addedCount > 0) {
            showUpdateNotification(addedCount);
        }
        
        renderArticles();
        
    } catch (error) {
        console.error('Error fetching feeds:', error);
        if (allArticles.length === 0) {
            newsGrid.innerHTML = `
                <div class="error-message" style="
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--text-secondary);
                ">
                    <h3>Unable to load news feeds</h3>
                    <p>Please check your internet connection and try again.</p>
                </div>
            `;
        }
    } finally {
        isLoading = false;
        hideLoading();
    }
}

// Event Listeners
function setupEventListeners() {
    // Search functionality
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim();
        renderArticles();
    });
    
    // Filter functionality
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update current filter
            currentFilter = button.dataset.source;
            renderArticles();
        });
    });
    
    // Auto-refresh every 5 minutes
    updateInterval = setInterval(() => {
        fetchAllFeeds(true);
    }, 300000); // 5 minutes
}

// Initialization
async function initializeApp() {
    console.log('🚀 Initializing Crypto News Feed...');
    
    setupEventListeners();
    
    // Initial load
    await fetchAllFeeds();
    
    console.log('✅ Crypto News Feed initialized successfully!');
    console.log(`📰 Loaded ${allArticles.length} articles from ${RSS_FEEDS.length} sources`);
}

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});