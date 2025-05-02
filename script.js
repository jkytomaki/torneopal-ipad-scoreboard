document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const scoreboardScreen = document.getElementById('scoreboard-screen');
    const hostnameInput = document.getElementById('hostname-input');
    const matchIdInput = document.getElementById('match-id-input');
    const loadMatchButton = document.getElementById('load-match-button');
    const resetButton = document.getElementById('reset-button');
    const increaseFontButton = document.getElementById('increase-font-button');
    const decreaseFontButton = document.getElementById('decrease-font-button');
    const reloadButtonStart = document.getElementById('reload-button-start');
    const reloadButtonScore = document.getElementById('reload-button-score');

    const scoreAElement = document.getElementById('score-a');
    const teamNameAElement = document.getElementById('team-name-a');
    const scoreBElement = document.getElementById('score-b');
    const teamNameBElement = document.getElementById('team-name-b');

    const startErrorElement = document.getElementById('start-error');
    const scoreErrorElement = document.getElementById('score-error');

    const POLLING_INTERVAL = 5000; // 5 seconds
    const HOSTNAME_STORAGE_KEY = 'scoreboard_hostname';
    const FONT_SIZE_FACTOR_STORAGE_KEY = 'scoreboard_font_size_factor';
    const FONT_SIZE_STEP = 0.05; // Smaller step for finer control
    const MIN_FONT_FACTOR = 0.5;
    const MAX_FONT_FACTOR = 3.0; // Adjust max as needed

    let currentMatchId = null;
    let currentHostname = null;
    let pollingIntervalId = null;
    let wakeLock = null;
    let retryTimeoutId = null;
    let scoreFontSizeFactor = 1.0; // Default factor

    // --- Local Storage ---
    const getStoredHostname = () => {
        return localStorage.getItem(HOSTNAME_STORAGE_KEY);
    };

    const storeHostname = (hostname) => {
        localStorage.setItem(HOSTNAME_STORAGE_KEY, hostname);
    };

    const getStoredFontSizeFactor = () => {
        const stored = localStorage.getItem(FONT_SIZE_FACTOR_STORAGE_KEY);
        // Ensure it's within bounds if loaded
        if (stored) {
            const factor = parseFloat(stored);
            if (!isNaN(factor) && factor >= MIN_FONT_FACTOR && factor <= MAX_FONT_FACTOR) {
                return factor;
            }
        }
        return 1.0; // Default if not stored or invalid
    };

    const storeFontSizeFactor = (factor) => {
        localStorage.setItem(FONT_SIZE_FACTOR_STORAGE_KEY, factor);
    };

    // --- Font Size Adjustment ---
    const applyFontSizeFactor = () => {
        document.documentElement.style.setProperty('--score-font-size-factor', scoreFontSizeFactor);
        console.log(`Applied font size factor: ${scoreFontSizeFactor}`);
    };

    const increaseFontSize = () => {
        if (scoreFontSizeFactor < MAX_FONT_FACTOR) {
            scoreFontSizeFactor = parseFloat((scoreFontSizeFactor + FONT_SIZE_STEP).toFixed(2)); // Avoid floating point issues
            // Clamp to max just in case
            if (scoreFontSizeFactor > MAX_FONT_FACTOR) scoreFontSizeFactor = MAX_FONT_FACTOR;
            applyFontSizeFactor();
            storeFontSizeFactor(scoreFontSizeFactor);
        }
    };

    const decreaseFontSize = () => {
         if (scoreFontSizeFactor > MIN_FONT_FACTOR) {
            scoreFontSizeFactor = parseFloat((scoreFontSizeFactor - FONT_SIZE_STEP).toFixed(2)); // Avoid floating point issues
             // Clamp to min just in case
            if (scoreFontSizeFactor < MIN_FONT_FACTOR) scoreFontSizeFactor = MIN_FONT_FACTOR;
            applyFontSizeFactor();
            storeFontSizeFactor(scoreFontSizeFactor);
        }
    };


    // --- Screen Wake Lock ---
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => {
                    console.log('Screen Wake Lock released:', wakeLock);
                    // If it was released unexpectedly (e.g., tab backgrounded),
                    // it will be re-requested on visibilitychange.
                    wakeLock = null;
                });
                console.log('Screen Wake Lock acquired:', wakeLock);
            } catch (err) {
                console.error(`Screen Wake Lock failed: ${err.name}`, err);
                wakeLock = null; // Ensure wakeLock is null if request fails
            }
        } else {
            console.warn('Screen Wake Lock API not supported.');
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLock !== null) {
            try {
                await wakeLock.release();
                wakeLock = null;
                console.log('Screen Wake Lock released manually.');
            } catch (err) {
                console.error(`Screen Wake Lock release failed: ${err.name}`, err);
            }
        }
    };

    // Re-acquire wake lock when tab becomes visible
    document.addEventListener('visibilitychange', async () => {
        if (wakeLock === null && document.visibilityState === 'visible' && scoreboardScreen.classList.contains('active')) {
            console.log('Tab became visible, re-acquiring Wake Lock...');
            await requestWakeLock();
        }
    });

    // --- API Fetching ---
    const fetchScore = async (hostname, matchId) => {
        clearTimeout(retryTimeoutId); // Clear any pending retries
        scoreErrorElement.textContent = ''; // Clear previous errors
        scoreErrorElement.style.display = 'none';

        const API_URL = `https://${hostname}/taso/rest/getScore?match_id=${matchId}`;
        console.log(`Fetching score from: ${API_URL}`);

        try {
            const response = await fetch(API_URL);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Match not found (ID: ${matchId} on ${hostname}).`);
                } else {
                     // Try to get text for more specific errors if possible
                    let errorText = `${response.status} ${response.statusText}`;
                    try {
                        const text = await response.text();
                        if(text) errorText += `: ${text}`;
                    } catch(e) { /* Ignore if text cannot be read */ }
                    throw new Error(`Network error: ${errorText}`);
                }
            }

            const data = await response.json();

            if (!data || !data.score) {
                 // Handle cases where API returns success but no score data (or unexpected format)
                 // This might happen for valid IDs but non-existent/uninitialized matches
                console.warn('API returned success but no score data found for match ID:', matchId, 'on host:', hostname);
                // Treat as 'Match not found' or similar for user feedback
                throw new Error(`Score data not available for Match ID: ${matchId} on ${hostname}.`);
            }

            updateScoreboard(data.score);
            // If successful, schedule next poll if polling is active
            if (pollingIntervalId) {
               // This check prevents scheduling if polling was stopped during the fetch
               // (e.g., user hit Reset)
            }

        } catch (error) {
            console.error('Failed to fetch score:', error);
            displayScoreError(`Error: ${error.message} Retrying...`);
            // Schedule a retry using the current hostname and matchId
            retryTimeoutId = setTimeout(() => fetchScore(currentHostname, currentMatchId), POLLING_INTERVAL);
        }
    };

    // --- UI Updates ---
    const updateScoreboard = (scoreData) => {
        scoreAElement.textContent = scoreData.live_A !== null ? scoreData.live_A : '-';
        teamNameAElement.textContent = scoreData.team_A_name || 'Team A';
        scoreBElement.textContent = scoreData.live_B !== null ? scoreData.live_B : '-';
        teamNameBElement.textContent = scoreData.team_B_name || 'Team B';

        // Optional: Adjust background colors if provided by API or based on team names
        // e.g., document.getElementById('team-a').style.backgroundColor = scoreData.team_A_color || 'var(--team-a-bg)';
    };

    const displayStartError = (message) => {
        startErrorElement.textContent = message;
        startErrorElement.style.display = message ? 'block' : 'none';
    };

    const displayScoreError = (message) => {
        scoreErrorElement.textContent = message;
        scoreErrorElement.style.display = message ? 'block' : 'none';
    };

    const switchScreen = (screenToShow) => {
        startScreen.classList.remove('active');
        scoreboardScreen.classList.remove('active');
        screenToShow.classList.add('active');
    };

    // --- Polling Control ---
    const startPolling = (hostname, matchId) => {
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId); // Clear existing interval if any
        }
        fetchScore(hostname, matchId); // Fetch immediately
        pollingIntervalId = setInterval(() => fetchScore(hostname, matchId), POLLING_INTERVAL);
    };

    const stopPolling = () => {
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
        }
        clearTimeout(retryTimeoutId); // Clear any pending retries
    };

    // --- Input Validation ---
    const validateInputs = () => {
        const hostname = hostnameInput.value.trim();
        const matchId = matchIdInput.value.trim();
        // Basic validation: hostname not empty, matchId not empty and contains only digits
        const isHostnameValid = hostname.length > 0;
        // Simple hostname validation (does it look like a domain?) - can be improved
        const looksLikeHostname = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(hostname);
        const isMatchIdValid = matchId.length > 0 && /^[0-9]+$/.test(matchId);

        const isValid = isHostnameValid && looksLikeHostname && isMatchIdValid;
        loadMatchButton.disabled = !isValid;

        if (isValid) {
            displayStartError(''); // Clear error on valid input
        } else if (hostname.length > 0 && !looksLikeHostname) {
            displayStartError('Invalid hostname format.');
        } else if (matchId.length > 0 && !isMatchIdValid) {
             displayStartError('Invalid Match ID. Please enter numbers only.');
        } else {
            displayStartError(''); // Clear if just empty
        }
    };

    // --- Reload Function ---
    const reloadApp = () => {
        console.log('Reloading application...');
        // true forces reload from server, bypassing cache
        location.reload(true);
    };

    // --- Event Listeners ---
    hostnameInput.addEventListener('input', validateInputs);
    matchIdInput.addEventListener('input', validateInputs);

    loadMatchButton.addEventListener('click', async () => {
        const hostname = hostnameInput.value.trim();
        const matchId = matchIdInput.value.trim();

        // Re-validate just in case
        if (loadMatchButton.disabled) {
            displayStartError('Please enter a valid hostname and match ID.');
            return;
        }

        currentHostname = hostname;
        currentMatchId = matchId;
        storeHostname(currentHostname); // Save hostname to localStorage

        displayStartError(''); // Clear previous errors
        console.log(`Loading match ID: ${currentMatchId} from host: ${currentHostname}`);

        // Apply the current/stored font size factor *before* showing the screen
        applyFontSizeFactor();

        // Show scoreboard immediately (fetch will update it)
        // Reset scores visually while loading
        updateScoreboard({ live_A: '?', team_A_name: 'Loading...', live_B: '?', team_B_name: 'Loading...' });
        switchScreen(scoreboardScreen);

        // Request wake lock *before* starting polling
        await requestWakeLock();

        // Start fetching/polling
        startPolling(currentHostname, currentMatchId);
    });

    resetButton.addEventListener('click', async () => {
        console.log('Resetting...');
        stopPolling();
        await releaseWakeLock(); // Release wake lock
        currentMatchId = null;
        currentHostname = null; // Clear current hostname variable
        // Don't clear hostnameInput here, it will be repopulated from localStorage
        matchIdInput.value = ''; // Clear match ID input
        displayStartError(''); // Clear errors
        displayScoreError('');
        switchScreen(startScreen);
        // Re-validate inputs (this will disable the button as matchId is empty)
        validateInputs();
        // Ensure hostname field is populated from storage if needed
        const storedHostname = getStoredHostname();
         if (storedHostname) {
            hostnameInput.value = storedHostname;
         }
         validateInputs(); // Re-validate after potentially filling hostname
    });

    increaseFontButton.addEventListener('click', increaseFontSize);
    decreaseFontButton.addEventListener('click', decreaseFontSize);

    reloadButtonStart.addEventListener('click', reloadApp);
    reloadButtonScore.addEventListener('click', reloadApp);


    // Prevent form submission if wrapped in a form (though not currently in a form)
    const handleEnter = (e) => {
         if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default Enter behavior
            if (!loadMatchButton.disabled) {
                loadMatchButton.click(); // Trigger button click
            }
        }
    };
    hostnameInput.addEventListener('keypress', handleEnter);
    matchIdInput.addEventListener('keypress', handleEnter);


    // --- Initial Setup ---
    // Load stored values
    const storedHostname = getStoredHostname();
    if (storedHostname) {
        hostnameInput.value = storedHostname;
    }
    scoreFontSizeFactor = getStoredFontSizeFactor(); // Load stored font size factor
    applyFontSizeFactor(); // Apply the initial factor immediately

    validateInputs(); // Initial validation to set button state
    switchScreen(startScreen); // Show start screen by default

});
