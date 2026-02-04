// lms-pdf-extractor.js - Handles embedded PDFs in LMS
console.log('📄 LMS PDF Extractor loaded');

class LMSPDFExtractor {
    constructor() {
        this.extractedDates = new Set();
        this.pdfIframes = new Set();
        this.isActive = false;
        
        // Date patterns for academic content
        this.datePatterns = [
            // Month Day (January 15)
            /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
            
            // MM/DD/YYYY or DD/MM/YYYY
            /\b(0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])[\/\-\.](\d{4})\b/g,
            
            // MM/DD or DD/MM
            /\b(0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b/g,
            
            // Academic deadlines
            /(?:due\s*|deadline\s*|exam\s*|quiz\s*|test\s*|assignment\s*|homework\s*|project\s*|lab\s*|midterm\s*|final\s*|submission\s*)[:;\-\s]*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?/gi,
            
            // Simple dates
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+\d{1,2}\b/gi
        ];
        
        this.init();
    }
    
    init() {
        console.log('📄 LMS PDF Extractor initializing...');
        
        // Check if we're on an LMS with PDFs
        this.detectLMSPDFs();
        
        // Setup observer for dynamic content
        this.setupObserver();
        
        // Setup keyboard shortcut
        this.setupShortcuts();
        
        // Auto-start on LMS pages
        setTimeout(() => {
            if (this.hasPDFs) {
                console.log('📄 Found PDFs on LMS page, auto-activating...');
                this.activate();
            }
        }, 2000);
    }
    
    detectLMSPDFs() {
        const url = window.location.href.toLowerCase();
        this.isLMSPage = url.includes('brightspace') || 
                         url.includes('d2l') || 
                         url.includes('canvas') ||
                         url.includes('blackboard') ||
                         url.includes('moodle') ||
                         document.querySelector('.d2l-htmlblock-untrusted, .user_content, .vtbegenerated');
        
        // Look for PDFs in various forms
        this.findPDFElements();
        
        this.hasPDFs = this.pdfIframes.size > 0 || 
                      document.querySelector('embed[type="application/pdf"]') ||
                      document.querySelector('object[type="application/pdf"]');
        
        console.log('📄 LMS PDF Detection:', {
            isLMSPage: this.isLMSPage,
            pdfIframes: this.pdfIframes.size,
            hasPDFs: this.hasPDFs
        });
    }
    
