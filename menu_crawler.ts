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

// Tool implementation for fetching pages
async function fetchPage({ url }: { url: string }) {
    console.log(`[Tool] Fetching: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.pizzahut.com.tw/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            }
        });

        if (!response.ok) {
            return `Error: ${response.status} ${response.statusText}`;
        }

        const text = await response.text();
        // Return a truncated version if it's too huge to save context,
        // but for now we'll return full HTML as the agent needs to parse it.
        // We might want to strip script/style tags to save tokens.
        return text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
                   .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
                   .replace(/<!--[\s\S]*?-->/gm, "");
    } catch (error: any) {
        return `Error fetching page: ${error.message}`;
    }
}

async function main() {
    console.log("Starting Menu Crawler Agent (Powered by GitHub Copilot SDK)...");

    // Initialize the Copilot Client
    // This assumes 'copilot' CLI is installed and available in PATH
    const client = new CopilotClient();

    try {
        // Start the client (connects to CLI)
        // Note: autoStart is true by default in constructor, but being explicit is fine.
        // If not authenticated, the CLI might prompt or fail. In CI, we use tokens.

        const session = await client.createSession({
            model: 'gpt-4.1',
            tools: [
                {
                    name: 'fetch_page',
                    description: 'Fetches the HTML content of a URL to extract menu information.',
                    parameters: {
                        type: 'object',
                        properties: {
                            url: { type: 'string', description: 'The fully qualified URL to fetch' }
                        },
                        required: ['url']
                    },
                    handler: fetchPage
                }
            ]
        });

        console.log("Session created. Sending instructions...");

        const prompt = `
You are an intelligent menu crawler for Pizza Hut Taiwan.
Your goal is to discover the menu categories and all products, then output a structured JSON file.

Start by visiting: https://www.pizzahut.com.tw/

Follow these steps:
1. Fetch the homepage to find links to the "Menu" or "Order" section.
2. Identify the main categories (e.g., Pizza, Pasta, BBQ, Drinks, etc.).
   (Hint: Categories usually look like ?mode=step_2&ct=1, ct=2, etc.)
3. Visit each category page.
4. Extract every product found in the category.

For each product, extract:
- id: The unique product ID (often in data attributes or URL).
- name: Product name.
- description: Ingredients or details.
- price: Current price (integer).
- originalPrice: Original price (if visible, integer).
- category: The category name (e.g., "個人比薩").
- categoryId: The category number (e.g., 1, 2...).
- url: Full URL to the product.

OUTPUT FORMAT:
You must output ONLY the valid JSON array of objects. Do not wrap it in markdown code blocks if possible, or just plain text.
The JSON structure must match this TypeScript interface:
interface MenuProduct {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    category: string;
    categoryId: number;
    sizes?: { size: string; price: number }[];
    url: string;
}

IMPORTANT:
- Be thorough.
- Do not make up data.
- Use the 'fetch_page' tool to get the HTML.
- If the page is large, focus on the list of products.
- Return ONLY the JSON string in your final response.
`;

        // We use sendAndWait to let the agent do its "thinking" and tool calling loops.
        // We set a long timeout because crawling multiple pages takes time.
        const response = await session.sendAndWait({ prompt }, 600000); // 10 minutes timeout

        if (response && response.data && response.data.content) {
            let content = response.data.content;
            console.log("Agent finished. Processing output...");

            // Cleanup potential markdown formatting
            if (content.startsWith('```json')) {
                content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (content.startsWith('```')) {
                content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            try {
                const menuData: MenuProduct[] = JSON.parse(content);
                console.log(`Successfully parsed ${menuData.length} products.`);

                // Validation: Ensure it's an array
                if (!Array.isArray(menuData)) {
                    throw new Error("Output is not an array");
                }

                // Save to file
                const publicDir = path.join(process.cwd(), 'public');
                if (!fs.existsSync(publicDir)) {
                    fs.mkdirSync(publicDir);
                }
                const outputPath = path.join(publicDir, 'menu.json');
                fs.writeFileSync(outputPath, JSON.stringify(menuData, null, 2));
                console.log(`Saved menu data to ${outputPath}`);

            } catch (parseError) {
                console.error("Failed to parse JSON output:", parseError);
                console.log("Raw output:", content);
            }
        } else {
            console.error("No response from agent.");
        }

        await session.destroy();
        await client.stop();

    } catch (error) {
        console.error("Agent failed:", error);
        await client.stop();
        process.exit(1);
    }
}

main();
