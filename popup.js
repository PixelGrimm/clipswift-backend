// Simple working version with Chrome storage
let snippets = [];
let currentSnippet = null;
let currentCategory = 'all';
let searchQuery = '';
let currentTheme = 'light';
// API key for OpenAI - this is your OpenAI API key
let openaiApiKey = 'YOUR_OPENAI_API_KEY_HERE'; // Replace with your actual API key

// User tier management
let userTier = 'free'; // 'free' or 'premium'

async function init() {
    await loadSnippets();
    await loadSettings();
    cleanupGenericSnippets(); // Clean up any generic fallback snippets
    enforceTierRestrictions(); // Enforce tier restrictions on existing snippets
    await checkPendingPayments(); // Check for any pending payments
    setupEventListeners();
    setupHelpModalListeners(); // Setup help modal listeners
    setupUpgradeModalListeners(); // Setup upgrade modal listeners
    setupDowngradeModalListeners(); // Setup downgrade modal listeners
    setupAiModalListeners(); // Setup AI modal listeners
    applyTheme(); // Now this runs after settings are loaded
    updateUIForTier(); // Update UI based on user tier
    showEditorOverlay(); // Show overlay initially
}

async function loadSnippets() {
    try {
        const result = await chrome.storage.sync.get(['snippets']);
        snippets = result.snippets || [];
        if (snippets.length === 0) {
            createSampleData();
        }
        renderSnippetsList();
    } catch (error) {
        createSampleData();
        renderSnippetsList();
    }
}

async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['theme', 'userTier']);
        currentTheme = result.theme || 'light';
        userTier = result.userTier || 'free';
    } catch (error) {
        currentTheme = 'light';
        userTier = 'free';
    }
}

async function saveSettings() {
    try {
        await chrome.storage.sync.set({ theme: currentTheme });
    } catch (error) {
        // Settings not persisted
    }
}

function applyTheme() {
    const body = document.body;
    
    if (currentTheme === 'dark') {
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
    }
    
    // Update theme toggle button
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = currentTheme === 'light' ? '☀️' : '🌙';
        themeToggleBtn.title = currentTheme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    }
}

// Update UI based on user tier
function updateUIForTier() {
    const upgradeButton = document.getElementById('upgradeButton');
    const downgradeButton = document.getElementById('downgradeButton');
    const aiBtn = document.getElementById('aiBtn');
    
    if (userTier === 'free') {
        // Show upgrade button, hide downgrade button
        if (upgradeButton) {
            upgradeButton.style.display = 'inline-block';
        }
        if (downgradeButton) {
            downgradeButton.style.display = 'none';
        }
        // Show AI button as locked for free users
        if (aiBtn) {
            aiBtn.title = 'AI Content Generator (Premium Only)';
            aiBtn.style.opacity = '0.6';
        }
    } else {
        // Premium user - hide upgrade button, show downgrade button
        if (upgradeButton) {
            upgradeButton.style.display = 'none';
        }
        if (downgradeButton) {
            downgradeButton.style.display = 'inline-block';
        }
        // Show AI button as unlocked for premium users
        if (aiBtn) {
            aiBtn.title = 'AI Content Generator';
            aiBtn.style.opacity = '1';
        }
    }
    
    // Enforce tier restrictions and re-render
    enforceTierRestrictions();
    renderSnippetsList();
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveSettings();
}

function createSampleData() {
    snippets = [
        {
            id: Date.now() + 1,
            title: ':welcome',
            content: 'Welcome to ClipSwift! 🚀 This extension helps you create and use text snippets for faster typing. Try typing ":welcome" in any text field to see it in action!',
            category: 'Messages',
            isSample: true
        },
        {
            id: Date.now() + 2,
            title: ':hello',
            content: 'Hello! How can I help you today?',
            category: 'Messages',
            isSample: true
        },
        {
            id: Date.now() + 3,
            title: ':thanks',
            content: 'Thank you for your message!',
            category: 'Messages',
            isSample: true
        }
    ];
}

function cleanupGenericSnippets() {
    // Remove any generic fallback snippets that might have been created
    snippets = snippets.filter(snippet => !snippet.title.includes('generic'));
}

