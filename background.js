// Background service worker for ClipSwift

// Handle installation
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('ClipSwift installed:', details.reason);
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getSnippets') {
        chrome.storage.sync.get(['snippets'], (result) => {
            sendResponse({ snippets: result.snippets || [] });
        });
        return true; // Keep message channel open for async response
    }
});
