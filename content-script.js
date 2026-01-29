// content-script.js - UPDATED VERSION
console.log('✅ Syllabus Date Extractor content script loaded on:', window.location.href);

// ====== 1. BASIC COPY DETECTION ======
function setupCopyDetection() {
    console.log('Setting up copy detection...');
    
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
function processCopiedText(text) {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
        console.log('⚠️ Extension context invalid, skipping...');
        return;
    }
    
    console.log('🚀 Sending to background:', text.substring(0, 50));
    
    try {
        chrome.runtime.sendMessage({
            action: 'processCopiedText',
            text: text,
            url: window.location.href,
            timestamp: Date.now()
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('📩 Send error (normal during reload):', chrome.runtime.lastError.message);
            } else {
                console.log('✅ Successfully sent to background');
                showVisualFeedback();
            }
        });
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
        'drug', 'pharmacy', 'safety', 'course', 'lecture'  // Add course-specific terms
    ];
    
    return academicKeywords.some(keyword => lowerText.includes(keyword));
}

// ====== 5. VISUAL FEEDBACK ======
function showVisualFeedback() {
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
                <span style="font-size: 18px;">✅</span>
                Date Captured!
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
    
    btn.onclick = () => {
        const testText = "Quiz 3 due February 15, 2024 at 3:00 PM";
        console.log('Test button clicked, text:', testText);
        
        // Simulate copy by sending directly to background
        chrome.runtime.sendMessage({
            action: 'processCopiedText',
            text: testText,
            url: window.location.href,
            timestamp: Date.now()
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Test error:', chrome.runtime.lastError.message);
                alert('❌ Test failed: ' + chrome.runtime.lastError.message);
            } else {
                console.log('✅ Test successful!');
                alert('✅ Test successful! Check extension popup for new event.');
                showVisualFeedback();
            }
        });
    };
    
    document.body.appendChild(btn);
    console.log('Test button added');
}

// ====== 7. INITIALIZATION ======
function initialize() {
    console.log('Initializing content script...');
    
    // Wait for page to be fully interactive
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupCopyDetection();
            addTestButton();
        });
    } else {
        setupCopyDetection();
        addTestButton();
    }
    
    console.log('✅ Content script initialized');
}

// Start initialization
initialize();