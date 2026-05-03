# Diet & Workout Planner

An AI-powered fitness app that generates personalized diet plans, workout routines, and calculates BMI/calorie targets — built with vanilla HTML/CSS/JS and Claude AI.

## Features

- **Diet plan** — 7-day meal plan based on your profile, goals, and dietary preferences (vegetarian, vegan, non-veg, low-carb, high-protein, etc.)
- **Workout plan** — Weekly split tailored to your fitness level, available equipment, and goals
- **BMI & calories** — Instant BMI, BMR, and TDEE calculator with contextual advice

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/amitsingh12ap/diet-workout-planner.git
cd diet-workout-planner
```

### 2. Add your API key

Open `app.js` and replace `'YOUR_API_KEY_HERE'` with your [Anthropic API key](https://console.anthropic.com/):

```js
const API_KEY = 'sk-ant-...';
```

> **Note:** For production, never expose API keys in client-side code. Use a backend proxy (Node.js/Express, Cloudflare Workers, etc.) to keep the key secure.

### 3. Run locally

Just open `index.html` in your browser — no build step needed.

Or use a simple local server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Tech stack

- Vanilla HTML, CSS, JavaScript
- [Anthropic Claude API](https://docs.anthropic.com) (claude-haiku-4-5)
- No frameworks, no dependencies

## Project structure

```
diet-workout-planner/
├── index.html   # App shell & UI
├── style.css    # Styles
├── app.js       # Logic, API calls, BMI calculator
└── README.md
```

## License

MIT
