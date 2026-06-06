/**
 * NexGen Weather - Main Application Front-end Logic (Automatic VFX, 8-Day Forecast & Geolocation Edition)
 * Orchestrates API queries, UI layouts, interactive charts, Leaflet maps, and WebGL VFX.
 */

// Global instances
let threeWeather = null;
let leafletMap = null;
let mapTileLayer = null;
let mapMarker = null;
let forecastChart = null;
let currentWeatherData = null; 
let selectedUnit = 'C'; // C or F
let userThemeOverride = null; // 'day', 'night', or null (automatic)

// Popular cities for autocomplete list
const popularCities = [
    "Kolkata", "London", "New York", "Tokyo", "Sydney", "Paris", "Berlin", 
    "Cairo", "Mumbai", "Moscow", "Rio de Janeiro", "Dubai", "Los Angeles", 
    "Singapore", "Toronto", "Cape Town", "Reykjavik", "Vancouver"
];

// Weather condition configs (Background videos and colors)
const weatherConfigs = {
    clear: {
        video: "https://assets.mixkit.co/videos/preview/mixkit-floating-white-clouds-in-a-blue-sky-4432-large.mp4",
        color: "#0284c7",
        glow: "0 0 25px rgba(2, 132, 199, 0.3)",
        icon: "<i class='bx bx-sun'></i>"
    },
    clouds: {
        video: "https://assets.mixkit.co/videos/preview/mixkit-dark-clouds-drifting-across-the-sky-34676-large.mp4",
        color: "#64748b",
        glow: "0 0 25px rgba(100, 116, 139, 0.2)",
        icon: "<i class='bx bx-cloud'></i>"
    },
    rain: {
        video: "https://assets.mixkit.co/videos/preview/mixkit-rain-falling-on-a-window-pane-14186-large.mp4",
        color: "#0ea5e9",
        glow: "0 0 25px rgba(14, 165, 233, 0.35)",
        icon: "<i class='bx bx-cloud-rain'></i>"
    },
    storm: {
        video: "https://assets.mixkit.co/videos/preview/mixkit-thunderstorm-with-lightning-flashes-in-the-night-42289-large.mp4",
        color: "#a855f7",
        glow: "0 0 25px rgba(168, 85, 247, 0.4)",
        icon: "<i class='bx bx-cloud-lightning'></i>"
    },
    snow: {
        video: "https://assets.mixkit.co/videos/preview/mixkit-snow-falling-on-pine-trees-31649-large.mp4",
        color: "#3b82f6",
        glow: "0 0 25px rgba(59, 130, 246, 0.3)",
        icon: "<i class='bx bx-cloud-snow'></i>"
    },
    mist: {
        video: "https://assets.mixkit.co/videos/preview/mixkit-dense-fog-covering-forest-trees-34375-large.mp4",
        color: "#64748b",
        glow: "0 0 25px rgba(100, 116, 139, 0.2)",
        icon: "<i class='bx bx-wind'></i>"
    }
};

// Inject Screen Shake keyframes into head
const shakeStyle = document.createElement('style');
shakeStyle.innerHTML = `
    @keyframes vfx-shake {
        0%, 100% { transform: translate(0, 0); }
        10%, 30%, 50%, 70%, 90% { transform: translate(-3px, -2px) rotate(-0.5deg); }
        20%, 40%, 60%, 80% { transform: translate(3px, 2px) rotate(0.5deg); }
    }
    .shake-vfx {
        animation: vfx-shake 0.4s ease-in-out;
    }
`;
document.head.appendChild(shakeStyle);

