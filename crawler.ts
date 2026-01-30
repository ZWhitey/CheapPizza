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
 * - Significantly reduces execution time and resource usage (52% fewer codes to scan)
 * 
 * Optimization Details:
 * - Original ranges: 14xxx, 15xxx, 25xxx, 26xxx, 94xxx (5000 codes)
 * - Optimized ranges: 10-code segments with ANY valid coupon data (2400 codes)
 * - Based on analysis of 853 valid coupons found in previous scans
 * - Strategy: Keep all segments with data, only remove completely empty ranges (14xxx)
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
// Uses 10-code segments (e.g., 150xx, 151xx) to include ALL segments with data
// Reduces scan size from 5000 to 2400 codes (52% reduction) while ensuring NO data is missed
// NOTE: Re-evaluate these ranges quarterly or when coupon patterns change significantly
const DEFAULT_RANGES = [
  // 15xxx series (500 coupons across 9 segments)
  '15000-15099', '15100-15199', '15200-15299', '15300-15399', 
  '15400-15499', '15500-15599', '15600-15699', '15700-15799', '15800-15899',
  // 25xxx series (47 coupons across 6 segments)
  '25300-25399', '25400-25499', '25500-25599', '25600-25699', '25700-25799', '25900-25999',
  // 26xxx series (300 coupons across 4 segments)
  '26300-26399', '26400-26499', '26500-26599', '26600-26699',
  // 94xxx series (6 coupons across 5 segments)
  '94100-94199', '94200-94299', '94500-94599', '94600-94699', '94700-94799'
];

