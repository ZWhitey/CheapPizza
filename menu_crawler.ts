import { CopilotClient } from "@github/copilot-sdk";
import * as fs from 'fs';
import * as path from 'path';

// Define the output structure matching the frontend requirements
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
    sizes?: ProductSize[];
    url: string;
}

const CATEGORIES = [
    { id: 1, name: '優惠推薦' },
    { id: 2, name: '大/小比薩' },
    { id: 3, name: '個人比薩' },
    { id: 4, name: '義大利麵/燉飯' },
    { id: 5, name: '拼盤/熱烤' },
    { id: 6, name: '甜點/飲料' },
    { id: 7, name: '10人以上套餐' },
    { id: 8, name: '特殊優惠' }
];

async function main() {
    console.log("Starting Menu Crawler Agent (Powered by GitHub Copilot SDK)...");

    const client = new CopilotClient({
        githubToken: process.env.COPILOT_GITHUB_TOKEN
    });

    try {
        const session = await client.createSession({
            model: 'gpt-5.1-mini'
        });

        // Actually, let's use the string exactly as requested or closest match.
        // Docs showed "GPT-5 mini". CLI likely expects "gpt-5.1-mini" or similar.
        // If it fails, we might need to change it. For now, following instruction.
        // Re-reading memory: "把模型換成 gpt-5.1 mini".
        // I will use 'gpt-5.1-mini'.

        let allProducts: MenuProduct[] = [];

        for (const cat of CATEGORIES) {
            console.log(`\n--- Processing Category ${cat.id}: ${cat.name} ---`);
            const url = `https://www.pizzahut.com.tw/order/?mode=step_2&ct=${cat.id}`;

            const prompt = `
Visit the following URL: ${url}

This page contains menu items for the category "${cat.name}".
Extract ALL products listed on this page.

For each product, extract:
- id: The unique product ID (found in URL parameter 'p_id' or 'pd' or data attribute).
- name: Product name.
- description: Ingredients or details.
- price: Current price (integer).
- originalPrice: Original price (if visible, integer).
- category: "${cat.name}"
- categoryId: ${cat.id}
- url: The full link to the product.

OUTPUT FORMAT:
Return strictly a JSON array of objects. No markdown formatting.
Format:
[{
    "id": "...",
    "name": "...",
    "description": "...",
    "price": 100,
    "originalPrice": 200,
    "category": "${cat.name}",
    "categoryId": ${cat.id},
    "url": "..."
}]

If no products are found, return [].
`;

            // Timeout per category to avoid total hang
            const response = await session.sendAndWait({ prompt }, 120000); // 2 minutes per category

            if (response && response.data && response.data.content) {
                let content = response.data.content;

                // Cleanup markdown
                content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

                try {
                    // Sometimes the agent might chat. Look for array start/end.
                    const arrayStart = content.indexOf('[');
                    const arrayEnd = content.lastIndexOf(']');
                    if (arrayStart !== -1 && arrayEnd !== -1) {
                        content = content.substring(arrayStart, arrayEnd + 1);
                        const products: MenuProduct[] = JSON.parse(content);
                        console.log(`Found ${products.length} products in category ${cat.id}.`);
                        allProducts = [...allProducts, ...products];
                    } else {
                        console.warn(`No JSON array found in response for category ${cat.id}. Response excerpt: ${content.substring(0, 100)}...`);
                    }
                } catch (e) {
                    console.error(`Failed to parse JSON for category ${cat.id}:`, e);
                }
            } else {
                console.error(`No response for category ${cat.id}`);
            }
        }

        console.log(`\nTotal products found: ${allProducts.length}`);

        // Save to file
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir);
        }
        const outputPath = path.join(publicDir, 'menu.json');
        fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2));
        console.log(`Saved menu data to ${outputPath}`);

    } catch (error) {
        console.error("Agent execution failed:", error);
        process.exitCode = 1;
    } finally {
        // Ensure cleanup prevents hanging
        await client.stop();
        console.log("Client stopped.");
        process.exit(process.exitCode ?? 0);
    }
}

main();
