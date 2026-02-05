// UNIVERSAL PDF DATE SCANNER
console.log('🎯 Universal PDF Date Scanner');

class UniversalPDFDateScanner {
    constructor() {
        this.allDates = [];
        this.isActive = false;
        this.highlightedSpans = new Set();
        this.datePatterns = this.createDatePatterns();
        
        this.init();
    }
    
    createDatePatterns() {
        return [
            // Full formats with day names
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi,
            
            // Standard month day, year
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi,
            
            // Abbreviated months
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
            
            // Numeric formats (MM/DD/YYYY, DD/MM/YYYY)
            /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b/g,
            
            // Year-Month-Day (ISO-like)
            /\b\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}\b/g,
            
            // Just month and day (contextual)
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b(?!\s*\d{4})/gi,
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2}\b(?!\s*\d{4})/gi,
            
            // Year only (in context)
            /\b(?:19|20)\d{2}\b/g,
            
            // Dates with ordinal indicators
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th),?\s+\d{4}\b/gi,
            
            // Relative dates
            /\b(today|tomorrow|yesterday|next week|last week|next month|last month|next year|last year)\b/gi
        ];
    }
    
    init() {
        console.log('🚀 Initializing universal date scanner...');
        
        // Auto-detect and scan PDF
        setTimeout(() => this.autoDetectAndScan(), 2000);
        
        // Add interface
        this.addInterface();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    autoDetectAndScan() {
        console.log('🔍 Auto-detecting PDF...');
        
        try {
            const iframe = document.querySelector('iframe.d2l-fileviewer-rendered-pdf');
            if (iframe) {
                console.log('✅ PDF iframe detected');
                this.scanPDF();
            } else {
                console.log('⏳ No PDF iframe found, retrying...');
                setTimeout(() => this.autoDetectAndScan(), 1000);
            }
        } catch (error) {
            console.log('Auto-detect error:', error);
        }
    }
    
    scanPDF() {
        console.log('🔬 Scanning PDF for ALL dates...');
        
        try {
            const iframe = document.querySelector('iframe.d2l-fileviewer-rendered-pdf');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Get text from PDF
            const text = this.extractTextFromPDF(iframeDoc);
            console.log(`📊 Extracted ${text.length} characters`);
            
            // Find ALL dates
            const allDates = this.findAllDates(text);
            console.log(`📅 Found ${allDates.length} date occurrences`);
            
            // Filter and categorize
            const categorized = this.categorizeDates(allDates);
            
            // Display results
            this.displayResults(categorized);
            
            // Optional: highlight dates
            if (this.isActive) {
                this.highlightAllDates(iframeDoc, categorized.validDates);
            }
            
            return categorized;
            
        } catch (error) {
            console.error('❌ Scan failed:', error);
            this.showNotification('Failed to scan PDF', '#f44336');
            return null;
        }
    }
    
    extractTextFromPDF(iframeDoc) {
        // Try multiple extraction methods
        let text = '';
        
        // Method 1: Text layers (PDF.js)
        const textLayers = iframeDoc.querySelectorAll('.textLayer');
        textLayers.forEach(layer => {
            text += ' ' + (layer.textContent || '');
        });
        
        // Method 2: Direct text
        if (text.length < 100) {
            text = iframeDoc.body.innerText || iframeDoc.body.textContent || '';
        }
        
        // Method 3: Span elements
        if (text.length < 100) {
            const spans = iframeDoc.querySelectorAll('span');
            spans.forEach(span => {
                text += ' ' + (span.textContent || '');
            });
        }
        
        // Clean text
        text = text.replace(/\s+/g, ' ').trim();
        
        return text;
    }
    
    findAllDates(text) {
        const allMatches = [];
        
        this.datePatterns.forEach((pattern, index) => {
            pattern.lastIndex = 0; // Reset
            let match;
            
            while ((match = pattern.exec(text)) !== null) {
                const dateStr = match[0].trim();
                const contextStart = Math.max(0, match.index - 50);
                const contextEnd = Math.min(text.length, match.index + dateStr.length + 50);
                const context = text.substring(contextStart, contextEnd);
                
                allMatches.push({
                    text: dateStr,
                    patternIndex: index,
                    context: context,
                    index: match.index
                });
            }
        });
        
        // Sort by position in text
        allMatches.sort((a, b) => a.index - b.index);
        
        return allMatches;
    }
    
    categorizeDates(dateMatches) {
        const validDates = [];
        const potentialDates = [];
        const ambiguous = [];
        
        // Common false positives to filter
        const falsePositives = [
            /^\d{1,2}$/, // Just a number
            /^\d{4}$/, // Just a year (without context)
            /^page \d+/i,
            /^section \d+/i,
            /^\d+\.\d+/, // Version numbers
            /^\d+\s*(?:am|pm)/i, // Times
            /^\d+\/\d+\s*$/, // Fractions
            /^\d+-\d+-\d+$/, // Phone numbers, IDs
        ];
        
        dateMatches.forEach(match => {
            const dateStr = match.text;
            
            // Filter out obvious false positives
            let isFalsePositive = false;
            falsePositives.forEach(fp => {
                if (fp.test(dateStr)) {
                    isFalsePositive = true;
                }
            });
            
            if (isFalsePositive) {
                return;
            }
            
            // Try to parse as Date
            try {
                const parsed = new Date(dateStr);
                const isValid = !isNaN(parsed) && 
                               parsed.getFullYear() > 1900 && 
                               parsed.getFullYear() < 2100;
                
                if (isValid) {
                    // Format nicely
                    const formatted = this.formatDate(parsed);
                    validDates.push({
                        raw: dateStr,
                        formatted: formatted,
                        date: parsed,
                        context: match.context
                    });
                } else {
                    potentialDates.push({
                        text: dateStr,
                        reason: 'Could not parse as valid date',
                        context: match.context
                    });
                }
            } catch (e) {
                ambiguous.push({
                    text: dateStr,
                    reason: 'Date parsing error',
                    context: match.context
                });
            }
        });
        
        // Remove duplicates
        const uniqueValid = this.removeDuplicates(validDates);
        const uniquePotential = this.removeDuplicates(potentialDates);
        
        return {
            validDates: uniqueValid,
            potentialDates: uniquePotential,
            ambiguous: ambiguous,
            totalFound: dateMatches.length
        };
    }
    
    removeDuplicates(datesArray) {
        const seen = new Set();
        return datesArray.filter(item => {
            const key = item.raw || item.text;
            if (seen.has(key.toLowerCase())) {
                return false;
            }
            seen.add(key.toLowerCase());
            return true;
        });
    }
    
    formatDate(dateObj) {
        return dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    highlightAllDates(iframeDoc, dates) {
        console.log(`🖍️ Highlighting ${dates.length} dates...`);
        
        // Clear previous highlights
        this.clearHighlights(iframeDoc);
        
        // Get all text spans
        const textSpans = iframeDoc.querySelectorAll('.textLayer span');
        
        dates.forEach(dateInfo => {
            this.highlightDate(iframeDoc, dateInfo.raw, textSpans);
        });
    }
    
    highlightDate(iframeDoc, dateText, allSpans) {
        // Break date into searchable parts
        const searchTerms = dateText.toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
            .split(/\s+/)
            .filter(term => term.length > 1);
        
        // Find spans containing these terms
        const matchingSpans = [];
        
        allSpans.forEach(span => {
            const spanText = span.textContent.toLowerCase();
            let matchesAny = false;
            
            searchTerms.forEach(term => {
                if (spanText.includes(term)) {
                    matchesAny = true;
                }
            });
            
            if (matchesAny && !this.highlightedSpans.has(span)) {
                matchingSpans.push(span);
                this.highlightedSpans.add(span);
            }
        });
        
        // Apply highlight if we found matching spans
        if (matchingSpans.length > 0) {
            this.applyHighlightToSpans(matchingSpans, dateText);
        }
    }
    
    applyHighlightToSpans(spans, dateText) {
        const color = this.getColorForDate(dateText);
        
        spans.forEach(span => {
            // Save original style
            if (!span.hasAttribute('data-original-style')) {
                span.setAttribute('data-original-style', span.style.cssText);
            }
            
            // Apply highlight
            span.style.cssText += `
                background: ${color.background} !important;
                color: ${color.text} !important;
                font-weight: bold !important;
                border: 2px solid ${color.border} !important;
                border-radius: 4px !important;
                padding: 1px 3px !important;
                margin: -1px -3px !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
                position: relative !important;
                z-index: 10 !important;
                cursor: pointer !important;
            `;
            
            // Click to copy
            span.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(dateText);
                this.showCopiedNotification(dateText);
            };
        });
    }
    
    getColorForDate(dateText) {
        // Assign different colors based on date recency
        const date = new Date(dateText);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return { // Past dates
                background: '#E0E0E0',
                text: '#424242',
                border: '#9E9E9E'
            };
        } else if (diffDays <= 7) {
            return { // This week
                background: '#FFCDD2',
                text: '#C62828',
                border: '#EF5350'
            };
        } else if (diffDays <= 30) {
            return { // This month
                background: '#FFF3E0',
                text: '#EF6C00',
                border: '#FF9800'
            };
        } else {
            return { // Future dates
                background: '#E8F5E8',
                text: '#2E7D32',
                border: '#4CAF50'
            };
        }
    }
    
    clearHighlights(iframeDoc) {
        const spans = iframeDoc.querySelectorAll('.textLayer span');
        spans.forEach(span => {
            if (span.hasAttribute('data-original-style')) {
                span.style.cssText = span.getAttribute('data-original-style');
                span.removeAttribute('data-original-style');
                span.onclick = null;
            }
        });
        this.highlightedSpans.clear();
    }
    
    displayResults(categorized) {
        // Remove existing panel
        const existing = document.getElementById('universal-date-scanner');
        if (existing) existing.remove();
        
        // Create results panel
        const panel = document.createElement('div');
        panel.id = 'universal-date-scanner';
        
        let html = `
            <div style="
                position: fixed;
                top: 60px;
                right: 20px;
                width: 450px;
                max-height: 80vh;
                background: white;
                border: 3px solid #2196F3;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                z-index: 99999;
                font-family: sans-serif;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #2196F3, #1976D2);
                    color: white;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <h3 style="margin: 0; font-size: 16px;">📅 Universal Date Scanner</h3>
                        <div style="font-size: 12px; opacity: 0.9;">
                            Found ${categorized.totalFound} date references
                        </div>
                    </div>
                    <button id="close-scanner" style="
                        background: none;
                        border: none;
                        color: white;
                        font-size: 24px;
                        cursor: pointer;
                        padding: 0;
                        width: 30px;
                        height: 30px;
                    ">×</button>
                </div>
                
                <!-- Content -->
                <div style="padding: 20px; overflow-y: auto; flex: 1;">
        `;
        
        // Valid Dates Section
        if (categorized.validDates.length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #4CAF50; display: flex; align-items: center; gap: 8px;">
                        <span>✅</span>
                        <span>Valid Dates (${categorized.validDates.length})</span>
                    </h4>
                    <div style="
                        max-height: 200px;
                        overflow-y: auto;
                        border: 1px solid #E0E0E0;
                        border-radius: 6px;
                    ">
            `;
            
            categorized.validDates.forEach((date, index) => {
                html += `
                    <div style="
                        padding: 10px;
                        border-bottom: 1px solid #F5F5F5;
                        background: ${index % 2 === 0 ? '#FAFAFA' : 'white'};
                        cursor: pointer;
                    " onclick="navigator.clipboard.writeText('${date.formatted}'); alert('📋 Copied: ${date.formatted}');">
                        <div style="font-weight: bold; color: #333;">${date.formatted}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">
                            <div>Original: ${date.raw}</div>
                            <div style="margin-top: 2px;">${date.date.toDateString()}</div>
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }
        
        // Potential Dates Section
        if (categorized.potentialDates.length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #FF9800; display: flex; align-items: center; gap: 8px;">
                        <span>⚠️</span>
                        <span>Potential Dates (${categorized.potentialDates.length})</span>
                    </h4>
                    <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
                        These look like dates but need verification
                    </div>
                    <div style="
                        max-height: 150px;
                        overflow-y: auto;
                        border: 1px solid #FFE0B2;
                        border-radius: 6px;
                        background: #FFF8E1;
                    ">
            `;
            
            categorized.potentialDates.forEach((date, index) => {
                html += `
                    <div style="
                        padding: 8px;
                        border-bottom: 1px solid #FFECB3;
                        font-size: 13px;
                    ">
                        <div style="font-weight: bold; color: #E65100;">${date.text}</div>
                        <div style="font-size: 11px; color: #FF8F00; margin-top: 2px;">
                            ${date.reason}
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }
        
        // Summary
        html += `
            <div style="
                background: #F5F5F5;
                padding: 12px;
                border-radius: 6px;
                margin-top: 10px;
                font-size: 13px;
            ">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Total found:</span>
                    <span style="font-weight: bold;">${categorized.totalFound}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Valid dates:</span>
                    <span style="color: #4CAF50; font-weight: bold;">${categorized.validDates.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Potential dates:</span>
                    <span style="color: #FF9800; font-weight: bold;">${categorized.potentialDates.length}</span>
                </div>
            </div>
        `;
        
        // Controls
        html += `
                </div>
                
                <!-- Footer -->
                <div style="
                    padding: 15px 20px;
                    background: #F5F5F5;
                    border-top: 1px solid #E0E0E0;
                    display: flex;
                    gap: 10px;
                ">
                    <button id="scan-again" style="
                        flex: 1;
                        padding: 8px;
                        background: #2196F3;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">🔄 Scan Again</button>
                    
                    <button id="toggle-highlight" style="
                        flex: 1;
                        padding: 8px;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">🎨 Toggle Highlight</button>
                    
                    <button id="copy-all" style="
                        flex: 1;
                        padding: 8px;
                        background: #9C27B0;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">📋 Copy All</button>
                </div>
            </div>
        `;
        
        panel.innerHTML = html;
        document.body.appendChild(panel);
        
        // Add event listeners
        panel.querySelector('#close-scanner').onclick = () => panel.remove();
        panel.querySelector('#scan-again').onclick = () => this.scanPDF();
        panel.querySelector('#toggle-highlight').onclick = () => this.toggleHighlighting();
        panel.querySelector('#copy-all').onclick = () => {
            const allDates = categorized.validDates.map(d => d.formatted).join('\n');
            navigator.clipboard.writeText(allDates);
            this.showNotification(`📋 Copied ${categorized.validDates.length} dates`, '#9C27B0');
        };
    }
    
    toggleHighlighting() {
        this.isActive = !this.isActive;
        
        if (this.isActive) {
            const iframe = document.querySelector('iframe.d2l-fileviewer-rendered-pdf');
            if (iframe) {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                // Re-scan to get dates for highlighting
                const text = this.extractTextFromPDF(iframeDoc);
                const dates = this.findAllDates(text);
                const categorized = this.categorizeDates(dates);
                this.highlightAllDates(iframeDoc, categorized.validDates);
            }
            this.showNotification('🎨 Highlighting ON', '#4CAF50');
        } else {
            const iframe = document.querySelector('iframe.d2l-fileviewer-rendered-pdf');
            if (iframe) {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                this.clearHighlights(iframeDoc);
            }
            this.showNotification('🎨 Highlighting OFF', '#666');
        }
    }
    
    addInterface() {
        // Add floating action button
        const fab = document.createElement('button');
        fab.id = 'universal-scanner-fab';
        fab.innerHTML = '📅';
        fab.title = 'Universal Date Scanner';
        fab.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #2196F3, #1976D2);
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            z-index: 99998;
            box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4);
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        fab.onmouseenter = () => {
            fab.style.transform = 'scale(1.1) rotate(10deg)';
            fab.style.boxShadow = '0 8px 25px rgba(33, 150, 243, 0.6)';
        };
        
        fab.onmouseleave = () => {
            fab.style.transform = 'scale(1) rotate(0)';
            fab.style.boxShadow = '0 6px 20px rgba(33, 150, 243, 0.4)';
        };
        
        fab.onclick = () => this.scanPDF();
        
        document.body.appendChild(fab);
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D for date scanner
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.scanPDF();
            }
            
            // Ctrl+Shift+H for highlight toggle
            if (e.ctrlKey && e.shiftKey && e.key === 'H') {
                e.preventDefault();
                this.toggleHighlighting();
            }
        });
    }
    
    showNotification(message, color) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${color};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 100000;
            font-family: sans-serif;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
    
    showCopiedNotification(dateText) {
        const notification = document.createElement('div');
        notification.textContent = `📋 Copied: ${dateText}`;
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 16px;
            border-radius: 6px;
            z-index: 100000;
            font-family: sans-serif;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 1500);
    }
}

