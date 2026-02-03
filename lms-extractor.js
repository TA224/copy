// lms-extractor.js - EXTRACTS FROM ALL LMS PLATFORMS
console.log('🎓 LMS Extractor loaded');

class LMSExtractor {
    constructor() {
        this.lmsPatterns = {
            // Brightspace/D2L
            d2l: {
                selectors: [
                    '.d2l-htmlblock-untrusted',
                    'd2l-html-block',
                    '.d2l-richtext-editor',
                    '[data-bsi-html-block]'
                ],
                shadowRoot: true,
                attribute: 'html'
            },
            // Canvas
            canvas: {
                selectors: [
                    '.user_content',
                    '.discussion-entry',
                    '.assignment-description',
                    '.page-content'
                ],
                shadowRoot: false
            },
            // Blackboard
            blackboard: {
                selectors: [
                    '.vtbegenerated',
                    '.content',
                    '.details'
                ],
                shadowRoot: false
            },
            // Moodle
            moodle: {
                selectors: [
                    '.content',
                    '.posting',
                    '.forum-post'
                ],
                shadowRoot: false
            },
            // Generic
            generic: {
                selectors: [
                    '[class*="content"]',
                    '[class*="post"]',
                    '[class*="assignment"]',
                    '[class*="quiz"]',
                    '[class*="exam"]',
                    'article',
                    'main',
                    '.content-area'
                ],
                shadowRoot: false
            }
        };
        
        this.datePatterns = this.getAcademicDatePatterns();
    }
    
    // ====== MAIN EXTRACTION METHOD ======
    async extractDatesFromPage() {
        console.log('🔍 Extracting dates from LMS page...');
        
        // Try each LMS platform
        const dates = [];
        
        for (const [platform, config] of Object.entries(this.lmsPatterns)) {
            console.log(`Trying ${platform} extraction...`);
            
            const platformDates = await this.extractFromPlatform(platform, config);
            dates.push(...platformDates);
            
            if (platformDates.length > 0) {
                console.log(`✅ Found ${platformDates.length} dates in ${platform}`);
            }
        }
        
        // Deduplicate
        const uniqueDates = this.deduplicateDates(dates);
        
        console.log(`📊 Total unique dates found: ${uniqueDates.length}`);
        return uniqueDates;
    }
    
    async extractFromPlatform(platform, config) {
        const dates = [];
        
        for (const selector of config.selectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
                try {
                    const elementDates = await this.extractFromElement(element, config);
                    dates.push(...elementDates);
                } catch (error) {
                    console.warn(`Error extracting from ${selector}:`, error);
                }
            }
        }
        
