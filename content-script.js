// content-script.js - FIXED VERSION
console.log('✅ Syllabus Date Extractor content script loaded on:', window.location.href);

// ====== 0. EXTENSION CONTEXT VALIDATION ======
function isExtensionContextValid() {
    try {
        // Check if Chrome APIs are available
        if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined') {
            return false;
        }
        
        // Check if we have a valid extension ID
        if (!chrome.runtime.id) {
            return false;
        }
        
        // Additional check - try to get manifest (will fail if context invalid)
        if (chrome.runtime.getManifest) {
            chrome.runtime.getManifest();
        }
        
        return true;
    } catch (error) {
        // If any check fails, context is invalid
        return false;
    }
}

// ====== 1. BASIC COPY DETECTION ======
function setupCopyDetection() {
    console.log('Setting up copy detection...');
    
    // Check if extension context is valid before setting up listeners
    if (!isExtensionContextValid()) {
        console.log('⚠️ Extension context not valid, skipping copy detection setup');
        return;
    }
    
    // Method 1: Standard copy event
    document.addEventListener('copy', handleCopyEvent);
    
    // Method 2: Capture phase (catches events before they can be stopped)
    document.addEventListener('copy', handleCopyEvent, true);
    
    // Method 3: Window level listener
    window.addEventListener('copy', handleCopyEvent);
    
    // Method 4: Keyboard shortcut detection (Ctrl+C)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            console.log('⌨️ Ctrl+C detected');
            
            setTimeout(() => {
                const selection = window.getSelection().toString().trim();
                if (selection) {
                    console.log('Text selected via Ctrl+C:', selection.substring(0, 50));
                    processCopiedText(selection);
                }
            }, 50);
        }
    });
    
    console.log('Copy detection setup complete');
}

// ====== 2. HANDLE COPY EVENTS ======
function handleCopyEvent(e) {
    console.log('🎯 Copy event caught by:', e.currentTarget.constructor.name);
    
    const text = window.getSelection().toString().trim();
    if (text) {
        console.log('Copied text:', text.substring(0, 100));
        processCopiedText(text);
    }
}

// ====== 3. PROCESS TEXT ======
async function processCopiedText(text) {
    // Validate text first
    if (!text || text.length < 20 || text.length > 2000) {
        console.log('❌ Text length not suitable:', text.length);
        return;
    }
    
    // Check if it's syllabus text
    if (!isSyllabusText(text)) {
        console.log('❌ Not syllabus text');
        return;
    }
    
    console.log('🚀 Processing syllabus text:', text.substring(0, 50));
    
    // Check extension context
    if (!isExtensionContextValid()) {
        console.log('⚠️ Extension context invalid, cannot send to background');
        
        // Store in localStorage as fallback
        try {
            const pendingEvents = JSON.parse(localStorage.getItem('syllabusPendingEvents') || '[]');
            pendingEvents.push({
                text: text,
                url: window.location.href,
                timestamp: Date.now()
            });
            localStorage.setItem('syllabusPendingEvents', JSON.stringify(pendingEvents));
            console.log('📦 Stored in localStorage for later processing');
            
            // Show message to user
            showVisualFeedback('⚠️ Extension reloaded - please refresh page');
        } catch (e) {
            console.log('❌ Could not store in localStorage:', e.message);
        }
        
        return;
    }
    
    // Send to background with error handling
    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'processCopiedText',
                text: text,
                url: window.location.href,
                timestamp: Date.now()
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('📩 Send error:', chrome.runtime.lastError.message);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
        
        if (response) {
            console.log('✅ Successfully sent to background');
            showVisualFeedback('Date captured!');
        }
    } catch (error) {
        console.log('❌ Error sending message:', error.message);
    }
}

// ====== 4. TEXT VALIDATION ======
function isSyllabusText(text) {
    const lowerText = text.toLowerCase();
    
    // More lenient date patterns (allow dates without years)
    const datePatterns = [
        // Month names with optional year
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?/i,
        // Month abbreviations with optional year
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?/i,
        // Numeric dates (with or without year)
        /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/,
        // Just month names (for "Jan 30th" without year)
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*/i
    ];
    
    const hasDate = datePatterns.some(pattern => pattern.test(text));
    if (!hasDate) return false;
    
    // Academic keywords (more comprehensive list)
    const academicKeywords = [
        'quiz', 'test', 'exam', 'assignment', 'homework', 'project',
        'due', 'deadline', 'midterm', 'final', 'submission',
        'paper', 'essay', 'lab', 'report', 'presentation',
        'drug', 'pharmacy', 'safety', 'course', 'lecture'
    ];
    
    return academicKeywords.some(keyword => lowerText.includes(keyword));
}

