import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { chromium } from "playwright";
import { z } from "zod";

const PORT = 3000;

const ALLOWLIST_HOSTS = (process.env.ALLOWLIST_HOSTS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const START_URL = process.env.START_URL || "about:blank";
const USER_DATA_DIR = process.env.USER_DATA_DIR || "/profile";

if (!ALLOWLIST_HOSTS.length) {
  console.error("ALLOWLIST_HOSTS empty. Refusing to start.");
  process.exit(1);
}

function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    return ALLOWLIST_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

let context;
let page;

async function boot() {
  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: null,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    args: [
      "--no-sandbox", 
      "--disable-dev-shm-usage", 
      "--disable-extensions",
      "--disable-session-crashed-bubble",
      "--no-first-run",
      "--window-size=1280,720",
      "--window-position=0,0",
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-infobars",
      "--exclude-switches=enable-automation",
      "--disable-automation",
      "--app=https://www.google.com",
      "--test-type",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--lang=en-US"
    ],
    ignoreDefaultArgs: ["--enable-automation"]
  });

  page = context.pages()[0] || await context.newPage();

  // Hide webdriver property and automation detection
  await page.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    
    // Remove all webdriver traces
    delete navigator.__proto__.webdriver;
    delete Object.getPrototypeOf(navigator).webdriver;
    
    // Override chrome property with more realistic values
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };
    
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
    
    // Override plugins to appear more realistic
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
    
    // Override platform
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Linux x86_64'
    });
    
    // Mock battery API
    if (!navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1
      });
    }
    
    // Override connection
    if (!navigator.connection) {
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          downlink: 10,
          rtt: 50
        })
      });
    }
    
    // Override userAgent if it contains 'HeadlessChrome'
    const originalUserAgent = navigator.userAgent;
    if (originalUserAgent.includes('HeadlessChrome')) {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => originalUserAgent.replace('HeadlessChrome', 'Chrome')
      });
    }
    
    // Aggressively remove automation banner on DOM changes
    const removeAutomationBanner = () => {
      // Remove any element that might be the automation banner
      const selectors = [
        '[class*="infobar"]',
        '[id*="infobar"]', 
        '[class*="automation"]',
        '[id*="automation"]',
        '[aria-label*="controlled"]',
        '[aria-label*="automation"]',
        'div', 'span', 'p', 'section', 'article'
      ];
      
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          const text = el.textContent.toLowerCase();
          if ((text.includes('controlled') && text.includes('automated')) || 
              (text.includes('chrome is being controlled')) ||
              (text.includes('automated test software'))) {
            el.remove();
          }
        });
      });
    };
    
    // Run immediately and on DOM changes
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', removeAutomationBanner);
    } else {
      removeAutomationBanner();
    }
    
    // Monitor for new elements
    const observer = new MutationObserver(removeAutomationBanner);
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  });

  if (isAllowedUrl(START_URL)) {
    await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Remove automation banner after page load
    await page.evaluate(() => {
      const removeElements = () => {
        const selectors = [
          '[class*="infobar"]',
          '[id*="infobar"]',
          '[class*="automation"]',
          '[id*="automation"]',
          '[aria-label*="controlled"]',
          '[aria-label*="automation"]'
        ];
        
        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (el.textContent.toLowerCase().includes('controlled') || 
                el.textContent.toLowerCase().includes('automation')) {
              el.remove();
            }
          });
        });
      };
      removeElements();
    }).catch(() => {});
    
    // Also inject CSS as backup - target Chrome's top-level UI
    await page.addStyleTag({
      content: `
        /* Hide Chrome automation banner and tab bar aggressively */
        body:has([class*="infobar"]),
        body:has([id*="infobar"]) {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
        
        [class*="infobar"], [id*="infobar"],
        [class*="automation"], [id*="automation"],
        [aria-label*="controlled"], [aria-label*="automation"],
        [class*="controlled"], [id*="controlled"] {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          width: 0 !important;
          opacity: 0 !important;
          position: absolute !important;
          top: -9999px !important;
          left: -9999px !important;
          z-index: -9999 !important;
          pointer-events: none !important;
        }
        
        /* Target Chrome's specific infobar structure */
        body > div:first-child:not([id]):not([class]) {
          display: none !important;
        }
      `
    }).catch(() => {});
  } else {
    await page.goto("about:blank");
  }

  page.on("download", d => d.cancel().catch(() => {}));
  
  // Re-inject removal logic on every navigation
  page.on("load", async () => {
    try {
      await page.evaluate(() => {
        const removeElements = () => {
          const selectors = [
            '[class*="infobar"]',
            '[id*="infobar"]',
            '[class*="automation"]',
            '[id*="automation"]',
            '[aria-label*="controlled"]',
            '[aria-label*="automation"]'
          ];
          
          selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
              if (el.textContent.toLowerCase().includes('controlled') || 
                  el.textContent.toLowerCase().includes('automation')) {
                el.remove();
              }
            });
          });
        };
        removeElements();
      });
      
      await page.addStyleTag({
        content: `
          body:has([class*="infobar"]),
          body:has([id*="infobar"]) {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
          
          [class*="infobar"], [id*="infobar"],
          [class*="automation"], [id*="automation"],
          [aria-label*="controlled"], [aria-label*="automation"],
          [class*="controlled"], [id*="controlled"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            opacity: 0 !important;
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
            z-index: -9999 !important;
            pointer-events: none !important;
          }
          
          body > div:first-child:not([id]):not([class]) {
            display: none !important;
          }
        `
      });
    } catch (e) {
      // Ignore errors
    }
  });
}

