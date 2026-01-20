/**
 * Tweet Hours - Activity Analyzer
 * Frontend JavaScript
 */

// Day names for display
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Chart instances
let hourlyChart = null;
let dailyChart = null;

// Store original UTC data for timezone conversion
let currentData = null;
let currentTimezoneOffset = 0;

// DOM Elements
const searchForm = document.getElementById('search-form');
const usernameInput = document.getElementById('username-input');
const searchBtn = searchForm.querySelector('.search-btn');
const resultsSection = document.getElementById('results-section');
const errorMessage = document.getElementById('error-message');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupChartDefaults();
    detectUserTimezone();
});

function setupEventListeners() {
    // Search form submission
    searchForm.addEventListener('submit', handleSearch);
    
    // Quick search buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            usernameInput.value = btn.dataset.username;
            searchForm.dispatchEvent(new Event('submit'));
        });
    });
    
    // Timezone selector
    const timezoneSelect = document.getElementById('timezone-select');
    if (timezoneSelect) {
        timezoneSelect.addEventListener('change', handleTimezoneChange);
    }
}

function detectUserTimezone() {
    // Get user's local timezone offset in hours
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = -offsetMinutes / 60; // Invert because getTimezoneOffset returns opposite
    
    const timezoneSelect = document.getElementById('timezone-select');
    if (timezoneSelect) {
        // Find closest matching option
        const options = Array.from(timezoneSelect.options);
        const closest = options.reduce((prev, curr) => {
            return Math.abs(parseFloat(curr.value) - offsetHours) < Math.abs(parseFloat(prev.value) - offsetHours) 
                ? curr : prev;
        });
        timezoneSelect.value = closest.value;
        currentTimezoneOffset = parseFloat(closest.value);
    }
}

function handleTimezoneChange(e) {
    currentTimezoneOffset = parseFloat(e.target.value);
    
    if (currentData) {
        // Re-render with new timezone
        renderWithTimezone(currentData, currentTimezoneOffset);
    }
}

function setupChartDefaults() {
    // Set Chart.js defaults for editorial theme
    Chart.defaults.color = '#666666';
    Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.06)';
    Chart.defaults.font.family = "'Inter', sans-serif";
}

async function handleSearch(e, forceDemo = false) {
    e.preventDefault();
    
    const username = usernameInput.value.trim().replace('@', '');
    
    if (!username) {
        showError('Please enter a username');
        return;
    }
    
    // Show loading state with message (scraping takes a bit longer)
    setLoading(true, forceDemo ? 'Loading demo data...' : 'Scraping tweets (this may take 10-20 seconds)...');
    hideError();
    
    try {
        const demoParam = forceDemo ? '?demo=true' : '';
        const response = await fetch(`/api/analyze/${encodeURIComponent(username)}${demoParam}`);
        const data = await response.json();
        
        if (!response.ok) {
            // Handle different error types
            if (response.status === 404) {
                showNotFoundError(username);
                return;
            }
            if (response.status === 504 || (data.detail && data.detail.includes('timed out'))) {
                showTimeoutError(username);
                return;
            }
            throw new Error(data.detail || 'Failed to analyze user');
        }
        
        // Store original data and display with current timezone
        currentData = data;
        displayResults(data);
    } catch (error) {
        showError(error.message);
        resultsSection.classList.add('hidden');
    } finally {
        setLoading(false);
    }
}

function showFreeTierError(username) {
    const errorEl = document.getElementById('error-message');
    errorEl.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <span class="error-icon">🔒</span>
            <div style="margin: 10px 0;">
                <strong>Twitter Free API Limitation</strong><br>
                <span style="font-size: 0.9em; opacity: 0.9;">Free tier cannot access other users' tweets. You need Basic tier ($100/month) for full access.</span>
            </div>
            <button onclick="loadDemoData('${username}')" class="error-btn-primary">View Demo Data Instead</button>
        </div>
    `;
    errorEl.classList.remove('hidden');
    resultsSection.classList.add('hidden');
}

function loadDemoData(username) {
    usernameInput.value = username;
    handleSearch(new Event('submit'), true);
}

function showRateLimitError(username) {
    const errorEl = document.getElementById('error-message');
    errorEl.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <span class="error-icon">⏱️</span>
            <div style="margin: 10px 0;">
                <strong>Rate Limit Reached</strong><br>
                <span style="font-size: 0.9em; opacity: 0.9;">Please wait a moment or use demo data.</span>
            </div>
            <button onclick="loadDemoData('${username}')" class="error-btn-primary">View Demo Data Instead</button>
        </div>
    `;
    errorEl.classList.remove('hidden');
    resultsSection.classList.add('hidden');
}

