// ClipSwift Extension - Main Popup Logic

// Global variables
let snippets = [];
let currentSnippet = null;
let currentCategory = 'All';
let searchQuery = '';
let currentTheme = 'light';
// API key for OpenAI - this is your OpenAI API key
let openaiApiKey = 'YOUR_OPENAI_API_KEY_HERE';

// User tier management
let userTier = 'free'; // 'free' or 'premium'

// Initialize the popup
async function init() {
    await loadSnippets();
    await loadSettings();
    cleanupGenericSnippets();
    enforceTierRestrictions();
    await checkPendingPayments();
    setupEventListeners();
    setupHelpModalListeners();
    setupUpgradeModalListeners();
    setupDowngradeModalListeners();
    setupAiModalListeners();
    applyTheme();
    updateUIForTier();
    showEditorOverlay();
}

// Load snippets from storage
async function loadSnippets() {
    try {
        const result = await chrome.storage.sync.get(['snippets']);
        snippets = result.snippets || [];
        
        // Add sample snippets if none exist
        if (snippets.length === 0) {
            snippets = [
                {
                    id: 'sample1',
                    command: ':welcome',
                    content: 'Welcome to ClipSwift! This is a sample snippet. You can edit or delete it.',
                    category: 'Messages',
                    isSample: true,
                    disabled: false
                },
                {
                    id: 'sample2',
                    command: ':thanks',
                    content: 'Thank you for using ClipSwift! We hope you find it helpful.',
                    category: 'Messages',
                    isSample: true,
                    disabled: false
                }
            ];
            await saveSnippets();
        }
        
        renderSnippetsList();
    } catch (error) {
        console.error('Error loading snippets:', error);
    }
}

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['theme', 'userTier']);
        currentTheme = result.theme || 'light';
        userTier = result.userTier || 'free';
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Update UI based on user tier
function updateUIForTier() {
    const upgradeButton = document.getElementById('upgradeButton');
    const downgradeButton = document.getElementById('downgradeButton');
    const aiButton = document.getElementById('aiButton');
    
    if (userTier === 'premium') {
        if (upgradeButton) upgradeButton.style.display = 'none';
        if (downgradeButton) downgradeButton.style.display = 'inline-block';
        if (aiButton) {
            aiButton.style.opacity = '1';
            aiButton.title = 'AI Content Generator';
        }
    } else {
        if (upgradeButton) upgradeButton.style.display = 'inline-block';
        if (downgradeButton) downgradeButton.style.display = 'none';
        if (aiButton) {
            aiButton.style.opacity = '0.5';
            aiButton.title = 'AI Content Generator (Premium Only)';
        }
    }
    
    enforceTierRestrictions();
    renderSnippetsList();
}

// Enforce tier restrictions
function enforceTierRestrictions() {
    if (userTier === 'free') {
        // For free users, only the last 2 user-created snippets should be enabled
        const userSnippets = snippets.filter(s => !s.isSample);
        const lastTwoSnippets = userSnippets.slice(-2);
        const lastTwoIds = lastTwoSnippets.map(s => s.id);
        
        snippets.forEach(snippet => {
            if (!snippet.isSample) {
                snippet.disabled = !lastTwoIds.includes(snippet.id);
            }
        });
    } else {
        // For premium users, all snippets should be enabled
        snippets.forEach(snippet => {
            snippet.disabled = false;
        });
    }
    
    saveSnippets();
}