async function saveSnippets() {
    try {
        await chrome.storage.sync.set({ snippets: snippets });
        console.log('Snippets saved, notifying content scripts...');
        
        // Notify content scripts to update their snippets
        try {
            const tabs = await chrome.tabs.query({});
            console.log('Found tabs:', tabs.length);
            let notifiedTabs = 0;
            
            for (const tab of tabs) {
                if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                    console.log('Sending message to tab:', tab.url);
                    try {
                        await chrome.tabs.sendMessage(tab.id, { 
                            action: 'updateSnippets',
                            snippets: snippets,
                            userTier: userTier
                        });
                        notifiedTabs++;
                        console.log('Successfully notified tab:', tab.url);
    } catch (error) {
                        console.log('Could not send message to tab:', tab.url, error);
                    }
                }
            }
            
            console.log(`Notified ${notifiedTabs} tabs about snippet updates`);
            
            // Also trigger a storage change event to ensure content scripts update
            setTimeout(() => {
                chrome.storage.sync.set({ snippets: snippets });
            }, 100);
        } catch (error) {
            console.log('Could not notify all content scripts:', error);
        }
    } catch (error) {
        console.error('Failed to save snippets:', error);
    }
}

function renderSnippetsList() {
    const snippetsList = document.getElementById('snippetsList');
    if (!snippetsList) return;

    snippetsList.innerHTML = '';

    let filteredSnippets = snippets;

    // Filter by category
    if (currentCategory !== 'all') {
        filteredSnippets = snippets.filter(snippet => snippet.category === currentCategory);
    }

    // Filter by search query
    if (searchQuery) {
        filteredSnippets = filteredSnippets.filter(snippet => 
            snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            snippet.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    if (filteredSnippets.length === 0) {
        snippetsList.innerHTML = `
            <div class="empty-state">
                <p>No snippets found</p>
                <p>Create your first snippet!</p>
            </div>
        `;
        return;
    }

    // For free users, identify which snippets should be locked
    let lockedSnippetIds = [];
    if (userTier === 'free') {
        const userSnippets = snippets.filter(snippet => !snippet.isSample);
        const lastTwoSnippets = userSnippets.slice(-2);
        const lastTwoSnippetIds = lastTwoSnippets.map(s => s.id);
        lockedSnippetIds = userSnippets.filter(snippet => !lastTwoSnippetIds.includes(snippet.id)).map(s => s.id);
    }

    filteredSnippets.forEach(snippet => {
        const snippetElement = document.createElement('div');
        snippetElement.className = 'snippet-item';
        
        // Check if this snippet should be locked for free users
        const isLocked = userTier === 'free' && !snippet.isSample && lockedSnippetIds.includes(snippet.id);
        
        if (isLocked) {
            snippetElement.classList.add('disabled');
        }
        
        if (currentSnippet && currentSnippet.id === snippet.id) {
            snippetElement.classList.add('selected');
        }
        
        let snippetText = '<strong>' + (snippet.title || 'Untitled') + '</strong><small>' + snippet.content.substring(0, 50) + (snippet.content.length > 50 ? '...' : '') + '</small>';
        
        if (isLocked) {
            snippetText += '<div class="premium-badge">🔒 Premium Only</div>';
        }
        
        snippetElement.innerHTML = snippetText;
        
        snippetElement.addEventListener('click', function() {
            if (isLocked) {
                showUpgradeModal();
            } else {
                loadSnippet(snippet);
            }
        });
        
        snippetsList.appendChild(snippetElement);
    });
    
    // Show overlay if no snippet is currently selected
    if (!currentSnippet) {
        showEditorOverlay();
    }
}

function loadSnippet(snippet) {
    // For free users, check if snippet is locked
    if (userTier === 'free') {
        const userSnippets = snippets.filter(s => !s.isSample);
        const lastTwoSnippets = userSnippets.slice(-2);
        const lastTwoSnippetIds = lastTwoSnippets.map(s => s.id);
        const isLocked = !snippet.isSample && !lastTwoSnippetIds.includes(snippet.id);
        
        if (isLocked) {
            showUpgradeModal();
            return;
        }
    }
    
    // Prevent editing sample snippets
    if (snippet.isSample) {
        currentSnippet = snippet;
        
        const titleInput = document.getElementById('snippetTitle');
        const contentEditor = document.getElementById('snippetContent');
        const categorySelect = document.getElementById('snippetCategory');
        
        if (titleInput) {
            titleInput.value = snippet.title || '';
            titleInput.disabled = true;
            titleInput.style.opacity = '0.6';
        }
        if (contentEditor) {
            contentEditor.value = snippet.content || '';
            contentEditor.disabled = true;
            contentEditor.style.opacity = '0.6';
        }
        if (categorySelect) {
            categorySelect.value = snippet.category || 'AI Prompts';
            categorySelect.disabled = true;
            categorySelect.style.opacity = '0.6';
        }
        
        // Show message that sample snippets can't be edited
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
            saveBtn.textContent = 'Sample - Read Only';
            saveBtn.style.background = '#6c757d';
            saveBtn.disabled = true;
        }
        
        hideEditorOverlay();
        renderSnippetsList();
        return;
    }
    
    currentSnippet = snippet;
    
    const titleInput = document.getElementById('snippetTitle');
    const contentEditor = document.getElementById('snippetContent');
    const categorySelect = document.getElementById('snippetCategory');
    
    if (titleInput) {
        titleInput.value = snippet.title || '';
        titleInput.disabled = false;
        titleInput.style.opacity = '1';
    }
    if (contentEditor) {
        contentEditor.value = snippet.content || '';
        contentEditor.disabled = false;
        contentEditor.style.opacity = '1';
    }
    if (categorySelect) {
        categorySelect.value = snippet.category || 'AI Prompts';
        categorySelect.disabled = false;
        categorySelect.style.opacity = '1';
    }
    
    // Reset save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.textContent = 'Save';
        saveBtn.style.background = '';
        saveBtn.disabled = false;
    }
    
    renderSnippetsList();
    hideEditorOverlay(); // Hide overlay when loading a snippet
}

