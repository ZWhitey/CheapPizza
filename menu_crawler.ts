import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// Define interfaces for the extracted data structure
interface ProductSize {
    size: string;
    price: number;
}

interface MenuProduct {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    category: string;
    categoryId: number;
    sizes?: ProductSize[]; // For products with multiple sizes
    url: string;
}

// Category mapping based on observation, will also try to extract from page
const CATEGORY_NAMES: { [key: number]: string } = {
    1: '優惠推薦',
    2: '大/小比薩',
    3: '個人比薩',
    4: '義大利麵/燉飯',
    5: '拼盤/熱烤',
    6: '甜點/飲料',
    7: '10人以上套餐',
    8: '特殊優惠'
};

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCategory(ct: number): Promise<MenuProduct[]> {
    const url = `https://www.pizzahut.com.tw/order/?mode=step_2&ct=${ct}`;
    console.log(`Fetching category ${ct} from ${url}...`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.pizzahut.com.tw/'
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch category ${ct}: ${response.status} ${response.statusText}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const products: MenuProduct[] = [];

        // Try to get category name from H1
        let categoryName = $('h1.visually-hidden').text().trim() ||
                           $('title').text().split('|')[0].trim() ||
                           CATEGORY_NAMES[ct] ||
                           `Category ${ct}`;

        // Select all product items
        const items = $('.promotion_list_item');
        console.log(`Found ${items.length} items in category ${ct} (${categoryName}).`);

        items.each((i, el) => {
            const $el = $(el);

            // Extract ID
            const realId = $el.attr('data-id-real');
            const elementId = $el.attr('id'); // e.g., itemss_p326
            const id = realId || (elementId ? elementId.replace('itemss_p', '') : '');

            if (!id) return;

            // Extract Name
            const name = $el.find('.pro-li-name').text().trim();

            // Extract Description
            const descHtml = $el.find('.pro-list-descContent').html() || '';
            const description = descHtml
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .trim();

            // Extract Price
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

            // Fallback for price
            if (price === 0) {
                 const simplePrice = $el.find('.pro-li-pr').not('.priceTxt_original').text().trim();
                 if (simplePrice) {
                    price = parseInt(simplePrice.replace(/[^\d]/g, ''), 10);
                 }
            }

            // Construct URL
            // Usually ?mode=step_2&ct=2&p_id=ID or similar
            // We can try to extract href from the <a> tag
            let productUrl = $el.find('a').attr('href') || '';
            if (productUrl && !productUrl.startsWith('http')) {
                productUrl = 'https://www.pizzahut.com.tw/order/' + productUrl;
            }

            if (name) {
                const product: MenuProduct = {
                    id,
                    name,
                    description,
                    price,
                    category: categoryName,
                    categoryId: ct,
                    url: productUrl
                };

                if (originalPrice) {
                    product.originalPrice = originalPrice;
                }

                // Attempt to detect sizes if implicit in category 2 (Big/Small)
                // Since the list page usually only shows the "Starting from" price which is often the Small size (or Large if it's the only one).
                // Without detail page crawling or JS parsing, we can't get the exact matrix.
                // However, we can structure the "sizes" field if we find evidence.
                // For now, we will leave 'sizes' undefined unless we find explicit multi-price data in the list item.

                products.push(product);
            }
        });

        return products;

    } catch (error) {
        console.error(`Error fetching category ${ct}:`, error);
        return [];
    }
}

async function main() {
    const allProducts: MenuProduct[] = [];

    // Loop through categories 1 to 8
    for (let ct = 1; ct <= 8; ct++) {
        const products = await fetchCategory(ct);
        allProducts.push(...products);
        // Add a small delay to be polite
        await delay(1000);
    }

    console.log(`Total extracted products: ${allProducts.length}`);

    // Ensure public directory exists
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
    }

    const outputPath = path.join(publicDir, 'menu.json');
    fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2));
    console.log(`Saved menu data to ${outputPath}`);
}

main();
