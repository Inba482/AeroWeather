/**
 * AeroWeather - Premium Weather Dashboard Application Logic
 * 
 * In this file:
 * 1. OpenWeatherMap API Integration using fetch (async/await)
 * 2. Parsing nested JSON properties safely
 * 3. Error Handling for network, invalid keys, invalid cities, empty inputs
 * 4. LocalStorage search history storage (limit 5)
 * 
 * INSTRUCTIONS FOR API KEY:
 * -------------------------------------------------------------
 * 1. Retrieve your free API key by signing up at https://openweathermap.org/
 * 2. You can configure the API Key directly in the UI settings panel (top right Gear icon).
 *    This will save the key locally to your browser's localStorage.
 * 3. Alternatively, you can hardcode the API key below in the DEFAULT_API_KEY constant.
 * -------------------------------------------------------------
 */

// If you want to hardcode your key, paste it inside the quotes below:
const DEFAULT_API_KEY = ""; 

// LocalStorage key configurations
const STORAGE_KEY_API_KEY = "aeroweather_api_key";
const STORAGE_KEY_HISTORY = "aeroweather_search_history";

// --------------------------------------------------------------------------
// DOM Elements Selection
// --------------------------------------------------------------------------
const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const clearInputBtn = document.getElementById("clearInputBtn");
const searchSubmitBtn = document.getElementById("searchSubmitBtn");
const searchSpinner = document.getElementById("searchSpinner");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// Weather display containers
const weatherPanel = document.getElementById("weatherPanel");
const weatherPlaceholder = document.getElementById("weatherPlaceholder");
const mainSpinner = document.getElementById("mainSpinner");
const errorCard = document.getElementById("errorCard");
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");
const weatherContent = document.getElementById("weatherContent");

// Weather fields
const cityName = document.getElementById("cityName");
const currentDate = document.getElementById("currentDate");
const weatherConditionPill = document.getElementById("weatherConditionPill");
const tempValue = document.getElementById("tempValue");
const weatherIcon = document.getElementById("weatherIcon");
const weatherDesc = document.getElementById("weatherDesc");
const humidityVal = document.getElementById("humidityVal");
const windSpeedVal = document.getElementById("windSpeedVal");
const pressureVal = document.getElementById("pressureVal");
const visibilityVal = document.getElementById("visibilityVal");

