// date-scanner.js
// Core date detection for scrollbar indicators

console.log('📍 Date Scanner initialized (scrollbar version)');

class DateScanner {
    constructor() {
        this.monthMap = {
            'january': 0, 'jan': 0, 'jan.': 0,
            'february': 1, 'feb': 1, 'feb.': 1,
            'march': 2, 'mar': 2, 'mar.': 2,
            'april': 3, 'apr': 3, 'apr.': 3,
            'may': 4, 'may.': 4,
            'june': 5, 'jun': 5, 'jun.': 5,
            'july': 6, 'jul': 6, 'jul.': 6,
            'august': 7, 'aug': 7, 'aug.': 7,
            'september': 8, 'sep': 8, 'sep.': 8, 'sept': 8, 'sept.': 8,
            'october': 9, 'oct': 9, 'oct.': 9,
            'november': 10, 'nov': 10, 'nov.': 10,
            'december': 11, 'dec': 11, 'dec.': 11
        };
        
        this.academicKeywords = [
            'due', 'deadline', 'exam', 'test', 'quiz', 'assignment',
            'homework', 'project', 'midterm', 'final', 'submission',
            'paper', 'essay', 'lab', 'report', 'presentation'
        ];
        
        this.patterns = [
            // Month + Day patterns
            /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/gi,
            
            // Numeric dates
            /\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/g,
            
            // Day + Month patterns
            /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*/gi
        ];
    }
    
    /**
     * Fast scan for scrollbar indicators
     * Returns array of scroll positions (0-1) where dates are found
     */
    scanForScrollbar() {
        console.log('🔍 Scanning for scrollbar indicators...');
        const startTime = performance.now();
        
        const datePositions = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // Skip invisible nodes
                    if (node.parentElement.tagName === 'SCRIPT' || 
                        node.parentElement.tagName === 'STYLE' ||
                        !node.textContent.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent;
            
            for (const pattern of this.patterns) {
                pattern.lastIndex = 0;
                if (pattern.test(text)) {
                    // Get element position
                    const element = node.parentElement;
                    const rect = element.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const elementTop = rect.top + scrollTop;
                    
                    // Calculate position as percentage of page height
                    const pageHeight = document.documentElement.scrollHeight;
                    const position = elementTop / pageHeight;
                    
                    if (!isNaN(position) && position >= 0 && position <= 1) {
                        datePositions.push({
                            position: position,
                            element: element,
                            text: text.substring(0, 100)
                        });
                    }
                    break; // Found a date in this node, move to next node
                }
            }
            
            // Performance limit
            if (datePositions.length > 500) {
                console.log('⚠️ Hit performance limit (500 dates)');
                break;
            }
        }
        
        const scanTime = performance.now() - startTime;
        console.log(`✅ Found ${datePositions.length} date positions in ${scanTime.toFixed(1)}ms`);
        
        return datePositions;
    }
    
    /**
     * Validate if a date is academically relevant
     */
    isAcademicDate(element) {
        // Check element and its parents for academic keywords
        let current = element;
        let depth = 0;
        
        while (current && depth < 5) {
            const text = current.textContent || '';
            const lowerText = text.toLowerCase();
            
            for (const keyword of this.academicKeywords) {
                if (lowerText.includes(keyword)) {
                    return true;
                }
            }
            
            current = current.parentElement;
            depth++;
        }
        
        return false;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateScanner;
}

// Create global instance
window.DateScanner = DateScanner;
console.log('✅ Date Scanner ready (scrollbar mode)');