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
                const text = window.getSelection().toString().trim();
                if (text) {
                    console.log('Text selected via Ctrl+C:', text.substring(0, 50));
                    processCopiedText(text);
                }
            }, 100);
        }
    });
    
    console.log('Copy detection setup complete');
}

// ====== 2. HANDLE COPY EVENTS ======
function handleCopyEvent(e) {
    console.log('🎯 Copy event triggered on:', e.target.tagName);
    
    const text = window.getSelection().toString().trim();
    if (!text) {
        console.log('No text selected');
        return;
    }
    
    console.log('📋 Copied text (' + text.length + ' chars):', text.substring(0, 100));
    
    // Process the text
    processCopiedText(text);
    
    // Don't prevent default - let copy happen normally
}

// ====== 3. PROCESS TEXT ======
function processCopiedText(text) {
    // Skip if text is too short or too long
    if (text.length < 20 || text.length > 2000) {
        console.log('Text length not suitable:', text.length);
        return;
    }
    
    // Check if it looks like syllabus text
    if (!isSyllabusText(text)) {
        console.log('Text does not contain syllabus patterns');
        return;
    }
    
    console.log('✅ Valid syllabus text found!');
    
    // Send to background script
    chrome.runtime.sendMessage({
        action: 'processCopiedText',
        text: text,
        url: window.location.href,
        timestamp: Date.now()
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('❌ Error sending to background:', chrome.runtime.lastError.message);
        } else {
            console.log('✅ Successfully sent to background');
            showVisualFeedback();
        }
    });
}

// ====== 4. TEXT VALIDATION ======
function isSyllabusText(text) {
    const lowerText = text.toLowerCase();
    
    // Check for date patterns
    const datePatterns = [
        // Month names
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
        // Month abbreviations
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+\d{1,2}/i,
        // Numeric dates
        /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/,
        // Year-first dates
        /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/
    ];
    
    const hasDate = datePatterns.some(pattern => pattern.test(text));
    if (!hasDate) return false;
    
    // Check for academic keywords
    const academicKeywords = [
        'due', 'deadline', 'exam', 'assignment', 'quiz', 'test',
        'homework', 'project', 'midterm', 'final', 'submission',
        'paper', 'essay', 'lab', 'report', 'presentation'
    ];
    
    return academicKeywords.some(keyword => lowerText.includes(keyword));
}

// ====== 5. VISUAL FEEDBACK ======
function showVisualFeedback() {
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