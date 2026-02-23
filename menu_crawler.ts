import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Define interfaces for the extracted data structure
interface MenuProduct {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    isStartingPrice: boolean;
    category: string;
    categoryId: number;
    subcategory: string;
    imageUrl: string;
    url: string;
}

// Category IDs to scrape (matching the Pizza Hut website navigation)
const CATEGORY_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Extract all products from a fully-rendered category page using Playwright.
 * Each category page contains multiple subcategory sections (.list-container)
 * with products inside (.promotion_list_item).
 */
export async function extractProductsFromPage(page: Page, ct: number): Promise<MenuProduct[]> {
    const url = `https://www.pizzahut.com.tw/order/?mode=step_2&ct=${ct}`;
    console.log(`Navigating to category ${ct}: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the product list to render
    await page.waitForSelector('.promotion_list_item', { timeout: 10000 }).catch(() => {
        console.warn(`No products found for category ${ct}, page may be empty.`);
    });

    const categoryName = await page.evaluate(() => {
        return document.querySelector('h1')?.textContent?.trim() || '';
    });

    const products = await page.evaluate((ctId: number) => {
        const results: {
            id: string;
            name: string;
            description: string;
            price: number;
            originalPrice: number;
            isStartingPrice: boolean;
            category: string;
            categoryId: number;
            subcategory: string;
            imageUrl: string;
            url: string;
        }[] = [];

        const categoryTitle = document.querySelector('h1')?.textContent?.trim() || `Category ${ctId}`;
        const containers = document.querySelectorAll('.list-container');

        containers.forEach(container => {
            const subcategory = container.querySelector('h2')?.textContent?.trim() || '';
            const items = container.querySelectorAll('.promotion_list_item');

            items.forEach(item => {
                const name = item.querySelector('.pro-li-name')?.textContent?.trim() || '';
                if (!name) return;

                const id = item.getAttribute('data-id-real') || item.id?.replace('itemss_p', '').replace('itemss_s', '') || '';
                if (!id) return;

                // Description
                const descEl = item.querySelector('.pro-list-descContent');
                const description = descEl?.textContent?.trim() || '';

                // Price extraction
                const priceEl = item.querySelector('.priceTxt .notranslate');
                const priceText = priceEl?.textContent?.trim() || '';
                let price = parseInt(priceText.replace(/[^\d]/g, ''), 10) || 0;

                // Original (strikethrough) price
                const originalPriceEl = item.querySelector('.priceTxt_original .notranslate');
                const originalPriceText = originalPriceEl?.textContent?.trim() || '';
                const originalPrice = parseInt(originalPriceText.replace(/[^\d]/g, ''), 10) || 0;

                // Detect "起" (starting price) indicator
                const priceContainer = item.querySelector('.pro-li-pr');
                const isStartingPrice = priceContainer?.textContent?.includes('起') || false;

                // Fallback price from the price container text
                if (price === 0 && priceContainer) {
                    const containerText = priceContainer.textContent || '';
                    const match = containerText.match(/\$(\d+)/);
                    if (match) {
                        price = parseInt(match[1], 10);
                    }
                }

                // Image URL
                const img = item.querySelector('img');
                const imageUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || '';

                // Product URL
                const anchor = item.querySelector('a');
                let productUrl = anchor?.getAttribute('href') || '';
                if (productUrl && !productUrl.startsWith('http')) {
                    productUrl = 'https://www.pizzahut.com.tw/order/' + productUrl;
                }

                results.push({
                    id,
                    name,
                    description,
                    price,
                    originalPrice,
                    isStartingPrice,
                    category: categoryTitle,
                    categoryId: ctId,
                    subcategory,
                    imageUrl,
                    url: productUrl,
                });
            });
        });

        return results;
    }, ct);

    // Post-process: only include originalPrice if it's non-zero
    const processed: MenuProduct[] = products.map(p => {
        const product: MenuProduct = {
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            isStartingPrice: p.isStartingPrice,
            category: p.category || categoryName || `Category ${ct}`,
            categoryId: p.categoryId,
            subcategory: p.subcategory,
            imageUrl: p.imageUrl,
            url: p.url,
        };
        if (p.originalPrice > 0) {
            product.originalPrice = p.originalPrice;
        }
        return product;
    });

    console.log(`  Found ${processed.length} items in category ${ct} (${categoryName})`);
    return processed;
}

async function main() {
    console.log('Starting Playwright-based menu crawler...');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const allProducts: MenuProduct[] = [];

    for (const ct of CATEGORY_IDS) {
        try {
            const products = await extractProductsFromPage(page, ct);
            allProducts.push(...products);
        } catch (error) {
            console.error(`Error scraping category ${ct}:`, error);
        }
    }

    await browser.close();

    console.log(`\nTotal extracted products: ${allProducts.length}`);

    // Ensure public directory exists
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
    }

    const outputPath = path.join(publicDir, 'menu.json');
    fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2));
    console.log(`Saved menu data to ${outputPath}`);
}

// Only run main when executed directly, not when imported
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    main();
}