        return dates;
    }
    
    async extractFromElement(element, config) {
        const dates = [];
        
        if (config.shadowRoot) {
            // Handle shadow DOM elements
            dates.push(...await this.extractFromShadowElement(element, config));
        } else {
            // Handle regular elements
            dates.push(...this.extractFromRegularElement(element));
        }
        
        return dates;
    }
    
    // ====== SHADOW DOM EXTRACTION (for D2L) ======
    async extractFromShadowElement(element, config) {
        const dates = [];
        
        // Method 1: Try to get HTML from attribute
        if (config.attribute && element.hasAttribute(config.attribute)) {
            const html = element.getAttribute(config.attribute);
            if (html) {
                dates.push(...this.extractFromHTML(html, 'shadow-attribute'));
            }
        }
        
        // Method 2: Try to access shadow root
        try {
            const shadowRoot = element.shadowRoot || element.openOrClosedShadowRoot;
            if (shadowRoot) {
                dates.push(...this.extractFromShadowRoot(shadowRoot));
            }
        } catch (e) {
            console.warn('Cannot access shadow root:', e);
        }
        
        // Method 3: Try to get text from light DOM
        dates.push(...this.extractFromRegularElement(element));
        
        return dates;
    }
    
    extractFromShadowRoot(shadowRoot) {
        const dates = [];
        
        // Get all text nodes in shadow root
        const walker = document.createTreeWalker(
            shadowRoot,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent;
            if (text.trim().length > 3) {
                const foundDates = this.findDatesInText(text);
                dates.push(...foundDates.map(date => ({
                    ...date,
                    source: 'shadow-dom',
                    element: node.parentElement
                })));
            }
        }
        
        // Also check for nested shadow roots
        const nestedShadows = shadowRoot.querySelectorAll('*');
        nestedShadows.forEach(child => {
            if (child.shadowRoot) {
                dates.push(...this.extractFromShadowRoot(child.shadowRoot));
            }
        });
        
        return dates;
    }
    
    // ====== REGULAR ELEMENT EXTRACTION ======
    extractFromRegularElement(element) {
        const dates = [];
        
        // Get text content
        const text = this.getElementText(element);
        if (text && text.length > 10) {
            const foundDates = this.findDatesInText(text);
            dates.push(...foundDates.map(date => ({
                ...date,
                source: 'regular-dom',
                element: element
            })));
        }
        
        return dates;
    }
    
    getElementText(element) {
        // Try multiple methods to get text
        
        // Method 1: textContent (fastest)
        let text = element.textContent || '';
        
        // Method 2: innerText (preserves formatting)
        if (!text || text.length < 10) {
            text = element.innerText || '';
        }
        
        // Method 3: Check data attributes
        if (!text || text.length < 10) {
            text = element.dataset.content || 
                   element.dataset.text || 
                   element.dataset.html || 
                   '';
        }
        
        // Clean the text
        text = text.replace(/\s+/g, ' ').trim();
        
        return text;
    }
    
    // ====== HTML EXTRACTION (for encoded HTML) ======
    extractFromHTML(html, sourceType) {
        const dates = [];
        
        // Decode HTML entities
        const decodedHTML = this.decodeHTML(html);
        
        // Method 1: Parse as HTML
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(decodedHTML, 'text/html');
            const text = doc.body.textContent || '';
            
            const foundDates = this.findDatesInText(text);
            dates.push(...foundDates.map(date => ({
                ...date,
                source: sourceType + '-parsed',
                context: text.substring(date.index, date.index + 100)
            })));
        } catch (e) {
            console.warn('HTML parsing failed:', e);
        }
        
        // Method 2: Direct text extraction (fallback)
        const directDates = this.findDatesInText(decodedHTML);
        dates.push(...directDates.map(date => ({
            ...date,
            source: sourceType + '-direct',
            context: decodedHTML.substring(date.index, date.index + 100)
        })));
        
        return dates;
    }
    
    decodeHTML(html) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = html;
        return textarea.value;
    }
    
    // ====== DATE PATTERNS ======
    getAcademicDatePatterns() {
        return [
            // Quiz/Exam patterns: "Drug Quiz #7 Feb 3rd"
            {
                regex: /(\bQuiz\s+#?\d+|\bExam\s+#?\d+|\bTest\s+#?\d+|\bAssignment\s+#?\d+|\bHomework\s+#?\d+|\bProject\s+#?\d+)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+(\d{1,2})(?:st|nd|rd|th)?/gi,
                handler: (match) => {
                    return {
                        title: match[1].trim(),
                        month: match[2].toLowerCase(),
                        day: parseInt(match[3]),
                        type: 'assessment'
                    };
                }
            },
            // "LO3 Exam Feb 5th"
            {
                regex: /(\bLO\d+\s+Exam|\bMidterm\s+Exam|\bFinal\s+Exam|\bOpen\s+Book\s+#?\d+)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+(\d{1,2})(?:st|nd|rd|th)?/gi,
                handler: (match) => ({
                    title: match[1].trim(),
                    month: match[2].toLowerCase(),
                    day: parseInt(match[3]),
                    type: 'exam'
                })
            },
            // Generic dates in academic context
            {
                regex: /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:due|deadline|exam|quiz|test|assignment|project|lab|homework))?/gi,
                handler: (match) => ({
                    title: 'Academic date',
                    month: match[1].toLowerCase(),
                    day: parseInt(match[2]),
                    type: 'generic'
                })
            }
        ];
    }
    
    findDatesInText(text) {
        const dates = [];
        
        this.datePatterns.forEach(pattern => {
            let match;
            pattern.regex.lastIndex = 0;
            
            while ((match = pattern.regex.exec(text)) !== null) {
                try {
                    const dateInfo = pattern.handler(match);
                    if (dateInfo) {
                        dates.push({
                            ...dateInfo,
                            originalText: match[0],
                            index: match.index,
                            confidence: this.calculateConfidence(match[0], dateInfo.type)
                        });
                    }
                } catch (e) {
                    console.warn('Error parsing date:', e);
                }
            }
        });
        
        return dates;
    }
    
    calculateConfidence(text, type) {
        let confidence = 0.5;
        
        // Boost for academic keywords
        const academicWords = ['quiz', 'exam', 'assignment', 'due', 'deadline', 'test', 'project', 'homework', 'lab'];
        const lowerText = text.toLowerCase();
        
        academicWords.forEach(word => {
            if (lowerText.includes(word)) confidence += 0.1;
        });
        
        // Boost for specific types
        if (type === 'exam' || type === 'assessment') confidence += 0.2;
        
        return Math.min(confidence, 1.0);
    }
    
    // ====== DEDUPLICATION ======
    deduplicateDates(dates) {
        const seen = new Set();
        const uniqueDates = [];
        
        dates.forEach(date => {
            const key = `${date.title}|${date.month}|${date.day}`;
            
            if (!seen.has(key) && date.confidence > 0.3) {
                seen.add(key);
                
                // Convert to proper Date object
                const fullDate = this.createDateObject(date);
                if (fullDate) {
                    uniqueDates.push({
                        ...date,
                        date: fullDate,
                        formatted: fullDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })
                    });
                }
            }
        });
        
        return uniqueDates;
    }
    
    createDateObject(dateInfo) {
        const monthMap = {
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
        
        const monthNum = monthMap[dateInfo.month];
        if (monthNum === undefined) return null;
        
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, monthNum, dateInfo.day, 23, 59, 0);
    }
    
    // ====== PUBLIC API ======
    async extract() {
        return await this.extractDatesFromPage();
    }
    
    async extractFromSelector(selector) {
        const dates = [];
        const elements = document.querySelectorAll(selector);
        
        for (const element of elements) {
            const elementDates = await this.extractFromElement(element, {
                shadowRoot: element.tagName.includes('-'), // Assume custom elements have shadow DOM
                attribute: 'html'
            });
            dates.push(...elementDates);
        }
        
        return this.deduplicateDates(dates);
    }
}