// QUICK UNIVERSAL SCAN FUNCTION
function quickUniversalScan() {
    console.log('⚡ Quick universal scan...');
    
    try {
        const iframe = document.querySelector('iframe.d2l-fileviewer-rendered-pdf');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Extract text
        const text = iframeDoc.body.innerText || iframeDoc.body.textContent;
        const cleanText = text.replace(/\s+/g, ' ').trim();
        
        // Comprehensive date patterns
        const patterns = [
            // Month Day, Year
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi,
            // With day
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi,
            // Numeric
            /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b/g,
            // Year-Month-Day
            /\b\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}\b/g,
            // Month Day (no year)
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi
        ];
        
        // Find all matches
        const allMatches = [];
        patterns.forEach(pattern => {
            const matches = cleanText.match(pattern) || [];
            matches.forEach(match => {
                if (!allMatches.includes(match)) {
                    allMatches.push(match);
                }
            });
        });
        
        // Sort and display
        const uniqueDates = [...new Set(allMatches)].sort();
        
        console.log('📅 All dates found:', uniqueDates);
        
        // Copy to clipboard
        navigator.clipboard.writeText(uniqueDates.join('\n'));
        
        // Show results
        const results = document.createElement('div');
        results.innerHTML = `
            <div style="
                position: fixed;
                top: 100px;
                right: 20px;
                width: 400px;
                max-height: 500px;
                background: white;
                border: 3px solid #2196F3;
                border-radius: 10px;
                padding: 20px;
                z-index: 99999;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                font-family: sans-serif;
                overflow-y: auto;
            ">
                <h3 style="margin: 0 0 15px 0; color: #2196F3;">📅 Found ${uniqueDates.length} Dates</h3>
                <div style="
                    max-height: 300px;
                    overflow-y: auto;
                    border: 1px solid #E0E0E0;
                    border-radius: 6px;
                    margin-bottom: 15px;
                ">
                    ${uniqueDates.map(date => `
                        <div style="
                            padding: 8px;
                            border-bottom: 1px solid #F5F5F5;
                            font-family: monospace;
                            cursor: pointer;
                        " onclick="navigator.clipboard.writeText('${date}'); this.style.background='#E8F5E9'; setTimeout(() => this.style.background='', 200);">
                            ${date}
                        </div>
                    `).join('')}
                </div>
                <div style="color: #666; font-size: 12px; margin-bottom: 15px;">
                    ✅ Copied ${uniqueDates.length} dates to clipboard
                </div>
                <button onclick="this.parentElement.remove();" style="
                    padding: 8px 16px;
                    background: #666;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(results);
        
        return uniqueDates;
        
    } catch (error) {
        console.error('Quick scan failed:', error);
        alert('Make sure PDF is loaded!');
        return [];
    }
}

// Initialize
console.log('🌍 Universal Date Scanner loading...');
setTimeout(() => {
    window.universalDateScanner = new UniversalPDFDateScanner();
    console.log('✅ Universal Date Scanner ready!');
    console.log('📌 Press Ctrl+Shift+D to scan or click the blue button');
    
    // Expose quick function
    window.quickUniversalScan = quickUniversalScan;
    
    // Auto-scan after 3 seconds
    setTimeout(() => {
        console.log('⏱️ Auto-scanning PDF...');
        quickUniversalScan();
    }, 3000);
}, 1000);