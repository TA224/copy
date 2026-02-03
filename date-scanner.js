// date-scanner.js - FIXED FOR NEGATIVE POSITIONS
console.log('📍 Date Scanner loaded (fixing negative positions)');

class DateScanner {
    constructor() {
        this.patterns = [
            /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+\d{1,2}(?:st|nd|rd|th)?/gi,
            /\b\d{1,2}(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*/gi,
            /\b\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?\b/g,
        ];
    }
    
    scanForPositions() {
        console.log('🔍 Scanning for dates...');
        
        if (this.isPDFViewer()) {
            console.log('📄 PDF viewer detected');
            return this.scanPDFAllElements();
        } else {
            return this.scanRegularPage();
        }
    }
    
    isPDFViewer() {
        return window.location.href.includes('pdfjs') || 
               document.querySelector('.textLayer, .text-layer, #viewer, .pdfViewer');
    }
    
    // NEW: Scan ALL elements in PDF, including those above/below viewport
    scanPDFAllElements() {
        const positions = [];
        const seenKeys = new Set();
        
        // Get viewport dimensions
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Get all elements in text layers
        const textElements = document.querySelectorAll('.textLayer *, .text-layer *');
        console.log(`Found ${textElements.length} elements in text layers`);
        
        // Also get text nodes directly
        const textNodes = this.getTextNodes();
        console.log(`Found ${textNodes.length} text nodes`);
        
        // Combine both approaches
        const allElements = [...textElements];
        
        // Process each element
        allElements.forEach(element => {
            const text = element.textContent || '';
            const trimmed = text.trim();
            
            if (trimmed.length > 0) {
                const dates = this.findDatesInString(trimmed);
                
                dates.forEach(dateMatch => {
                    const rect = element.getBoundingClientRect();
                    
                    // FIX: Allow negative coordinates! Elements can be above viewport
                    // Only require that element has dimensions
                    if (rect.width > 0 && rect.height > 0 && rect.width < 300) {
                        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                        const elementTop = rect.top + scrollTop;
                        const pageHeight = document.documentElement.scrollHeight;
                        const position = elementTop / pageHeight;
                        
                        // FIX: Allow positions outside 0-1 range during PDF loading
                        // Elements can be above (negative) or below (>100%) the viewport
                        
                        // Create unique key
                        const uniqueKey = `${dateMatch.text}|${rect.left.toFixed(1)}|${rect.top.toFixed(1)}`;
                        
                        if (!seenKeys.has(uniqueKey)) {
                            positions.push({
                                position: position,
                                element: element,
                                text: dateMatch.text,
                                isAcademic: this.isAcademicText(dateMatch.text, element),
                                relevance: 1.0,
                                rect: rect,
                                inViewport: this.isInViewport(rect)
                            });
                            seenKeys.add(uniqueKey);
                        }
                    }
                });
            }
        });
        
        // FIX: Also process text nodes (might find more dates)
        textNodes.forEach(nodeInfo => {
            const text = nodeInfo.text;
            const element = nodeInfo.element;
            const dates = this.findDatesInString(text);
            
            dates.forEach(dateMatch => {
                const rect = element.getBoundingClientRect();
                
                if (rect.width > 0 && rect.height > 0) {
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const elementTop = rect.top + scrollTop;
                    const pageHeight = document.documentElement.scrollHeight;
                    const position = elementTop / pageHeight;
                    
                    const uniqueKey = `${dateMatch.text}|${rect.left.toFixed(1)}|${rect.top.toFixed(1)}`;
                    
                    if (!seenKeys.has(uniqueKey)) {
                        positions.push({
                            position: position,
                            element: element,
                            text: dateMatch.text,
                            isAcademic: this.isAcademicText(dateMatch.text, element),
                            relevance: 1.0,
                            rect: rect,
                            inViewport: this.isInViewport(rect)
                        });
                        seenKeys.add(uniqueKey);
                    }
                }
            });
        });
        
        console.log(`Found ${positions.length} date positions (including off-screen)`);
        
        // Filter out positions that are way outside reasonable bounds
        const filteredPositions = positions.filter(pos => {
            // Allow some negative positions (elements above viewport)
            // Allow positions > 100% (elements below viewport)
            // But filter extreme outliers
            return pos.position > -5 && pos.position < 5; // Allow -500% to +500%
        });
        
        // Sort by position
        filteredPositions.sort((a, b) => a.position - b.position);
        
        // Debug output
        console.log('All date positions:');
        filteredPositions.forEach((pos, i) => {
            console.log(`${i+1}. "${pos.text}" at ${(pos.position*100).toFixed(1)}% (${pos.rect.width}x${pos.rect.height}px) ${pos.inViewport ? '[VISIBLE]' : '[OFF-SCREEN]'}`);
        });
        
        return filteredPositions;
    }
    
    // Get text nodes from PDF
    getTextNodes() {
        const textNodes = [];
        
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Only accept nodes in PDF viewer
                    if (!node.parentElement) return NodeFilter.FILTER_REJECT;
                    
                    // Check if in PDF text layer
                    const parent = node.parentElement;
                    const isInPDF = parent.closest('.textLayer, .text-layer, #viewer, .pdfViewer');
                    
                    if (!isInPDF) return NodeFilter.FILTER_REJECT;
                    
                    const text = node.textContent || '';
                    return text.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );
        
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push({
                node: node,
                element: node.parentElement,
                text: node.textContent
            });
        }
        
