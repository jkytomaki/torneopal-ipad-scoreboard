Mietti pari sekuntia


Here’s a suggested spec you can hand off to your coding assistant. Feel free to tweak any of the details or add/remove sections as your project dictates.

---

# Basketball Scoreboard Web App Specification

## 1. Overview

A simple, full-screen web app for iPad to display live basketball scores.

1. **Start Screen:** Ask the user for a `match_id`.
2. **Scoreboard Screen:**

   * Show team names (`team_A_name`, `team_B_name`)
   * Show live scores (`live_A`, `live_B`)
   * Auto-refresh periodically
   * “Reset” button to return to Start Screen

Additionally, prevent the iPad from sleeping while the app is open.

---

## 2. User Stories

1. **As a scorekeeper**, I want to enter a match ID so that the app knows which game to track.
2. **As a scorekeeper**, I want to see each team’s name and current score in large text, so spectators can easily read it.
3. **As a scorekeeper**, I want the scores to update automatically every few seconds.
4. **As a scorekeeper**, I want a button to reset or switch to a different match at any time.
5. **As an operator**, I want the screen to stay awake while the app is running.

---

## 3. Functional Requirements

### 3.1 Start Screen

* **Input**:

  * Text field (number only) for `match_id`.
  * “Load Match” button (disabled unless a valid ID is entered).
* **Behavior**:

  * On submit, navigate to the Scoreboard Screen.

### 3.2 Scoreboard Screen

* **Display**:

  * Two columns side-by-side (or top/bottom in landscape):

    * **Left:** Team A name and score
    * **Right:** Team B name and score
  * Large, centered typography for readability.
  * Background color blocks (e.g. blue/red) to differentiate sides.
* **Data source**:

  * Poll `GET https://torneopal.helsinkibasketballfestival.fi/taso/rest/getScore?match_id={match_id}`
  * Update interval: every 5 seconds (configurable).
* **Fields to use**:

  * `team_A_name`, `team_B_name`
  * `live_A`, `live_B`
* **Error states**:

  * Show a friendly message (e.g. “Failed to fetch. Retry?”) if the network request fails or returns invalid data.
* **Reset control**:

  * A small “↺ Reset” button in the bottom-corner that stops polling and returns to the Start Screen.

---

## 4. Non-Functional Requirements

* **Full screen**: Hide any browser UI (use the Web App manifest or `display: standalone`).
* **Prevent sleep**:

  * Use the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) to keep the display on.
* **Responsiveness**:

  * Optimize for iPad resolution in both portrait and landscape.
* **Accessibility**:

  * High-contrast text
  * ARIA labels on buttons and inputs
* **Performance**:

  * Keep payloads minimal
  * Handle errors gracefully

---

## 5. Tech Stack & Tools

* **Core**:

  * HTML5, CSS3, vanilla JavaScript (or lightweight framework e.g. Preact).
* **Styling**:

  * CSS custom properties for colors/fonts
  * Flexbox or Grid for layout
* **Build** (optional):

  * Vite / Rollup
* **Deployment**:

  * Host as static files (e.g. GitHub Pages, Netlify)

---

## 6. UI Wireframes (ASCII / Rough)

### 6.1 Start Screen

```
┌───────────────────────────┐
│      Enter Match ID       │
│  [  ________ ]  [ Load ]  │
└───────────────────────────┘
```

### 6.2 Scoreboard Screen

```
┌─────────────────────────────────────────┐
│               TEAM A      TEAM B      │
│                                         │
│   ┌───────────┐   ┌───────────┐         │
│   │   12      │   │   59      │         │
│   │ HNMKY …   │   │ RBS Jugla │         │
│   └───────────┘   └───────────┘         │
│                                         │
│                 [↺ Reset]              │
└─────────────────────────────────────────┘
```

---

## 7. API Integration

* **Endpoint:**

  ```
  GET https://torneopal.helsinkibasketballfestival.fi/taso/rest/getScore
       ?match_id={match_id}
  ```
* **Response JSON path:**

  ```js
  const data = response.score;
  const teamA = data.team_A_name;
  const teamB = data.team_B_name;
  const scoreA = data.live_A;
  const scoreB = data.live_B;
  ```
* **Polling:**

  ```js
  setInterval(fetchScore, 5000);
  ```

---

## 8. Screen Wake Lock

```js
let wakeLock;
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.error('Wake Lock failed:', err);
  }
}
document.addEventListener('visibilitychange', () => {
  if (wakeLock && document.visibilityState === 'visible') {
    requestWakeLock();
  }
});
```

---

## 9. Error Handling

* **Invalid ID** → Show “Match not found.”
* **Network error** → Show “Connection lost. Retrying…” and retry in 5 s.
* **Reset** → Clear interval, release wake lock, go back to Start Screen.

---

## 10. Next Steps

1. **Design review**: finalize colors, fonts, dimensions.
2. **Prototype**: scaffold HTML/CSS, implement JS fetch & render.
3. **Test on iPad**: verify full-screen & wake-lock behavior.
4. **Deploy**: publish to static-host and share URL with operators.

---

*End of spec*