    findPDFElements() {
        // Look for iframes that might contain PDFs
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            const src = iframe.src || '';
            if (src.includes('.pdf') || 
                src.includes('pdfjs') ||
                src.includes('viewer') ||
                iframe.title.toLowerCase().includes('pdf')) {
                this.pdfIframes.add(iframe);
            }
        });
        
        // Look for PDF embeds
        const embeds = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
        embeds.forEach(embed => this.pdfIframes.add(embed));
    }
    
    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    this.findPDFElements();
                    
                    if (this.isActive && this.pdfIframes.size > 0) {
                        setTimeout(() => this.scanAllPDFs(), 1000);
                    }
                }
            });
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') { // Ctrl+Shift+P for PDFs
                e.preventDefault();
                this.toggle();
            }
        });
    }
    
    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }
    
    activate() {
        if (this.isActive) return;
        
        console.log('🎯 Activating LMS PDF extraction...');
        this.isActive = true;
        
        // Scan immediately
        this.scanAllPDFs();
        
        this.showNotification('📄 Scanning PDFs for dates...', '#4CAF50');
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        console.log('🔴 Deactivating LMS PDF extraction...');
        this.isActive = false;
        
        this.showNotification('📄 PDF scanning OFF', '#666');
    }
    
    async scanAllPDFs() {
        if (!this.isActive) return;
        
        console.log(`🔍 Scanning ${this.pdfIframes.size} PDF element(s)...`);
        let totalDates = 0;
        
        // Strategy 1: Try to access iframe content
        for (const element of this.pdfIframes) {
            if (element.tagName === 'IFRAME') {
                totalDates += await this.scanIframePDF(element);
            } else if (element.tagName === 'EMBED' || element.tagName === 'OBJECT') {
                totalDates += await this.scanEmbeddedPDF(element);
            }
        }
        
        // Strategy 2: Look for PDF.js viewers
        totalDates += this.scanPDFjsViewers();
        
        // Strategy 3: Look for text that might be from a PDF
        totalDates += this.scanTextContent();
        
        if (totalDates > 0) {
            console.log(`✅ Found ${totalDates} date(s) in PDFs`);
            this.showNotification(`📅 Found ${totalDates} date(s) in PDFs`, '#4CAF50');
            this.shareWithMainExtractor();
        }
        
        return totalDates;
    }
    
    async scanIframePDF(iframe) {
        let datesFound = 0;
        
        try {
            // Try to access iframe document
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) {
                console.log('Cannot access iframe document (CORS)');
                return 0;
            }
            
            // Check for PDF.js viewer
            const isPDFjs = iframeDoc.querySelector('.textLayer, .pdfViewer');
            
            if (isPDFjs) {
                // PDF.js viewer - extract text from text layer
                datesFound += this.extractFromPDFjsViewer(iframeDoc);
            } else {
                // Regular iframe - extract all text
                datesFound += this.extractAllText(iframeDoc.body);
            }
            
        } catch (error) {
            console.log('Error accessing iframe:', error.message);
            
            // Alternative: Try to get text via OCR/rendering simulation
            datesFound += this.simulateTextExtraction(iframe);
        }
        
        return datesFound;
    }
    
    async scanEmbeddedPDF(embed) {
        try {
            const doc = embed.contentDocument || embed.contentWindow?.document;
            if (doc) {
                return this.extractAllText(doc.body);
            }
        } catch (error) {
            console.log('Cannot access embedded PDF:', error.message);
        }
        return 0;
    }
    
    scanPDFjsViewers() {
        let datesFound = 0;
        
        // Look for PDF.js viewers in main document
        const textLayers = document.querySelectorAll('.textLayer, .text-layer');
        textLayers.forEach(layer => {
            const text = layer.textContent || '';
            const dates = this.extractDates(text);
            datesFound += dates.length;
            
            // Highlight dates if we can
            if (dates.length > 0) {
                this.highlightDatesInElement(layer, dates);
            }
        });
        
        return datesFound;
    }
    
    scanTextContent() {
        let datesFound = 0;
        
        // Look for large text blocks that might be PDF content
        const selectors = [
            '.d2l-htmlblock-untrusted',
            '.user_content',
            '.vtbegenerated',
            '[class*="content"]',
            '[class*="document"]',
            'article',
            'section'
        ];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const text = element.textContent || '';
                if (text.length > 500) { // Likely a document
                    const dates = this.extractDates(text);
                    datesFound += dates.length;
                    
                    if (dates.length > 0) {
                        console.log(`Found ${dates.length} dates in ${selector}`);
                        this.highlightDatesInElement(element, dates);
                    }
                }
            });
        });
        
        return datesFound;
    }
    
    extractFromPDFjsViewer(doc) {
        let datesFound = 0;
        
        // PDF.js stores text in spans within .textLayer
        const textSpans = doc.querySelectorAll('.textLayer span, .text-layer span');
        textSpans.forEach(span => {
            const text = span.textContent || '';
            const dates = this.extractDates(text);
            datesFound += dates.length;
            
            if (dates.length > 0) {
                this.highlightTextNode(span, dates);
            }
        });
        
        return datesFound;
    }
    
    extractAllText(element) {
        const text = element.textContent || '';
        const dates = this.extractDates(text);
        
        if (dates.length > 0) {
            console.log(`Found ${dates.length} dates in PDF content`);
            this.highlightDatesInElement(element, dates);
        }
        
        return dates.length;
    }
    
    simulateTextExtraction(iframe) {
        // Try to extract text by simulating user interaction
        let datesFound = 0;
        
        // Method 1: Try to get text via canvas (for rendered PDFs)
        const canvases = iframe.contentDocument?.querySelectorAll('canvas');
        if (canvases && canvases.length > 0) {
            console.log('PDF appears to be canvas-rendered, trying alternative extraction');
            
            // Look for text overlay
            const parent = iframe.parentElement;
            const textOverlay = parent?.querySelector('.textLayer, .text-layer');
            if (textOverlay) {
                datesFound += this.extractAllText(textOverlay);
            }
        }
        
        return datesFound;
    }
    
    extractDates(text) {
        const dates = [];
        
        this.datePatterns.forEach((pattern, index) => {
            pattern.lastIndex = 0;
            let match;
            
            while ((match = pattern.exec(text)) !== null) {
                const dateText = match[0].trim();
                
                // Skip false positives
                if (this.isFalsePositive(dateText)) continue;
                
                // Skip duplicates
                const isDuplicate = dates.some(d => 
                    d.text === dateText && Math.abs(d.index - match.index) < 5
                );
                
                if (!isDuplicate) {
                    dates.push({
                        text: dateText,
                        index: match.index,
                        pattern: index
                    });
                }
            }
        });
        
        return dates;
    }
    
    isFalsePositive(text) {
        const lower = text.toLowerCase();
        const falsePositives = [
            /^\d+$/,
            /^\d+\.\d+$/,
            /^\d+:\d+$/,
            /^page\s+\d+/i,
            /^http/i,
            /^\d+%\s*$/,
            /^\(\d+\)$/,
            /^\d+[-–]\d+$/
        ];
        
        return falsePositives.some(fp => fp.test(lower));
    }
    
    highlightDatesInElement(element, dates) {
        try {
            const originalHTML = element.innerHTML;
            let modifiedHTML = originalHTML;
            
            // Sort dates by position (last to first)
            dates.sort((a, b) => b.index - a.index);
            
            dates.forEach(date => {
                const escaped = this.escapeRegExp(date.text);
                const regex = new RegExp(`(${escaped})`, 'gi');
                
                const highlight = `<span class="lms-pdf-date" 
                                        style="background:#FFEB3B;color:#000;padding:2px 4px;border-radius:3px;font-weight:bold;border:2px solid #FFC107;cursor:pointer;"
                                        data-date="${this.escapeHTML(date.text)}"
                                        onclick="window.lmsPDFExtractor?.onDateClick(this, '${this.escapeHTML(date.text)}')">
                                    ${this.escapeHTML(date.text)}
                                  </span>`;
                
                modifiedHTML = modifiedHTML.replace(regex, highlight);
                this.extractedDates.add(date.text);
            });
            
            if (modifiedHTML !== originalHTML) {
                element.innerHTML = modifiedHTML;
            }
        } catch (error) {
            console.error('Error highlighting dates:', error);
        }
    }
    
    highlightTextNode(textNode, dates) {
        try {
            let html = textNode.textContent;
            dates.sort((a, b) => b.index - a.index);
            
            dates.forEach(date => {
                const escaped = this.escapeRegExp(date.text);
                const regex = new RegExp(`(${escaped})`, 'g');
                
                const highlight = `<span class="lms-pdf-date" 
                                        style="background:#FFEB3B;color:#000;padding:2px 4px;border-radius:3px;font-weight:bold;border:2px solid #FFC107;cursor:pointer;"
                                        data-date="${this.escapeHTML(date.text)}">
                                    ${this.escapeHTML(date.text)}
                                  </span>`;
                
                html = html.replace(regex, highlight);
                this.extractedDates.add(date.text);
            });
            
            const span = document.createElement('span');
            span.innerHTML = html;
            textNode.parentNode.replaceChild(span, textNode);
        } catch (error) {
            console.error('Error highlighting text node:', error);
        }
    }
    
    onDateClick(element, dateText) {
        // Flash effect
        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = '#FFD54F';
        element.style.borderColor = '#FFA000';
        
        setTimeout(() => {
            element.style.backgroundColor = originalBg;
            element.style.borderColor = '#FFC107';
        }, 300);
        
        // Show tooltip
        this.showDateTooltip(element, dateText);
        
        console.log('📅 PDF date clicked:', dateText);
    }
    
    showDateTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.textContent = `📅 ${text}`;
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10000;
            pointer-events: none;
            max-width: 250px;
            font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.top + window.scrollY - 40}px`;
        
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.remove();
            }
        }, 2000);
    }
    
    shareWithMainExtractor() {
        try {
            const dates = Array.from(this.extractedDates);
            
            // Dispatch event for main LMS extractor
            const event = new CustomEvent('pdfDatesExtracted', {
                detail: { 
                    dates: dates,
                    source: 'lms-pdf-extractor',
                    count: dates.length
                }
            });
            window.dispatchEvent(event);
            
            // Try to share with main extractor
            if (window.lmsExtractor && typeof window.lmsExtractor.addDates === 'function') {
                window.lmsExtractor.addDates(dates);
                console.log(`📤 Shared ${dates.length} PDF dates with main extractor`);
            }
        } catch (error) {
            console.log('Could not share dates:', error.message);
        }
    }
    
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            border-radius: 8px;
            z-index: 10000;
            font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-weight: bold;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    getDates() {
        return Array.from(this.extractedDates);
    }
}

// ====== MAIN LMS EXTRACTOR WITH PDF SUPPORT ======
// This should replace your current lms-extractor.js
console.log('🎓 Enhanced LMS Extractor loading...');

class EnhancedLMSExtractor {
    constructor() {
        this.extractedDates = new Set();
        this.lmsPlatform = null;
        this.pdfExtractor = null;
        
        this.init();
    }
    
    init() {
        console.log('🎓 Enhanced LMS Extractor initializing...');
        
        // Detect LMS platform
        this.detectPlatform();
        
        // Initialize PDF extractor if we're on an LMS
        if (this.lmsPlatform) {
            console.log(`🎓 Detected ${this.lmsPlatform}, initializing PDF support...`);
            this.pdfExtractor = new LMSPDFExtractor();
            
            // Listen for PDF dates
            window.addEventListener('pdfDatesExtracted', (event) => {
                console.log(`Received ${event.detail.count} dates from PDF extractor`);
                this.addDates(event.detail.dates);
            });
        }
        
        // Auto-extract after page loads
        setTimeout(() => {
            this.autoExtract();
        }, 3000);
    }
    
    detectPlatform() {
        const url = window.location.href.toLowerCase();
        const hostname = window.location.hostname.toLowerCase();
        
        if (hostname.includes('brightspace') || hostname.includes('d2l') || url.includes('/d2l/')) {
            this.lmsPlatform = 'Brightspace/D2L';
        } else if (hostname.includes('canvas') || hostname.includes('instructure')) {
            this.lmsPlatform = 'Canvas';
        } else if (hostname.includes('blackboard')) {
            this.lmsPlatform = 'Blackboard';
        } else if (hostname.includes('moodle')) {
            this.lmsPlatform = 'Moodle';
        } else if (url.includes('syllabus') || url.includes('assignment') || url.includes('course')) {
            this.lmsPlatform = 'Generic LMS';
        }
    }
    
    async autoExtract() {
        console.log('🔍 Auto-extracting from LMS...');
        
        // Step 1: Extract from LMS page structure
        const lmsDates = await this.extractFromLMSStructure();
        
        // Step 2: If we have a PDF extractor, let it scan PDFs
        if (this.pdfExtractor && this.pdfExtractor.hasPDFs) {
            console.log('📄 Found PDFs, scanning them...');
            // PDF extractor will run automatically and share dates via events
        }
        
        // Step 3: Also scan page text as fallback
        const textDates = this.scanPageText();
        
        const totalDates = lmsDates.length + textDates.length;
        console.log(`📊 Total dates found: ${totalDates}`);
        
        if (totalDates > 0) {
            this.showSummary(totalDates);
        }
    }
    
    async extractFromLMSStructure() {
        console.log('🔍 Extracting from LMS structure...');
        const dates = [];
        
        // Platform-specific extraction logic
        switch (this.lmsPlatform) {
            case 'Brightspace/D2L':
                dates.push(...this.extractFromD2L());
                break;
            case 'Canvas':
                dates.push(...this.extractFromCanvas());
                break;
            case 'Blackboard':
                dates.push(...this.extractFromBlackboard());
                break;
            case 'Moodle':
                dates.push(...this.extractFromMoodle());
                break;
            default:
                dates.push(...this.extractFromGeneric());
        }
        
        console.log(`Found ${dates.length} dates in LMS structure`);
        return dates;
    }
    
    extractFromD2L() {
        const dates = [];
        
        // D2L-specific extraction
        const d2lSelectors = [
            '.d2l-htmlblock-untrusted',
            'd2l-html-block',
            '.d2l-richtext-editor',
            '.d2l-textblock'
        ];
        
        d2lSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const text = element.textContent || '';
                const foundDates = this.extractDatesFromText(text);
                dates.push(...foundDates);
            });
        });
        
        return dates;
    }
    
    extractFromCanvas() {
        const dates = [];
        const selectors = ['.user_content', '.assignment-description', '.discussion-entry'];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const text = element.textContent || '';
                const foundDates = this.extractDatesFromText(text);
                dates.push(...foundDates);
            });
        });
        
        return dates;
    }
    
    extractFromBlackboard() {
        const dates = [];
        const selectors = ['.vtbegenerated', '.content', '.details'];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const text = element.textContent || '';
                const foundDates = this.extractDatesFromText(text);
                dates.push(...foundDates);
            });
        });
        
        return dates;
    }
    
    extractFromMoodle() {
        const dates = [];
        const selectors = ['.content', '.posting', '.forum-post'];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const text = element.textContent || '';
                const foundDates = this.extractDatesFromText(text);
                dates.push(...foundDates);
            });
        });
        
        return dates;
    }
    
    extractFromGeneric() {
        const dates = [];
        const selectors = [
            'article',
            'main',
            '.content',
            '.main-content',
            '#content',
            '[class*="content"]',
            '[class*="assignment"]',
            '[class*="syllabus"]'
        ];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const text = element.textContent || '';
                if (text.length > 100) { // Only scan substantial content
                    const foundDates = this.extractDatesFromText(text);
                    dates.push(...foundDates);
                }
            });
        });
        
        return dates;
    }
    
    scanPageText() {
        const dates = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return node.textContent.trim().length > 3 ? 
                           NodeFilter.FILTER_ACCEPT : 
                           NodeFilter.FILTER_REJECT;
                }
            }
        );
        
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent;
            const foundDates = this.extractDatesFromText(text);
            dates.push(...foundDates);
        }
        
        console.log(`Found ${dates.length} dates in page text`);
        return dates;
    }
    
    extractDatesFromText(text) {
        const dates = [];
        const patterns = [
            /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
            /\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/g,
            /(?:due\s*|deadline\s*|exam\s*|assignment\s*)[:;\-\s]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+\d{1,2}\b/gi
        ];
        
        patterns.forEach(pattern => {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(text)) !== null) {
                const dateText = match[0].trim();
                if (dateText.length > 4) { // Skip very short matches
                    dates.push(dateText);
                    this.extractedDates.add(dateText);
                }
            }
        });
        
        return dates;
    }
    
    addDates(dates) {
        dates.forEach(date => {
            if (date && !this.extractedDates.has(date)) {
                this.extractedDates.add(date);
            }
        });
        
        console.log(`Total unique dates: ${this.extractedDates.size}`);
        return this.extractedDates.size;
    }
    
    showSummary(count) {
        const summary = document.createElement('div');
        summary.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-weight: bold;
            cursor: pointer;
        `;
        
        summary.textContent = `📅 Found ${count} academic dates`;
        summary.title = 'Click to view dates';
        
        summary.addEventListener('click', () => {
            this.showDatesModal();
            summary.remove();
        });
        
        document.body.appendChild(summary);
        
        setTimeout(() => {
            if (summary.parentNode) {
                summary.remove();
            }
        }, 10000);
    }
    
    showDatesModal() {
        const dates = Array.from(this.extractedDates);
        if (dates.length === 0) return;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; width: 500px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column;">
                <div style="padding: 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #2c3e50;">Academic Dates Found</h3>
                    <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" 
                            style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    ${dates.map(date => `
                        <div style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #4CAF50;">
                            <div style="font-weight: 600; color: #2c3e50;">${date}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="padding: 16px; border-top: 1px solid #e0e0e0; text-align: center;">
                    <button onclick="navigator.clipboard.writeText(${JSON.stringify(dates.join('\\n'))})"
                            style="background: #2196F3; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; cursor: pointer; margin-right: 10px;">
                        Copy Dates
                    </button>
                    <button onclick="this.closest('[style*=\"position: fixed\"]').remove()"
                            style="background: #f5f5f5; color: #333; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    getDates() {
        return Array.from(this.extractedDates);
    }
}

// Initialize
window.lmsExtractor = new EnhancedLMSExtractor();