"""
Twitter Activity Analyzer - Backend
Analyzes tweet timestamps to show when accounts are most active
Now uses web scraping - NO API KEY REQUIRED!
"""

import os
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional
import random
import asyncio

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Import the scraper
from scraper import scrape_twitter_activity, analyze_scraped_data

# Load environment variables
load_dotenv()

app = FastAPI(title="Twitter Activity Analyzer")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


class ActivityResponse(BaseModel):
    username: str
    display_name: str
    profile_image: str
    total_tweets_analyzed: int
    hourly_activity: dict  # hour (0-23) -> count
    daily_activity: dict   # day (0-6, Mon-Sun) -> count
    heatmap_data: list     # 7 days x 24 hours matrix
    peak_hours: list       # Top 3 most active hours
    peak_days: list        # Top 3 most active days
    timezone_note: str
    is_demo: bool


def generate_demo_data(username: str) -> ActivityResponse:
    """Generate realistic demo data for testing"""
    
    hourly = defaultdict(int)
    daily = defaultdict(int)
    heatmap = [[0 for _ in range(24)] for _ in range(7)]
    
    num_tweets = random.randint(150, 300)
    
    for _ in range(num_tweets):
        hour_weights = [1, 1, 1, 1, 1, 2, 3, 5, 8, 10, 12, 14, 
                       15, 14, 13, 14, 16, 18, 20, 22, 18, 12, 6, 3]
        hour = random.choices(range(24), weights=hour_weights)[0]
        
        day_weights = [18, 20, 22, 20, 18, 12, 10]
        day = random.choices(range(7), weights=day_weights)[0]
        
        hourly[hour] += 1
        daily[day] += 1
        heatmap[day][hour] += 1
    
    hourly_dict = {str(h): hourly[h] for h in range(24)}
    daily_dict = {str(d): daily[d] for d in range(7)}
    
    sorted_hours = sorted(hourly.items(), key=lambda x: x[1], reverse=True)
    sorted_days = sorted(daily.items(), key=lambda x: x[1], reverse=True)
    
    peak_hours = [{"hour": h, "count": c} for h, c in sorted_hours[:3]]
    peak_days = [{"day": d, "count": c} for d, c in sorted_days[:3]]
    
    return ActivityResponse(
        username=username,
        display_name=f"@{username}",
        profile_image="",
        total_tweets_analyzed=num_tweets,
        hourly_activity=hourly_dict,
        daily_activity=daily_dict,
        heatmap_data=heatmap,
        peak_hours=peak_hours,
        peak_days=peak_days,
        timezone_note="Times shown in UTC (demo mode)",
        is_demo=True
    )


async def fetch_via_scraper(username: str) -> ActivityResponse:
    """Fetch data by scraping Twitter directly - NO API NEEDED"""
    
    # Scrape the profile
    scraped_data = await scrape_twitter_activity(username, max_tweets=50)
    
    if not scraped_data.get("success"):
        error_msg = scraped_data.get("error", "Failed to scrape profile")
        
        if "not found" in error_msg.lower() or "suspended" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        elif "timed out" in error_msg.lower():
            raise HTTPException(status_code=504, detail=error_msg)
        else:
            raise HTTPException(status_code=500, detail=error_msg)
    
    # Analyze the scraped data
    analysis = analyze_scraped_data(scraped_data)
    
    if not analysis:
        raise HTTPException(status_code=404, detail=f"No tweets found for @{username}")
    
    return ActivityResponse(
        username=analysis["username"],
        display_name=analysis["display_name"],
        profile_image=analysis.get("profile_image", ""),
        total_tweets_analyzed=analysis["total_tweets_analyzed"],
        hourly_activity=analysis["hourly_activity"],
        daily_activity=analysis["daily_activity"],
        heatmap_data=analysis["heatmap_data"],
        peak_hours=analysis["peak_hours"],
        peak_days=analysis["peak_days"],
        timezone_note=analysis["timezone_note"],
        is_demo=False
    )


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the main page"""
    return templates.TemplateResponse("index.html", {
        "request": request,
        "demo_mode": False  # Scraper mode is always "live"
    })


@app.get("/api/analyze/{username}")
async def analyze_user(
    username: str, 
    demo: bool = Query(False, description="Use demo data instead of scraping")
) -> ActivityResponse:
    """Analyze a Twitter user's activity patterns"""
    
    # Clean username
    username = username.strip().lstrip("@")
    
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    # Use demo mode if requested
    if demo:
        return generate_demo_data(username)
    
    # Scrape real data
    try:
        return await fetch_via_scraper(username)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/status")
async def get_status():
    """Check API status and mode"""
    return {
        "status": "online",
        "mode": "scraper",
        "message": "Using web scraper - No API key required!",
        "demo_mode": False
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("[OK] Twitter Activity Analyzer")
    print("    Mode: Web Scraper (No API key needed!)")
    print("    Scraping public Twitter profiles directly")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