// Check for pending payments on startup
async function checkPendingPayments() {
    try {
        const result = await chrome.storage.sync.get(['pendingSessionId', 'pendingPaymentTime']);
        const { pendingSessionId, pendingPaymentTime } = result;
        
        if (pendingSessionId && pendingPaymentTime) {
            const timeDiff = Date.now() - pendingPaymentTime;
            const fiveMinutes = 5 * 60 * 1000;
            
            if (timeDiff < fiveMinutes) {
                // Payment was recent, check status
                await checkPaymentStatus(pendingSessionId);
            } else {
                // Clear old pending payment data
                await chrome.storage.sync.remove(['pendingSessionId', 'pendingPaymentTime']);
            }
        }
    } catch (error) {
        console.error('Error checking pending payments:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // New snippet button
    const newSnippetBtn = document.getElementById('newSnippetBtn');
    if (newSnippetBtn) {
        newSnippetBtn.addEventListener('click', createNewSnippet);
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderSnippetsList();
        });
    }
    
    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            renderSnippetsList();
        });
    }
    
    // Command input
    const commandInput = document.getElementById('commandInput');
    if (commandInput) {
        commandInput.addEventListener('input', (e) => {
            if (currentSnippet) {
                currentSnippet.command = e.target.value;
            }
        });
    }
    
    // Content textarea
    const contentTextarea = document.getElementById('contentTextarea');
    if (contentTextarea) {
        contentTextarea.addEventListener('input', (e) => {
            if (currentSnippet) {
                currentSnippet.content = e.target.value;
            }
        });
    }
    
    // Save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentSnippet);
    }
    
    // Delete button
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteCurrentSnippet);
    }
    
    // AI button
    const aiButton = document.getElementById('aiButton');
    if (aiButton) {
        aiButton.addEventListener('click', openAiModal);
    }
    
    // Help button
    const helpButton = document.getElementById('helpButton');
    if (helpButton) {
        helpButton.addEventListener('click', showHelpModal);
    }
    
    // Contact button
    const contactButton = document.getElementById('contactButton');
    if (contactButton) {
        contactButton.addEventListener('click', showContactModal);
    }
    
    // Upgrade button
    const upgradeButton = document.getElementById('upgradeButton');
    if (upgradeButton) {
        upgradeButton.addEventListener('click', showUpgradeModal);
    }
    
    // Downgrade button
    const downgradeButton = document.getElementById('downgradeButton');
    if (downgradeButton) {
        downgradeButton.addEventListener('click', handleDowngrade);
    }
}

// Setup help modal listeners
function setupHelpModalListeners() {
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', closeHelpModal);
    }
}

// Setup upgrade modal listeners
function setupUpgradeModalListeners() {
    const closeUpgradeBtn = document.getElementById('closeUpgradeBtn');
    const maybeLaterBtn = document.getElementById('maybeLaterBtn');
    const upgradeNowBtn = document.getElementById('upgradeNowBtn');
    const closeUpgradeSuccessBtn = document.getElementById('closeUpgradeSuccessBtn');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const closeUpgradeErrorBtn = document.getElementById('closeUpgradeErrorBtn');
    const closeErrorBtn = document.getElementById('closeErrorBtn');
    const tryAgainBtn = document.getElementById('tryAgainBtn');
    
    if (closeUpgradeBtn) {
        closeUpgradeBtn.addEventListener('click', closeUpgradeModal);
    }
    if (maybeLaterBtn) {
        maybeLaterBtn.addEventListener('click', closeUpgradeModal);
    }
    if (upgradeNowBtn) {
        upgradeNowBtn.addEventListener('click', () => {
            const emailInput = document.getElementById('customerEmail');
            const customerEmail = emailInput ? emailInput.value.trim() : '';
            if (!customerEmail) {
                alert('Please enter your billing email address');
                return;
            }
            handlePayment();
        });
    }
    if (closeUpgradeSuccessBtn) {
        closeUpgradeSuccessBtn.addEventListener('click', closeUpgradeSuccessModal);
    }
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', closeUpgradeSuccessModal);
    }
    if (closeUpgradeErrorBtn) {
        closeUpgradeErrorBtn.addEventListener('click', closeUpgradeErrorModal);
    }
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', closeUpgradeErrorModal);
    }
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', closeUpgradeErrorModal);
    }
}

// Setup downgrade modal listeners
function setupDowngradeModalListeners() {
    const closeDowngradeBtn = document.getElementById('closeDowngradeBtn');
    const cancelDowngradeBtn = document.getElementById('cancelDowngradeBtn');
    const confirmDowngradeBtn = document.getElementById('confirmDowngradeBtn');
    const closeDowngradeSuccessBtn = document.getElementById('closeDowngradeSuccessBtn');
    const gotItBtn = document.getElementById('gotItBtn');
    
    if (closeDowngradeBtn) {
        closeDowngradeBtn.addEventListener('click', closeDowngradeConfirmModal);
    }
    if (cancelDowngradeBtn) {
        cancelDowngradeBtn.addEventListener('click', closeDowngradeConfirmModal);
    }
    if (confirmDowngradeBtn) {
        confirmDowngradeBtn.addEventListener('click', confirmDowngrade);
    }
    if (closeDowngradeSuccessBtn) {
        closeDowngradeSuccessBtn.addEventListener('click', closeDowngradeSuccessModal);
    }
    if (gotItBtn) {
        gotItBtn.addEventListener('click', closeDowngradeSuccessModal);
    }
}

