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
        console.log('🔍 Parsing text for dates...');
        
        const patterns = [
            // Format: "Homework due January 15, 2024 at 11:59 PM"
            {
                regex: /(\b\w+\b.*?)\b(due|exam|deadline|submission|test|quiz|midterm|final)\b.*?\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)(?:\.?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.))?/gi,
                handler: (match) => {
                    const [_, title, type, monthStr, day, year, hour, minute, ampm] = match;
                    const month = this.monthMap[monthStr.toLowerCase()];
                    let hourNum = 23, minuteNum = 59; // Default to end of day
                    
                    if (hour && minute && ampm) {
                        hourNum = parseInt(hour);
                        minuteNum = parseInt(minute);
                        if (ampm.toLowerCase().includes('pm') && hourNum < 12) hourNum += 12;
                        if (ampm.toLowerCase().includes('am') && hourNum === 12) hourNum = 0;
                    }
                    
                    return {
                        title: title.trim() + ' ' + type,
                        date: new Date(year, month, parseInt(day), hourNum, minuteNum)
                    };
                }
            },
            // Format: "Midterm Exam: February 20, 2024"
            {
                regex: /([^:]+):\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)(?:\.?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi,
                handler: (match) => {
                    const [_, title, monthStr, day, year] = match;
                    const month = this.monthMap[monthStr.toLowerCase()];
                    return {
                        title: title.trim(),
                        date: new Date(year, month, parseInt(day), 23, 59)
                    };
                }
            },
            // Format: "Assignment 3 due 03/30/2024"
            {
                regex: /(\b\w+\b.*?)\b(due|deadline|by)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.))?/gi,
                handler: (match) => {
                    const [_, title, type, month, day, year, hour, minute, ampm] = match;
                    let hourNum = 23, minuteNum = 59;
                    
                    if (hour && minute && ampm) {
                        hourNum = parseInt(hour);
                        minuteNum = parseInt(minute);
                        if (ampm.toLowerCase().includes('pm') && hourNum < 12) hourNum += 12;
                        if (ampm.toLowerCase().includes('am') && hourNum === 12) hourNum = 0;
                    }
                    
                    // Handle both US (MM/DD) and international (DD/MM) formats
                    let monthNum, dayNum;
                    if (parseInt(month) > 12) {
                        // DD/MM format
                        dayNum = parseInt(month);
                        monthNum = parseInt(day) - 1;
                    } else {
                        // MM/DD format
                        monthNum = parseInt(month) - 1;
                        dayNum = parseInt(day);
                    }
                    
                    return {
                        title: title.trim() + ' ' + type,
                        date: new Date(year, monthNum, dayNum, hourNum, minuteNum)
                    };
                }
            },
            // Format with year first: "2024-03-30"
            {
                regex: /(\b\w+\b.*?)\b(due|deadline|by)\s+(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/gi,
                handler: (match) => {
                    const [_, title, type, year, month, day] = match;
                    return {
                        title: title.trim() + ' ' + type,
                        date: new Date(year, parseInt(month) - 1, parseInt(day), 23, 59)
                    };
                }
            }
        ];

        const events = [];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                try {
                    const event = pattern.handler(match);
                    
                    // Validate the date
                    if (event && event.date instanceof Date && !isNaN(event.date.getTime())) {
                        // Remove duplicate events within this parsing session
                        const isDuplicate = events.some(e => 
                            e.title === event.title && 
                            e.date.getTime() === event.date.getTime()
                        );
                        
                        if (!isDuplicate) {
                            events.push(event);
                            console.log('✅ Parsed event:', event.title, event.date);
                        }
                    } else {
                        console.warn('❌ Invalid date for event:', event);
                    }
                } catch (e) {
                    console.warn('Failed to parse date:', match[0], e);
                }
            }
        }
        
        console.log(`📅 Total events parsed: ${events.length}`);
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