function createNewSnippet() {
    // Check if free user has reached the limit
    if (userTier === 'free') {
        const userSnippets = snippets.filter(snippet => !snippet.isSample);
        if (userSnippets.length >= 2) {
            showUpgradeModal();
            return;
        }
    }
    
    currentSnippet = {
        id: Date.now(),
        title: '',
        content: '',
        category: 'AI Prompts',
        isSample: false
    };
    
    const titleInput = document.getElementById('snippetTitle');
    const contentEditor = document.getElementById('snippetContent');
    const categorySelect = document.getElementById('snippetCategory');
    
    if (titleInput) titleInput.value = '';
    if (contentEditor) contentEditor.value = '';
    if (categorySelect) categorySelect.value = 'AI Prompts';
    
    renderSnippetsList();
    hideEditorOverlay();
    
    // Focus on title input
    if (titleInput) titleInput.focus();
}

function saveCurrentSnippet() {
    if (!currentSnippet) return;
    
    // Prevent saving sample snippets
    if (currentSnippet.isSample) {
        console.log('Cannot save sample snippets');
        return;
    }

    const titleInput = document.getElementById('snippetTitle');
    const contentEditor = document.getElementById('snippetContent');
    const categorySelect = document.getElementById('snippetCategory');
    
    if (titleInput && contentEditor && categorySelect) {
        currentSnippet.title = titleInput.value.trim();
        currentSnippet.content = contentEditor.value.trim();
        currentSnippet.category = categorySelect.value;
        
        // Find existing snippet or add new one
        const existingIndex = snippets.findIndex(s => s.id === currentSnippet.id);
        if (existingIndex !== -1) {
            snippets[existingIndex] = { ...currentSnippet };
        } else {
            snippets.push({ ...currentSnippet });
        }
        
        saveSnippets();
        renderSnippetsList();
        
        // Show success message
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            saveBtn.style.background = '#28a745';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }, 2000);
        }
    }
}

function deleteCurrentSnippet() {
    if (!currentSnippet) return;
    
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    if (confirmModal && confirmMessage && confirmBtn) {
        confirmMessage.textContent = `Are you sure you want to delete "${currentSnippet.title}"?`;
        confirmModal.style.display = 'flex';
        
        // Remove existing listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            const index = snippets.findIndex(s => s.id === currentSnippet.id);
            if (index !== -1) {
                snippets.splice(index, 1);
                saveSnippets();
                currentSnippet = null;
                renderSnippetsList();
                showEditorOverlay();
            }
            confirmModal.style.display = 'none';
        });
    }
}

