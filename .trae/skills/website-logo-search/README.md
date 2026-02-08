# Website Logo Search Skill

A comprehensive skill for searching and retrieving website logos from multiple sources including Baidu Images and Seeklogo. This skill provides a multi-source fallback strategy to ensure reliable logo retrieval for bookmark management systems, new tab pages, and web applications.

## Overview

This skill implements a cascading search strategy with three fallback levels:
1. **Primary**: Baidu Images - Fast and comprehensive image search
2. **Secondary**: Seeklogo - Specialized logo database with curated logos
3. **Fallback**: Placeholder generation - Ensures UI never breaks

## Features

- Multi-source logo search with automatic fallback
- Chrome extension architecture with background service worker
- Message passing between content scripts and background
- Async response pattern for non-blocking operations
- Comprehensive error handling at each level
- Visual feedback during search operations
- Support for manual URL input as alternative

## Use Cases

- Building bookmark management systems with icon support
- Creating new tab pages with website cards
- Developing applications that display website logos
- Implementing logo search functionality in browser extensions
- Building dashboard or launcher applications with website shortcuts

## Installation

1. Copy the skill directory to your project's `.trae/skills/` folder
2. Add the required permissions to your `manifest.json`:

```json
{
  "permissions": [
    "storage",
    "tabs",
    "bookmarks"
  ],
  "host_permissions": [
    "https://image.baidu.com/*",
    "https://seeklogo.com/*",
    "https://t3.gstatic.com/*",
    "<all_urls>"
  ]
}
```

3. Copy the background service worker code to your `background.js`
4. Copy the frontend integration code to your content script or popup

## Quick Start

### Background Service Worker

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'searchLogo') {
        const searchTerm = request.searchTerm;
        if (!searchTerm) {
            sendResponse({ error: 'Search term is required' });
            return true;
        }
        searchLogoFromBaidu(searchTerm, sendResponse);
        return true;
    }
    return false;
});
```

### Frontend Integration

```javascript
chrome.runtime.sendMessage({
    action: 'searchLogo',
    searchTerm: 'Google'
}, function(response) {
    if (response && response.success) {
        console.log('Found logos:', response.items);
    }
});
```

## Examples

See the [examples](./examples/) directory for complete working examples:

- [background.js](./examples/background.js) - Complete background service worker implementation
- [frontend.js](./examples/frontend.js) - Frontend integration with UI
- [example.html](./examples/example.html) - Example HTML interface

## API Reference

### Message Format

**Request:**
```javascript
{
    action: 'searchLogo',
    searchTerm: string  // Website name or domain to search
}
```

**Response:**
```javascript
{
    success: boolean,
    items: [
        {
            name: string,  // Logo name
            url: string    // Logo image URL
        }
    ],
    error?: string  // Error message if failed
}
```

## Known Issues

### CORS Issues
Browser security restrictions may block cross-origin requests. Use Chrome extension's background service worker which has broader permissions.

### Rate Limiting
External services (Baidu, Seeklogo) may rate limit requests. Implement request throttling and caching of results.

### Image Loading Failures
Hotlinking protection or expired URLs may cause images to fail loading. Implement fallback to placeholder images.

## Guidelines

1. Always validate search terms before making requests
2. Implement proper error handling at each search source
3. Use fallback strategies to ensure UI never breaks
4. Cache search results to reduce API calls
5. Limit result count to prevent overwhelming the UI
6. Provide visual feedback during search operations
7. Allow manual URL input as alternative to search

## Performance

| Metric | Value |
|--------|-------|
| Search sources | 3 (Baidu, Seeklogo, Placeholder) |
| Results per search | Up to 10 logos |
| Fallback success rate | 100% |
| Average response time | 1-3 seconds |

## Integration with Context Engineering Skills

This skill applies principles from the Agent Skills for Context Engineering collection:

- **tool-design**: Single comprehensive tool with contextual error responses
- **filesystem-context**: Uses Chrome's storage API for persistent context
- **evaluation**: Multi-source fallback strategy ensures end-state success

## License

This skill is part of the Website Logo Search project.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Support

For questions or issues, please refer to the main [SKILL.md](./SKILL.md) documentation.
