# Basketball Scoreboard Web App

A simple, full-screen web application designed primarily for iPad to display live basketball scores fetched from a specified tournament API.

**Note:** This application is specifically designed to work with the API structure provided by **Torneopal** tournament management systems. It expects the score data to be available at `https://<tournament-hostname>/taso/rest/getScore?match_id=<match_id>`.

## Features

*   **Live Score Display:** Shows team names and scores for a selected match.
*   **Configurable API Host:** Allows specifying the hostname for the Torneopal tournament API.
*   **Auto-Refresh:** Scores update automatically every 5 seconds.
*   **Screen Wake Lock:** Prevents the device screen from sleeping while the scoreboard is active.
*   **Persistent Hostname:** Remembers the last used tournament hostname for convenience.
*   **Full-Screen Capable:** Can be added to the Home Screen on iOS/iPadOS for an app-like experience.

## Usage

1.  Open the web app in a browser (optimized for iPad).
2.  On the start screen:
    *   Enter the **Tournament Hostname** (e.g., `torneopal.helsinkibasketballfestival.fi`). This is the domain where the Torneopal instance for your tournament is hosted.
    *   Enter the **Match ID** for the game you want to display.
3.  Click "Load Match".
4.  The scoreboard for the specified match will be displayed and update automatically.
5.  Click the "↺ Reset" button to return to the start screen and load a different match.

## Deployment

This is a static web application (HTML, CSS, JavaScript). Deploy the contents of the repository (`index.html`, `style.css`, `script.js`, `manifest.json`, and the `icons/` directory) to any static web hosting service (e.g., AWS S3/CloudFront, Netlify, Vercel, GitHub Pages).