function showEditorOverlay() {
    const overlay = document.getElementById('editorOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function hideEditorOverlay() {
    const overlay = document.getElementById('editorOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchQuery = this.value;
            renderSnippetsList();
        });
    }

    // Category tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.category;
            renderSnippetsList();
        });
    });

    // New snippet button
    const newSnippetBtn = document.getElementById('newSnippetBtn');
    if (newSnippetBtn) {
        newSnippetBtn.addEventListener('click', createNewSnippet);
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

    // Theme toggle
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // AI button
    const aiBtn = document.getElementById('aiBtn');
    if (aiBtn) {
        aiBtn.addEventListener('click', function() {
            if (userTier === 'premium') {
                openAiModal();
            } else {
                showUpgradeModal();
            }
        });
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

    // Help button
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
        helpBtn.addEventListener('click', showHelpModal);
    }

    // Contact button
    const contactBtn = document.getElementById('contactBtn');
    if (contactBtn) {
        contactBtn.addEventListener('click', showContactModal);
    }

    // Confirm modal close
    const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    if (cancelConfirmBtn) {
        cancelConfirmBtn.addEventListener('click', () => {
            const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
                confirmModal.style.display = 'none';
            }
        });
    }
}

async function openAiModal() {
    const aiModal = document.getElementById('aiModal');
    const aiPrompt = document.getElementById('aiPrompt');
    const aiCommand = document.getElementById('aiCommand');
    const aiCategory = document.getElementById('aiCategory');
    
    if (aiModal && aiPrompt && aiCommand && aiCategory) {
        aiModal.style.display = 'flex';
        aiPrompt.value = '';
        aiCommand.value = '';
        // Load last used settings instead of defaulting
        await loadLastAiSettings();
        aiPrompt.focus();
    }
}

function closeAiModal() {
    const aiModal = document.getElementById('aiModal');
    if (aiModal) {
        aiModal.style.display = 'none';
    }
}

// Save last used AI settings
async function saveLastAiSettings(category, tone) {
    await chrome.storage.sync.set({
        lastAiCategory: category,
        lastAiTone: tone
    });
}

// Load last used AI settings
async function loadLastAiSettings() {
    const result = await chrome.storage.sync.get(['lastAiCategory', 'lastAiTone']);
    const aiCategory = document.getElementById('aiCategory');
    const aiTone = document.getElementById('aiTone');
    
    if (aiCategory && result.lastAiCategory) {
        aiCategory.value = result.lastAiCategory;
    }
    if (aiTone && result.lastAiTone) {
        aiTone.value = result.lastAiTone;
    }
}

async function generateAiContent() {
    const aiPrompt = document.getElementById('aiPrompt');
    const aiCommand = document.getElementById('aiCommand');
    const aiCategory = document.getElementById('aiCategory');
    const aiTone = document.getElementById('aiTone');
    const aiLoading = document.getElementById('aiLoading');
    const generateAiBtn = document.getElementById('generateAiBtn');
    
    if (!aiPrompt || !aiCommand || !aiCategory || !aiTone) return;
    
    const prompt = aiPrompt.value.trim();
    const command = aiCommand.value.trim();
    const category = aiCategory.value;
    const tone = aiTone.value;
    
    if (!prompt || !command) {
        alert('Please fill in both the prompt and command fields.');
        return;
    }
    
    if (!command || command.trim() === '') {
        alert('Please enter a command (e.g., welcome, @hello, .thanks, etc.)');
        return;
    }
    
    // Show loading
    if (aiLoading) aiLoading.style.display = 'block';
    if (generateAiBtn) generateAiBtn.disabled = true;
    
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
                        content: `You are a helpful assistant that can respond to any prompt or comment in the same language and tone as the input. The user has requested a ${tone.toLowerCase()} tone. 

If the tone is "rizz", create flirty, smooth, and charming content that's perfect for dating apps like Tinder or Instagram DMs. Use playful language, emojis, and confident but respectful messaging.

If the user asks you to answer a comment, respond directly to that comment in a ${tone.toLowerCase()} manner. If they ask you to create content, create ${tone.toLowerCase()} content suitable for quick copy-paste use. Keep responses under 200 words unless the context requires more.`
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

                const data = await response.json();
        const generatedContent = data.choices[0].message.content.trim();
        
        // Save last used settings
        await saveLastAiSettings(category, tone);
        
        // Create new snippet with generated content
        const newSnippet = {
            id: Date.now(),
            title: command,
            content: generatedContent,
            category: category,
            isSample: false
        };
        
        snippets.push(newSnippet);
        await saveSnippets();
        
        // Load the new snippet
        loadSnippet(newSnippet);
        
        // Close AI modal
        closeAiModal();
        
        // Show success message
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'AI Generated!';
            saveBtn.style.background = '#28a745';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }, 2000);
        }
        
        } catch (error) {
        console.error('AI generation failed:', error);
        alert('Failed to generate content. Please check your API key and try again.');
    } finally {
        // Hide loading
        if (aiLoading) aiLoading.style.display = 'none';
        if (generateAiBtn) generateAiBtn.disabled = false;
    }
}

function showHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.style.display = 'flex';
    }
}

function closeHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.style.display = 'none';
    }
}

function showContactModal() {
    closeHelpModal();
    const contactModal = document.getElementById('contactModal');
    if (contactModal) {
        contactModal.style.display = 'flex';
    }
}

function closeContactModal() {
    const contactModal = document.getElementById('contactModal');
    if (contactModal) {
        contactModal.style.display = 'none';
    }
}

function showThankYouModal() {
    const thankYouModal = document.getElementById('thankYouModal');
    if (thankYouModal) {
        thankYouModal.style.display = 'flex';
    }
}

function closeThankYouModal() {
    const thankYouModal = document.getElementById('thankYouModal');
    if (thankYouModal) {
        thankYouModal.style.display = 'none';
    }
}

function sendContactMessage() {
    const contactName = document.getElementById('contactName');
    const contactEmail = document.getElementById('contactEmail');
    const contactMessage = document.getElementById('contactMessage');
    
    if (!contactName || !contactEmail || !contactMessage) return;
    
    const name = contactName.value.trim();
    const email = contactEmail.value.trim();
    const message = contactMessage.value.trim();
    
    if (!name || !email || !message) {
        alert('Please fill in all fields.');
        return;
    }
    
    // Create email content
    const subject = 'ClipSwift Support Request';
    const body = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;
    
    // Open email client
    const mailtoUrl = `mailto:alexszabo0089@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open in popup window
    const popup = window.open(mailtoUrl, 'email-popup', 'width=600,height=400,scrollbars=yes,resizable=yes');
    
    if (popup) {
        // Close contact modal and show thank you modal
        closeContactModal();
        setTimeout(() => {
            showThankYouModal();
        }, 500);
    } else {
        alert('Please allow popups to send the message.');
    }
}

// Setup help modal listeners
function setupHelpModalListeners() {
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', closeHelpModal);
    }
}

// Setup contact modal listeners
function setupContactModalListeners() {
    const cancelContactBtn = document.getElementById('cancelContactBtn');
    const sendContactBtn = document.getElementById('sendContactBtn');
    const closeThankYouBtn = document.getElementById('closeThankYouBtn');
    
    if (cancelContactBtn) {
        cancelContactBtn.addEventListener('click', closeContactModal);
    }
    
    if (sendContactBtn) {
        sendContactBtn.addEventListener('click', sendContactMessage);
    }
    
    if (closeThankYouBtn) {
        closeThankYouBtn.addEventListener('click', closeThankYouModal);
    }
}

// Setup AI modal listeners
function setupAiModalListeners() {
    const cancelAiBtn = document.getElementById('cancelAiBtn');
    const generateAiBtn = document.getElementById('generateAiBtn');
    
    if (cancelAiBtn) {
        cancelAiBtn.addEventListener('click', closeAiModal);
    }
    
    if (generateAiBtn) {
        generateAiBtn.addEventListener('click', generateAiContent);
    }
}

// Stripe Functions
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
        
        const response = await fetch('https://clipswift-backend-production.up.railway.app/create-checkout-with-promo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                priceId: 'price_1RzIKIPu9zXPs9BWghmq5pRE', // TODO: Update to live price ID
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

// Check for pending payments on startup
async function checkPendingPayments() {
    try {
        const result = await chrome.storage.sync.get(['pendingSessionId', 'pendingPaymentTime']);
        const pendingSessionId = result.pendingSessionId;
        const pendingPaymentTime = result.pendingPaymentTime;
        
        if (pendingSessionId && pendingPaymentTime) {
            // Check if payment is still pending (within last 15 minutes)
            const timeSincePayment = Date.now() - pendingPaymentTime;
            const fifteenMinutes = 15 * 60 * 1000;
            
            if (timeSincePayment < fifteenMinutes) {
                console.log('Found pending payment, checking status...');
                // Check payment status
                try {
                    const verifyResponse = await fetch('https://clipswift-backend-production.up.railway.app/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: pendingSessionId }),
                    });
                    
                    if (verifyResponse.ok) {
                        const result = await verifyResponse.json();
                        if (result.paymentStatus === 'completed') {
                            // Payment was successful, upgrade user
                            await upgradeUserToPremium();
                            setTimeout(() => {
                                showUpgradeSuccessModal();
                            }, 1000);
                        } else {
                            // Payment failed or pending, clear data
                            await chrome.storage.sync.remove(['pendingSessionId', 'pendingPaymentTime']);
                        }
                    }
                } catch (error) {
                    console.error('Error checking pending payment:', error);
                    await chrome.storage.sync.remove(['pendingSessionId', 'pendingPaymentTime']);
                }
            } else {
                // Payment is too old, clear data
                await chrome.storage.sync.remove(['pendingSessionId', 'pendingPaymentTime']);
            }
        }
    } catch (error) {
        console.error('Error checking pending payments:', error);
        await chrome.storage.sync.remove(['pendingSessionId', 'pendingPaymentTime']);
    }
}

// Function to enforce tier restrictions on existing snippets
function enforceTierRestrictions() {
    if (userTier === 'free') {
        const userSnippets = snippets.filter(snippet => !snippet.isSample);
        const lastTwoSnippets = userSnippets.slice(-2);
        
        // Mark excess snippets as disabled
        const lastTwoSnippetIds = lastTwoSnippets.map(s => s.id);
        snippets.forEach(snippet => {
            if (!snippet.isSample && !lastTwoSnippetIds.includes(snippet.id)) {
                snippet.disabled = true;
            } else if (!snippet.isSample) {
                snippet.disabled = false; // Ensure active snippets are not disabled
            }
        });
        
        // Save changes if any snippets were modified
        saveSnippets();
    } else {
        // Premium users - enable all snippets
        snippets.forEach(snippet => {
            if (!snippet.isSample) {
                snippet.disabled = false;
            }
        });
        saveSnippets();
    }
}

// Upgrade user to premium
async function upgradeUserToPremium() {
    try {
        // Enable all snippets
        snippets.forEach(snippet => {
            snippet.disabled = false;
        });
        
        // Save snippets
    await saveSnippets();
        
        // Update user tier
        userTier = 'premium';
        await chrome.storage.sync.set({ userTier: 'premium' });
        
        // Notify content scripts to update their user tier
        try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                    chrome.tabs.sendMessage(tab.id, { action: 'updateSnippets' }).catch(() => {
                        // Ignore errors for tabs that don't have content scripts
                    });
                }
            }
        } catch (error) {
            console.log('Could not notify all content scripts:', error);
        }
        
        // Clear pending payment data
        await chrome.storage.sync.remove(['pendingSessionId', 'pendingPaymentTime']);
        
        // Update UI
        updateUIForTier();
    renderSnippetsList();
    
        console.log('User upgraded to premium successfully');
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

// Show downgrade confirmation modal
function showDowngradeConfirmModal() {
    const downgradeConfirmModal = document.getElementById('downgradeConfirmModal');
    if (downgradeConfirmModal) {
        downgradeConfirmModal.style.display = 'flex';
    }
}

// Close downgrade confirmation modal
function closeDowngradeConfirmModal() {
    const downgradeConfirmModal = document.getElementById('downgradeConfirmModal');
    if (downgradeConfirmModal) {
        downgradeConfirmModal.style.display = 'none';
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

// Confirm downgrade
async function confirmDowngrade() {
    // Anti-abuse: Keep only top 2 user-created snippets active
    const userSnippets = snippets.filter(snippet => !snippet.isSample);
    const lastTwoSnippets = userSnippets.slice(-2); // Get last 2 instead of first 2
    
    // Disable excess snippets using ID comparison
    const lastTwoSnippetIds = lastTwoSnippets.map(s => s.id);
    snippets.forEach(snippet => {
        if (!snippet.isSample && !lastTwoSnippetIds.includes(snippet.id)) {
            snippet.disabled = true;
        } else if (!snippet.isSample) {
            snippet.disabled = false; // Ensure active snippets are not disabled
        }
    });
    
    // Save snippets first
    await saveSnippets();
    
    // Update tier
    userTier = 'free';
    await chrome.storage.sync.set({ userTier: 'free' });
    
    // Update UI
    updateUIForTier();
    
    // Immediately notify all content scripts about the tier change
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { 
                        action: 'updateTier', 
                        userTier: 'free',
                        snippets: snippets 
                    });
    } catch (error) {
                    // Tab might not have content script, ignore
                }
            }
        }
    } catch (error) {
        console.error('Error notifying content scripts:', error);
    }
    
    closeDowngradeConfirmModal();
    showDowngradeSuccessModal();
}

// Setup upgrade modal listeners
function setupUpgradeModalListeners() {
    const closeUpgradeBtn = document.getElementById('closeUpgradeBtn');
    const maybeLaterBtn = document.getElementById('maybeLaterBtn');
    const upgradeNowBtn = document.getElementById('upgradeNowBtn');
    
    if (closeUpgradeBtn) {
        closeUpgradeBtn.addEventListener('click', closeUpgradeModal);
    }
    
    if (maybeLaterBtn) {
        maybeLaterBtn.addEventListener('click', closeUpgradeModal);
    }
    
    if (upgradeNowBtn) {
        upgradeNowBtn.addEventListener('click', function() {
            const customerEmail = document.getElementById('customerEmail').value.trim();
            if (!customerEmail) {
                alert('Please enter your billing email address to continue.');
                return;
            }
            handlePayment();
        });
    }
    
    // Upgrade success modal listeners
    const closeUpgradeSuccessBtn = document.getElementById('closeUpgradeSuccessBtn');
    const getStartedBtn = document.getElementById('getStartedBtn');
    
    if (closeUpgradeSuccessBtn) {
        closeUpgradeSuccessBtn.addEventListener('click', closeUpgradeSuccessModal);
    }
    
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', closeUpgradeSuccessModal);
    }
    
    // Upgrade error modal listeners
    const closeUpgradeErrorBtn = document.getElementById('closeUpgradeErrorBtn');
    const closeErrorBtn = document.getElementById('closeErrorBtn');
    const tryAgainBtn = document.getElementById('tryAgainBtn');
    
    if (closeUpgradeErrorBtn) {
        closeUpgradeErrorBtn.addEventListener('click', closeUpgradeErrorModal);
    }
    
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', closeUpgradeErrorModal);
    }
    
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', () => {
            closeUpgradeErrorModal();
            showUpgradeModal();
        });
    }
}

// Setup downgrade modal listeners
function setupDowngradeModalListeners() {
    const closeDowngradeBtn = document.getElementById('closeDowngradeBtn');
    const cancelDowngradeBtn = document.getElementById('cancelDowngradeBtn');
    const confirmDowngradeBtn = document.getElementById('confirmDowngradeBtn');
    const gotItBtn = document.getElementById('gotItBtn');
    const closeDowngradeSuccessBtn = document.getElementById('closeDowngradeSuccessBtn');
    
    if (closeDowngradeBtn) {
        closeDowngradeBtn.addEventListener('click', closeDowngradeConfirmModal);
    }
    
    if (cancelDowngradeBtn) {
        cancelDowngradeBtn.addEventListener('click', closeDowngradeConfirmModal);
    }
    
    if (confirmDowngradeBtn) {
        confirmDowngradeBtn.addEventListener('click', confirmDowngrade);
    }
    
    if (gotItBtn) {
        gotItBtn.addEventListener('click', closeDowngradeSuccessModal);
    }
    
    if (closeDowngradeSuccessBtn) {
        closeDowngradeSuccessBtn.addEventListener('click', closeDowngradeSuccessModal);
    }
}

// Listen for payment success messages from success page
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'payment-success') {
        console.log('Received payment success message');
        // The payment verification will handle the upgrade
    }
});

// Initialize the app
init();