// Settings Modal elements
const settingsBtn = document.getElementById("settingsBtn");
const placeholderSetupBtn = document.getElementById("placeholderSetupBtn");
const settingsModal = document.getElementById("settingsModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const apiSettingsForm = document.getElementById("apiSettingsForm");
const apiKeyInput = document.getElementById("apiKeyInput");
const toggleKeyVisibility = document.getElementById("toggleKeyVisibility");

// --------------------------------------------------------------------------
// Application State Management
// --------------------------------------------------------------------------
let state = {
    apiKey: DEFAULT_API_KEY || localStorage.getItem(STORAGE_KEY_API_KEY) || "",
    searchHistory: JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || []
};

// --------------------------------------------------------------------------
// Initialization & Event Listeners
// --------------------------------------------------------------------------
function init() {
    setupEventListeners();
    renderHistory();
    
    // Fill the key input field with the active key if set
    if (state.apiKey) {
        apiKeyInput.value = state.apiKey;
    }
    
    // Automatically load the last searched city if present
    if (state.searchHistory.length > 0) {
        fetchWeatherData(state.searchHistory[0]);
    }
}

function setupEventListeners() {
    // Search Form submissions
    searchForm.addEventListener("submit", handleSearchSubmit);
    
    // Control inputs input-listeners
    cityInput.addEventListener("input", toggleClearButtonVisibility);
    clearInputBtn.addEventListener("click", clearSearchInput);

    // Modal Control listeners
    settingsBtn.addEventListener("click", openSettingsModal);
    if (placeholderSetupBtn) {
        placeholderSetupBtn.addEventListener("click", openSettingsModal);
    }
    modalCloseBtn.addEventListener("click", closeSettingsModal);
    modalCancelBtn.addEventListener("click", closeSettingsModal);
    apiSettingsForm.addEventListener("submit", handleSettingsSubmit);
    toggleKeyVisibility.addEventListener("click", toggleApiKeyFieldType);
    
    // Close modal when clicking outside modal box
    window.addEventListener("click", (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });

    // History controls
    clearHistoryBtn.addEventListener("click", clearAllSearchHistory);
}

// --------------------------------------------------------------------------
// Core Actions & Form Handlers
// --------------------------------------------------------------------------

/**
 * Handle weather search execution on form submission.
 */
function handleSearchSubmit(e) {
    e.preventDefault();
    const query = cityInput.value.trim();
    
    if (!query) {
        showError("Invalid Input", "Please enter a valid city name to search.");
        return;
    }

    if (!state.apiKey) {
        showError("API Key Missing", "You must configure your OpenWeatherMap API Key before executing searches.");
        openSettingsModal();
        return;
    }

    fetchWeatherData(query);
}

/**
 * Open Settings Modal Dialog.
 */
function openSettingsModal() {
    settingsModal.classList.remove("hidden");
    apiKeyInput.focus();
}

/**
 * Close Settings Modal Dialog.
 */
function closeSettingsModal() {
    settingsModal.classList.add("hidden");
}

/**
 * Toggle the password input field between plain-text and hidden status.
 */
function toggleApiKeyFieldType() {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    const icon = toggleKeyVisibility.querySelector("i");
    icon.className = isPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
}

/**
 * Save new API key configurations.
 */
function handleSettingsSubmit(e) {
    e.preventDefault();
    const key = apiKeyInput.value.trim();
    
    if (key) {
        state.apiKey = key;
        localStorage.setItem(STORAGE_KEY_API_KEY, key);
        closeSettingsModal();
        
        // Notify success
        alert("API Key configuration updated successfully!");
        
        // If there was an error card visible due to missing API key, query again with the new key.
        if (weatherContent.classList.contains("hidden") && cityInput.value.trim()) {
            fetchWeatherData(cityInput.value.trim());
        }
    }
}

/**
 * Clear the input value in the search bar.
 */
function clearSearchInput() {
    cityInput.value = "";
    clearInputBtn.style.display = "none";
    cityInput.focus();
}

/**
 * Check if clear input button should show up.
 */
function toggleClearButtonVisibility() {
    if (cityInput.value.length > 0) {
        clearInputBtn.style.display = "flex";
    } else {
        clearInputBtn.style.display = "none";
    }
}

// --------------------------------------------------------------------------
// API Fetch Logic (async/await)
// --------------------------------------------------------------------------

/**
 * Retrieve weather indicators from the OpenWeatherMap API.
 * @param {string} city - The city name query string
 */
async function fetchWeatherData(city) {
    // Show spinner UI
    setLoadingState(true);
    
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${state.apiKey}&units=metric`;
        
        const response = await fetch(url);
        
        // Handle non-OK response codes (e.g. 401 Unauthorized, 404 Not Found, 429 Rate Exceeded)
        if (!response.ok) {
            const errorDetails = await response.json();
            handleApiError(response.status, errorDetails);
            return;
        }

        // Parse nested JSON payload
        const weatherData = await response.json();
        
        // Successful response processes
        processAndDisplayWeather(weatherData);
        addToHistory(weatherData.name);

    } catch (networkError) {
        // Fetch failed due to network error, browser blocking, or DNS issues
        console.error("Network or CORS exception encountered: ", networkError);
        showError(
            "Connection Interrupted", 
            "Unable to communicate with OpenWeatherMap services. Please check your network connection and verify DNS access."
        );
    } finally {
        setLoadingState(false);
    }
}

/**
 * Handle API specific error responses.
 * @param {number} status - The HTTP response code
 * @param {object} errorData - The decoded error response object
 */
function handleApiError(status, errorData) {
    const apiMessage = errorData.message || "";
    
    if (status === 404) {
        showError(
            "City Not Found", 
            "The requested location could not be located in OpenWeatherMap coordinates. Please check spelling or try adding a country code (e.g. 'Tokyo, JP')."
        );
    } else if (status === 401) {
        showError(
            "Authentication Denied", 
            "Your OpenWeatherMap API Key is invalid or expired. Open API Settings to configure a working Key."
        );
    } else if (status === 429) {
        showError(
            "Request Quota Exceeded",
            "Too many requests have been made to the API within a short timeframe. Please wait a few moments and try again."
        );
    } else {
        showError(
            `API Exception (Status ${status})`, 
            apiMessage.charAt(0).toUpperCase() + apiMessage.slice(1) || "An unexpected error occurred while communicating with the weather service."
        );
    }
}

// --------------------------------------------------------------------------
// UI Rendering & DOM Manipulation
// --------------------------------------------------------------------------

/**
 * Switch layout cards based on state transitions.
 * @param {boolean} isLoading - Toggle loading spinners
 */
function setLoadingState(isLoading) {
    if (isLoading) {
        // Toggle spinner displays
        searchSpinner.classList.remove("hidden");
        searchSubmitBtn.disabled = true;
        
        mainSpinner.classList.remove("hidden");
        weatherPlaceholder.classList.add("hidden");
        errorCard.classList.add("hidden");
        weatherContent.classList.add("hidden");
    } else {
        searchSpinner.classList.add("hidden");
        searchSubmitBtn.disabled = false;
        mainSpinner.classList.add("hidden");
    }
}

/**
 * Display the main Weather Card and details Grid from JSON properties.
 * @param {object} data - Nested OpenWeatherMap response object
 */
function processAndDisplayWeather(data) {
    // 1. Parse and format text metrics
    const city = data.name;
    const country = data.sys.country;
    cityName.textContent = `${city}, ${country}`;
    
    // Set formatted local date
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    currentDate.textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // Weather descriptions
    const mainCondition = data.weather[0].main;
    const descriptionText = data.weather[0].description;
    weatherConditionPill.textContent = mainCondition;
    weatherDesc.textContent = descriptionText;

    // Numerical stats
    const temp = Math.round(data.main.temp);
    tempValue.textContent = temp;

    const humidity = data.main.humidity;
    humidityVal.textContent = `${humidity}%`;

    // Convert Wind Speed from m/s to km/h: speed * 3.6
    const windSpeedMps = data.wind.speed;
    const windSpeedKmh = (windSpeedMps * 3.6).toFixed(1);
    windSpeedVal.textContent = `${windSpeedKmh} km/h`;

    const pressure = data.main.pressure;
    pressureVal.textContent = `${pressure} hPa`;

    // Convert visibility from meters to kilometers
    const visibilityM = data.visibility;
    const visibilityKm = (visibilityM / 1000).toFixed(1);
    visibilityVal.textContent = `${visibilityKm} km`;

    // 2. Resolve weather icon source URL
    const iconCode = data.weather[0].icon;
    weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
    weatherIcon.alt = descriptionText;


    // 4. Toggle view elements visibility
    weatherContent.classList.remove("hidden");
    weatherPlaceholder.classList.add("hidden");
    errorCard.classList.add("hidden");
}



/**
 * Handle display of error messages.
 * @param {string} title - The header of the alert block
 * @param {string} msg - The core explanation
 */
function showError(title, msg) {
    errorTitle.textContent = title;
    errorMessage.textContent = msg;

    weatherContent.classList.add("hidden");
    weatherPlaceholder.classList.add("hidden");
    mainSpinner.classList.add("hidden");
    errorCard.classList.remove("hidden");
}

// --------------------------------------------------------------------------
// LocalStorage History Operations
// --------------------------------------------------------------------------

/**
 * Add a query string into the history tracker array.
 * @param {string} city - The successfully fetched location name
 */
function addToHistory(city) {
    // Convert to lowercase to check duplicates, but store with clean case formatting
    const normalizedSearch = city.trim();
    
    // Filter duplicates
    state.searchHistory = state.searchHistory.filter(
        item => item.toLowerCase() !== normalizedSearch.toLowerCase()
    );

    // Add to beginning of the array
    state.searchHistory.unshift(normalizedSearch);

    // Limit array size to exactly 5 elements
    if (state.searchHistory.length > 5) {
        state.searchHistory.pop();
    }

    // Save state and re-render the pills
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.searchHistory));
    renderHistory();
}

/**
 * Re-render list capsules representing search history.
 */
function renderHistory() {
    historyList.innerHTML = "";

    if (state.searchHistory.length === 0) {
        historyList.innerHTML = `<li class="history-placeholder">No recent searches yet.</li>`;
        return;
    }

    state.searchHistory.forEach(city => {
        const item = document.createElement("li");
        item.className = "history-item";
        
        item.innerHTML = `
            <button class="history-item-btn" type="button">${city}</button>
            <button class="delete-history-btn" type="button" aria-label="Remove ${city} from history">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        // Click search button
        item.querySelector(".history-item-btn").addEventListener("click", () => {
            cityInput.value = city;
            toggleClearButtonVisibility();
            fetchWeatherData(city);
        });

        // Click delete button
        item.querySelector(".delete-history-btn").addEventListener("click", (e) => {
            e.stopPropagation(); // Avoid triggering search listener
            deleteHistoryItem(city);
        });

        historyList.appendChild(item);
    });
}

/**
 * Delete a specific entry from search history cache.
 * @param {string} city - Target search term to remove
 */
function deleteHistoryItem(city) {
    state.searchHistory = state.searchHistory.filter(
        item => item.toLowerCase() !== city.toLowerCase()
    );
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.searchHistory));
    renderHistory();
}

/**
 * Reset all cached cities.
 */
function clearAllSearchHistory() {
    if (state.searchHistory.length === 0) return;
    
    if (confirm("Are you sure you want to clear your search history?")) {
        state.searchHistory = [];
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        renderHistory();
    }
}

// --------------------------------------------------------------------------
// Start Application Context
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);