// ====== BRIGHTSPACE/D2L SPECIFIC EXTRACTOR ======
class D2LExtractor extends LMSExtractor {
    constructor() {
        super();
        console.log('🎓 D2L/Brightspace Extractor loaded');
    }
    
    async extractDatesFromD2L() {
        console.log('Extracting from D2L/Brightspace...');
        
        const dates = [];
        
        // Method 1: Extract from d2l-html-block elements
        const htmlBlocks = document.querySelectorAll('d2l-html-block');
        for (const block of htmlBlocks) {
            dates.push(...await this.extractFromD2LHtmlBlock(block));
        }
        
        // Method 2: Extract from .d2l-htmlblock-untrusted
        const untrustedBlocks = document.querySelectorAll('.d2l-htmlblock-untrusted');
        for (const block of untrustedBlocks) {
            dates.push(...this.extractFromD2LUntrustedBlock(block));
        }
        
        // Method 3: Extract from news/announcements
        dates.push(...this.extractFromD2LNews());
        
        // Method 4: Extract from content areas
        dates.push(...this.extractFromD2LContent());
        
        return this.deduplicateDates(dates);
    }
    
    async extractFromD2LHtmlBlock(block) {
        const dates = [];
        
        // Try to get HTML from attribute
        const html = block.getAttribute('html');
        if (html) {
            dates.push(...this.extractFromHTML(html, 'd2l-html-attribute'));
        }
        
        // Try to access shadow DOM
        try {
            const shadowRoot = block.shadowRoot;
            if (shadowRoot) {
                // Look for content inside shadow DOM
                const content = shadowRoot.querySelector('.d2l-html-block-content') || 
                               shadowRoot.querySelector('slot') ||
                               shadowRoot;
                
                if (content) {
                    const text = content.textContent || '';
                    if (text) {
                        dates.push(...this.findDatesInText(text).map(date => ({
                            ...date,
                            source: 'd2l-shadow-dom'
                        })));
                    }
                }
            }
        } catch (e) {
            console.warn('Cannot access D2L shadow DOM:', e);
        }
        
        return dates;
    }
    
