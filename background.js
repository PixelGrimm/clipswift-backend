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
    
    if (request.action === 'verifyPayment') {
        verifyPaymentInBackground(request.sessionId).then((result) => {
            sendResponse(result);
        });
        return true; // Keep message channel open for async response
    }
});

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
