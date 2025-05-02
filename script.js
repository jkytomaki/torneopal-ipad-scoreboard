document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const scoreboardScreen = document.getElementById('scoreboard-screen');
    const matchIdInput = document.getElementById('match-id-input');
    const loadMatchButton = document.getElementById('load-match-button');
    const resetButton = document.getElementById('reset-button');

    const scoreAElement = document.getElementById('score-a');
    const teamNameAElement = document.getElementById('team-name-a');
    const scoreBElement = document.getElementById('score-b');
    const teamNameBElement = document.getElementById('team-name-b');

    const startErrorElement = document.getElementById('start-error');
    const scoreErrorElement = document.getElementById('score-error');

    const API_BASE_URL = 'https://torneopal.helsinkibasketballfestival.fi/taso/rest/getScore';
    const POLLING_INTERVAL = 5000; // 5 seconds

    let currentMatchId = null;
    let pollingIntervalId = null;
    let wakeLock = null;
    let retryTimeoutId = null;

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
    const fetchScore = async (matchId) => {
        clearTimeout(retryTimeoutId); // Clear any pending retries
        scoreErrorElement.textContent = ''; // Clear previous errors
        scoreErrorElement.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}?match_id=${matchId}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Match not found (ID: ${matchId}).`);
                } else {
                    throw new Error(`Network error: ${response.status} ${response.statusText}`);
                }
            }

            const data = await response.json();

            if (!data || !data.score) {
                 // Handle cases where API returns success but no score data (or unexpected format)
                 // This might happen for valid IDs but non-existent/uninitialized matches
                console.warn('API returned success but no score data found for match ID:', matchId);
                // Treat as 'Match not found' or similar for user feedback
                throw new Error(`Score data not available for Match ID: ${matchId}.`);
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
            // Schedule a retry
            retryTimeoutId = setTimeout(() => fetchScore(matchId), POLLING_INTERVAL);
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
    const startPolling = (matchId) => {
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId); // Clear existing interval if any
        }
        fetchScore(matchId); // Fetch immediately
        pollingIntervalId = setInterval(() => fetchScore(matchId), POLLING_INTERVAL);
    };

    const stopPolling = () => {
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
        }
        clearTimeout(retryTimeoutId); // Clear any pending retries
    };

    // --- Event Listeners ---
    matchIdInput.addEventListener('input', () => {
        const isValid = matchIdInput.value.trim().length > 0 && /^[0-9]+$/.test(matchIdInput.value);
        loadMatchButton.disabled = !isValid;
        if (isValid) {
            displayStartError(''); // Clear error on valid input
        }
    });

    loadMatchButton.addEventListener('click', async () => {
        const matchId = matchIdInput.value.trim();
        if (!matchId) return;

        // Basic validation before attempting fetch
        if (!/^[0-9]+$/.test(matchId)) {
             displayStartError('Invalid Match ID. Please enter numbers only.');
             return;
        }

        currentMatchId = matchId;
        displayStartError(''); // Clear previous errors
        console.log(`Loading match ID: ${currentMatchId}`);

        // Show scoreboard immediately (fetch will update it)
        // Reset scores visually while loading
        updateScoreboard({ live_A: '?', team_A_name: 'Loading...', live_B: '?', team_B_name: 'Loading...' });
        switchScreen(scoreboardScreen);

        // Request wake lock *before* starting polling
        await requestWakeLock();

        // Start fetching/polling
        startPolling(currentMatchId);
    });

    resetButton.addEventListener('click', async () => {
        console.log('Resetting...');
        stopPolling();
        await releaseWakeLock(); // Release wake lock
        currentMatchId = null;
        matchIdInput.value = ''; // Clear input
        loadMatchButton.disabled = true; // Disable button
        displayStartError(''); // Clear errors
        displayScoreError('');
        switchScreen(startScreen);
    });

    // Prevent form submission if wrapped in a form
    matchIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default Enter behavior
            if (!loadMatchButton.disabled) {
                loadMatchButton.click(); // Trigger button click
            }
        }
    });

    // Initial setup
    loadMatchButton.disabled = true; // Ensure button is disabled initially
    switchScreen(startScreen); // Show start screen by default

});