// Trigger function called by lightning effect
window.triggerScreenShake = function() {
    const leftPanel = document.querySelector('.left-panel');
    if (leftPanel) {
        leftPanel.classList.add('shake-vfx');
        setTimeout(() => leftPanel.classList.remove('shake-vfx'), 450);
    }
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Retrieve any existing theme override
    const storedTheme = localStorage.getItem('themeOverride');
    if (storedTheme) {
        userThemeOverride = storedTheme;
        setDayNightMode(storedTheme === 'day');
    }

    // 2. Start Three.js Canvas background
    threeWeather = new ThreeWeather('three-bg-canvas');

    // 3. Load default city
    fetchWeather("Kolkata");

    // 4. Register search input events
    const input = document.getElementById('city-input');
    const searchBtn = document.getElementById('search-btn');

    searchBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val) fetchWeather(val);
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const val = input.value.trim();
            if (val) fetchWeather(val);
        }
    });

    // 5. Autocomplete implementation
    setupAutocomplete(input);

    // 6. 3D Card Tilt registration
    setupCard3DTilt();

    // 7. Unit Toggler (°C / °F)
    setupUnitToggler();

    // 8. Dynamic Digital Clock
    startClock();

    // 9. Voice Recognition Search setup
    setupVoiceSearch();

    // 10. Theme Toggler Button Setup (allows manual override)
    setupThemeToggleButton();

    // 11. HTML5 Geolocation Current Location button click setup
    setupGeolocationBtn();

    // 12. Smooth navigation scrolling
    setupSidebarNavigation();
});

