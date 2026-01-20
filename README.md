# Tweet Hours — Twitter Activity Analyzer

A beautiful web application that analyzes Twitter/X accounts to show when they're most active. Visualize activity patterns with heatmaps and charts.

![Python](https://img.shields.io/badge/python-3.11+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green) ![License](https://img.shields.io/badge/license-MIT-1A1A1A)

## ✨ Features

- 🔓 **No API key required** — uses web scraping
- 🗺️ **Activity heatmap** — visualize day × hour patterns
- 📊 **Distribution charts** — hourly and daily breakdowns
- 🔥 **Peak analysis** — discover most active hours and days
- 🌍 **Timezone support** — convert times to any timezone
- ✨ **Beautiful UI** — clean, editorial design system

## 🚀 Quick Start (Local)

### 1. Install Dependencies

```bash
pip install -r requirements.txt
playwright install chromium
```

### 2. Run the App

```bash
python main.py
```

### 3. Open in Browser

Go to **http://localhost:8000**

---

## 🌐 Deploy to Production

### Option 1: Railway (Recommended)

**Step 1:** Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tweet-hours.git
git push -u origin main
```

**Step 2:** Deploy
1. Go to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway auto-detects the Dockerfile and deploys
5. Your app is live at `https://your-app.railway.app`

---

### Option 2: Render

1. Push to GitHub (same as above)
2. Go to [render.com](https://render.com)
3. Click **"New"** → **"Web Service"**
4. Connect your GitHub repository
5. Select **"Docker"** as environment
6. Click **"Create Web Service"**

---

### Option 3: Fly.io

```bash
# Install Fly CLI (Windows PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Login and deploy
fly auth login
fly launch --name tweet-hours
fly deploy
```

---

## 📁 Project Structure

```
tweet-hours/
├── main.py              # FastAPI backend
├── scraper.py           # Playwright Twitter scraper
├── requirements.txt     # Python dependencies
├── Dockerfile           # Container config
├── railway.toml         # Railway deployment config
├── render.yaml          # Render deployment config
├── design-system.json   # UI design tokens
├── templates/
│   └── index.html       # Main page template
└── static/
    ├── css/
    │   └── style.css    # Editorial Minimal styles
    └── js/
        └── app.js       # Frontend JavaScript
```

## 🔧 How It Works

1. **Scraping** — Playwright launches headless Chromium to visit public Twitter profiles
2. **Parsing** — Extracts tweet timestamps from the DOM
3. **Analysis** — Aggregates data by hour and day of week
4. **Visualization** — Renders heatmap and charts with Chart.js

## 🎨 Design System

The UI uses the **Editorial Minimal** design system:
- Serif headings (Playfair Display)
- Clean sans-serif body (Inter)
- Warm off-white backgrounds
- Subtle shadows and borders
- Earth-tone heatmap colors

## ⚠️ Notes

- Only works with **public** Twitter profiles
- Scraping may be slower than API calls (10-20 seconds)
- Twitter may occasionally block requests
- Demo mode available if scraping fails

## 📄 License

MIT — use however you like!

---

Built with FastAPI, Playwright, and Chart.js
