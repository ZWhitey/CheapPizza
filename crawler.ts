import * as fs from 'fs';
import * as path from 'path';

/**
 * Coupon Crawler Script
 * 
 * Features:
 * - Incremental updates: Automatically skips already-scanned coupon codes
 * - Loads existing data from public/coupons.json to avoid redundant scans
 * - Merges new coupons with existing ones
 * - Optimized search ranges based on historical data analysis
 * - Significantly reduces execution time and resource usage (64% fewer codes to scan)
 * 
 * Optimization Details:
 * - Original ranges: 14xxx, 15xxx, 25xxx, 26xxx, 94xxx (5000 codes)
 * - Optimized ranges: Focused on high-density 100s ranges (1800 codes)
 * - Based on analysis of 853 valid coupons found in previous scans
 * 
 * Recommended Usage:
 * npx tsx crawler.ts [range]
 * 
 * (tsx handles TypeScript and ESM automatically without complex config)
 * 
 * Example:
 * npx tsx crawler.ts 24000-24005
 */

// Default code ranges to scan when no arguments are provided
// Optimized based on historical data analysis (853 valid coupons, analyzed on 2026-01-27)
// Reduces scan size from 5000 to 1800 codes (64% reduction)
// Focuses on ranges with highest coupon density (5+ coupons per 100 codes)
// NOTE: Re-evaluate these ranges quarterly or when coupon patterns change significantly
const DEFAULT_RANGES = [
  '15000-15099', '15100-15199', '15200-15299', '15300-15399', 
  '15400-15499', '15500-15599', '15600-15699', '15700-15799', '15800-15899',
  '25300-25399', '25400-25499', '25500-25599', '25700-25799', '25900-25999',
  '26300-26399', '26400-26499', '26500-26599', '26600-26699'
];

// Interface for the output data
interface CouponData {
  id: string;
  code: string;
  title: string;
  items: string[];
  originalPrice: number;
  discountedPrice: number;
  validUntil: string;
  imageUrl: string;
}

// Global cookie storage to maintain session (optional but good practice for sequential requests)
let globalCookie = '';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const parseArgsToCodes = (args: string[]): string[] => {
  const codes: string[] = [];
  args.forEach(arg => {
    if (arg.includes('-')) {
      const [start, end] = arg.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          codes.push(String(i).padStart(5, '0'));
        }
      }
    } else {
      if (!isNaN(Number(arg))) {
        codes.push(arg.padStart(5, '0'));
      }
    }
  });
  return codes;
};

// 1. Check validity via API
// Returns any to avoid strict type checking issues with ts-node/tsc
async function checkCouponValidity(code: string): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = `https://www.pizzahut.com.tw/order/?m=ajax&t=${timestamp}`;
  const params = new URLSearchParams();
  params.append('mode', 'get_dgtAll');
  params.append('type_id', '');
  params.append('dType', 'plu');
  params.append('txtPLU', code);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.pizzahut.com.tw',
        'Referer': 'https://www.pizzahut.com.tw/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': '*/*'
      },
      body: params.toString(),
    });
    
    // Capture cookies if any
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        globalCookie = setCookie;
    }

    if (!response.ok) return null;

    const text = await response.text();
    if (!text || text.trim() === '') {
        return null; 
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
  } catch (error) {
    console.error(`Error checking code ${code}:`, error);
    return null;
  }
}

// 2. Fetch and Parse HTML for details
async function fetchCouponDetails(code: string, typeId: string): Promise<CouponData | null> {
  const url = `https://www.pizzahut.com.tw/order/?mode=step_2&type_id=${typeId}&cno=${code}`;
  
  try {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.pizzahut.com.tw/',
            'Cookie': globalCookie
        }
    });
    const html = await response.text();

    // --- HTML Parsing Logic ---
    
    // Extract Title (Look for <h1 id="cb_name">...</h1>)
    let title = `優惠代碼 ${code}`;
    // Use [\s\S]*? to safely match across newlines if any
    const titleMatch = html.match(/<h1 id="cb_name"[^>]*>([\s\S]*?)<\/h1>/i);
    if (titleMatch) {
        title = titleMatch[1].trim();
    } else {
        // Fallback
        const fallbackTitle = html.match(/class="prod_name"[^>]*>([\s\S]*?)<\//i);
        if (fallbackTitle) title = fallbackTitle[1].trim();
    }

    // Extract Price (<div class="descPrice ...">$ 2098</div>)
    let price = 999;
    const priceMatch = html.match(/<div class="descPrice[^"]*"[^>]*>\$\s*([\d,]+)<\/div>/i);
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    } else {
      // Fallback
      const oldPrice = html.match(/class="price"[^>]*>\$?([\d,]+)/i);
      if (oldPrice) price = parseInt(oldPrice[1].replace(/,/g, ''), 10);
    }

    // Extract Original Price (Looking for "原價NT$..." or "原價$...")
    let originalPrice = Math.round(price * 1.5); 
    const originalPriceMatch = html.match(/原價(?:NT)?\$([\d,]+)/i);
    if (originalPriceMatch) {
        originalPrice = parseInt(originalPriceMatch[1].replace(/,/g, ''), 10);
    }

    // Extract Image (<div class="combo_banner">...<img src="...">...)
    let imageUrl = 'https://www.pizzahut.com.tw/images/logo_header.png';
    const imgMatch = html.match(/<div class="combo_banner"[^>]*>[\s\S]*?<img[^>]+src="([^">]+)"/i);
    if (imgMatch) {
        imageUrl = imgMatch[1];
    } else {
        // Fallback
        const oldImg = html.match(/<img[^>]+src="([^">]+)"[^>]*class="prod_img"/i);
        if (oldImg) imageUrl = oldImg[1];
    }

    // Fix relative image URLs
    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `https://www.pizzahut.com.tw${imageUrl}`;
    }

    // Extract Items
    // Strategy: Look for "套餐內容：" inside <li> tags in the description block
    // We want raw content, respecting <br> for line breaks, but stripping tags.
    let items: string[] = [];
    
    // Use [\s\S]*? to match across newlines
    const contentMatch = html.match(/<li>套餐內容：([\s\S]*?)<\/li>/i);
    
    if (contentMatch) {
      // Replace <br> tags with newline character to split items later
      let contentText = contentMatch[1].replace(/<br\s*\/?>/gi, '\n');
      // Strip all other HTML tags
      contentText = contentText.replace(/<[^>]+>/g, '').trim();
      // Split by newline and filter empty
      items = contentText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    }

    // Fallback: Check .descTop if items are still empty
    if (items.length === 0) {
        const descTopMatch = html.match(/<div class="descTop"[^>]*>([\s\S]*?)<\/div>/i);
        if (descTopMatch) {
            let descText = descTopMatch[1].replace(/<br\s*\/?>/gi, '\n');
            descText = descText.replace(/<[^>]+>/g, '').trim();
            items = descText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        }
    }

    if (items.length === 0) {
        items.push('美味餐點組合 (請見官網詳情)');
    }

    // Extract Date (Not strictly available in the provided HTML snippets, defaulting)
    // Sometimes it's in the text like "有效期限:..."
    const validUntil = '2025-12-31';

    return {
      id: code,
      code,
      title: title.replace(/&amp;/g, '&'),
      items,
      originalPrice,
      discountedPrice: price > 0 ? price : 999,
      validUntil,
      imageUrl,
    };

  } catch (error) {
    console.error(`Error scraping details for ${code}:`, error);
    return null;
  }
}