// ==========================================
// Weather Fetch & API Integration
// ==========================================
async function fetchWeather(city) {
    try {
        const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
        const data = await response.json();

        if (response.ok) {
            handleAPIResponse(data);
        } else {
            alert(data.error || "City search failed!");
        }
    } catch(err) {
        console.error("API Call error: ", err);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    const locBtn = document.getElementById('location-btn');
    if (locBtn) {
        locBtn.classList.add('recording'); // Pulses icon to indicate loading GPS coordinates
    }
    
    try {
        const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        const data = await response.json();

        if (response.ok) {
            handleAPIResponse(data);
            // Clean text box input
            document.getElementById('city-input').value = '';
        } else {
            alert(data.error || "Coordinates query failed!");
        }
    } catch(err) {
        console.error("Coordinates API lookup failed:", err);
    } finally {
        if (locBtn) {
            locBtn.classList.remove('recording');
        }
    }
}

// Coordinates state update dispatcher
function handleAPIResponse(data) {
    currentWeatherData = data;
    
    // Reset manual overrides so it automatically syncs local time of new locations!
    userThemeOverride = null;
    localStorage.removeItem('themeOverride');

    // Clean autocomplete suggestions list
    document.getElementById('suggestions-box').style.display = 'none';

    // Auto determine day vs night mode for city timezone parameters
    const isDayTime = data.dt >= data.sunrise && data.dt < data.sunset;
    setDayNightMode(isDayTime);

    // Update user interface text panels
    updateUI(data);

    // Re-render Forecast graph
    updateChart(data.hourly);

    // Relocate Satellite Map
    updateMap(data.lat, data.lon, data.city);

    // Trigger corresponding WebGL simulation automatically
    syncLiveVFX(data.condition);

    // Highlight location pills if matches
    updatePillHighlights(data.city);
}

// Global quick-selection helper
window.quickSearch = function(city) {
    document.getElementById('city-input').value = city;
    fetchWeather(city);
};

// ==========================================
// UI Updates
// ==========================================
function updateUI(data) {
    // Top headers
    document.getElementById('header-city-title').innerHTML = `Weather Dashboard in <strong>${data.city}, ${data.country}</strong>`;
    
    // Update temperatures dynamically
    renderTemperatures(data.temperature, data.feels_like);
    
    document.getElementById('condition').innerText = data.description;
    
    // High / Low ranges on card
    const highC = data.temperature + 2;
    const lowC = data.temperature - 3;
    document.getElementById('temp-high').innerText = `${selectedUnit === 'C' ? highC : Math.round(highC * 1.8 + 32)}°`;
    document.getElementById('temp-low').innerText = `${selectedUnit === 'C' ? lowC : Math.round(lowC * 1.8 + 32)}°`;

    // Dynamic Weather highlights
    const config = getThemeConfig(data.condition);
    const isDay = document.body.classList.contains('day-mode');
    const finalThemeColor = isDay ? adjustThemeColorForDay(config.color) : config.color;
    
    document.documentElement.style.setProperty('--theme-color', finalThemeColor);
    document.documentElement.style.setProperty('--theme-glow', isDay ? `0 0 20px ${hexToRGBA(finalThemeColor, 0.12)}` : config.glow);
    document.getElementById('weather-3d-icon').innerHTML = config.icon;

    // Detailed metrics grid
    document.getElementById('wind').innerHTML = `${data.wind_speed} <small>m/s</small>`;
    document.getElementById('humidity').innerHTML = `${data.humidity} <small>%</small>`;
    document.getElementById('visibility').innerHTML = `${data.visibility} <small>km</small>`;
    document.getElementById('pressure').innerHTML = `${data.pressure} <small>hPa</small>`;
    document.getElementById('dew-point').innerHTML = `${data.dew_point} <small>°C</small>`;

    // Format local sunrise and sunset based on target timezone
    const timezoneOffset = data.timezone;
    const formatLocalTime = (unixTime, offsetSec) => {
        const date = new Date((unixTime + offsetSec) * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    };
    const sunriseStr = formatLocalTime(data.sunrise, timezoneOffset);
    const sunsetStr = formatLocalTime(data.sunset, timezoneOffset);
    document.getElementById('sunrise-sunset').innerText = `${sunriseStr} / ${sunsetStr}`;

    // Generate UV Index simulation realistically (based on condition & temp)
    let uvVal = "Moderate";
    let uvDesc = "Safe levels of UV rays.";
    if (data.condition.toLowerCase().includes('clear')) {
        if (data.temperature > 30) {
            uvVal = "Very High";
            uvDesc = "Wear sunscreen! Intense solar exposure.";
        } else {
            uvVal = "High";
            uvDesc = "SPF protection recommended.";
        }
    } else if (data.condition.toLowerCase().includes('rain') || data.condition.toLowerCase().includes('storm') || !isDay) {
        uvVal = "Low";
        uvDesc = "Overcast blocks direct solar UV rays.";
    }
    document.getElementById('uv-index').innerHTML = uvVal;
    document.getElementById('uv-desc').innerText = uvDesc;

    // Detailed descriptions tweaks
    document.getElementById('wind-desc').innerText = data.wind_speed > 10 ? "Strong winds, caution during outdoor events." : "Expected light, refreshing winds blowing.";
    document.getElementById('humidity-desc').innerText = data.humidity > 75 ? "Extremely humid air. Dew droplets likely." : "Comfortable humidity levels inside the area.";
    document.getElementById('visibility-desc').innerText = data.visibility < 5 ? "Mist reduces distance visibility. Drive carefully." : "Clear sky visibility. No visual barriers.";
    document.getElementById('pressure-desc').innerText = data.pressure < 1008 ? "Low pressure system, storm cells possible." : "High pressure system, stable meteorological fields.";

    // Render 8-Day Daily Forecast Cards with weather-wise animations
    renderDailyForecast(data.daily);
}

function renderTemperatures(tempC, feelsC) {
    let displayTemp = tempC;
    let displayFeels = feelsC;

    if (selectedUnit === 'F') {
        displayTemp = Math.round(tempC * 1.8 + 32);
        displayFeels = Math.round(feelsC * 1.8 + 32);
    }

    document.getElementById('temperature').innerText = displayTemp;
    document.getElementById('feels-like').innerText = `${displayFeels}°${selectedUnit}`;
    document.getElementById('grid-feels-like').innerHTML = `${displayFeels} <small>°${selectedUnit}</small>`;
}

// Generate daily forecast card layouts dynamically with custom animations
function renderDailyForecast(dailyData) {
    const container = document.getElementById('daily-forecast-container');
    if (!container) return;

    container.innerHTML = '';

    dailyData.forEach((dayData) => {
        let minTemp = dayData.temp_min;
        let maxTemp = dayData.temp_max;
        if (selectedUnit === 'F') {
            minTemp = Math.round(minTemp * 1.8 + 32);
            maxTemp = Math.round(maxTemp * 1.8 + 32);
        }

        const iconConfig = getThemeConfig(dayData.condition);
        const animationClass = getAnimationClass(dayData.condition);
        
        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <span class="fc-day">${dayData.day.substring(0, 3)}</span>
            <div class="fc-icon ${animationClass}">${iconConfig.icon}</div>
            <div class="fc-temp">
                <span class="fc-high">${maxTemp}°</span>
                <span class="fc-low">${minTemp}°</span>
            </div>
            <span class="fc-desc" title="${dayData.description}">${dayData.description}</span>
        `;
        container.appendChild(card);
    });
}

// Match weather types to specialized CSS keyframe animation classes
function getAnimationClass(condition) {
    const raw = condition.toLowerCase();
    if (raw.includes('thunder') || raw.includes('storm')) return 'anim-stormy';
    if (raw.includes('rain') || raw.includes('drizzle')) return 'anim-rainy';
    if (raw.includes('snow') || raw.includes('ice')) return 'anim-snowy';
    if (raw.includes('mist') || raw.includes('fog') || raw.includes('haze') || raw.includes('smoke') || raw.includes('cloud') || raw.includes('overcast')) return 'anim-misty';
    return 'anim-sunny';
}

// Convert colors slightly to stand out better on light backdrops
function adjustThemeColorForDay(colorHex) {
    if (colorHex === '#38bdf8') return '#0284c7';
    if (colorHex === '#94a3b8') return '#475569';
    if (colorHex === '#93c5fd') return '#2563eb';
    return colorHex;
}

// Retrieve custom visual profile matching condition string
function getThemeConfig(condition) {
    const raw = condition.toLowerCase();
    if (raw.includes('thunder') || raw.includes('storm')) return weatherConfigs.storm;
    if (raw.includes('rain') || raw.includes('drizzle')) return weatherConfigs.rain;
    if (raw.includes('snow') || raw.includes('ice')) return weatherConfigs.snow;
    if (raw.includes('cloud') || raw.includes('overcast')) return weatherConfigs.clouds;
    if (raw.includes('mist') || raw.includes('fog') || raw.includes('haze') || raw.includes('smoke')) return weatherConfigs.mist;
    return weatherConfigs.clear;
}

// ==========================================
// 3D Perspective Card Tilt
// ==========================================
function setupCard3DTilt() {
    const card = document.getElementById('tilt-card');
    if (!card) return;

    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        
        // Calculate coordinates inside card
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        // Angle bounds [-25, 25] degrees
        const rx = ((y / h) - 0.5) * -20;
        const ry = ((x / w) - 0.5) * 20;

        card.style.setProperty('--rx', `${rx}deg`);
        card.style.setProperty('--ry', `${ry}deg`);
        card.style.setProperty('--mx', `${(x / w) * 100}%`);
        card.style.setProperty('--my', `${(y / h) * 100}%`);
    });

    card.addEventListener('mouseleave', () => {
        // Return smoothly to flat perspective
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
    });
}

// ==========================================
// Forecast Chart.js Configuration
// ==========================================
function updateChart(hourlyData) {
    const ctx = document.getElementById('forecastChart');
    if (!ctx) return;

    const labels = hourlyData.map(item => item.time);
    let temps = hourlyData.map(item => item.temp);

    // Convert values if selected unit is Fahrenheit
    if (selectedUnit === 'F') {
        temps = temps.map(t => Math.round(t * 1.8 + 32));
    }

    if (forecastChart) {
        forecastChart.destroy();
    }

    // Set custom visual gradient fill based on Day/Night theme parameters
    const canvasCtx = ctx.getContext('2d');
    const grad = canvasCtx.createLinearGradient(0, 0, 0, 180);
    
    const isDay = document.body.classList.contains('day-mode');
    const themeColor = document.documentElement.style.getPropertyValue('--theme-color').trim() || (isDay ? '#0284c7' : '#38bdf8');
    const gridColor = isDay ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isDay ? '#475569' : '#94a3b8';

    grad.addColorStop(0, hexToRGBA(themeColor, 0.35));
    grad.addColorStop(1, hexToRGBA(themeColor, 0));

    forecastChart = new Chart(canvasCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Temp (°${selectedUnit})`,
                data: temps,
                borderColor: themeColor,
                backgroundColor: grad,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: themeColor,
                pointRadius: 4,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Outfit', size: 12 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Outfit', size: 11 } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Utility for formatting color strings
function hexToRGBA(hex, alpha) {
    if (hex.startsWith('rgba')) return hex.replace(/[\d\.]+\)$/g, `${alpha})`);
    
    let r = 56, g = 189, b = 248; // Default Fallback
    if (hex.startsWith('#')) {
        const h = hex.replace('#', '');
        if (h.length === 3) {
            r = parseInt(h[0] + h[0], 16);
            g = parseInt(h[1] + h[1], 16);
            b = parseInt(h[2] + h[2], 16);
        } else if (h.length === 6) {
            r = parseInt(h.substring(0, 2), 16);
            g = parseInt(h.substring(2, 4), 16);
            b = parseInt(h.substring(4, 6), 16);
        }
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ==========================================
// Satellite Coordinate Map (Leaflet)
// ==========================================
function updateMap(lat, lon, cityName) {
    const mapDiv = document.getElementById('weather-map');
    if (!mapDiv) return;

    const isDay = document.body.classList.contains('day-mode');
    const tileUrl = isDay 
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' 
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    if (!leafletMap) {
        leafletMap = L.map('weather-map', { zoomControl: true }).setView([lat, lon], 11);

        mapTileLayer = L.tileLayer(tileUrl, {
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        }).addTo(leafletMap);

        const pulseIcon = L.divIcon({
            className: 'map-pulse-marker',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        mapMarker = L.marker([lat, lon], { icon: pulseIcon }).addTo(leafletMap);
        mapMarker.bindPopup(`<b>${cityName} Satellite Node</b><br>Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`).openPopup();
    } else {
        // Pan map smoothly to new coords and update layer
        leafletMap.setView([lat, lon], 11);
        mapTileLayer.setUrl(tileUrl);
        mapMarker.setLatLng([lat, lon]);
        mapMarker.getPopup().setContent(`<b>${cityName} Satellite Node</b><br>Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`).openPopup();
    }
}

// ==========================================
// Day/Night Theme Toggler Logic
// ==========================================
function setupThemeToggleButton() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        const isDayCurrently = document.body.classList.contains('day-mode');
        const nextDayState = !isDayCurrently;

        userThemeOverride = nextDayState ? 'day' : 'night';
        localStorage.setItem('themeOverride', userThemeOverride);

        setDayNightMode(nextDayState);

        // Re-draw dynamic widgets to update colors
        if (currentWeatherData) {
            updateUI(currentWeatherData);
            updateChart(currentWeatherData.hourly);
            updateMap(currentWeatherData.lat, currentWeatherData.lon, currentWeatherData.city);
        }
    });
}

function setDayNightMode(isDay) {
    const toggleIcon = document.getElementById('theme-toggle-icon');
    
    if (isDay) {
        document.body.classList.add('day-mode');
        if (toggleIcon) {
            toggleIcon.className = 'bx bx-moon';
        }
    } else {
        document.body.classList.remove('day-mode');
        if (toggleIcon) {
            toggleIcon.className = 'bx bx-sun';
        }
    }

    const tileUrl = isDay 
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' 
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    
    if (mapTileLayer) {
        mapTileLayer.setUrl(tileUrl);
    }

    if (threeWeather) {
        threeWeather.setDayMode(isDay);
    }
}

// ==========================================
// HTML5 Geolocation Current Location logic
// ==========================================
function setupGeolocationBtn() {
    const locBtn = document.getElementById('location-btn');
    if (!locBtn) return;

    locBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    fetchWeatherByCoords(lat, lon);
                },
                (err) => {
                    alert("Location access denied or timed out: " + err.message);
                },
                { enableHighAccuracy: true, timeout: 6000 }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    });
}

// ==========================================
// Unit Toggler (°C <-> °F)
// ==========================================
function setupUnitToggler() {
    const btnC = document.getElementById('unit-c');
    const btnF = document.getElementById('unit-f');

    btnC.addEventListener('click', () => {
        if (selectedUnit === 'C') return;
        selectedUnit = 'C';
        btnC.classList.add('active');
        btnF.classList.remove('active');
        refreshUnitUI();
    });

    btnF.addEventListener('click', () => {
        if (selectedUnit === 'F') return;
        selectedUnit = 'F';
        btnF.classList.add('active');
        btnC.classList.remove('active');
        refreshUnitUI();
    });
}

function refreshUnitUI() {
    if (currentWeatherData) {
        updateUI(currentWeatherData);
        updateChart(currentWeatherData.hourly);
    }
}

// ==========================================
// Popular Autocomplete suggestions
// ==========================================
function setupAutocomplete(input) {
    const suggestions = document.getElementById('suggestions-box');
    if (!suggestions) return;

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        suggestions.innerHTML = '';

        if (!val) {
            suggestions.style.display = 'none';
            return;
        }

        const matches = popularCities.filter(city => city.toLowerCase().startsWith(val));
        if (matches.length === 0) {
            suggestions.style.display = 'none';
            return;
        }

        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerText = match;
            div.addEventListener('click', () => {
                input.value = match;
                suggestions.style.display = 'none';
                fetchWeather(match);
            });
            suggestions.appendChild(div);
        });

        suggestions.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== suggestions) {
            suggestions.style.display = 'none';
        }
    });
}