// ====== 5. VISUAL FEEDBACK ======
function showVisualFeedback(message = 'Date captured!') {
    try {
        // Only show if we can access the DOM
        if (!document || !document.body) return;

        // Remove any existing feedback
        const existing = document.querySelector('.syllabus-feedback');
        if (existing) existing.remove();
        
        const feedback = document.createElement('div');
        feedback.className = 'syllabus-feedback';
        feedback.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                font-weight: bold;
                z-index: 999999;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                animation: slideIn 0.3s ease-out;
                display: flex;
                align-items: center;
                gap: 8px;
                border: 2px solid white;
            ">
                <span style="font-size: 18px;">${message.includes('⚠️') ? '⚠️' : '✅'}</span>
                ${message}
            </div>
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            .syllabus-feedback {
                animation: slideIn 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(feedback);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            feedback.remove();
            style.remove();
        }, 3000);
    } catch (error) {
        console.log('❌ Error showing feedback:', error.message);
    }
}

// ====== 6. TEST BUTTON ======
function addTestButton() {
    // Check if button already exists
    if (document.getElementById('syllabus-test-btn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'syllabus-test-btn';
    btn.innerHTML = '📋 Test Copy';
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: #4CAF50;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        z-index: 999998;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    btn.onclick = async () => {
        const testText = "Quiz 3 due February 15, 2024 at 3:00 PM";
        console.log('Test button clicked, text:', testText);
        
        if (!isExtensionContextValid()) {
            alert('⚠️ Extension context invalid. Please refresh the page.');
            return;
        }
        
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'processCopiedText',
                    text: testText,
                    url: window.location.href,
                    timestamp: Date.now()
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Test error:', chrome.runtime.lastError.message);
                        resolve({ error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response);
                    }
                });
            });
            
            if (response && !response.error) {
                console.log('✅ Test successful!');
                alert('✅ Test successful! Check extension popup for new event.');
                showVisualFeedback('Test date captured!');
            } else {
                alert('❌ Test failed: ' + (response?.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Test error:', error);
            alert('❌ Test error: ' + error.message);
        }
    };
    
    document.body.appendChild(btn);
    console.log('Test button added');
}

// ====== 7. CHECK FOR PENDING EVENTS ======
async function processPendingEvents() {
    if (!isExtensionContextValid()) return;
    
    try {
        const pendingEvents = JSON.parse(localStorage.getItem('syllabusPendingEvents') || '[]');
        if (pendingEvents.length === 0) return;
        
        console.log(`📦 Processing ${pendingEvents.length} pending events`);
        
        for (const event of pendingEvents) {
            try {
                await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: 'processCopiedText',
                        text: event.text,
                        url: event.url,
                        timestamp: event.timestamp,
                        fromPending: true
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('Pending event error:', chrome.runtime.lastError.message);
                        } else {
                            console.log('✅ Processed pending event');
                        }
                        resolve();
                    });
                });
            } catch (e) {
                console.log('Error processing pending event:', e.message);
            }
        }
        
        // Clear pending events
        localStorage.removeItem('syllabusPendingEvents');
        console.log('✅ All pending events processed');
        
    } catch (error) {
        console.log('Error processing pending events:', error);
    }
}

// ====== 8. INITIALIZATION ======
async function initialize() {
    console.log('Initializing content script...');
    
    // Check extension context
    if (!isExtensionContextValid()) {
        console.log('⚠️ Extension context invalid on initialization');
        console.log('This is normal if you just reloaded the extension.');
        console.log('Please refresh this page (F5) to load the updated content script.');
        
        // Still add test button for manual testing
        addTestButton();
        showVisualFeedback('⚠️ Please refresh page (F5)');
        return;
    }
    
    // Extension context is valid
    console.log('✅ Extension context is valid');
    
    // Process any pending events from previous session
    await processPendingEvents();
    
    // Setup copy detection
    setupCopyDetection();
    
    // Add test button
    addTestButton();
    
    console.log('✅ Content script fully initialized');
}

// ====== 9. START ======
// Initialize when page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// ====== 10. RELOAD DETECTION ======
// Listen for extension reloads
if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extensionReloaded') {
            console.log('🔄 Extension was reloaded, refreshing content script...');
            // Show notification to user
            showVisualFeedback('🔄 Extension updated, please refresh page');
        }
        sendResponse({ received: true });
    });
}