const app = express();
app.use(helmet());
app.use(express.json({ limit: "200kb" }));
app.use(morgan("tiny"));

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/url", async (req, res) => res.json({ url: page.url() }));

app.post("/url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "URL is required" });
    }
    
    if (!isAllowedUrl(url)) {
      return res.status(403).json({ error: "URL not in allowlist" });
    }
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    res.json({ ok: true, url: page.url() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/auth-status", async (req, res) => {
  try {
    const cookies = await context.cookies();
    const currentUrl = page.url();
    
    // Check for Google authentication cookies
    const googleAuthCookies = cookies.filter(cookie => 
      (cookie.domain.includes('google.com') || cookie.domain.includes('.google.')) &&
      (cookie.name.includes('SID') || cookie.name.includes('HSID') || cookie.name.includes('SSID'))
    );
    
    // Check for Microsoft authentication cookies
    const microsoftAuthCookies = cookies.filter(cookie => 
      (cookie.domain.includes('microsoft.com') || cookie.domain.includes('.live.com') || 
       cookie.domain.includes('outlook.com') || cookie.domain.includes('.microsoftonline.com')) &&
      (cookie.name.includes('MSA') || cookie.name.includes('ESTSAUTH') || 
       cookie.name.includes('SignInStateCookie') || cookie.name === 'SDIDC')
    );
    
    // Check for Facebook authentication cookies
    const facebookAuthCookies = cookies.filter(cookie => 
      (cookie.domain.includes('facebook.com') || cookie.domain.includes('.fb.com')) &&
      (cookie.name === 'c_user' || cookie.name === 'xs' || cookie.name === 'datr')
    );
    
    // Validate cookies aren't expired
    const validGoogleCookies = googleAuthCookies.filter(cookie => {
      if (cookie.expires && cookie.expires !== -1) {
        return cookie.expires * 1000 > Date.now();
      }
      return true;
    });
    
    const validMicrosoftCookies = microsoftAuthCookies.filter(cookie => {
      if (cookie.expires && cookie.expires !== -1) {
        return cookie.expires * 1000 > Date.now();
      }
      return true;
    });
    
    const validFacebookCookies = facebookAuthCookies.filter(cookie => {
      if (cookie.expires && cookie.expires !== -1) {
        return cookie.expires * 1000 > Date.now();
      }
      return true;
    });
    
    let googleEmail = null;
    let microsoftEmail = null;
    let facebookName = null;
    
    // Try to extract Google email
    if (validGoogleCookies.length > 0 && currentUrl.includes('google.com')) {
      try {
        googleEmail = await page.evaluate(() => {
          const selectors = [
            'a[href*="SignOut"]',
            '[data-email]',
            'div[aria-label*="@"]',
            'button[aria-label*="@"]',
            '[data-ogsr-up]'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.textContent || element.getAttribute('aria-label') || 
                          element.getAttribute('data-email') || element.getAttribute('data-ogsr-up');
              const emailMatch = text?.match(/[\w.-]+@[\w.-]+\.\w+/);
              if (emailMatch) return emailMatch[0];
            }
          }
          return null;
        });
      } catch (e) {
        console.error('Error extracting Google email:', e);
      }
    }
    
    // Try to extract Microsoft email
    if (validMicrosoftCookies.length > 0 && (currentUrl.includes('microsoft.com') || 
        currentUrl.includes('live.com') || currentUrl.includes('office.com') || 
        currentUrl.includes('outlook.com'))) {
      try {
        microsoftEmail = await page.evaluate(() => {
          const selectors = [
            '[data-test-id="user-email"]',
            '[aria-label*="@"]',
            '.ms-Persona-primaryText',
            '[id*="mectrl_currentAccount_primary"]',
            '[data-automation-id*="userEmail"]',
            'button[aria-label*="@"]',
            '[id*="meControl"]'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.textContent || element.getAttribute('aria-label') || 
                          element.getAttribute('title') || element.getAttribute('data-test-id');
              const emailMatch = text?.match(/[\w.-]+@[\w.-]+\.\w+/);
              if (emailMatch) return emailMatch[0];
            }
          }
          return null;
        });
      } catch (e) {
        console.error('Error extracting Microsoft email:', e);
      }
    }
    
    // Try to extract Facebook user info
    if (validFacebookCookies.length > 0 && (currentUrl.includes('facebook.com') || currentUrl.includes('fb.com'))) {
      try {
        facebookName = await page.evaluate(() => {
          const selectors = [
            '[aria-label*="Your profile"]',
            '[data-click="profile_icon"]',
            'a[href*="/profile.php"] span',
            '[data-visualcompletion="ignore-dynamic"] span',
            'image[alt]:not([alt=""])'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.textContent || element.getAttribute('aria-label') || element.getAttribute('alt');
              if (text && text.length > 0 && !text.includes('Menu') && !text.includes('Settings') && 
                  !text.includes('Facebook') && text.length < 50) {
                return text.replace(/^(Your profile|Account) /, '').trim();
              }
            }
          }
          return null;
        });
      } catch (e) {
        console.error('Error extracting Facebook name:', e);
      }
    }
    
    // Only consider authenticated if we have both cookies AND can verify user info
    res.json({
      google: {
        isAuthenticated: validGoogleCookies.length > 0 && googleEmail !== null,
        userEmail: googleEmail,
        cookieCount: validGoogleCookies.length
      },
      microsoft: {
        isAuthenticated: validMicrosoftCookies.length > 0 && microsoftEmail !== null,
        userEmail: microsoftEmail,
        cookieCount: validMicrosoftCookies.length
      },
      facebook: {
        isAuthenticated: validFacebookCookies.length > 0 && facebookName !== null,
        userName: facebookName,
        cookieCount: validFacebookCookies.length
      }
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const NavigateSchema = z.object({ url: z.string().min(1) });
const ClickSchema = z.object({ selector: z.string().min(1).max(200) });
const TypeSchema = z.object({
  selector: z.string().min(1).max(200),
  text: z.string().max(5000),
  clear: z.boolean().optional().default(true)
});

app.post("/navigate", async (req, res) => {
  const body = NavigateSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Bad request" });
  const { url } = body.data;

  if (!isAllowedUrl(url)) return res.status(403).json({ error: "URL not allowed" });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    res.json({ ok: true, url: page.url() });
  } catch (e) {
    res.status(500).json({ error: "Navigation failed", details: String(e) });
  }
});

app.post("/click", async (req, res) => {
  const body = ClickSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Bad request" });

  try {
    await page.click(body.data.selector, { timeout: 15000 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Click failed", details: String(e) });
  }
});

app.post("/type", async (req, res) => {
  const body = TypeSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Bad request" });

  try {
    const loc = page.locator(body.data.selector).first();
    await loc.waitFor({ timeout: 15000 });
    if (body.data.clear) await loc.fill("");
    await loc.type(body.data.text, { delay: 10 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Type failed", details: String(e) });
  }
});

app.get("/text", async (req, res) => {
  try {
    const text = await page.evaluate(() => document.body?.innerText?.slice(0, 200000) || "");
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ error: "Text extract failed", details: String(e) });
  }
});

app.get("/screenshot", async (req, res) => {
  try {
    const buf = await page.screenshot({ type: "png" });
    res.setHeader("Content-Type", "image/png");
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: "Screenshot failed", details: String(e) });
  }
});

await boot();
app.listen(PORT, () => console.log(`Browserbox API listening on :${PORT}`));