function showNotFoundError(username) {
    const errorEl = document.getElementById('error-message');
    errorEl.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <span class="error-icon">🔍</span>
            <div style="margin: 10px 0;">
                <strong>User Not Found</strong><br>
                <span style="font-size: 0.9em; opacity: 0.9;">@${username} doesn't exist or the account may be private/suspended.</span>
            </div>
            <button onclick="loadDemoData('${username}')" class="error-btn-primary">View Demo Data Instead</button>
        </div>
    `;
    errorEl.classList.remove('hidden');
    resultsSection.classList.add('hidden');
}

function showTimeoutError(username) {
    const errorEl = document.getElementById('error-message');
    errorEl.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <span class="error-icon">⏳</span>
            <div style="margin: 10px 0;">
                <strong>Request Timed Out</strong><br>
                <span style="font-size: 0.9em; opacity: 0.9;">Twitter is being slow. Try again or use demo data.</span>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 12px;">
                <button onclick="retrySearch()" class="error-btn-secondary">Try Again</button>
                <button onclick="loadDemoData('${username}')" class="error-btn-primary">View Demo Data</button>
            </div>
        </div>
    `;
    errorEl.classList.remove('hidden');
    resultsSection.classList.add('hidden');
}

function retrySearch() {
    searchForm.dispatchEvent(new Event('submit'));
}

function setLoading(isLoading, message = '') {
    searchBtn.classList.toggle('loading', isLoading);
    searchBtn.disabled = isLoading;
    usernameInput.disabled = isLoading;
    
    // Show loading message
    const existingMsg = document.getElementById('loading-message');
    if (existingMsg) existingMsg.remove();
    
    if (isLoading && message) {
        const msgDiv = document.createElement('div');
        msgDiv.id = 'loading-message';
        msgDiv.style.cssText = 'text-align: center; color: var(--text-muted); margin-top: 1rem; font-size: 0.9rem;';
        msgDiv.innerHTML = `<span class="loading-spinner"></span> ${message}`;
        searchForm.appendChild(msgDiv);
    }
}

function showError(message) {
    errorMessage.querySelector('.error-text').textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function displayResults(data) {
    resultsSection.classList.remove('hidden');
    
    // Update profile info
    document.getElementById('display-name').textContent = data.display_name;
    document.getElementById('username-display').textContent = `@${data.username}`;
    document.getElementById('tweets-analyzed').textContent = data.total_tweets_analyzed;
    
    // Profile image
    const profileImg = document.getElementById('profile-image');
    if (data.profile_image) {
        profileImg.src = data.profile_image;
        profileImg.style.display = 'block';
    } else {
        // Default avatar with initial
        profileImg.style.display = 'none';
    }
    
    // Render visualizations with current timezone
    renderWithTimezone(data, currentTimezoneOffset);
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderWithTimezone(data, offsetHours) {
    // Convert data to selected timezone
    const converted = convertToTimezone(data, offsetHours);
    
    // Update timezone note
    const tzNote = document.getElementById('timezone-note');
    if (tzNote) {
        tzNote.textContent = formatTimezoneLabel(offsetHours);
    }
    
    // Render all visualizations
    renderHeatmap(converted.heatmap_data);
    renderPeakTimes(converted.peak_hours, converted.peak_days);
    renderHourlyChart(converted.hourly_activity);
    renderDailyChart(converted.daily_activity);
    
    // Render live insights
    renderInsights(converted, offsetHours);
}

function convertToTimezone(data, offsetHours) {
    // Convert hourly activity
    const hourlyActivity = {};
    for (let h = 0; h < 24; h++) {
        hourlyActivity[h.toString()] = 0;
    }
    
    for (let h = 0; h < 24; h++) {
        const count = data.hourly_activity[h.toString()] || 0;
        const newHour = Math.floor((h + offsetHours + 24) % 24);
        hourlyActivity[newHour.toString()] += count;
    }
    
    // Convert heatmap data (7 days x 24 hours)
    const heatmapData = Array.from({ length: 7 }, () => Array(24).fill(0));
    
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const count = data.heatmap_data[day][hour] || 0;
            const newHour = Math.floor((hour + offsetHours + 24) % 24);
            
            // Handle day rollover
            let newDay = day;
            if (hour + offsetHours >= 24) {
                newDay = (day + 1) % 7;
            } else if (hour + offsetHours < 0) {
                newDay = (day - 1 + 7) % 7;
            }
            
            heatmapData[newDay][newHour] += count;
        }
    }
    
    // Recalculate daily activity from heatmap
    const dailyActivity = {};
    for (let d = 0; d < 7; d++) {
        dailyActivity[d.toString()] = heatmapData[d].reduce((a, b) => a + b, 0);
    }
    
    // Recalculate peak hours
    const hourlyEntries = Object.entries(hourlyActivity)
        .map(([h, c]) => ({ hour: parseInt(h), count: c }))
        .sort((a, b) => b.count - a.count);
    const peakHours = hourlyEntries.slice(0, 3);
    
    // Recalculate peak days
    const dailyEntries = Object.entries(dailyActivity)
        .map(([d, c]) => ({ day: parseInt(d), count: c }))
        .sort((a, b) => b.count - a.count);
    const peakDays = dailyEntries.slice(0, 3);
    
    return {
        ...data,
        hourly_activity: hourlyActivity,
        daily_activity: dailyActivity,
        heatmap_data: heatmapData,
        peak_hours: peakHours,
        peak_days: peakDays
    };
}

