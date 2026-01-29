// background.js - COMPLETE FIXED VERSION
console.log('🎯 Syllabus Date Extractor background script STARTED');

// ====== DATE PARSER ======
class BackgroundDateParser {
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
    }

    parseDate(text) {
        console.log('🔍 Parsing text:', text.substring(0, 100));
        
        const patterns = [
            // ====== PATTERN 1: Natural language with "due/deadline" ======
            // "Assignment due January 15, 2024 at 11:59 PM"
            // "Homework due Jan 15"
            // "Project deadline Feb 28th 2024"
            {
                regex: /(\b[\w\s#&-]+\b)\s+(due|deadline|by|submit|submission|exam|test|quiz|assignment|homework|project|midterm|final)\s+(?:on\s+)?(?:by\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,\s*)?(?:\s+(\d{4}))?(?:\s+(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?)?/gi,
                handler: (match) => {
                    const [_, title, type, monthStr, day, year, hour, minute, ampm] = match;
                    const month = this.monthMap[monthStr.toLowerCase()];
                    const currentYear = new Date().getFullYear();
                    
                    // Determine year
                    let eventYear = year ? parseInt(year) : currentYear;
                    
                    // Determine time
                    let hourNum = 23, minuteNum = 59; // Default to end of day
                    if (hour) {
                        hourNum = parseInt(hour);
                        minuteNum = minute ? parseInt(minute) : 0;
                        
                        if (ampm) {
                            const ampmLower = ampm.toLowerCase();
                            if (ampmLower.includes('pm') && hourNum < 12) hourNum += 12;
                            if (ampmLower.includes('am') && hourNum === 12) hourNum = 0;
                        } else if (hourNum < 12) {
                            // Assume PM if no am/pm and hour is < 12 (common for deadlines)
                            hourNum += 12;
                        }
                    }
                    
                    const date = new Date(eventYear, month, parseInt(day), hourNum, minuteNum);
                    
                    // Adjust year if date is in the past
                    if (date < new Date()) {
                        date.setFullYear(date.getFullYear() + 1);
                    }
                    
                    return {
                        title: `${title.trim()} ${type}`,
                        date: date
                    };
                }
            },
            
            // ====== PATTERN 2: Title with colon format ======
            // "Midterm Exam: February 20, 2024"
            // "Quiz 3: Jan 15"
            // "Final Project: March 30th"
            {
                regex: /([^:\n]+):\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,\s*)?(?:\s+(\d{4}))?(?:\s+(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?)?/gi,
                handler: (match) => {
                    const [_, title, monthStr, day, year, hour, minute, ampm] = match;
                    const month = this.monthMap[monthStr.toLowerCase()];
                    const currentYear = new Date().getFullYear();
                    
                    let eventYear = year ? parseInt(year) : currentYear;
                    let hourNum = 23, minuteNum = 59;
                    
                    if (hour) {
                        hourNum = parseInt(hour);
                        minuteNum = minute ? parseInt(minute) : 0;
                        
                        if (ampm) {
                            const ampmLower = ampm.toLowerCase();
                            if (ampmLower.includes('pm') && hourNum < 12) hourNum += 12;
                            if (ampmLower.includes('am') && hourNum === 12) hourNum = 0;
                        }
                    }
                    
                    const date = new Date(eventYear, month, parseInt(day), hourNum, minuteNum);
                    
                    if (date < new Date()) {
                        date.setFullYear(date.getFullYear() + 1);
                    }
                    
                    return {
                        title: title.trim(),
                        date: date
                    };
                }
            },
            
            // ====== PATTERN 3: Standalone dates with context ======
            // "Jan 30 - Drug Quiz #6"
            // "February 15: Assignment 3"
            // "March 20th - Final Exam"
            {
                regex: /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,\s*)?(?:\s+(\d{4}))?(?:\s*[-:]\s*)(.+)/gi,
                handler: (match) => {
                    const [_, monthStr, day, year, title] = match;
                    const month = this.monthMap[monthStr.toLowerCase()];
                    const currentYear = new Date().getFullYear();
                    
                    let eventYear = year ? parseInt(year) : currentYear;
                    const date = new Date(eventYear, month, parseInt(day), 23, 59);
                    
                    if (date < new Date()) {
                        date.setFullYear(date.getFullYear() + 1);
                    }
                    
                    // Determine event type from title
                    let type = 'assignment';
                    const lowerTitle = title.toLowerCase();
                    if (lowerTitle.includes('quiz')) type = 'quiz';
                    if (lowerTitle.includes('test')) type = 'test';
                    if (lowerTitle.includes('exam')) type = 'exam';
                    if (lowerTitle.includes('homework')) type = 'homework';
                    if (lowerTitle.includes('project')) type = 'project';
                    if (lowerTitle.includes('midterm')) type = 'midterm';
                    if (lowerTitle.includes('final')) type = 'final';
                    
                    return {
                        title: `${title.trim()} ${type}`,
                        date: date
                    };
                }
            },
            
            // ====== PATTERN 4: Numeric dates (MM/DD/YYYY or DD/MM/YYYY) ======
            // "Due 01/15/2024"
            // "Assignment by 15/01/2024"
            // "Submit by 3/30/24"
            {
                regex: /(\b[\w\s#&-]+\b)\s+(due|deadline|by|submit|submission)\s+(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?)?/gi,
                handler: (match) => {
                    const [_, title, type, part1, part2, year, hour, minute, ampm] = match;
                    
                    // Parse year (handle 2-digit years)
                    let eventYear = parseInt(year);
                    if (year.length === 2) {
                        eventYear = 2000 + eventYear;
                    }
                    
                    // Determine if part1 is month or day
                    let monthNum, dayNum;
                    const num1 = parseInt(part1);
                    const num2 = parseInt(part2);
                    
                    if (num1 > 12 && num2 <= 12) {
                        // DD/MM format (15/01/2024)
                        dayNum = num1;
                        monthNum = num2 - 1;
                    } else if (num2 > 12 && num1 <= 12) {
                        // MM/DD format (01/15/2024)
                        monthNum = num1 - 1;
                        dayNum = num2;
                    } else {
                        // Ambiguous, assume MM/DD (US format)
                        monthNum = Math.min(num1, num2) - 1;
                        dayNum = Math.max(num1, num2);
                    }
                    
                    // Determine time
                    let hourNum = 23, minuteNum = 59;
                    if (hour) {
                        hourNum = parseInt(hour);
                        minuteNum = minute ? parseInt(minute) : 0;
                        
                        if (ampm) {
                            const ampmLower = ampm.toLowerCase();
                            if (ampmLower.includes('pm') && hourNum < 12) hourNum += 12;
                            if (ampmLower.includes('am') && hourNum === 12) hourNum = 0;
                        }
                    }
                    
                    const date = new Date(eventYear, monthNum, dayNum, hourNum, minuteNum);
                    
                    if (date < new Date()) {
                        date.setFullYear(date.getFullYear() + 1);
                    }
                    
                    return {
                        title: `${title.trim()} ${type}`,
                        date: date
                    };
                }
            },
            
            // ====== PATTERN 5: ISO dates (YYYY-MM-DD) ======
            // "Due 2024-03-30"
            // "Submission: 2024-12-15"
            {
                regex: /(\b[\w\s#&-]+\b)\s+(due|deadline|by|submit|submission|:)\s+(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/gi,
                handler: (match) => {
                    const [_, title, type, year, month, day] = match;
                    const date = new Date(year, parseInt(month) - 1, parseInt(day), 23, 59);
                    
                    if (date < new Date()) {
                        date.setFullYear(date.getFullYear() + 1);
                    }
                    
                    return {
                        title: type === ':' ? title.trim() : `${title.trim()} ${type}`,
                        date: date
                    };
                }
            },
            
            // ====== PATTERN 6: Relative dates ======
            // "Next Monday"
            // "Due next week"
            {
                regex: /(\b[\w\s#&-]+\b)\s+(due|deadline|by)\s+(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)/gi,
                handler: (match) => {
                    const [_, title, type, nextThis, dayOrPeriod] = match;
                    const today = new Date();
                    let targetDate = new Date(today);
                    
                    if (dayOrPeriod === 'week') {
                        targetDate.setDate(today.getDate() + 7);
                    } else if (dayOrPeriod === 'month') {
                        targetDate.setMonth(today.getMonth() + 1);
                    } else {
                        // Day of week
                        const dayMap = {
                            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
                            'thursday': 4, 'friday': 5, 'saturday': 6
                        };
                        const targetDay = dayMap[dayOrPeriod.toLowerCase()];
                        const currentDay = today.getDay();
                        
                        let daysToAdd = targetDay - currentDay;
                        if (daysToAdd <= 0) daysToAdd += 7;
                        if (nextThis.toLowerCase() === 'next') daysToAdd += 7;
                        
                        targetDate.setDate(today.getDate() + daysToAdd);
                    }
                    
                    targetDate.setHours(23, 59, 0, 0);
                    
                    return {
                        title: `${title.trim()} ${type}`,
                        date: targetDate
                    };
                }
            }
        ];

        const events = [];
        const seen = new Set(); // For duplicate detection
        
        for (const pattern of patterns) {
            let match;
            // Reset regex lastIndex
            pattern.regex.lastIndex = 0;
            
            while ((match = pattern.regex.exec(text)) !== null) {
                try {
                    console.log(`✅ Pattern matched: "${match[0]}"`);
                    
                    const event = pattern.handler(match);
                    
                    if (event && event.date instanceof Date && !isNaN(event.date.getTime())) {
                        // Create unique key for duplicate detection
                        const key = `${event.title}|${event.date.getTime()}`;
                        
                        if (!seen.has(key)) {
                            seen.add(key);
                            events.push(event);
                            console.log(`📅 Added: ${event.title} on ${event.date.toDateString()}`);
                        } else {
                            console.log(`↪️ Duplicate skipped: ${event.title}`);
                        }
                    } else {
                        console.warn(`❌ Invalid date for: "${match[0]}"`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Parse error for "${match[0]}":`, e.message);
                }
            }
        }
        
        // Sort events by date
        events.sort((a, b) => a.date - b.date);
        
        console.log(`📊 Total unique events parsed: ${events.length}`);
        return events;
    }
}

const parser = new BackgroundDateParser();

// ====== MESSAGE HANDLER ======
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('='.repeat(50));
    console.log('📩 MESSAGE RECEIVED in background:', request.action);
    console.log('From URL:', sender.url);
    console.log('Text length:', request.text?.length || 0);
    
    if (request.action === 'processCopiedText') {
        console.log('🎉🎉🎉 AUTOMATIC COPY WORKING! 🎉🎉🎉');
        console.log('Text preview:', request.text?.substring(0, 100) || 'No text');
        
        // Send immediate response
        sendResponse({ received: true, success: true });
        
        // Process the text
        if (request.text) {
            processRequest(request).catch(error => {
                console.error('❌ Processing error:', error);
            });
        }
        
        return true; // Keep message channel open
    }
    
    if (request.action === 'popupOpened') {
        console.log('Popup opened');
        // Clear badge when popup opens
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'processClipboardManually') {
        console.log('Manual clipboard check requested');
        sendResponse({ checked: true });
        return true;
    }
    
    if (request.action === 'test') {
        console.log('Test message received');
        sendResponse({ test: 'Background script is working' });
        return true;
    }
    
    console.log('Unknown action:', request.action);
    sendResponse({ error: 'Unknown action' });
    return false;
});

// ====== PROCESS REQUEST ======
async function processRequest(request) {
    try {
        // Parse dates from text
        const events = parser.parseDate(request.text);
        
        if (events.length === 0) {
            console.log('❌ No dates found in text');
            return;
        }
        
        console.log(`✅ Found ${events.length} valid date(s)`);
        
        // Get existing events from storage
        const result = await chrome.storage.local.get(['syllabusEvents']);
        const existingEvents = result.syllabusEvents || [];
        
        console.log(`📊 Existing events in storage: ${existingEvents.length}`);
        
        // Prepare new events with metadata
        const newEvents = events.map(event => {
            // Convert Date to ISO string for storage
            const dateISO = event.date.toISOString();
            
            return {
                title: event.title,
                date: dateISO,  // Store as ISO string
                source: request.url,
                added: new Date().toISOString(),
                autoCaptured: true
            };
        });
        
        // Filter out duplicates (compare by title and date)
        const existingKeys = new Set();
        existingEvents.forEach(event => {
            if (event.title && event.date) {
                try {
                    const eventDate = new Date(event.date);
                    if (!isNaN(eventDate.getTime())) {
                        existingKeys.add(`${event.title}|${eventDate.getTime()}`);
                    }
                } catch (e) {
                    console.warn('Error processing existing event:', e);
                }
            }
        });
        
        const uniqueNewEvents = newEvents.filter(event => {
            try {
                const eventDate = new Date(event.date);
                const key = `${event.title}|${eventDate.getTime()}`;
                return !existingKeys.has(key);
            } catch (e) {
                console.warn('Error checking duplicate:', e);
                return false;
            }
        });
        
        if (uniqueNewEvents.length === 0) {
            console.log('📌 All events already exist in storage');
            return;
        }
        
        console.log(`✨ ${uniqueNewEvents.length} new unique event(s) to save`);
        
        // Combine old and new events
        const allEvents = [...existingEvents, ...uniqueNewEvents];
        
        // Save to storage
        await chrome.storage.local.set({ syllabusEvents: allEvents });
        
        console.log(`💾 Saved ${uniqueNewEvents.length} new events (total: ${allEvents.length})`);
        
        // Update extension badge
        updateBadge(uniqueNewEvents.length);
        
    } catch (error) {
        console.error('❌ Error processing request:', error);
        console.error('Error stack:', error.stack);
    }
}

// ====== UPDATE BADGE ======
function updateBadge(newCount) {
    chrome.action.getBadgeText({}, (currentText) => {
        const currentCount = parseInt(currentText) || 0;
        const total = currentCount + newCount;
        
        const badgeText = total > 0 ? total.toString() : '';
        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        
        // Clear badge after 30 seconds
        if (badgeText) {
            setTimeout(() => {
                chrome.action.setBadgeText({ text: '' });
            }, 30000);
        }
        
        console.log(`🔄 Badge updated: ${currentCount} → ${total}`);
    });
}

// ====== CLEANUP OLD EVENTS ======
async function cleanupOldEvents() {
    try {
        const result = await chrome.storage.local.get(['syllabusEvents']);
        const events = result.syllabusEvents || [];
        
        if (events.length === 0) return;
        
        // Filter out events with invalid dates
        const validEvents = events.filter(event => {
            if (!event.date) return false;
            
            try {
                const date = new Date(event.date);
                return date instanceof Date && !isNaN(date.getTime());
            } catch (e) {
                return false;
            }
        });
        
        if (validEvents.length !== events.length) {
            console.log(`🧹 Cleaned up ${events.length - validEvents.length} invalid events`);
            await chrome.storage.local.set({ syllabusEvents: validEvents });
        }
        
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// ====== INITIALIZATION ======
async function initialize() {
    console.log('🚀 Initializing background script...');
    
    // Clean up any old/invalid events
    await cleanupOldEvents();
    
    // Log startup info
    console.log('✅ Background script ready');
    console.log('📋 Listening for messages...');
    console.log('🎯 Automatic copy processing: ACTIVE');
}

// Start initialization
initialize();

// Export for testing (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BackgroundDateParser };
}