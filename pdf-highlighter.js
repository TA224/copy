// pdf-highlighter.js - Lightweight PDF Date Highlighter
console.log('📄 PDF Highlighter loaded');

class PDFHighlighter {
    constructor() {
        this.isActive = false;
        this.highlightedElements = new Set();
        this.observer = null;
        this.scanInterval = null;
        this.lastScanCount = 0;
        this.scanAttempts = 0;
        
        // Enhanced date patterns for academic PDFs
        this.datePatterns = this.createDatePatterns();
        
        this.init();
    }
    
    createDatePatterns() {
        return [
            // Month Day, Year (January 15, 2024) - most common
            /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[,\.]?\s*\d{4})?\b/gi,
            
            // Numeric dates (01/15/2024, 01-15-24, 01.15.2024)
            /\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/g,
            
            // Year-Month-Day (2024-01-15) - ISO format
            /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g,
            
            // Academic context dates (due Jan 15, deadline: January 15)
            /(?:due\s*|deadline\s*|exam\s*|quiz\s*|test\s*|assignment\s*|homework\s*|project\s*|lab\s*|midterm\s*|final\s*|submission\s*|paper\s*)[:;\-\s]*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?/gi,
            
            // Day Month Year (15 January 2024) - international
            /\b\d{1,2}(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*(?:\s*[,\.]?\s*\d{4})?\b/gi,
            
            // Weekday patterns (Monday, January 15)
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[\s,]+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?/gi,
            
            // Quarter patterns (Q1 2024, Fall 2024)
            /\b(Q[1-4]|Spring|Summer|Fall|Winter|Autumn)[\s\-]+\d{4}\b/gi,
            
            // Simple month year (January 2024)
            /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+\d{4}\b/gi
        ];
    }
    
    init() {
        console.log('📄 PDF Highlighter initializing...');
        
        // Check if this is a PDF page
        this.isPDFPage = this.detectPDFPage();
        
        // Setup keyboard shortcut
        this.setupShortcuts();
        
        // Start observing for PDF content
        this.setupObserver();
        
        // Add styles
        this.addStyles();
        
        console.log('✅ PDF Highlighter ready! Press Ctrl+Shift+H to toggle');
        
        // Auto-activate on PDF pages
        if (this.isPDFPage) {
            setTimeout(() => {
                console.log('📄 Auto-activating on PDF page');
                this.activate();
            }, 1000);
        }
    }
    
    detectPDFPage() {
        // Check if we're on a PDF page
        const url = window.location.href.toLowerCase();
        const contentType = document.contentType;
        
        // URL patterns for PDFs
        const pdfUrlPatterns = [
            /\.pdf($|\?)/i,
            /pdf$/i,
            /application\/pdf/i,
            /viewer\.html/i,
            /pdfjs/i
        ];
        
        // Check URL
        const isPDFUrl = pdfUrlPatterns.some(pattern => pattern.test(url));
        
        // Check content type
        const isPDFContentType = contentType === 'application/pdf';
        
        // Check for PDF embeds
        const hasPDFEmbed = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]');
        
        // Check for PDF.js viewer
        const hasPDFjs = document.querySelector('.textLayer, .pdfViewer, #viewer');
        
        // Check page title
        const title = document.title.toLowerCase();
        const hasPDFInTitle = title.includes('.pdf') || title.includes('pdf');
        
        const isPDF = isPDFUrl || isPDFContentType || hasPDFEmbed || hasPDFjs || hasPDFInTitle;
        
        console.log('📄 PDF detection:', {
            url, 
            contentType, 
            hasPDFEmbed: !!hasPDFEmbed,
            hasPDFjs: !!hasPDFjs,
            isPDF
        });
        