// Interface for the output data
interface CouponData {
  code: string;
  title: string;
  items: string[];
  originalPrice: number;
  discountedPrice: number;
  validUntil: string;
  minPurchasePrice?: number;
  deliveryType?: 'delivery' | 'takeout' | 'both';
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

// Helper function to remove delivery service notes from text
// These notes typically appear at the end like:
// "*外送服務為限區服務，購買商品實際付款金額滿$399，外送服務一律免費；購買商品實際付款金額未滿$399，酌收官網定價外送服務費用。"
// Note: Some notes don't have the asterisk (*) prefix
function removeDeliveryNotes(text: string): string {
  // Remove delivery service notes - match from "*外送服務" or " 外送服務" to end of text
  return text.replace(/\s*\*?外送服務為限區服務[^]*$/, '').trim();
}

// Helper function to extract maximum value (original price) from coupon text
// Patterns like "最高價值NT$204" or "(最高價值NT$890元)" indicate the original value
function extractMaxValuePrice(text: string): number | undefined {
  // Match patterns like:
  // - "最高價值NT$204"
  // - "(最高價值NT$890元)"
  // - "最高價值$174元"
  const patterns = [
    /最高價值(?:NT)?\$([\d,]+)/i,
    /\(最高價值(?:NT)?\$([\d,]+)元?\)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  }
  
  return undefined;
}

// Helper function to extract minimum purchase price from coupon text
// Uses early return pattern - higher priority patterns are checked first
function extractMinPurchasePrice(text: string): number | undefined {
  // Priority 1: Match patterns with explicit minimum price indicators (含)以上
  // e.g., "NT$320元(含)以上" or "限定NT$460元(含)以上" or "$690元起(含)以上口味"
  const minPricePatterns = [
    /NT\$(\d+)元?起?\(含\)以上/,
    /限定NT\$(\d+)元?起?\(含\)以上/,
    /NT\$(\d+)\(含\)以上/,
    /\$(\d+)元?起?\(含\)以上/,
    /限定\$(\d+)元?起?\(含\)以上/,
  ];
  
  for (const pattern of minPricePatterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // Priority 2: Match "此套餐合計NT$298" pattern (total price for combo sets)
  // e.g., "享第2份半價(此套餐合計NT$298)"
  const totalPricePattern = /此套餐合計(?:NT)?\$(\d+)/;
  const totalMatch = text.match(totalPricePattern);
  if (totalMatch) {
    return parseInt(totalMatch[1], 10);
  }
  
  // Priority 3: Match "=NT$320元起" or "=$320起" patterns (price starting from)
  // e.g., "買1個9吋鬆厚比薩(全口味任選)=NT$320元起"
  // e.g., "買1個6吋鬆厚比薩=NT$89元起"
  const startingPricePatterns = [
    /=\s*NT\$(\d+)元?起/,
    /=\s*\$(\d+)元?起/,
    /=NT\$(\d+)元?起/,
    /=\$(\d+)起/,
  ];
  
  for (const pattern of startingPricePatterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // Priority 4 (fallback): Handle "9吋鬆厚比薩買1送1" or "小比薩買1送1" patterns
  // with default min price of 320 (based on 9-inch/small pizza menu prices)
  // Only applies when no explicit price is found in the text
  // Note: Both 9吋 and 小比薩 refer to the same pizza size with min price 320
  if (/9吋[^。]*比薩[^。]*買1送1/.test(text) || /小比薩[^。]*買1送1/.test(text)) {
    return 320;
  }
  
  // Priority 5 (fallback): Handle "買小送小" pattern with default min price of 320
  if (/買小送小/.test(text)) {
    return 320;
  }
  
  // Priority 6 (fallback): Handle 13吋大比薩 percentage discount patterns
  // Only applies to "單點大比薩" discounts (e.g., 94555, 94666, 94700)
  // These coupons have patterns like "單點大比薩半價" or "單點大比薩7折"
  // Calculate discounted price based on minimum 13-inch pizza original price (565)
  const minLargePizzaPrice = 565; // Minimum 13-inch pizza original price from menu
  
  // Match "單點大比薩半價" or "單點...大比薩半價" (50% off)
  if (/單點[^。]*大比薩[^。]*半價/.test(text)) {
    return Math.round(minLargePizzaPrice * 0.5);
  }
  
  // Match "單點大比薩X折" pattern (X0% of original price)
  // 6折 = 60% of original, 7折 = 70% of original
  const discountMatch = text.match(/單點[^。]*大比薩[^。]*?(\d)折/);
  if (discountMatch) {
    const discountDigit = parseInt(discountMatch[1], 10);
    return Math.round(minLargePizzaPrice * discountDigit * 0.1);
  }
  
  return undefined;
}

// Helper function to extract delivery type from coupon text
function extractDeliveryType(text: string): 'delivery' | 'takeout' | 'both' | undefined {
  // Check for "外送限定" or "外帶限定" patterns in title first (highest priority)
  // These appear in coupon titles like "外送限定-94700" or "外帶限定-94555"
  if (text.includes('外送限定')) {
    return 'delivery';
  }
  
  if (text.includes('外帶限定')) {
    return 'takeout';
  }
  
  // Remove asterisk notes about delivery services to avoid false positives
  // These notes typically appear at the end with pattern like:
  // "*外送服務為限區服務，購買商品實際付款金額滿$399，外送服務一律免費"
  // Use a pattern that stops at common delimiters (period, newline, or another asterisk)
  const cleanedText = text.replace(/\*外送服務[^。\n*]*/g, '');
  const lowerText = cleanedText.toLowerCase();
  
  // Check for specific patterns (more specific to less specific)
  // Check for delivery only restrictions
  if (lowerText.includes('限外送') && !lowerText.includes('外帶')) {
    return 'delivery';
  }
  
  // Check for takeout only restrictions
  if (lowerText.includes('限外帶') && !lowerText.includes('外送')) {
    return 'takeout';
  }
  
  // Check for both delivery and takeout (patterns like "外送/外帶" or "外帶/外送")
  if ((lowerText.includes('外送/外帶') || lowerText.includes('外帶/外送')) ||
      (lowerText.includes('外送') && lowerText.includes('外帶'))) {
    return 'both';
  }
  
  // Check for single mentions
  if (lowerText.includes('外送')) {
    return 'delivery';
  }
  
  if (lowerText.includes('外帶')) {
    return 'takeout';
  }
  
  return undefined;
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
    let title = '';
    // Use [\s\S]*? to safely match across newlines if any
    const titleMatch = html.match(/<h1 id="cb_name"[^>]*>([\s\S]*?)<\/h1>/i);
    if (titleMatch) {
        title = titleMatch[1].trim();
    } else {
        // Fallback
        const fallbackTitle = html.match(/class="prod_name"[^>]*>([\s\S]*?)<\//i);
        if (fallbackTitle) title = fallbackTitle[1].trim();
    }
    
    // If still no title, use code as fallback
    if (!title) {
        title = `優惠代碼 ${code}`;
    }

    // Extract Price (<div class="descPrice ...">$ 2098</div>)
    let price = 0;
    const priceMatch = html.match(/<div class="descPrice[^"]*"[^>]*>\$\s*([\d,]+)<\/div>/i);
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    } else {
      // Fallback
      const oldPrice = html.match(/class="price"[^>]*>\$?([\d,]+)/i);
      if (oldPrice) price = parseInt(oldPrice[1].replace(/,/g, ''), 10);
    }

    // Extract Original Price (Looking for "原價NT$..." or "原價$...")
    let originalPrice = 0; 
    const originalPriceMatch = html.match(/原價(?:NT)?\$([\d,]+)/i);
    if (originalPriceMatch) {
        originalPrice = parseInt(originalPriceMatch[1].replace(/,/g, ''), 10);
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

    // Extract Date - look for expiration date in HTML
    let validUntil = '';
    const dateMatch = html.match(/有效期限[：:]\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i);
    if (dateMatch) {
        validUntil = dateMatch[1].replace(/\//g, '-');
    }

    // Extract minimum purchase price and delivery type from title and items
    // Note: Extract these BEFORE removing delivery notes to preserve delivery type detection
    const allText = [title, ...items].join(' ');
    const minPurchasePrice = extractMinPurchasePrice(allText);
    const deliveryType = extractDeliveryType(allText);

    // Extract original price from "最高價值" if not found via "原價" pattern
    if (originalPrice === 0) {
      const maxValuePrice = extractMaxValuePrice(allText);
      if (maxValuePrice) {
        originalPrice = maxValuePrice;
      }
    }

    // Remove delivery notes from items (after extracting delivery type)
    const cleanedItems = items.map(item => removeDeliveryNotes(item)).filter(item => item.length > 0);

    return {
      code,
      title: title.replace(/&amp;/g, '&'),
      items: cleanedItems,
      originalPrice,
      discountedPrice: price,
      validUntil,
      minPurchasePrice,
      deliveryType,
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
  let existingCodes = new Set<string>();
  
  if (fs.existsSync(publicPath)) {
    try {
      const existingData = fs.readFileSync(publicPath, 'utf-8');
      const loadedCoupons: CouponData[] = JSON.parse(existingData);
      
      // Filter out expired coupons (only if validUntil is not empty)
      const now = new Date();
      existingCoupons = loadedCoupons.filter(coupon => {
        if (!coupon.validUntil) return true; // Keep coupons without expiration
        const validUntil = new Date(coupon.validUntil);
        return validUntil >= now;
      });
      
      const expiredCount = loadedCoupons.length - existingCoupons.length;
      console.log(`Loaded ${loadedCoupons.length} existing coupons from ${publicPath}`);
      if (expiredCount > 0) {
        console.log(`Removed ${expiredCount} expired coupons`);
      }
      
      existingCodes = new Set(existingCoupons.map(c => c.code));
    } catch (err) {
      console.error('Failed to load existing coupons:', err);
    }
  }

  // Filter out codes that already exist
  const codesToScan = codes.filter(code => !existingCodes.has(code));
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