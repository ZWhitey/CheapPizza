import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { extractProductsFromPage } from '../menu_crawler';
import { chromium, type Browser, type Page } from 'playwright';

// Sample HTML mimicking the Pizza Hut website structure
const SAMPLE_CATEGORY_HTML = `
<!DOCTYPE html>
<html>
<head><title>大/小比薩，人氣主打 | Pizza Hut 必勝客</title></head>
<body>
  <h1>大/小比薩</h1>
  <div class="list-container">
    <h2>人氣主打</h2>
    <div class="promotion_list_item" id="itemss_s100" data-id-real="100">
      <a href="?mode=step_2&p_id=100">
        <img data-src="https://img.pizzahut.com.tw/w230/test-image.jpg" />
        <div class="pro-li-name">Hot任選小比薩餐</div>
        <div class="pro-list-descContent">小比薩1個+熱烤類1份。</div>
        <div class="pro-li-pr">
          <span class="priceTxt"><span class="notranslate">$398</span></span>
          起
        </div>
      </a>
    </div>
    <div class="promotion_list_item" id="itemss_s200" data-id-real="200">
      <a href="?mode=step_2&p_id=200">
        <img data-src="https://img.pizzahut.com.tw/w230/test-image2.jpg" />
        <div class="pro-li-name">金皇軟殼蟹鮑魚</div>
        <div class="pro-list-descContent">嚴選酥炸軟殼蟹為主角。</div>
        <div class="pro-li-pr">
          <span class="priceTxt_original"><span class="notranslate">$968</span></span>
          <span class="priceTxt"><span class="notranslate">$580</span></span>
        </div>
      </a>
    </div>
  </div>
  <div class="list-container">
    <h2>超值系列</h2>
    <div class="promotion_list_item" id="itemss_s300" data-id-real="300">
      <a href="?mode=step_2&p_id=300">
        <img data-src="https://img.pizzahut.com.tw/w230/test-image3.jpg" />
        <div class="pro-li-name">夏威夷</div>
        <div class="pro-list-descContent">經典夏威夷口味。</div>
        <div class="pro-li-pr">
          <span class="priceTxt"><span class="notranslate">$199</span></span>
        </div>
      </a>
    </div>
    <div class="promotion_list_item" id="itemss_s400" data-id-real="400">
      <a href="?mode=step_2&p_id=400">
        <img data-src="https://img.pizzahut.com.tw/w230/test-image4.jpg" />
        <div class="pro-li-name">外帶大比薩送大比薩</div>
        <div class="pro-list-descContent">外帶買大比薩送大比薩。</div>
        <div class="pro-li-pr"></div>
      </a>
    </div>
  </div>
</body>
</html>
`;

describe('Menu Crawler - extractProductsFromPage', () => {
  let browser: Browser;
  let page: Page;

  // Set up a real browser page serving our sample HTML
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  async function loadSamplePage(html: string): Promise<Page> {
    // Use route to intercept and serve our sample HTML with proper UTF-8 encoding
    await page.route('**/order/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: html,
      });
    });
    return page;
  }

  it('should extract all products from all subcategories', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    expect(products).toHaveLength(4);
  });

  it('should extract product names correctly', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const names = products.map(p => p.name);
    expect(names).toContain('Hot任選小比薩餐');
    expect(names).toContain('金皇軟殼蟹鮑魚');
    expect(names).toContain('夏威夷');
    expect(names).toContain('外帶大比薩送大比薩');
  });

  it('should extract prices correctly', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const priceMap = Object.fromEntries(products.map(p => [p.name, p.price]));
    expect(priceMap['Hot任選小比薩餐']).toBe(398);
    expect(priceMap['金皇軟殼蟹鮑魚']).toBe(580);
    expect(priceMap['夏威夷']).toBe(199);
    expect(priceMap['外帶大比薩送大比薩']).toBe(0);
  });

  it('should extract original prices correctly', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const product = products.find(p => p.name === '金皇軟殼蟹鮑魚');
    expect(product?.originalPrice).toBe(968);

    // Products without original price should not have it set
    const noOrigPrice = products.find(p => p.name === 'Hot任選小比薩餐');
    expect(noOrigPrice?.originalPrice).toBeUndefined();
  });

  it('should detect starting price indicator', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const startingProduct = products.find(p => p.name === 'Hot任選小比薩餐');
    expect(startingProduct?.isStartingPrice).toBe(true);

    // Products without "起" should not be marked as starting price
    const normalProduct = products.find(p => p.name === '夏威夷');
    expect(normalProduct?.isStartingPrice).toBe(false);
  });

  it('should extract subcategory info', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const subcatMap = Object.fromEntries(products.map(p => [p.name, p.subcategory]));
    expect(subcatMap['Hot任選小比薩餐']).toBe('人氣主打');
    expect(subcatMap['金皇軟殼蟹鮑魚']).toBe('人氣主打');
    expect(subcatMap['夏威夷']).toBe('超值系列');
  });

  it('should extract category and categoryId', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    products.forEach(p => {
      expect(p.category).toBe('大/小比薩');
      expect(p.categoryId).toBe(2);
    });
  });

  it('should extract product IDs from data-id-real', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const ids = products.map(p => p.id);
    expect(ids).toContain('100');
    expect(ids).toContain('200');
    expect(ids).toContain('300');
    expect(ids).toContain('400');
  });

  it('should extract image URLs', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const product = products.find(p => p.name === 'Hot任選小比薩餐');
    expect(product?.imageUrl).toBe('https://img.pizzahut.com.tw/w230/test-image.jpg');
  });

  it('should extract descriptions', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const product = products.find(p => p.name === 'Hot任選小比薩餐');
    expect(product?.description).toBe('小比薩1個+熱烤類1份。');
  });

  it('should construct product URLs', async () => {
    await loadSamplePage(SAMPLE_CATEGORY_HTML);
    const products = await extractProductsFromPage(page, 2);

    const product = products.find(p => p.name === 'Hot任選小比薩餐');
    expect(product?.url).toContain('p_id=100');
  });

  it('should handle empty categories gracefully', async () => {
    const emptyHtml = `
      <!DOCTYPE html>
      <html><body><h1>Empty</h1></body></html>
    `;
    await loadSamplePage(emptyHtml);
    const products = await extractProductsFromPage(page, 99);

    expect(products).toHaveLength(0);
  }, 15000);
});
