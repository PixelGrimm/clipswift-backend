// Content script for ClipSwift - runs on all websites
let snippets = [];
let userTier = 'free';

// Load snippets and user tier from storage
async function loadSnippets() {
    try {
        const result = await chrome.storage.sync.get(['snippets', 'userTier']);
        snippets = result.snippets || [];
        userTier = result.userTier || 'free';
        console.log('Content script: Loaded snippets:', snippets.length, 'userTier:', userTier);
    } catch (error) {
        snippets = [];
        userTier = 'free';
        console.log('Content script: Error loading snippets:', error);
    }
}

// Check for auto-completion triggers
function checkAutoCompletion(element, text) {
    // Get the current word being typed
    const words = text.split(/\s+/);
    const currentWord = words[words.length - 1];
    
    console.log('Content script: Checking auto-completion for:', currentWord, 'in element:', element.tagName);
    
    // First check sample snippets (always available)
    for (const snippet of snippets.filter(s => s.isSample)) {
        if (snippet.title && currentWord === snippet.title) {
            replaceText(element, words, snippet.content);
            return;
        }
    }
    
    // Then check user snippets (with tier restrictions)
    for (const snippet of snippets) {
        if (snippet.title && currentWord === snippet.title) {
            // For free users, check if snippet is disabled
            if (userTier === 'free') {
                const userSnippets = snippets.filter(s => !s.isSample);
                const lastTwoSnippets = userSnippets.slice(-2);
                const lastTwoSnippetIds = lastTwoSnippets.map(s => s.id);
                const isLocked = !snippet.isSample && !lastTwoSnippetIds.includes(snippet.id);
                
                if (isLocked) {
                    // Don't auto-complete disabled snippets for free users
                    continue;
                }
            }
            
            replaceText(element, words, snippet.content);
            return;
        }
    }
}

// Replace text in the element
function replaceText(element, words, replacement) {
    const newText = words.slice(0, -1).join(' ') + (words.length > 1 ? ' ' : '') + replacement;
    
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        // For input/textarea elements
        element.value = newText;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.contentEditable === 'true') {
        // For contenteditable elements
        element.textContent = newText;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Set cursor to end
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.setSelectionRange(newText.length, newText.length);
    } else if (element.contentEditable === 'true') {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// Check if element is a text input
function isTextInput(element) {
    if (!element) return false;
    
    // Check for input elements
    if (element.tagName === 'INPUT') {
        const type = (element.type || '').toLowerCase();
        return ['text', 'email', 'search', 'url', 'tel', 'password', 'number'].includes(type);
    }
    
    // Check for textarea
    if (element.tagName === 'TEXTAREA') {
        return true;
    }
    
    // Check for contenteditable
    if (element.contentEditable === 'true') {
        return true;
    }
    
    // Check for specific roles and attributes
    if (element.getAttribute('role') === 'textbox' || 
        element.getAttribute('role') === 'searchbox' ||
        element.getAttribute('role') === 'combobox') {
        return true;
    }
    
    // Check for common comment/input classes - SAFE VERSION
    try {
        // Handle all possible className types safely
        let className = '';
        if (typeof element.className === 'string') {
            className = element.className;
        } else if (element.className && typeof element.className.toString === 'function') {
            className = element.className.toString();
        } else if (element.className && element.className.baseVal) {
            className = element.className.baseVal;
        } else {
            className = '';
        }
        
        className = className.toLowerCase();
        if (className.includes('comment') || 
            className.includes('input') || 
            className.includes('text') ||
            className.includes('editor') ||
            className.includes('compose') ||
            className.includes('message') ||
            className.includes('post')) {
            return true;
        }
    } catch (error) {
        // Continue without className check
    }
    
    return false;
}

// Get text content from element
function getElementText(element) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        return element.value;
    } else if (element.contentEditable === 'true') {
        return element.textContent;
    }
    return '';
}