    extractFromD2LUntrustedBlock(block) {
        const dates = [];
        
        // The HTML might be in child elements
        const children = block.querySelectorAll('*');
        
        // Check each child for text
        children.forEach(child => {
            const text = child.textContent || '';
            if (text.trim().length > 3) {
                dates.push(...this.findDatesInText(text).map(date => ({
                    ...date,
                    source: 'd2l-untrusted',
                    element: child
                })));
            }
        });
        
        // Also check the block itself
        const blockText = block.textContent || '';
        if (blockText.trim().length > 3) {
            dates.push(...this.findDatesInText(blockText).map(date => ({
                ...date,
                source: 'd2l-untrusted-block'
            })));
        }
        
        return dates;
    }
    
    extractFromD2LNews() {
        const dates = [];
        
        // Look for news/announcement items
        const newsItems = document.querySelectorAll('.d2l-datalist-item-content, .d2l-news-item, [class*="news"], [class*="announcement"]');
        
        newsItems.forEach(item => {
            // Extract from heading
            const heading = item.querySelector('h1, h2, h3, h4, .d2l-heading');
            if (heading) {
                const headingText = heading.textContent || '';
                dates.push(...this.findDatesInText(headingText).map(date => ({
                    ...date,
                    source: 'd2l-news-heading',
                    element: heading
                })));
            }
            
            // Extract from content
            const content = item.textContent || '';
            dates.push(...this.findDatesInText(content).map(date => ({
                ...date,
                source: 'd2l-news-content',
                element: item
            })));
        });
        
        return dates;
    }
    
    extractFromD2LContent() {
        const dates = [];
        
        // Look in various content areas
        const contentSelectors = [
            '.d2l-textblock',
            '.d2l-htmlblock',
            '.d2l-richtext',
            '[class*="content"]',
            '[class*="description"]',
            '[class*="instruction"]'
        ];
        
        contentSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const text = element.textContent || '';
                if (text.trim().length > 10) {
                    dates.push(...this.findDatesInText(text).map(date => ({
                        ...date,
                        source: 'd2l-content',
                        element: element
                    })));
                }
            });
        });
        
        return dates;
    }
}

// ====== AUTO-DETECT AND INITIALIZE ======
(function() {
    console.log('🎓 LMS Auto-detection starting...');
    
    const init = () => {
        // Check if we're on an LMS
        const isD2L = document.querySelector('d2l-html-block, .d2l-htmlblock-untrusted, body[d2l-branding]');
        const isCanvas = document.querySelector('#content, .ic-Dashboard-card, .ic-app');
        const isBlackboard = document.querySelector('.breadcrumbs, .container, .courseMenu');
        const isMoodle = document.querySelector('.navbar, .header, .course-content');
        
        let extractor;
        
        if (isD2L) {
            console.log('Detected D2L/Brightspace');
            extractor = new D2LExtractor();
            window.lmsExtractor = extractor;
            
            // Auto-extract after page loads
            setTimeout(async () => {
                const dates = await extractor.extractDatesFromD2L();
                if (dates.length > 0) {
                    console.log(`✅ Extracted ${dates.length} dates from D2L`);
                    showLMSNotification(dates);
                }
            }, 3000);
            
        } else if (isCanvas || isBlackboard || isMoodle) {
            console.log('Detected LMS platform');
            extractor = new LMSExtractor();
            window.lmsExtractor = extractor;
            
            setTimeout(async () => {
                const dates = await extractor.extract();
                if (dates.length > 0) {
                    console.log(`✅ Extracted ${dates.length} dates from LMS`);
                    showLMSNotification(dates);
                }
            }, 3000);
        } else {
            console.log('Not an LMS page');
        }
    };
    
    function showLMSNotification(dates) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            cursor: pointer;
        `;
        
        notification.textContent = `📅 Found ${dates.length} academic dates`;
        notification.title = 'Click to view dates';
        
        notification.addEventListener('click', () => {
            showDatesModal(dates);
            notification.remove();
        });
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }
    
    function showDatesModal(dates) {
        // Create modal to show dates
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10001;
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
                    ${dates.slice(0, 20).map(date => `
                        <div style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #4CAF50;">
                            <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">
                                ${date.title}
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px;">
                                <span style="color: #666;">${date.formatted || date.date.toLocaleDateString()}</span>
                                <span style="color: #888; font-size: 12px;">${date.type}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="padding: 16px; border-top: 1px solid #e0e0e0; text-align: center;">
                    <button onclick="window.lmsExtractor.exportDates(${JSON.stringify(dates)})"
                            style="background: #4CAF50; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; cursor: pointer;">
                        Export to Calendar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 1000);
        });
    } else {
        setTimeout(init, 1000);
    }
})();