// ==========================================
// Voice Speech Search Setup
// ==========================================
function setupVoiceSearch() {
    const voiceBtn = document.getElementById('voice-btn');
    const input = document.getElementById('city-input');
    if (!voiceBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceBtn.style.display = 'none';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    voiceBtn.addEventListener('click', () => {
        if (voiceBtn.classList.contains('recording')) {
            recognition.stop();
        } else {
            voiceBtn.classList.add('recording');
            recognition.start();
        }
    });

    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        const cleanedText = text.replace(/[\.\,\?\!]/g, '');
        input.value = cleanedText;
        fetchWeather(cleanedText);
    };

    recognition.onend = () => {
        voiceBtn.classList.remove('recording');
    };

    recognition.onerror = (e) => {
        console.error("Speech Recognition Error: ", e.error);
        voiceBtn.classList.remove('recording');
    };
}

// ==========================================
// Digital clock
// ==========================================
function startClock() {
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', dateOptions);

        document.getElementById('digital-clock').innerText = timeStr;
        document.getElementById('header-date').innerText = dateStr;
    }, 1000);
}

// ==========================================
// VFX State Sync automatically
// ==========================================
function triggerVFXState(type) {
    if (threeWeather) {
        threeWeather.changeWeather(type);
    }

    const video = document.getElementById('bg-video');
    if (video && weatherConfigs[type]) {
        const conf = weatherConfigs[type];
        
        video.style.opacity = 0.05;
        setTimeout(() => {
            video.src = conf.video;
            video.load();
            video.play().catch(e => console.log("Video auto play prevented", e));
            
            const isDay = document.body.classList.contains('day-mode');
            video.style.opacity = isDay ? 0.35 : 0.22;
        }, 300);

        const finalThemeColor = document.body.classList.contains('day-mode') ? adjustThemeColorForDay(conf.color) : conf.color;
        document.documentElement.style.setProperty('--theme-color', finalThemeColor);
        document.documentElement.style.setProperty('--theme-glow', document.body.classList.contains('day-mode') ? `0 0 20px ${hexToRGBA(finalThemeColor, 0.12)}` : conf.glow);
    }
}

function syncLiveVFX(condition) {
    const raw = condition.toLowerCase();
    let type = 'clear';

    if (raw.includes('thunder') || raw.includes('storm')) type = 'storm';
    else if (raw.includes('rain') || raw.includes('drizzle')) type = 'rain';
    else if (raw.includes('snow') || raw.includes('ice')) type = 'snow';
    else if (raw.includes('cloud') || raw.includes('overcast')) type = 'clouds';
    else if (raw.includes('mist') || raw.includes('fog') || raw.includes('haze') || raw.includes('smoke')) type = 'mist';

    triggerVFXState(type);
}

// Utility to match pills with active searched location
function updatePillHighlights(cityName) {
    const pills = document.querySelectorAll('.location-pill');
    pills.forEach(pill => {
        if (pill.innerText.toLowerCase() === cityName.toLowerCase()) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
}

// ==========================================
// Sidebar navigation scrolling
// ==========================================
function setupSidebarNavigation() {
    const mapBtn = document.getElementById('nav-map-btn');
    const chartBtn = document.getElementById('nav-chart-btn');

    if (mapBtn) {
        mapBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const sec = document.getElementById('map-section');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (chartBtn) {
        chartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const sec = document.getElementById('chart-section');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        });
    }
}