// Setup AI modal listeners
function setupAiModalListeners() {
    const closeAiBtn = document.getElementById('closeAiBtn');
    const generateBtn = document.getElementById('generateBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    if (closeAiBtn) {
        closeAiBtn.addEventListener('click', closeAiModal);
    }
    if (generateBtn) {
        generateBtn.addEventListener('click', generateAiContent);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAiModal);
    }
}

// Clean up generic snippets (old sample snippets)
function cleanupGenericSnippets() {
    snippets = snippets.filter(snippet => !snippet.command.startsWith('generic_'));
    saveSnippets();
}

// Create a new snippet
function createNewSnippet() {
    // Check if free user has reached limit
    if (userTier === 'free') {
        const userSnippets = snippets.filter(s => !s.isSample);
        if (userSnippets.length >= 2) {
            showUpgradeModal();
            return;
        }
    }
    
    const newSnippet = {
        id: Date.now().toString(),
        command: '',
        content: '',
        category: 'Messages',
        isSample: false,
        disabled: false
    };
    
    snippets.push(newSnippet);
    currentSnippet = newSnippet;
    saveSnippets();
    renderSnippetsList();
    showEditorOverlay();
    
    // Focus on command input
    setTimeout(() => {
        const commandInput = document.getElementById('commandInput');
        if (commandInput) {
            commandInput.focus();
        }
    }, 100);
}

// Save current snippet
function saveCurrentSnippet() {
    if (!currentSnippet) return;
    
    // Validate required fields
    if (!currentSnippet.command.trim()) {
        alert('Please enter a command');
        return;
    }
    
    if (!currentSnippet.content.trim()) {
        alert('Please enter content');
        return;
    }
    
    // Check for duplicate commands (excluding current snippet)
    const duplicate = snippets.find(s => 
        s.id !== currentSnippet.id && 
        s.command.toLowerCase() === currentSnippet.command.toLowerCase()
    );
    
    if (duplicate) {
        alert('A snippet with this command already exists');
        return;
    }
    
    // Update category if not set
    if (!currentSnippet.category) {
        currentSnippet.category = 'Messages';
    }
    
    saveSnippets();
    renderSnippetsList();
    
    // Show success message
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#28a745';
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 2000);
    }
}

// Load a snippet for editing
function loadSnippet(snippet) {
    // For free users, prevent loading locked snippets
    if (userTier === 'free' && snippet.disabled) {
        showUpgradeModal();
        return;
    }
    
    currentSnippet = { ...snippet };
    
    const commandInput = document.getElementById('commandInput');
    const contentTextarea = document.getElementById('contentTextarea');
    const categorySelect = document.getElementById('categorySelect');
    
    if (commandInput) commandInput.value = currentSnippet.command || '';
    if (contentTextarea) contentTextarea.value = currentSnippet.content || '';
    if (categorySelect) categorySelect.value = currentSnippet.category || 'Messages';
    
    showEditorOverlay();
}

// Delete current snippet
function deleteCurrentSnippet() {
    if (!currentSnippet) return;
    
    if (confirm('Are you sure you want to delete this snippet?')) {
        const index = snippets.findIndex(s => s.id === currentSnippet.id);
        if (index > -1) {
            snippets.splice(index, 1);
            currentSnippet = null;
            saveSnippets();
            renderSnippetsList();
            hideEditorOverlay();
        }
    }
}

