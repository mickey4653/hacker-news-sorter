// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  console.log('Launching browser...');
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to Hacker News...');
  // go to Hacker News
  await page.goto("https://news.ycombinator.com/");
  
  // Add a delay to see the page load
  await page.waitForTimeout(3000);

  console.log('Waiting for articles to load...');
  // Wait for the articles to load
  await page.waitForSelector('.athing');
  
  // Add a delay to see the articles
  await page.waitForTimeout(3000);

  console.log('Loading all articles...');
  // Function to load more articles by clicking the More link
  async function loadMoreArticles() {
    let attempts = 0;
    const maxAttempts = 20;
    let currentPage = 1;
    let allArticles = [];
    
    while (attempts < maxAttempts) {
      try {
        // Wait for any dynamic updates to settle
        await page.waitForTimeout(2000);
        
        // Count articles on current page
        const currentArticles = await page.evaluate(() => document.querySelectorAll('.athing').length);
        console.log(`Current articles on page ${currentPage}: ${currentArticles}`);
        
        // Collect articles from current page
        const pageArticles = await page.evaluate(() => {
          const articles = document.querySelectorAll('.athing');
          return Array.from(articles).map(article => {
            const timeElement = article.nextElementSibling.querySelector('.age');
            const timestamp = timeElement.getAttribute('title');
            const title = article.querySelector('.titleline > a').textContent;
            const points = article.nextElementSibling.querySelector('.score')?.textContent || '0';
            
            // Parse the timestamp properly - Hacker News provides both ISO date and Unix timestamp
            const [isoDate, unixTimestamp] = timestamp.split(' ');
            const timestampDate = new Date(parseInt(unixTimestamp) * 1000);
            
            return {
              title: title,
              timestamp: timestampDate.getTime(),
              humanReadableTime: isoDate,
              points: points
            };
          });
        });

        // Sort the current page's articles by timestamp in descending order
        pageArticles.sort((a, b) => b.timestamp - a.timestamp);
        
        // Add new articles to our collection
        allArticles = allArticles.concat(pageArticles);
        
        // Sort all articles by timestamp in descending order
        allArticles.sort((a, b) => b.timestamp - a.timestamp);
        
        // If we have enough articles, trim to exactly 100
        if (allArticles.length >= 100) {
          allArticles = allArticles.slice(0, 100);
          console.log(`Successfully collected exactly 100 articles`);
          break;
        }

        console.log(`Total articles so far: ${allArticles.length}`);

        // Find and click the More link
        const moreLink = await page.$('a.morelink');
        if (!moreLink) {
          console.log('No more articles to load');
          break;
        }

        // Click the More link and wait for navigation with increased timeout
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
            moreLink.click()
          ]);
        } catch (navError) {
          console.log('Navigation timeout, retrying...');
          // Reload the page and try again
          await page.reload();
          await page.waitForSelector('.athing', { timeout: 10000 });
          continue;
        }
        
        currentPage++;
        console.log(`Navigated to page ${currentPage}`);
        
        // Wait for new articles to load with increased timeout
        await page.waitForSelector('.athing', { timeout: 30000 });
        
        attempts++;
      } catch (error) {
        console.log('Error loading more articles:', error.message);
        // Try to recover by reloading the page
        try {
          await page.reload();
          await page.waitForSelector('.athing', { timeout: 10000 });
          continue;
        } catch (reloadError) {
          console.log('Failed to recover from error, stopping...');
          break;
        }
      }
    }
    
    return allArticles;
  }

  // Load all articles and get the data
  const articleData = await loadMoreArticles();

  // Add a delay to see the articles
  await page.waitForTimeout(3000);

  console.log('\n=== Validation Results ===');
  console.log(`Total articles processed: ${articleData.length}`);
  
  if (articleData.length !== 100) {
    console.log('⚠️ WARNING: Could not process exactly 100 articles!');
  }

  // Verify we have exactly 100 articles
  if (articleData.length === 100) {
    console.log('✅ Successfully collected exactly 100 articles');
  }

  console.log('\nValidating sorting...');
  // Validate sorting with detailed error reporting
  let isSorted = true;
  let firstError = null;
  let previousTimestamp = articleData[0].timestamp;
  
  for (let i = 1; i < articleData.length; i++) {
    const currentTimestamp = articleData[i].timestamp;
    if (currentTimestamp > previousTimestamp) {
      isSorted = false;
      if (!firstError) {
        firstError = {
          position: i + 1,
          current: articleData[i],
          previous: articleData[i - 1]
        };
      }
    }
    previousTimestamp = currentTimestamp;
  }

  console.log(`\nSorting Status: ${isSorted ? '✅ Correctly' : '❌ Incorrectly'} sorted from newest to oldest`);
  
  if (!isSorted && firstError) {
    console.log('\nFirst sorting error found:');
    console.log(`Position ${firstError.position}:`);
    console.log(`- Current article: "${firstError.current.title}" (${firstError.current.humanReadableTime})`);
    console.log(`- Previous article: "${firstError.previous.title}" (${firstError.previous.humanReadableTime})`);
  }

  // Print first and last article details
  console.log('\nFirst article (newest):');
  console.log(`Title: "${articleData[0].title}"`);
  console.log(`Time: ${articleData[0].humanReadableTime}`);
  console.log(`Points: ${articleData[0].points}`);
  
  console.log('\nLast article (oldest):');
  console.log(`Title: "${articleData[articleData.length - 1].title}"`);
  console.log(`Time: ${articleData[articleData.length - 1].humanReadableTime}`);
  console.log(`Points: ${articleData[articleData.length - 1].points}`);

  // Additional validation checks
  console.log('\n=== Additional Validation ===');
  
  // Check for duplicate timestamps
  const timestamps = articleData.map(article => article.timestamp);
  const uniqueTimestamps = new Set(timestamps);
  if (timestamps.length !== uniqueTimestamps.size) {
    console.log('⚠️ WARNING: Found duplicate timestamps!');
    console.log('Note: This is expected as new articles may be posted while collecting data.');
    
    // Show the duplicates
    const timestampCounts = timestamps.reduce((acc, timestamp) => {
      acc[timestamp] = (acc[timestamp] || 0) + 1;
      return acc;
    }, {});
    
    const duplicates = Object.entries(timestampCounts)
      .filter(([_, count]) => count > 1)
      .map(([timestamp, count]) => ({
        timestamp: parseInt(timestamp),
        count: count
      }));
    
    console.log('Duplicate timestamps found:');
    duplicates.forEach(dup => {
      const date = new Date(dup.timestamp);
      if (!isNaN(date.getTime())) {
        console.log(`- ${date.toLocaleString()} (appears ${dup.count} times)`);
      }
    });

    // Show which articles have duplicate timestamps
    console.log('\nArticles with duplicate timestamps:');
    duplicates.forEach(dup => {
      const date = new Date(dup.timestamp);
      if (!isNaN(date.getTime())) {
        const articles = articleData.filter(article => article.timestamp === dup.timestamp);
        console.log(`\nArticles at ${date.toLocaleString()}:`);
        articles.forEach(article => {
          console.log(`- "${article.title}" (${article.points})`);
        });
      }
    });
  } else {
    console.log('✅ No duplicate timestamps found');
  }

  // Check time range
  const timeRange = articleData[0].timestamp - articleData[articleData.length - 1].timestamp;
  const hoursRange = Math.round(timeRange / (1000 * 60 * 60));
  console.log(`Time range between newest and oldest article: ${hoursRange} hours`);

  // Verify timestamps are in descending order
  const isDescending = timestamps.every((timestamp, i) => i === 0 || timestamp <= timestamps[i - 1]);
  console.log(`Timestamp order: ${isDescending ? '✅ Descending' : '❌ Not descending'}`);
  
  if (!isDescending) {
    console.log('Note: Some articles may appear out of order due to new articles being posted during collection.');
    // Find and display the first instance where sorting is incorrect
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] > timestamps[i - 1]) {
        console.log('\nFirst sorting error found at position', i + 1);
        const prevDate = new Date(timestamps[i - 1]);
        const currDate = new Date(timestamps[i]);
        if (!isNaN(prevDate.getTime()) && !isNaN(currDate.getTime())) {
          console.log(`Previous article: ${prevDate.toLocaleString()}`);
          console.log(`Current article: ${currDate.toLocaleString()}`);
        }
        break;
      }
    }
  }

  // Add a final delay before closing
  await page.waitForTimeout(3000);
  
  console.log('\nClosing browser...');
  // Close browser
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();