// Setup event listeners for text inputs
function setupEventListeners() {
    // Listen for input events on all elements
    document.addEventListener('input', function(e) {
        const element = e.target;
        if (isTextInput(element)) {
            const text = getElementText(element);
            checkAutoCompletion(element, text);
        }
    }, true);
    
    // Listen for keydown events
    document.addEventListener('keydown', function(e) {
        const element = e.target;
        if (isTextInput(element)) {
            // Trigger on space, enter, tab, or any key that might complete a command
            if (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab') {
                const text = getElementText(element);
                checkAutoCompletion(element, text);
            }
        }
    }, true);
    
    // Listen for keyup events to catch immediate typing without space
    document.addEventListener('keyup', function(e) {
        const element = e.target;
        if (isTextInput(element)) {
            const text = getElementText(element);
            const words = text.split(/\s+/);
            const currentWord = words[words.length - 1];
            
            // Check if current word is a complete command
            if (snippets.some(s => s.title === currentWord)) {
                checkAutoCompletion(element, text);
            }
        }
    }, true);
    
    // Listen for focus events to handle dynamic elements
    document.addEventListener('focus', function(e) {
        const element = e.target;
        if (isTextInput(element)) {
            // Add a small delay to ensure the element is ready
            setTimeout(() => {
                const text = getElementText(element);
                if (text) {
                    checkAutoCompletion(element, text);
                }
            }, 100);
        }
    }, true);
    
    // Listen for paste events
    document.addEventListener('paste', function(e) {
        const element = e.target;
        if (isTextInput(element)) {
            // Check after paste
            setTimeout(() => {
                const text = getElementText(element);
                checkAutoCompletion(element, text);
            }, 50);
        }
    }, true);
    
    // Listen for composition events (for IME input)
    document.addEventListener('compositionend', function(e) {
        const element = e.target;
        if (isTextInput(element)) {
            const text = getElementText(element);
            checkAutoCompletion(element, text);
        }
    }, true);
}

// Monitor for dynamically added elements
function setupMutationObserver() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added element is a text input
                        if (isTextInput(node)) {
                            // Add event listeners to the new element
                            node.addEventListener('input', function(e) {
                                const text = getElementText(node);
                                checkAutoCompletion(node, text);
                            });
                        }
                        
                        // Check child elements
                        const textInputs = node.querySelectorAll('input, textarea, [contenteditable="true"]');
                        textInputs.forEach(function(input) {
                            if (isTextInput(input)) {
                                input.addEventListener('input', function(e) {
                                    const text = getElementText(input);
                                    checkAutoCompletion(input, text);
                                });
                            }
                        });
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initialize when DOM is ready
function init() {
    console.log('ClipSwift content script initialized on:', window.location.href);
    loadSnippets();
    setupEventListeners();
    setupMutationObserver();
    
    // Listen for storage changes to reload snippets and user tier
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync' && (changes.snippets || changes.userTier)) {
        console.log('Content script: Storage changed, reloading snippets and user tier');
        loadSnippets();
    }
});

// Also listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Content script: Received message:', request.action);
    
    if (request.action === 'updateSnippets') {
        console.log('Content script: Received updateSnippets message');
        
        // Update snippets directly if provided
        if (request.snippets) {
            snippets = request.snippets;
            userTier = request.userTier || userTier;
            console.log('Content script: Updated snippets directly, count:', snippets.length);
            
            // Log the new snippets for debugging
            snippets.forEach(snippet => {
                console.log('Content script: Snippet loaded:', snippet.title, snippet.content.substring(0, 50) + '...');
            });
        } else {
            // Fallback to loading from storage
            loadSnippets().then(() => {
                console.log('Content script: Snippets reloaded from storage, count:', snippets.length);
            }).catch((error) => {
                console.error('Content script: Error reloading snippets from storage:', error);
            });
        }
        
        // Force a re-check of any active text inputs
        const activeElement = document.activeElement;
        if (activeElement && isTextInput(activeElement)) {
            const text = getElementText(activeElement);
            if (text) {
                console.log('Content script: Re-checking active element with text:', text);
                checkAutoCompletion(activeElement, text);
            }
        }
        
        // Also check all text inputs on the page
        const allTextInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], textarea, [contenteditable="true"]');
        allTextInputs.forEach(input => {
            if (isTextInput(input)) {
                const text = getElementText(input);
                if (text) {
                    console.log('Content script: Re-checking input:', input.tagName, 'with text:', text);
                    checkAutoCompletion(input, text);
                }
            }
        });
        
        sendResponse({success: true, snippetsCount: snippets.length});
        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'updateTier') {
        console.log('Content script: Received updateTier message', request);
        userTier = request.userTier;
        snippets = request.snippets || [];
        console.log('Content script: Updated userTier to', userTier, 'and snippets count:', snippets.length);
        sendResponse({success: true});
        return true;
    }
});
}

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}