function formatTimezoneLabel(offset) {
    if (offset === 0) return 'UTC';
    const sign = offset > 0 ? '+' : '';
    const hours = Math.floor(Math.abs(offset));
    const minutes = (Math.abs(offset) % 1) * 60;
    if (minutes > 0) {
        return `UTC${sign}${offset > 0 ? hours : -hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return `UTC${sign}${offset}`;
}

function renderHeatmap(heatmapData) {
    const container = document.getElementById('heatmap');
    container.innerHTML = '';
    
    // Find max value for scaling
    let maxVal = 0;
    heatmapData.forEach(row => {
        row.forEach(val => {
            if (val > maxVal) maxVal = val;
        });
    });
    
    // Create heatmap grid
    heatmapData.forEach((row, dayIndex) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'heatmap-row';
        
        row.forEach((count, hourIndex) => {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            
            // Calculate intensity level (0-4)
            let level = 0;
            if (count > 0 && maxVal > 0) {
                const ratio = count / maxVal;
                if (ratio > 0.75) level = 4;
                else if (ratio > 0.5) level = 3;
                else if (ratio > 0.25) level = 2;
                else level = 1;
            }
            
            if (level > 0) {
                cell.classList.add(`level-${level}`);
            }
            
            // Add tooltip on hover
            cell.addEventListener('mouseenter', (e) => showTooltip(e, dayIndex, hourIndex, count));
            cell.addEventListener('mouseleave', hideTooltip);
            
            rowDiv.appendChild(cell);
        });
        
        container.appendChild(rowDiv);
    });
}

function showTooltip(event, day, hour, count) {
    // Remove existing tooltip
    hideTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.id = 'heatmap-tooltip';
    
    const hourStr = formatHour(hour);
    const dayStr = DAYS[day];
    
    tooltip.innerHTML = `
        <strong>${dayStr} ${hourStr}</strong><br>
        ${count} tweet${count !== 1 ? 's' : ''}
    `;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
}

function hideTooltip() {
    const tooltip = document.getElementById('heatmap-tooltip');
    if (tooltip) tooltip.remove();
}

function formatHour(hour) {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
}

function renderPeakTimes(peakHours, peakDays) {
    // Render peak hours
    const hoursContainer = document.getElementById('peak-hours');
    hoursContainer.innerHTML = peakHours.map((item, index) => `
        <div class="peak-item">
            <span class="peak-rank">${index + 1}</span>
            <span class="peak-label">${formatHour(item.hour)}</span>
            <span class="peak-count">${item.count} tweets</span>
        </div>
    `).join('');
    
    // Render peak days
    const daysContainer = document.getElementById('peak-days');
    daysContainer.innerHTML = peakDays.map((item, index) => `
        <div class="peak-item">
            <span class="peak-rank">${index + 1}</span>
            <span class="peak-label">${DAYS[item.day]}</span>
            <span class="peak-count">${item.count} tweets</span>
        </div>
    `).join('');
}

function renderHourlyChart(hourlyData) {
    const ctx = document.getElementById('hourly-chart').getContext('2d');
    
    // Destroy existing chart
    if (hourlyChart) {
        hourlyChart.destroy();
    }
    
    // Prepare data
    const labels = Array.from({ length: 24 }, (_, i) => formatHour(i));
    const data = Array.from({ length: 24 }, (_, i) => hourlyData[i.toString()] || 0);
    
    // Create gradient with editorial colors
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(139, 115, 85, 0.85)');
    gradient.addColorStop(1, 'rgba(139, 115, 85, 0.15)');
    
    hourlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: gradient,
                borderColor: 'rgba(93, 78, 55, 0.8)',
                borderWidth: 1,
                borderRadius: 3,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#FFFFFF',
                    titleColor: '#1A1A1A',
                    bodyColor: '#666666',
                    borderColor: '#E5E5E5',
                    borderWidth: 1,
                    titleFont: { family: "'Playfair Display', serif", weight: '600', size: 13 },
                    bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (items) => `${items[0].label}`,
                        label: (item) => `${item.raw} tweets`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxRotation: 0,
                        color: '#999999',
                        font: { size: 10 },
                        callback: function(val, index) {
                            // Show every 3rd label
                            return index % 3 === 0 ? this.getLabelForValue(val) : '';
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: { 
                        precision: 0,
                        color: '#999999',
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function renderDailyChart(dailyData) {
    const ctx = document.getElementById('daily-chart').getContext('2d');
    
    // Destroy existing chart
    if (dailyChart) {
        dailyChart.destroy();
    }
    
    // Prepare data
    const data = Array.from({ length: 7 }, (_, i) => dailyData[i.toString()] || 0);
    
    // Create gradient with editorial colors
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(93, 78, 55, 0.85)');
    gradient.addColorStop(1, 'rgba(93, 78, 55, 0.15)');
    
    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: DAYS_SHORT,
            datasets: [{
                data,
                backgroundColor: gradient,
                borderColor: 'rgba(93, 78, 55, 0.8)',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#FFFFFF',
                    titleColor: '#1A1A1A',
                    bodyColor: '#666666',
                    borderColor: '#E5E5E5',
                    borderWidth: 1,
                    titleFont: { family: "'Playfair Display', serif", weight: '600', size: 13 },
                    bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (items) => DAYS[items[0].dataIndex],
                        label: (item) => `${item.raw} tweets`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#999999',
                        font: { size: 11 }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: { 
                        precision: 0,
                        color: '#999999',
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

// ============================================
// INSIGHTS & PREDICTIONS
// ============================================

function renderInsights(data, offsetHours) {
    // Get current time in the selected timezone
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcDay = (now.getUTCDay() + 6) % 7; // Convert to Mon=0 format
    
    const currentHour = Math.floor((utcHour + offsetHours + 24) % 24);
    const currentDay = utcDay; // Simplified - could adjust for day rollover
    
    // Calculate all insights
    const onlineProb = calculateOnlineProbability(data, currentHour, currentDay);
    const nextActive = calculateNextActiveWindow(data, currentHour, currentDay);
    const bestTime = calculateBestTime(data);
    const pattern = detectActivityPattern(data);
    const consistency = calculateConsistency(data);
    
    // Update DOM
    document.getElementById('online-probability').textContent = `${onlineProb}%`;
    document.getElementById('next-active-time').textContent = nextActive;
    document.getElementById('best-time').textContent = bestTime;
    document.getElementById('activity-pattern').textContent = pattern.label;
    document.getElementById('consistency-score').textContent = consistency;
    
    // Update status indicator
    const indicator = document.getElementById('status-indicator');
    indicator.className = 'status-indicator';
    if (onlineProb >= 60) {
        indicator.classList.add('high');
    } else if (onlineProb >= 30) {
        indicator.classList.add('medium');
    } else {
        indicator.classList.add('low');
    }
    
    // Update pattern icon
    const patternIcon = document.querySelector('.insight-item:nth-child(2) .insight-icon');
    if (patternIcon) {
        patternIcon.textContent = pattern.icon;
    }
}

function calculateOnlineProbability(data, currentHour, currentDay) {
    const heatmap = data.heatmap_data;
    const hourlyActivity = data.hourly_activity;
    
    // Get activity for current hour across all days
    const currentHourTotal = parseInt(hourlyActivity[currentHour.toString()] || 0);
    
    // Get total activity
    const totalActivity = Object.values(hourlyActivity).reduce((a, b) => a + parseInt(b), 0);
    
    if (totalActivity === 0) return 0;
    
    // Calculate probability based on historical activity
    // Weight current day's data more heavily
    const currentSlotActivity = heatmap[currentDay]?.[currentHour] || 0;
    const avgHourActivity = currentHourTotal / 7;
    
    // Combine slot-specific and hour-general probability
    const maxSlotActivity = Math.max(...heatmap.flat());
    const slotProb = maxSlotActivity > 0 ? (currentSlotActivity / maxSlotActivity) * 100 : 0;
    const hourProb = (currentHourTotal / Math.max(...Object.values(hourlyActivity).map(v => parseInt(v)))) * 100;
    
    // Weighted average (60% specific slot, 40% hour general)
    const probability = Math.round(slotProb * 0.6 + hourProb * 0.4);
    
    return Math.min(95, Math.max(5, probability)); // Clamp between 5-95%
}

function calculateNextActiveWindow(data, currentHour, currentDay) {
    const hourlyActivity = data.hourly_activity;
    
    // Find peak hours
    const hourlyArr = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: parseInt(hourlyActivity[i.toString()] || 0)
    })).sort((a, b) => b.count - a.count);
    
    const peakHours = hourlyArr.slice(0, 5).map(h => h.hour);
    
    // Find next peak hour from current time
    for (let offset = 1; offset <= 24; offset++) {
        const checkHour = (currentHour + offset) % 24;
        if (peakHours.includes(checkHour)) {
            if (offset === 1) {
                return 'Within the hour';
            } else if (offset < 24) {
                return `In ~${offset} hour${offset > 1 ? 's' : ''}`;
            }
        }
    }
    
    // If currently in a peak hour
    if (peakHours.includes(currentHour)) {
        return 'Right now!';
    }
    
    return 'Check heatmap';
}

function calculateBestTime(data) {
    const hourlyActivity = data.hourly_activity;
    
    // Find the hour with highest activity
    let maxHour = 0;
    let maxCount = 0;
    
    for (let h = 0; h < 24; h++) {
        const count = parseInt(hourlyActivity[h.toString()] || 0);
        if (count > maxCount) {
            maxCount = count;
            maxHour = h;
        }
    }
    
    // Return a time range
    const startHour = maxHour;
    const endHour = (maxHour + 2) % 24;
    
    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
}

function detectActivityPattern(data) {
    const hourlyActivity = data.hourly_activity;
    
    // Calculate activity in different periods
    const morning = [6, 7, 8, 9, 10, 11].reduce((sum, h) => sum + parseInt(hourlyActivity[h.toString()] || 0), 0);
    const afternoon = [12, 13, 14, 15, 16, 17].reduce((sum, h) => sum + parseInt(hourlyActivity[h.toString()] || 0), 0);
    const evening = [18, 19, 20, 21, 22, 23].reduce((sum, h) => sum + parseInt(hourlyActivity[h.toString()] || 0), 0);
    const night = [0, 1, 2, 3, 4, 5].reduce((sum, h) => sum + parseInt(hourlyActivity[h.toString()] || 0), 0);
    
    const total = morning + afternoon + evening + night;
    if (total === 0) return { label: 'Unknown', icon: '❓' };
    
    // Determine pattern
    const morningPct = morning / total;
    const eveningPct = evening / total;
    const nightPct = night / total;
    const workHoursPct = (morning + afternoon) / total;
    
    if (nightPct > 0.3) {
        return { label: 'Night Owl', icon: '🦉' };
    } else if (morningPct > 0.35) {
        return { label: 'Early Bird', icon: '🐦' };
    } else if (workHoursPct > 0.6) {
        return { label: '9-to-5 Pattern', icon: '💼' };
    } else if (eveningPct > 0.4) {
        return { label: 'Evening Active', icon: '🌆' };
    } else {
        return { label: 'Spread Out', icon: '📊' };
    }
}

function calculateConsistency(data) {
    const dailyActivity = data.daily_activity;
    
    // Calculate standard deviation of daily activity
    const values = Array.from({ length: 7 }, (_, i) => parseInt(dailyActivity[i.toString()] || 0));
    const mean = values.reduce((a, b) => a + b, 0) / 7;
    
    if (mean === 0) return 'No data';
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 7;
    const stdDev = Math.sqrt(variance);
    
    // Coefficient of variation (lower = more consistent)
    const cv = stdDev / mean;
    
    if (cv < 0.3) {
        return 'Very Consistent';
    } else if (cv < 0.5) {
        return 'Fairly Regular';
    } else if (cv < 0.8) {
        return 'Somewhat Variable';
    } else {
        return 'Unpredictable';
    }
}
