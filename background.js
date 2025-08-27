// Background service worker for ClipSwift

// Handle installation
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('ClipSwift installed:', details.reason);
    
    // Inject content script into all existing tabs
    chrome.tabs.query({}, function(tabs) {
        tabs.forEach(function(tab) {
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                }).catch(function(error) {
                    console.log('Could not inject into tab:', tab.url, error);
                });
            }
        });
    });
});

// Inject content script when new tabs are created or updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && 
        (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).catch(function(error) {
            console.log('Could not inject into updated tab:', tab.url, error);
        });
    }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getSnippets') {
        chrome.storage.sync.get(['snippets'], (result) => {
            sendResponse({ snippets: result.snippets || [] });
        });
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'verifyPayment') {
        verifyPaymentInBackground(request.sessionId).then((result) => {
            sendResponse(result);
        });
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'injectContentScript') {
        injectContentScript().then((result) => {
            sendResponse(result);
        });
        return true; // Keep message channel open for async response
    }
});

// Inject content script using activeTab permission
async function injectContentScript() {
    try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            return { success: false, error: 'No active tab found' };
        }
        
        // Inject the content script
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });
        
        return { success: true, tabId: tab.id };
    } catch (error) {
        console.error('Failed to inject content script:', error);
        return { success: false, error: error.message };
    }
}

// Verify payment in background
async function verifyPaymentInBackground(sessionId) {
    try {
        const response = await fetch('https://clipswift-backend-production.up.railway.app/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId }),
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.paymentStatus === 'completed') {
                // Update user tier in background
                await chrome.storage.sync.set({ userTier: 'premium' });
                return { success: true, paymentStatus: 'completed' };
            } else {
                return { success: false, paymentStatus: 'pending' };
            }
        } else {
            return { success: false, error: 'Verification failed' };
        }
    } catch (error) {
        console.error('Background payment verification failed:', error);
        return { success: false, error: error.message };
    }
}