// Render snippets list
function renderSnippetsList() {
    const snippetsList = document.getElementById('snippetsList');
    if (!snippetsList) return;
    
    // Filter snippets
    let filteredSnippets = snippets;
    
    // Filter by category
    if (currentCategory !== 'All') {
        filteredSnippets = filteredSnippets.filter(s => s.category === currentCategory);
    }
    
    // Filter by search query
    if (searchQuery) {
        filteredSnippets = filteredSnippets.filter(s => 
            s.command.toLowerCase().includes(searchQuery) ||
            s.content.toLowerCase().includes(searchQuery)
        );
    }
    
    // For free users, mark excess snippets as locked
    if (userTier === 'free') {
        const userSnippets = snippets.filter(s => !s.isSample);
        const lastTwoSnippets = userSnippets.slice(-2);
        const lastTwoIds = lastTwoSnippets.map(s => s.id);
        
        filteredSnippets.forEach(snippet => {
            if (!snippet.isSample) {
                snippet.isLocked = !lastTwoIds.includes(snippet.id);
            }
        });
    }
    
    // Generate HTML
    let html = '';
    filteredSnippets.forEach(snippet => {
        const isLocked = snippet.isLocked || (userTier === 'free' && snippet.disabled);
        const isDisabled = userTier === 'free' && snippet.disabled;
        
        html += `
            <div class="snippet-item ${isDisabled ? 'disabled' : ''}" 
                 onclick="${isLocked ? 'showUpgradeModal()' : `loadSnippet(${JSON.stringify(snippet).replace(/"/g, '&quot;')})`}">
                <div class="snippet-header">
                    <span class="snippet-command">${snippet.command}</span>
                    ${snippet.isSample ? '<span class="sample-badge">Sample</span>' : ''}
                    ${isLocked ? '<span class="premium-badge">Premium Only</span>' : ''}
                </div>
                <div class="snippet-content">${snippet.content.substring(0, 50)}${snippet.content.length > 50 ? '...' : ''}</div>
                <div class="snippet-category">${snippet.category}</div>
            </div>
        `;
    });
    
    snippetsList.innerHTML = html;
    
    // Update snippet count
    updateSnippetCount();
}

// Update snippet count display
function updateSnippetCount() {
    const userSnippets = snippets.filter(s => !s.isSample);
    const snippetCount = document.getElementById('snippetCount');
    if (snippetCount) {
        snippetCount.textContent = `${userSnippets.length}/2 snippets`;
    }
}

// Save snippets to storage
async function saveSnippets() {
    try {
        await chrome.storage.sync.set({ snippets: snippets });
        
        // Notify content scripts
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { action: 'updateSnippets' }).catch(() => {});
            });
        });
        
        // Force storage sync event
        chrome.storage.sync.get(['snippets'], () => {});
    } catch (error) {
        console.error('Error saving snippets:', error);
    }
}

// Toggle theme
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    chrome.storage.sync.set({ theme: currentTheme });
    applyTheme();
}

// Apply theme
function applyTheme() {
    document.body.className = currentTheme === 'dark' ? 'dark-theme' : '';
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀️';
    }
}

// Show editor overlay
function showEditorOverlay() {
    const editorOverlay = document.getElementById('editorOverlay');
    if (editorOverlay) {
        editorOverlay.style.display = 'flex';
    }
}

// Hide editor overlay
function hideEditorOverlay() {
    const editorOverlay = document.getElementById('editorOverlay');
    if (editorOverlay) {
        editorOverlay.style.display = 'none';
    }
}

// Show help modal
function showHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.style.display = 'flex';
    }
}

// Close help modal
function closeHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.style.display = 'none';
    }
}

// Show contact modal
function showContactModal() {
    const contactModal = document.getElementById('contactModal');
    if (contactModal) {
        contactModal.style.display = 'flex';
    }
}

// Close contact modal
function closeContactModal() {
    const contactModal = document.getElementById('contactModal');
    if (contactModal) {
        contactModal.style.display = 'none';
    }
}

// Send contact message
function sendContactMessage() {
    const nameInput = document.getElementById('contactName');
    const emailInput = document.getElementById('contactEmail');
    const messageInput = document.getElementById('contactMessage');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const message = messageInput ? messageInput.value.trim() : '';
    
    if (!name || !email || !message) {
        alert('Please fill in all fields');
        return;
    }
    
    // Create email content
    const subject = 'ClipSwift Support Request';
    const body = `Name: ${name}\nEmail: ${email}\nMessage: ${message}`;
    
    // Open email client in popup
    const emailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=alexszabo0089@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    chrome.windows.create({
        url: emailUrl,
        type: 'popup',
        width: 800,
        height: 600
    });
    
    // Show thank you modal
    showThankYouModal();
    closeContactModal();
}

// Show thank you modal
function showThankYouModal() {
    const thankYouModal = document.getElementById('thankYouModal');
    if (thankYouModal) {
        thankYouModal.style.display = 'flex';
    }
}

// Close thank you modal
function closeThankYouModal() {
    const thankYouModal = document.getElementById('thankYouModal');
    if (thankYouModal) {
        thankYouModal.style.display = 'none';
    }
}

// Handle payment
async function handlePayment() {
    try {
        const emailInput = document.getElementById('customerEmail');
        const customerEmail = emailInput ? emailInput.value.trim() : '';
        if (!customerEmail) {
            throw new Error('Please enter your email address');
        }
        
        // Show payment processing modal
        showPaymentProcessingModal();
        
        // Check if backend is running
        try {
            const healthCheck = await fetch('https://clipswift-backend-production.up.railway.app/health');
            if (!healthCheck.ok) {
                throw new Error('Backend is not responding');
            }
        } catch (error) {
            console.error('Backend health check failed:', error);
            throw new Error('Backend service is unavailable. Please try again later.');
        }
        
        const response = await fetch('https://clipswift-backend-production.up.railway.app/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                priceId: 'price_1RzIKIPu9zXPs9BWghmq5pRE', // Your Stripe Price ID
                successUrl: 'https://clipswift-backend-production.up.railway.app/success',
                cancelUrl: 'https://clipswift-backend-production.up.railway.app/cancel',
                customerEmail: customerEmail,
            }),
        });
        if (!response.ok) { 
            const errorData = await response.text();
            console.error('Backend error:', errorData);
            throw new Error('Failed to create checkout session'); 
        }
        const session = await response.json();
        
        // Store session info for verification
        await chrome.storage.sync.set({ 
            pendingSessionId: session.sessionId,
            pendingPaymentTime: Date.now()
        });
        
        // Open Stripe checkout in a new tab instead of popup
        const newTab = await chrome.tabs.create({ url: session.url, active: true });
        
        // Monitor the tab for closure
        const checkClosed = setInterval(() => {
            chrome.tabs.get(newTab.id, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    clearInterval(checkClosed);
                    // Tab was closed, check payment status
                    setTimeout(() => {
                        checkPaymentStatus(session.sessionId);
                    }, 2000);
                }
            });
        }, 1000);
    } catch (error) {
        console.error('Payment failed:', error);
        hidePaymentProcessingModal();
        showUpgradeErrorModal();
    }
}

// Check payment status
async function checkPaymentStatus(sessionId) {
    if (!sessionId) return; // Don't check if no session ID provided
    
    try {
        // Use background script to verify payment
        const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'verifyPayment', sessionId: sessionId }, (response) => {
                resolve(response);
            });
        });
        
        if (result.success && result.paymentStatus === 'completed') {
            // Hide processing modal and upgrade user to premium
            hidePaymentProcessingModal();
            await upgradeUserToPremium();
            showUpgradeSuccessModal();
        } else {
            hidePaymentProcessingModal();
            showUpgradeErrorModal();
        }
    } catch (error) {
        console.error('Payment verification failed:', error);
        hidePaymentProcessingModal();
        showUpgradeErrorModal();
    }
}

// Upgrade user to premium
async function upgradeUserToPremium() {
    try {
        userTier = 'premium';
        await chrome.storage.sync.set({ userTier: 'premium' });
        
        // Enable all snippets
        snippets.forEach(snippet => {
            snippet.disabled = false;
        });
        
        await saveSnippets();
        
        // Clear pending payment data
        await chrome.storage.sync.remove(['pendingSessionId', 'pendingPaymentTime']);
        
        // Update UI
        updateUIForTier();
        
        // Notify content scripts
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { action: 'updateSnippets' }).catch(() => {});
            });
        });
        
        // Force storage sync event
        chrome.storage.sync.get(['snippets', 'userTier'], () => {});
    } catch (error) {
        console.error('Error upgrading user:', error);
    }
}

// Show upgrade modal
function showUpgradeModal() {
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal) {
        upgradeModal.style.display = 'flex';
    }
}

// Close upgrade modal
function closeUpgradeModal() {
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal) {
        upgradeModal.style.display = 'none';
    }
}

// Create confetti animation
function createConfetti() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#a8e6cf', '#ff8b94'];
    const confettiCount = 100;
    
    for (let i = 0; i < confettiCount; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            
            document.body.appendChild(confetti);
            
            // Remove confetti after animation
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, 5000);
        }, i * 50);
    }
}

// Show upgrade success modal
function showUpgradeSuccessModal() {
    // Close the upgrade modal first
    closeUpgradeModal();
    
    const upgradeSuccessModal = document.getElementById('upgradeSuccessModal');
    if (upgradeSuccessModal) {
        upgradeSuccessModal.style.display = 'flex';
        // Add confetti animation
        createConfetti();
    }
}

// Close upgrade success modal
function closeUpgradeSuccessModal() {
    const upgradeSuccessModal = document.getElementById('upgradeSuccessModal');
    if (upgradeSuccessModal) {
        upgradeSuccessModal.style.display = 'none';
    }
}

// Show payment processing modal
function showPaymentProcessingModal() {
    const paymentProcessingModal = document.getElementById('paymentProcessingModal');
    if (paymentProcessingModal) {
        paymentProcessingModal.style.display = 'flex';
    }
}

// Hide payment processing modal
function hidePaymentProcessingModal() {
    const paymentProcessingModal = document.getElementById('paymentProcessingModal');
    if (paymentProcessingModal) {
        paymentProcessingModal.style.display = 'none';
    }
}

// Show upgrade error modal
function showUpgradeErrorModal() {
    const upgradeErrorModal = document.getElementById('upgradeErrorModal');
    if (upgradeErrorModal) {
        upgradeErrorModal.style.display = 'flex';
    }
}

// Close upgrade error modal
function closeUpgradeErrorModal() {
    const upgradeErrorModal = document.getElementById('upgradeErrorModal');
    if (upgradeErrorModal) {
        upgradeErrorModal.style.display = 'none';
    }
}

// Handle downgrade
function handleDowngrade() {
    showDowngradeConfirmModal();
}

// Show downgrade confirm modal
function showDowngradeConfirmModal() {
    const downgradeConfirmModal = document.getElementById('downgradeConfirmModal');
    if (downgradeConfirmModal) {
        downgradeConfirmModal.style.display = 'flex';
    }
}

// Close downgrade confirm modal
function closeDowngradeConfirmModal() {
    const downgradeConfirmModal = document.getElementById('downgradeConfirmModal');
    if (downgradeConfirmModal) {
        downgradeConfirmModal.style.display = 'none';
    }
}

// Confirm downgrade
async function confirmDowngrade() {
    try {
        // Anti-abuse: Keep only the top 2 user-created snippets active
        const userSnippets = snippets.filter(s => !s.isSample);
        const lastTwoSnippets = userSnippets.slice(-2);
        const lastTwoIds = lastTwoSnippets.map(s => s.id);
        
        snippets.forEach(snippet => {
            if (!snippet.isSample) {
                snippet.disabled = !lastTwoIds.includes(snippet.id);
            }
        });
        
        // Set user tier to free
        userTier = 'free';
        await chrome.storage.sync.set({ userTier: 'free' });
        
        await saveSnippets();
        updateUIForTier();
        renderSnippetsList();
        
        closeDowngradeConfirmModal();
        showDowngradeSuccessModal();
    } catch (error) {
        console.error('Error downgrading user:', error);
    }
}

// Show downgrade success modal
function showDowngradeSuccessModal() {
    const downgradeSuccessModal = document.getElementById('downgradeSuccessModal');
    if (downgradeSuccessModal) {
        downgradeSuccessModal.style.display = 'flex';
    }
}

// Close downgrade success modal
function closeDowngradeSuccessModal() {
    const downgradeSuccessModal = document.getElementById('downgradeSuccessModal');
    if (downgradeSuccessModal) {
        downgradeSuccessModal.style.display = 'none';
    }
}

// Open AI modal
function openAiModal() {
    if (userTier !== 'premium') {
        showUpgradeModal();
        return;
    }
    
    const aiModal = document.getElementById('aiModal');
    if (aiModal) {
        aiModal.style.display = 'flex';
    }
}

// Close AI modal
function closeAiModal() {
    const aiModal = document.getElementById('aiModal');
    if (aiModal) {
        aiModal.style.display = 'none';
    }
}

// Generate AI content
async function generateAiContent() {
    const promptInput = document.getElementById('aiPrompt');
    const commandInput = document.getElementById('aiCommand');
    
    const prompt = promptInput ? promptInput.value.trim() : '';
    const command = commandInput ? commandInput.value.trim() : '';
    
    if (!prompt || !command) {
        alert('Please fill in both prompt and command fields');
        return;
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that generates professional content for text snippets. Generate concise, well-written content based on the user\'s prompt.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate content');
        }
        
        const data = await response.json();
        const generatedContent = data.choices[0].message.content.trim();
        
        // Create new snippet with generated content
        const newSnippet = {
            id: Date.now().toString(),
            command: command,
            content: generatedContent,
            category: 'AI Prompts',
            isSample: false,
            disabled: false
        };
        
        snippets.push(newSnippet);
        await saveSnippets();
        renderSnippetsList();
        
        closeAiModal();
        
        // Show success message
        alert('AI content generated successfully! Check your snippets list.');
        
    } catch (error) {
        console.error('AI generation failed:', error);
        alert('Failed to generate AI content. Please try again.');
    }
}

// Listen for messages from success/cancel pages
window.addEventListener('message', function(event) {
    if (event.data.type === 'payment-success') {
        // Payment was successful, check status
        chrome.storage.sync.get(['pendingSessionId'], (result) => {
            if (result.pendingSessionId) {
                checkPaymentStatus(result.pendingSessionId);
            }
        });
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
