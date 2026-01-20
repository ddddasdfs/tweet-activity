"""
Twitter Scraper - No API Required
Uses Playwright to scrape tweet timestamps from public profiles
"""

import asyncio
import re
from datetime import datetime
from collections import defaultdict
from typing import Optional
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout


async def scrape_twitter_activity(username: str, max_tweets: int = 50) -> dict:
    """
    Scrape tweets from a public Twitter profile using Playwright.
    Returns activity data including timestamps.
    """
    
    result = {
        "success": False,
        "username": username,
        "display_name": f"@{username}",
        "profile_image": "",
        "tweets": [],
        "error": None
    }
    
    async with async_playwright() as p:
        # Launch browser in headless mode
        browser = await p.chromium.launch(headless=True)
        
        # Create context with realistic user agent
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        
        page = await context.new_page()
        
        try:
            # Navigate to the user's profile
            url = f"https://twitter.com/{username}"
            await page.goto(url, wait_until="networkidle", timeout=30000)
            
            # Wait a bit for content to load
            await asyncio.sleep(2)
            
            # Check if user exists (look for error messages)
            page_content = await page.content()
            if "This account doesn't exist" in page_content or "Account suspended" in page_content:
                result["error"] = f"User @{username} not found or suspended"
                await browser.close()
                return result
            
            # Try to get profile name
            try:
                name_element = await page.query_selector('[data-testid="UserName"]')
                if name_element:
                    name_text = await name_element.inner_text()
                    # First line is usually the display name
                    result["display_name"] = name_text.split('\n')[0] if name_text else f"@{username}"
            except:
                pass
            
            # Try to get profile image
            try:
                avatar = await page.query_selector(f'img[alt="Opens profile photo"]')
                if avatar:
                    result["profile_image"] = await avatar.get_attribute("src")
            except:
                pass
            
            # Scroll to load more tweets
            tweets_data = []
            scroll_attempts = 0
            max_scrolls = 10
            
            while len(tweets_data) < max_tweets and scroll_attempts < max_scrolls:
                # Find all tweet articles
                tweet_elements = await page.query_selector_all('article[data-testid="tweet"]')
                
                for tweet in tweet_elements:
                    try:
                        # Find the time element within the tweet
                        time_element = await tweet.query_selector('time')
                        if time_element:
                            datetime_str = await time_element.get_attribute("datetime")
                            if datetime_str and datetime_str not in [t["datetime"] for t in tweets_data]:
                                tweets_data.append({
                                    "datetime": datetime_str
                                })
                    except:
                        continue
                
                # Scroll down
                await page.evaluate("window.scrollBy(0, 1000)")
                await asyncio.sleep(1.5)
                scroll_attempts += 1
                
                # Check if we have enough tweets
                if len(tweets_data) >= max_tweets:
                    break
            
            result["tweets"] = tweets_data[:max_tweets]
            result["success"] = len(tweets_data) > 0
            
            if not result["success"]:
                result["error"] = f"No tweets found for @{username}"
            
        except PlaywrightTimeout:
            result["error"] = "Request timed out. Twitter may be slow or blocking requests."
        except Exception as e:
            result["error"] = f"Scraping error: {str(e)}"
        finally:
            await browser.close()
    
    return result


def analyze_scraped_data(scraped_data: dict) -> dict:
    """
    Analyze scraped tweet data to extract activity patterns.
    """
    
    if not scraped_data.get("success") or not scraped_data.get("tweets"):
        return None
    
    hourly = defaultdict(int)
    daily = defaultdict(int)
    heatmap = [[0 for _ in range(24)] for _ in range(7)]
    
    for tweet in scraped_data["tweets"]:
        try:
            # Parse ISO datetime string
            dt_str = tweet["datetime"]
            # Handle various datetime formats
            if dt_str.endswith("Z"):
                dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(dt_str)
            
            hour = dt.hour
            day = dt.weekday()
            
            hourly[hour] += 1
            daily[day] += 1
            heatmap[day][hour] += 1
            
        except Exception as e:
            continue
    
    # Convert to regular dicts
    hourly_dict = {str(h): hourly[h] for h in range(24)}
    daily_dict = {str(d): daily[d] for d in range(7)}
    
    # Find peaks
    sorted_hours = sorted(hourly.items(), key=lambda x: x[1], reverse=True)
    sorted_days = sorted(daily.items(), key=lambda x: x[1], reverse=True)
    
    peak_hours = [{"hour": h, "count": c} for h, c in sorted_hours[:3] if c > 0]
    peak_days = [{"day": d, "count": c} for d, c in sorted_days[:3] if c > 0]
    
    # Find the most recent tweet timestamp
    last_tweet_time = None
    if scraped_data["tweets"]:
        try:
            timestamps = []
            for tweet in scraped_data["tweets"]:
                dt_str = tweet["datetime"]
                if dt_str.endswith("Z"):
                    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                else:
                    dt = datetime.fromisoformat(dt_str)
                timestamps.append(dt)
            if timestamps:
                last_tweet_time = max(timestamps).isoformat()
        except:
            pass
    
    return {
        "username": scraped_data["username"],
        "display_name": scraped_data["display_name"],
        "profile_image": scraped_data.get("profile_image", ""),
        "total_tweets_analyzed": len(scraped_data["tweets"]),
        "hourly_activity": hourly_dict,
        "daily_activity": daily_dict,
        "heatmap_data": heatmap,
        "peak_hours": peak_hours,
        "peak_days": peak_days,
        "timezone_note": "Times shown in UTC (scraped)",
        "last_tweet_time": last_tweet_time,
        "is_demo": False,
        "is_scraped": True
    }


# Test function
async def test_scraper():
    print("Testing scraper...")
    result = await scrape_twitter_activity("elonmusk", max_tweets=20)
    print(f"Success: {result['success']}")
    print(f"Tweets found: {len(result.get('tweets', []))}")
    if result.get("error"):
        print(f"Error: {result['error']}")
    
    if result["success"]:
        analysis = analyze_scraped_data(result)
        print(f"Analysis: {analysis}")


if __name__ == "__main__":
    asyncio.run(test_scraper())
