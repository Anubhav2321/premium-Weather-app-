/**
 * NexGen Project Documentation Portal - Frontend Controller
 * Manages tab switching, theme syncing, digital clocks, and live API health latency graphs.
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Persist Day/Night mode class from main weather app settings
    const storedTheme = localStorage.getItem('themeOverride');
    if (storedTheme === 'day') {
        document.body.classList.add('day-mode');
    }

    // 2. Sidebar section toggle routing
    setupSectionSwitches();

    // 3. Start Live Digital clock
    startPortalClock();

    // 4. Initialize real-time API Latency Analytics Graph
    initLatencyTrackerChart();
});

// Sidebar click navigation handlers
function setupSectionSwitches() {
    const navItems = document.querySelectorAll('.portal-nav-item');
    const sections = document.querySelectorAll('.portal-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active classes from links
            navItems.forEach(link => link.classList.remove('active'));
            item.classList.add('active');

            // Show selected section
            const targetId = item.getAttribute('data-target');
            sections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });
}

// Digital clock tracking UTC or system local
function startPortalClock() {
    const clock = document.getElementById('portal-live-clock');
    if (!clock) return;

    setInterval(() => {
        const now = new Date();
        clock.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);
}

// Real-time API Latency tracker using Chart.js
function initLatencyTrackerChart() {
    const canvas = document.getElementById('latencyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Initialize rolling dataset (last 10 updates)
    const labelLimit = 10;
    const labels = Array.from({ length: labelLimit }, (_, i) => `t-${labelLimit - 1 - i}s`);
    const dataPoints = Array.from({ length: labelLimit }, () => Math.floor(Math.random() * 80) + 90); // default between 90-170ms

    // Check theme colors
    const isDay = document.body.classList.contains('day-mode');
    const themeColor = isDay ? '#0284c7' : '#38bdf8';
    const gridColor = isDay ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isDay ? '#475569' : '#94a3b8';

    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, hexToRGBA(themeColor, 0.3));
    grad.addColorStop(1, hexToRGBA(themeColor, 0));

    const latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Query Response Latency (ms)',
                data: dataPoints,
                borderColor: themeColor,
                backgroundColor: grad,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: themeColor,
                pointRadius: 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 50,
                    max: 300,
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Outfit', size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Outfit', size: 10 } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Real-time updates simulation every 2 seconds
    setInterval(() => {
        // Generate new latency reading with occasional network spike
        const spike = Math.random() < 0.15 ? 120 : 0; // 15% chance of spikes
        const newReading = Math.floor(Math.random() * 60) + 85 + spike;

        // Push new value, shift oldest
        latencyChart.data.datasets[0].data.shift();
        latencyChart.data.datasets[0].data.push(newReading);
        
        // Redraw
        latencyChart.update();

        // Update display text values
        const avg = Math.round(latencyChart.data.datasets[0].data.reduce((a, b) => a + b) / labelLimit);
        document.getElementById('avg-latency-display').innerText = `${avg} ms`;
    }, 2000);
}

// Utility to translate HEX colors
function hexToRGBA(hex, alpha) {
    if (hex.startsWith('rgba')) return hex;
    let r = 56, g = 189, b = 248;
    if (hex.startsWith('#')) {
        const h = hex.replace('#', '');
        if (h.length === 6) {
            r = parseInt(h.substring(0, 2), 16);
            g = parseInt(h.substring(2, 4), 16);
            b = parseInt(h.substring(4, 6), 16);
        }
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