        return textNodes;
    }
    
    // Check if element is in viewport
    isInViewport(rect) {
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );
    }
    
    // Find dates in string
    findDatesInString(text) {
        const matches = [];
        
        for (const pattern of this.patterns) {
            pattern.lastIndex = 0;
            const patternMatches = text.matchAll(pattern);
            
            for (const match of patternMatches) {
                if (match[0].length >= 4) {
                    const cleanText = match[0].trim();
                    
                    // Skip false positives
                    if (!this.isFalsePositive(cleanText)) {
                        matches.push({
                            text: cleanText,
                            index: match.index
                        });
                    }
                }
            }
        }
        
        // Deduplicate
        const uniqueMatches = [];
        const seen = new Set();
        
        matches.forEach(match => {
            if (!seen.has(match.text)) {
                uniqueMatches.push(match);
                seen.add(match.text);
            }
        });
        
        return uniqueMatches;
    }
    
    // Check for false positives
    isFalsePositive(text) {
        const lower = text.toLowerCase();
        const falsePositives = [
            /^\d+$/, // Just numbers
            /^\d+\.\d+$/, // Decimals
            /^\d+:\d+/, // Times
            /^page\s+\d+/i,
            /^chapter\s+\d+/i
        ];
        
        return falsePositives.some(fp => fp.test(lower));
    }
    
    // Check if text is academic
    isAcademicText(text, element) {
        const lower = text.toLowerCase();
        const academicWords = ['quiz', 'exam', 'assignment', 'due', 'deadline', 'test', 'project'];
        
        for (const word of academicWords) {
            if (lower.includes(word)) return true;
        }
        
        return false;
    }
    
    // Regular page scanning
    scanRegularPage() {
        const positions = [];
        const seen = new Set();
        
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (node.textContent.trim().length < 3) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent;
            const element = node.parentElement;
            
            const matches = this.findDatesInString(text);
            matches.forEach(match => {
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;
                
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const elementTop = rect.top + scrollTop;
                const pageHeight = document.documentElement.scrollHeight;
                const position = elementTop / pageHeight;
                
                const key = `${match.text}-${position.toFixed(4)}`;
                if (position >= 0 && position <= 1 && !seen.has(key)) {
                    positions.push({
                        position: position,
                        element: element,
                        text: match.text,
                        isAcademic: this.isAcademicText(match.text, element),
                        relevance: 1.0
                    });
                    seen.add(key);
                }
            });
            
            if (positions.length > 100) break;
        }
        
        console.log(`Found ${positions.length} dates on regular page`);
        return positions;
    }
}

if (typeof window !== 'undefined') {
    window.DateScanner = DateScanner;
}