        return isPDF;
    }
    
    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'H') {
                e.preventDefault();
                e.stopPropagation();
                console.log('⌨️ Ctrl+Shift+H pressed - toggling PDF highlighting');
                this.toggle();
                return false;
            }
            
            if (e.key === 'Escape' && this.isActive) {
                this.deactivate();
            }
        }, true);
    }
    
    setupObserver() {
        // Watch for PDF content loading
        this.observer = new MutationObserver((mutations) => {
            if (!this.isActive) return;
            
            let shouldScan = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldScan = true;
                    break;
                }
            }
            
            if (shouldScan) {
                // Debounce scans
                clearTimeout(this.scanDebounce);
                this.scanDebounce = setTimeout(() => {
                    if (this.isActive) {
                        this.scanContent();
                    }
                }, 500);
            }
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('👀 DOM observer active');
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.id = 'pdf-highlighter-styles';
        style.textContent = `
            .pdf-date-highlight {
                position: relative !important;
                z-index: 1000 !important;
                cursor: pointer !important;
                animation: pdf-highlight-pulse 0.3s ease !important;
            }
            
            .pdf-date-highlight:hover {
                transform: translateY(-1px) scale(1.02) !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
                z-index: 1001 !important;
            }
            
            .pdf-date-tooltip {
                animation: pdf-tooltip-fadein 0.2s ease !important;
                z-index: 10002 !important;
            }
            
            .pdf-highlighter-notification {
                animation: pdf-notification-slidein 0.3s ease !important;
            }
            
            @keyframes pdf-highlight-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            @keyframes pdf-tooltip-fadein {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes pdf-notification-slidein {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        if (!document.getElementById('pdf-highlighter-styles')) {
            document.head.appendChild(style);
        }
    }
    
    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }
    
    async activate() {
        if (this.isActive) return;
        
        console.log('🎯 Activating PDF highlighting...');
        this.isActive = true;
        this.scanAttempts = 0;
        
        // Force a scan
        await this.scanContent(true);
        
        // Start periodic scanning for dynamic content
        this.startPeriodicScan();
        
        this.showNotification('📄 PDF highlighting ACTIVATED', '#4CAF50');
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        console.log('🔴 Deactivating PDF highlighting...');
        this.isActive = false;
        
        this.stopPeriodicScan();
        this.clearHighlights();
        
        this.showNotification('📄 PDF highlighting OFF', '#666');
    }
    
    async scanContent(force = false) {
        if (!this.isActive) return;
        
        this.scanAttempts++;
        console.log(`🔍 Scanning for dates (attempt ${this.scanAttempts})...`);
        
        // Get all text content in the document
        const textNodes = this.getAllTextNodes();
        let totalMatches = 0;
        
        console.log(`Found ${textNodes.length} text nodes`);
        
        // Process each text node
        for (const node of textNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 3) {
                const matches = this.highlightTextNode(node);
                totalMatches += matches;
            }
        }
        
        // Also scan for text in hidden layers (common in PDF viewers)
        if (totalMatches === 0 && this.isPDFPage) {
            console.log('Trying alternative text extraction for PDF viewer...');
            const altMatches = this.scanAlternativeText();
            totalMatches += altMatches;
        }
        
        // Update last scan count
        if (totalMatches !== this.lastScanCount) {
            this.lastScanCount = totalMatches;
            
            if (totalMatches > 0) {
                console.log(`✅ Found ${totalMatches} date(s)`);
                this.showNotification(`📅 Found ${totalMatches} date(s)`, '#4CAF50');
                
                // Share with LMS extractor if it exists
                this.shareDatesWithLMS();
            } else if (this.scanAttempts <= 3) {
                console.log('ℹ️ No dates found, will retry...');
            } else {
                console.log('ℹ️ No dates found in current content');
            }
        }
        
        return totalMatches;
    }
    
    getAllTextNodes() {
        try {
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        // Skip script, style, hidden elements
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        
                        if (parent.tagName === 'SCRIPT' || 
                            parent.tagName === 'STYLE' ||
                            parent.tagName === 'NOSCRIPT' ||
                            parent.style.display === 'none' ||
                            parent.hidden ||
                            parent.offsetParent === null ||
                            window.getComputedStyle(parent).display === 'none') {
                            return NodeFilter.FILTER_REJECT;
                        }
                        
                        // Only include nodes with meaningful text
                        if (node.textContent.trim().length > 3) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_REJECT;
                    }
                }
            );
            
            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            
            return textNodes;
        } catch (error) {
            console.error('Error getting text nodes:', error);
            return [];
        }
    }
    
    scanAlternativeText() {
        let matches = 0;
        
        // Try different selectors for PDF viewer text
        const selectors = [
            '.textLayer span',
            '.text-layer span',
            '.textLayer div',
            '.text-layer div',
            '.text span',
            '.text div',
            '.page span',
            '.page div',
            '[role="text"]',
            '.text-content',
            '.text-annotation'
        ];
        
        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.textContent && element.textContent.trim().length > 3) {
                        const elementMatches = this.highlightElement(element);
                        matches += elementMatches;
                    }
                });
            } catch (e) {
                // Ignore errors
            }
        });
        
        return matches;
    }
    
    highlightTextNode(textNode) {
        try {
            const text = textNode.textContent;
            const matches = this.findDatesInText(text);
            
            if (matches.length === 0) return 0;
            
            // Don't modify if already highlighted
            const parent = textNode.parentElement;
            if (parent && parent.classList && parent.classList.contains('pdf-date-highlight')) {
                return 0;
            }
            
            // Create a span to replace the text node
            const span = document.createElement('span');
            let html = this.escapeHTML(text);
            
            // Replace matches in reverse order to preserve indices
            const sortedMatches = [...matches].sort((a, b) => b.index - a.index);
            
            sortedMatches.forEach((match, i) => {
                const escapedText = this.escapeRegExp(match.text);
                const regex = new RegExp(`(${escapedText})(?![^<]*>)`, 'gi');
                
                const highlight = document.createElement('mark');
                highlight.className = 'pdf-date-highlight';
                highlight.dataset.date = match.text;
                highlight.dataset.index = i;
                highlight.textContent = match.text;
                
                // Assign color based on match type
                const colors = ['#FFF3CD', '#D1ECF1', '#D4EDDA', '#F8D7DA', '#E2E3E5', '#CCE5FF', '#E8D3F4', '#F4D3E8'];
                const color = colors[match.patternIndex % colors.length];
                
                highlight.style.cssText = `
                    background-color: ${color} !important;
                    color: #000 !important;
                    padding: 2px 4px !important;
                    margin: 0 1px !important;
                    border-radius: 3px !important;
                    border: 1px solid ${this.darkenColor(color, 30)} !important;
                    font-weight: bold !important;
                    cursor: pointer !important;
                    position: relative !important;
                    transition: all 0.2s ease !important;
                    display: inline !important;
                `;
                
                // Add hover effects
                highlight.addEventListener('mouseenter', (e) => {
                    highlight.style.transform = 'translateY(-1px) scale(1.02)';
                    highlight.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                    highlight.style.zIndex = '1001';
                });
                
                highlight.addEventListener('mouseleave', () => {
                    highlight.style.transform = '';
                    highlight.style.boxShadow = '';
                    highlight.style.zIndex = '';
                });
                
                // Add click handler
                highlight.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onDateClick(highlight, match.text);
                });
                
                html = html.replace(regex, highlight.outerHTML);
            });
            
            span.innerHTML = html;
            
            // Replace the text node with our highlighted span
            if (textNode.parentNode) {
                textNode.parentNode.replaceChild(span, textNode);
                
                // Store highlighted elements
                const highlights = span.querySelectorAll('.pdf-date-highlight');
                highlights.forEach(h => this.highlightedElements.add(h));
                
                return matches.length;
            }
        } catch (error) {
            console.error('Error highlighting text node:', error);
        }
        
        return 0;
    }
    
    highlightElement(element) {
        try {
            const text = element.textContent;
            const matches = this.findDatesInText(text);
            
            if (matches.length === 0) return 0;
            
            // Don't re-highlight
            if (element.classList && element.classList.contains('pdf-date-highlight')) {
                return 0;
            }
            
            const originalHTML = element.innerHTML;
            let modifiedHTML = originalHTML;
            
            // Replace matches in reverse order
            const sortedMatches = [...matches].sort((a, b) => b.index - a.index);
            
            sortedMatches.forEach((match, i) => {
                const escapedText = this.escapeRegExp(match.text);
                const regex = new RegExp(`(${escapedText})(?![^<]*>)`, 'gi');
                
                const highlight = document.createElement('span');
                highlight.className = 'pdf-date-highlight';
                highlight.dataset.date = match.text;
                highlight.textContent = match.text;
                
                const colors = ['#FFF3CD', '#D1ECF1', '#D4EDDA', '#F8D7DA', '#E2E3E5'];
                const color = colors[match.patternIndex % colors.length];
                
                highlight.style.cssText = `
                    background-color: ${color} !important;
                    color: #000 !important;
                    padding: 1px 3px !important;
                    margin: 0 1px !important;
                    border-radius: 2px !important;
                    border: 1px solid ${this.darkenColor(color, 30)} !important;
                    font-weight: bold !important;
                    cursor: pointer !important;
                `;
                
                highlight.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onDateClick(highlight, match.text);
                });
                
                modifiedHTML = modifiedHTML.replace(regex, highlight.outerHTML);
            });
            
            if (modifiedHTML !== originalHTML) {
                element.innerHTML = modifiedHTML;
                const highlights = element.querySelectorAll('.pdf-date-highlight');
                highlights.forEach(h => this.highlightedElements.add(h));
                return matches.length;
            }
        } catch (error) {
            console.error('Error highlighting element:', error);
        }
        
        return 0;
    }
    
    findDatesInText(text) {
        const matches = [];
        
        this.datePatterns.forEach((pattern, patternIndex) => {
            pattern.lastIndex = 0;
            let match;
            
            while ((match = pattern.exec(text)) !== null) {
                const dateText = match[0].trim();
                
                // Skip false positives
                if (this.isFalsePositive(dateText)) continue;
                
                // Skip if already matched (allowing some overlap)
                const isDuplicate = matches.some(m => 
                    Math.abs(m.index - match.index) < 5 && 
                    m.text === dateText
                );
                
                if (!isDuplicate) {
                    matches.push({
                        text: dateText,
                        index: match.index,
                        patternIndex: patternIndex,
                        fullMatch: match
                    });
                }
            }
        });
        
        return matches;
    }
    
    isFalsePositive(text) {
        const lower = text.toLowerCase();
        
        // Common false positives
        const falsePositives = [
            /^\d+$/,                      // Just numbers
            /^\d+\.\d+$/,                 // Decimal numbers
            /^\d+:\d+(?::\d+)?$/,         // Times (12:30, 12:30:45)
            /^\d+\.\d+\.\d+$/,            // Version numbers (1.2.3)
            /^page\s+\d+/i,               // Page numbers
            /^\d+\s*[kmgb]b?$/i,          // File sizes
            /^http/i,                     // URLs
            /^\(\d+\)$/,                  // Parenthesized numbers
            /^[\d\.,]+\s*(?:st|nd|rd|th)$/i, // Just ordinals
            /^\d+[-–]\d+$/,               // Ranges (10-15)
            /^[a-z]\.\s*\d+/i,            // Letter. number (a. 1)
            /^fig\.\s*\d+/i,              // Figure references
            /^table\s+\d+/i,              // Table numbers
            /^equation\s+\d+/i,           // Equation numbers
            /^doi:/i,                     // DOI
            /^isbn:/i,                    // ISBN
            /^issn:/i,                    // ISSN
            /^arxiv:/i                    // ArXiv
        ];
        
        // Also exclude very short date-like strings without year
        if (text.length < 6 && !text.match(/\d{4}/)) {
            return true;
        }
        
        // Exclude if it looks like a file name
        if (lower.includes('.pdf') || lower.includes('.doc') || lower.includes('.ppt')) {
            return true;
        }
        
        return falsePositives.some(fp => fp.test(lower));
    }
    
    onDateClick(element, dateText) {
        // Flash animation
        const originalColor = element.style.backgroundColor;
        element.style.backgroundColor = '#FFEB3B';
        element.style.borderColor = '#FFC107';
        element.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
            element.style.backgroundColor = originalColor;
            element.style.borderColor = this.darkenColor(originalColor, 30);
            element.style.transform = '';
        }, 300);
        
        // Show tooltip
        this.showTooltip(element, dateText);
        
        // Try to parse date
        const parsedDate = this.parseDate(dateText);
        if (parsedDate) {
            console.log('Date clicked:', dateText, '->', parsedDate.toLocaleDateString());
        }
    }
    
    showTooltip(element, text) {
        // Remove existing tooltip
        document.querySelectorAll('.pdf-date-tooltip').forEach(t => t.remove());
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'pdf-date-tooltip';
        tooltip.innerHTML = `<strong>📅 ${this.escapeHTML(text)}</strong>`;
        
        // Try to parse date
        const parsed = this.parseDate(text);
        if (parsed) {
            tooltip.innerHTML += `<div style="font-size:11px;color:#ccc;margin-top:4px;">
                ${parsed.toLocaleDateString()} • Click to highlight
            </div>`;
        }
        
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(44, 62, 80, 0.95);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10002;
            pointer-events: none;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, sans-serif;
            border: 1px solid #34495e;
            backdrop-filter: blur(10px);
            line-height: 1.4;
        `;
        
        // Position near element
        const rect = element.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        tooltip.style.left = `${rect.left + scrollX}px`;
        tooltip.style.top = `${rect.top + scrollY - 40}px`;
        
        document.body.appendChild(tooltip);
        
        // Adjust if off-screen
        setTimeout(() => {
            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipRect.right > window.innerWidth) {
                tooltip.style.left = `${rect.left + scrollX - tooltipRect.width + rect.width}px`;
            }
            if (tooltipRect.top < 0) {
                tooltip.style.top = `${rect.bottom + scrollY + 10}px`;
            }
        }, 0);
        
        // Remove after delay
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateY(-10px)';
                tooltip.style.transition = 'all 0.3s ease';
                
                setTimeout(() => {
                    if (tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                }, 300);
            }
        }, 2500);
    }
    
    startPeriodicScan() {
        this.stopPeriodicScan();
        
        // Initial scan immediately
        this.scanContent();
        
        // Then scan every 2 seconds while active
        this.scanInterval = setInterval(() => {
            if (this.isActive) {
                this.scanContent();
            }
        }, 2000);
    }
    
    stopPeriodicScan() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
    }
    
    clearHighlights() {
        this.highlightedElements.forEach(element => {
            if (element.parentNode) {
                const textNode = document.createTextNode(element.textContent);
                element.parentNode.replaceChild(textNode, element);
            }
        });
        
        this.highlightedElements.clear();
        
        // Remove tooltips
        document.querySelectorAll('.pdf-date-tooltip').forEach(t => t.remove());
        
        this.lastScanCount = 0;
    }
    
    shareDatesWithLMS() {
        // Share found dates with LMS extractor if it exists
        try {
            const dates = Array.from(this.highlightedElements).map(el => el.dataset.date);
            const uniqueDates = [...new Set(dates)];
            
            // Dispatch event that LMS extractor can listen for
            const event = new CustomEvent('pdfDatesFound', {
                detail: { dates: uniqueDates }
            });
            window.dispatchEvent(event);
            
            // Also try to call LMS extractor directly
            if (window.lmsExtractor && typeof window.lmsExtractor.addDates === 'function') {
                window.lmsExtractor.addDates(uniqueDates);
            }
            
            console.log(`📤 Shared ${uniqueDates.length} dates with LMS extractor`);
        } catch (e) {
            // Silently fail
        }
    }
    
    parseDate(dateText) {
        try {
            // Clean up the date string
            const clean = dateText
                .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
                .replace(/(january|february|march|april|may|june|july|august|september|october|november|december)/gi, 
                    match => match.substring(0, 3))
                .replace(/[,\.]/g, '')
                .trim();
            
            // Try different date formats
            const formats = [
                clean, // Try as-is
                clean.replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, '$3-$1-$2'),
                clean.replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/, '$1/$2/20$3'),
                clean.replace(/(\w{3}) (\d{1,2}) (\d{4})/, '$1 $2, $3'),
                clean.replace(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/, '$1-$2-$3')
            ];
            
            for (const format of formats) {
                const date = new Date(format);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        } catch (e) {
            // Date parsing failed
        }
        return null;
    }
    
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    darkenColor(color, percent) {
        try {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) - amt;
            const G = (num >> 8 & 0x00FF) - amt;
            const B = (num & 0x0000FF) - amt;
            
            return '#' + (
                0x1000000 +
                (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
                (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
                (B < 255 ? (B < 1 ? 0 : B) : 255)
            ).toString(16).slice(1);
        } catch (e) {
            return '#000';
        }
    }
    
    showNotification(message, color) {
        const existing = document.querySelector('.pdf-highlighter-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'pdf-highlighter-notification';
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${color};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-weight: bold;
            max-width: 300px;
            text-align: center;
            border: 2px solid rgba(255,255,255,0.3);
            backdrop-filter: blur(10px);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                notification.style.transition = 'all 0.3s ease';
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }
}

// Initialize when page is ready
(function() {
    console.log('📄 PDF Highlighter loading...');
    
    const init = () => {
        // Wait a bit for page to settle
        setTimeout(() => {
            try {
                window.pdfHighlighter = new PDFHighlighter();
                
                // Expose API
                window.PDFHighlighterAPI = {
                    toggle: () => window.pdfHighlighter?.toggle(),
                    activate: () => window.pdfHighlighter?.activate(),
                    deactivate: () => window.pdfHighlighter?.deactivate(),
                    scan: () => window.pdfHighlighter?.scanContent(true),
                    getDates: () => {
                        const dates = Array.from(window.pdfHighlighter?.highlightedElements || [])
                            .map(el => el.dataset.date);
                        return [...new Set(dates)];
                    }
                };
                
                console.log('✅ PDF Highlighter initialized');
            } catch (error) {
                console.error('Failed to initialize PDF Highlighter:', error);
            }
        }, 500);
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();