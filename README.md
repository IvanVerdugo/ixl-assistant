# IXL Assistant Chrome Extension

An AI-powered assistant for IXL that integrates with ChatGPT, DeepSeek, and Gemini.

## Features

- ChatGPT integration
- DeepSeek integration
- Gemini integration
- IXL page enhancement

## Development

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked" and select this folder

### Scripts

- `npm run dev` - Start development mode
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests

## File Structure

```
ixl-assistant/
├── manifest.json          # Extension configuration
├── package.json           # NPM dependencies
├── background/
│   └── background.js      # Service worker
├── content-scripts/
│   ├── ixl.js            # IXL page injection
│   ├── chatgpt.js        # ChatGPT integration
│   ├── deepseek.js       # DeepSeek integration
│   └── gemini.js         # Gemini integration
├── popup/
│   ├── settings.html     # Popup UI
│   ├── settings.js       # Popup logic
│   └── settings.css      # Popup styles
└── assets/               # Static assets
```

## GitHub Integration

This project is configured for GitHub integration. To use:

1. Create a `.env` file with your GitHub token:
   ```
   GITHUB_TOKEN=your_token_here
   ```

2. Push to your repository:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin master
   ```

## Chrome DevTools

The extension can be debugged using Chrome DevTools:

1. Right-click the extension icon → "Inspect popup"
2. Go to `chrome://extensions` and click "background page" or "service worker"

## License

MIT