async function main() {
  let args = typeof process !== 'undefined' ? (process as any).argv.slice(2) : [];
  if (args.length === 0) {
    console.log(`No args. Using default ranges: ${DEFAULT_RANGES.join(', ')}`);
    args = DEFAULT_RANGES;
  }

  const codes = parseArgsToCodes(args);
  
  // Load existing coupons to enable incremental updates
  const publicPath = path.join((process as any).cwd(), 'public', 'coupons.json');
  let existingCoupons: CouponData[] = [];
  let existingIds = new Set<string>();
  
  if (fs.existsSync(publicPath)) {
    try {
      const existingData = fs.readFileSync(publicPath, 'utf-8');
      const loadedCoupons: CouponData[] = JSON.parse(existingData);
      
      // Filter out expired coupons
      const now = new Date();
      existingCoupons = loadedCoupons.filter(coupon => {
        const validUntil = new Date(coupon.validUntil);
        return validUntil >= now;
      });
      
      const expiredCount = loadedCoupons.length - existingCoupons.length;
      console.log(`Loaded ${loadedCoupons.length} existing coupons from ${publicPath}`);
      if (expiredCount > 0) {
        console.log(`Removed ${expiredCount} expired coupons`);
      }
      
      existingIds = new Set(existingCoupons.map(c => c.id));
    } catch (err) {
      console.error('Failed to load existing coupons:', err);
    }
  }

  // Filter out codes that already exist
  const codesToScan = codes.filter(code => !existingIds.has(code));
  const skippedCount = codes.length - codesToScan.length;
  
  console.log(`Total codes: ${codes.length}`);
  console.log(`Already scanned: ${skippedCount}`);
  console.log(`New codes to scan: ${codesToScan.length}`);

  const validCoupons: CouponData[] = [];

  for (const code of codesToScan) {
    await delay(250); // Slight delay

    const checkResult = await checkCouponValidity(code);

    // Using loose type check for resilience
    if (checkResult && checkResult.success) {
      const typeId = checkResult.data?.type_id || '1025'; 
      console.log(`[FOUND] ${code} (Type: ${typeId}). Fetching details...`);
      
      const details = await fetchCouponDetails(code, typeId);
      if (details) {
        validCoupons.push(details);
        console.log(`   -> Parsed: ${details.title} ($${details.discountedPrice})`);
      }
    } else {
        // Fix for process.stdout type issue
        if ((process as any).stdout) {
            (process as any).stdout.write('.'); 
        }
    }
  }

  console.log(`\nScan complete. Found ${validCoupons.length} new coupons.`);
  
  // Merge new coupons with existing ones
  const allCoupons = [...existingCoupons, ...validCoupons];
  
  console.log(`Total coupons after merge: ${allCoupons.length}`);

  // Write to current directory or public if possible
  const simplePath = 'coupons.json';

  // Try saving to public folder first, then fallback to current
  let savePath = simplePath;
  if (fs.existsSync(path.dirname(publicPath))) {
      savePath = publicPath;
  }

  try {
     fs.writeFileSync(savePath, JSON.stringify(allCoupons, null, 2));
     console.log(`Saved ${allCoupons.length} total coupons to ${savePath}`);
  } catch (err) {
      console.error("Failed to write file:", err);
      console.log("JSON Output:", JSON.stringify(allCoupons, null, 2));
  }

  // Save metadata file with update timestamp
  const metadataPath = path.join(path.dirname(savePath), 'metadata.json');
  const metadata = {
    lastUpdated: new Date().toISOString(),
    totalCoupons: allCoupons.length,
    scannedRanges: args,
    newCouponsFound: validCoupons.length,
    existingCoupons: existingCoupons.length
  };

  try {
     fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
     console.log(`Saved metadata to ${metadataPath}`);
  } catch (err) {
      console.error("Failed to write metadata file:", err);
  }
}

main().catch(console.error);