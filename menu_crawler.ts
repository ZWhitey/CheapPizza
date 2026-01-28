import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// Define interfaces for the extracted data structure
interface MenuProduct {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
}

async function fetchAndParseMenu() {
    const url = 'https://www.pizzahut.com.tw/order/?mode=step_2&ct=2';
    console.log(`Fetching menu from ${url}...`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.pizzahut.com.tw/'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Note on Implementation Strategy:
        // The original request suggested parsing global JS variables (psidss, ctidss, pprcss) using the 'vm' module.
        // However, during verification, it was confirmed that these variables are NOT present in the raw HTML response
        // for the target URL (https://www.pizzahut.com.tw/order/?mode=step_2&ct=2).
        // Instead, the product data is rendered directly in the HTML (Server-Side Rendering).
        // Therefore, we use Cheerio to scrape the HTML elements directly, which is a proven working solution for the current site structure.

        const products: MenuProduct[] = [];

        // Select all product items
        const items = $('.promotion_list_item');
        console.log(`Found ${items.length} product items in HTML.`);

        items.each((i, el) => {
            const $el = $(el);

            // Extract ID
            // User mentioned mainpop_1_ID but we see itemss_pID or data-id-real
            const realId = $el.attr('data-id-real');
            const elementId = $el.attr('id'); // e.g., itemss_p326
            const id = realId || (elementId ? elementId.replace('itemss_p', '') : '');

            if (!id) return;

            // Extract Name
            const name = $el.find('.pro-li-name').text().trim();

            // Extract Description
            const descHtml = $el.find('.pro-list-descContent').html() || '';
            // Clean HTML tags from description
            const description = descHtml
                .replace(/<br\s*\/?>/gi, '\n') // Replace <br> with newline
                .replace(/<[^>]+>/g, '') // Remove other tags
                .trim();

            // Extract Price
            // Structure:
            // <span class="pro-li-pr priceTxt_original">原價<span class="notranslate">$968</span></span>
            // <span class="pro-li-pr priceTxt">限時<span class="notranslate">$580</span>起</span>

            let price = 0;
            let originalPrice = 0;

            const priceText = $el.find('.priceTxt .notranslate').text().trim();
            if (priceText) {
                price = parseInt(priceText.replace(/[^\d]/g, ''), 10);
            }

            const originalPriceText = $el.find('.priceTxt_original .notranslate').text().trim();
            if (originalPriceText) {
                originalPrice = parseInt(originalPriceText.replace(/[^\d]/g, ''), 10);
            }

            // Fallback if priceTxt not found (e.g. standard price)
            if (price === 0) {
                 const simplePrice = $el.find('.pro-li-pr').not('.priceTxt_original').text().trim();
                 if (simplePrice) {
                    price = parseInt(simplePrice.replace(/[^\d]/g, ''), 10);
                 }
            }

            if (name) {
                products.push({
                    id,
                    name,
                    description,
                    price,
                    ...(originalPrice ? { originalPrice } : {})
                });
            }
        });

        console.log(`Extracted ${products.length} products.`);

        // Ensure public directory exists
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir);
        }

        const outputPath = path.join(publicDir, 'menu.json');
        fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
        console.log(`Saved menu data to ${outputPath}`);

    } catch (error) {
        console.error('Error in fetchAndParseMenu:', error);
        process.exit(1);
    }
}

fetchAndParseMenu();
