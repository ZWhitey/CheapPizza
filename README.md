<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ZlV6RqcpMkYxn3n6xOqD4jDTrGT0bKZv

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## GitHub Pages Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions.

### Automatic Deployment

- The deployment workflow triggers automatically on every push to the `main` branch
- The workflow runs the crawler to update coupon data before building
- The built site is deployed to the `gh-pages` branch, which is served at: `https://ZWhitey.github.io/CheapPizza/`

### Manual Deployment

You can also trigger the deployment manually:

1. Go to the repository's Actions tab
2. Select the "Deploy to GitHub Pages" workflow
3. Click "Run workflow" and select the branch to deploy

### Local Build

To test the build locally:

```bash
# Update coupon data
npm run crawler

# Build the project
npm run build

# Preview the built site
npm run preview
```

## Coupon Crawler Optimization

The crawler has been optimized to reduce scanning time by 64%:
- **Original**: 5000 codes across 5 ranges (14xxx, 15xxx, 25xxx, 26xxx, 94xxx)
- **Optimized**: 1800 codes across 18 targeted ranges
- Based on analysis of 853 valid coupons collected

See [OPTIMIZATION.md](OPTIMIZATION.md) for detailed analysis and results.
