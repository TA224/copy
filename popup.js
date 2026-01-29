// Date Parser Class
class DateParser {
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
        
        this.timeMap = {
            'midnight': '00:00',
            'noon': '12:00',
            'am': 'AM',
            'pm': 'PM',
            'a.m.': 'AM',
            'p.m.': 'PM'
        };
    }

    parseDate(text) {
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
                    if (event && event.date instanceof Date && !isNaN(event.date.getTime())) {
                        // Remove duplicate events
                        const isDuplicate = events.some(e => 
                            e.title === event.title && 
                            e.date.getTime() === event.date.getTime()
                        );
                        
                        if (!isDuplicate) {
                            events.push(event);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse date:', match[0], e);
                }
            }
        }
        
        return events;
    }
}

// ICS Generator Class
class ICSGenerator {
    generate(events) {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        let ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Syllabus Date Extractor//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        events.forEach((event, index) => {
            const start = this.formatDate(event.date);
            const end = this.formatDate(new Date(event.date.getTime() + 3600000)); // 1 hour later
            const uid = `${timestamp}-${index}@syllabusextractor`;
            const summary = this.escapeText(event.title);
            
            ics.push(
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${timestamp}`,
                `DTSTART:${start}`,
                `DTEND:${end}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:${summary} - Extracted from syllabus`,
                'END:VEVENT'
            );
        });

        ics.push('END:VCALENDAR');
        return ics.join('\r\n');
    }

    formatDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    escapeText(text) {
        return text.replace(/[\\,;]/g, '\\$&').replace(/\n/g, '\\n');
    }
}

// Main Application
class SyllabusDateExtractor {
    constructor() {
        this.events = [];
        this.parser = new DateParser();
        this.icsGenerator = new ICSGenerator();
        this.init();
    }

    // Add to your SyllabusDateExtractor class methods:
    addClipboardCheckButton() {
        const container = document.querySelector('.controls');
        
        const checkBtn = document.createElement('button');
        checkBtn.id = 'checkClipboardBtn';
        checkBtn.textContent = '🔍 Check Clipboard Now';
        checkBtn.style.cssText = `
            width: 100%;
            margin-top: 10px;
            background: #17a2b8;
            color: white;
        `;
        
        checkBtn.onclick = async () => {
            checkBtn.disabled = true;
            checkBtn.textContent = 'Checking...';
            
            try {
                const response = await chrome.runtime.sendMessage({ 
                    action: 'processClipboardManually' 
                });
                
                if (response) {
                    this.showStatus('Clipboard checked');
                }
                
                // Reload events
                await this.loadEvents();
                this.updateUI();
                
            } catch (error) {
                console.error('Manual check error:', error);
                this.showStatus('Error checking clipboard', true);
            } finally {
                checkBtn.disabled = false;
                checkBtn.textContent = '🔍 Check Clipboard Now';
            }
        };
        
        container.parentNode.insertBefore(checkBtn, container.nextSibling);
    }

    async init() {
        try {
            console.log('Syllabus Date Extractor popup initializing...');
            
            // Notify background that popup is open
            chrome.runtime.sendMessage({ action: 'popupOpened' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Background not available:', chrome.runtime.lastError.message);
                }
            });
            
            // Load events
            await this.loadEvents();
            
            // Setup UI
            this.setupUI();
            this.updateUI();
            
            // Add refresh button
            this.addRefreshButton();

            this.addClipboardCheckButton();
            
            // Setup auto-refresh when storage changes
            this.setupStorageListener();
            
            console.log('Popup initialized with', this.events.length, 'events');
            
        } catch (error) {
            console.error('Error initializing popup:', error);
            this.showStatus('Error loading events. Please try refreshing.', true);
        }
    }

    setupStorageListener() {
        // Listen for storage changes to update UI automatically
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.syllabusEvents) {
                console.log('Storage changed, updating UI...');
                this.loadEvents().then(() => {
                    this.updateUI();
                    this.showStatus('Events updated', false);
                });
            }
        });
    }

    async loadEvents() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['syllabusEvents'], (result) => {
                console.log('🔍 DEBUG - Loading events from storage');
                console.log('Storage result:', result);
                
                try {
                    const rawEvents = result.syllabusEvents || [];
                    console.log(`📊 Found ${rawEvents.length} raw events in storage`);
                    
                    // Log each event to see what's in storage
                    rawEvents.forEach((event, index) => {
                        console.log(`Event ${index + 1}:`, {
                            title: event.title,
                            date: event.date,
                            dateType: typeof event.date,
                            source: event.source,
                            isValidDate: event.date ? !isNaN(new Date(event.date).getTime()) : false
                        });
                    });
                    
                    // Convert date strings to Date objects
                    this.events = rawEvents.map(event => {
                        if (event && event.date) {
                            try {
                                const date = typeof event.date === 'string' ? new Date(event.date) : event.date;
                                const isValid = date instanceof Date && !isNaN(date.getTime());
                                
                                if (isValid) {
                                    return {
                                        ...event,
                                        date: date
                                    };
                                } else {
                                    console.warn('Invalid date in event:', event);
                                    return null;
                                }
                            } catch (error) {
                                console.error('Error parsing date:', error, 'in event:', event);
                                return null;
                            }
                        }
                        return null;
                    }).filter(event => event !== null);
                    
                    console.log(`✅ Processed ${this.events.length} valid events`);
                    console.log('Events ready for display:', this.events);
                    
                } catch (error) {
                    console.error('❌ Error loading events:', error);
                    this.events = [];
                }
                
                resolve();
            });
        });
    }

    setupUI() {
        this.exportBtn = document.getElementById('exportBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.status = document.getElementById('status');
        this.eventsList = document.getElementById('eventsList');
        this.count = document.getElementById('count');

        this.exportBtn.addEventListener('click', () => this.exportToICS());
        this.clearBtn.addEventListener('click', () => this.clearEvents());
        
        // Add manual process button for testing/backup
        this.addManualProcessButton();
    }

    addManualProcessButton() {
        // Only add if not already present
        if (!document.getElementById('manualProcessBtn')) {
            const container = document.querySelector('.controls');
            const manualBtn = document.createElement('button');
            manualBtn.id = 'manualProcessBtn';
            manualBtn.textContent = '📋 Process Clipboard';
            manualBtn.title = 'Manually process clipboard text (fallback)';
            manualBtn.style.cssText = `
                background: #6c757d;
                color: white;
                margin-top: 10px;
                width: 100%;
            `;
            manualBtn.onclick = () => this.processClipboardManually();
            container.parentNode.insertBefore(manualBtn, container.nextSibling);
        }
    }

    addRefreshButton() {
        // Only add if not already present
        if (!document.getElementById('refreshBtn')) {
            const refreshBtn = document.createElement('button');
            refreshBtn.id = 'refreshBtn';
            refreshBtn.textContent = '🔄';
            refreshBtn.title = 'Refresh events';
            refreshBtn.style.cssText = `
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: 2px solid #e0e0e0;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 16px;
                color: #666;
                transition: all 0.2s;
            `;
            refreshBtn.onclick = async () => {
                refreshBtn.style.transform = 'rotate(180deg)';
                await this.loadEvents();
                this.updateUI();
                this.showStatus('Refreshed');
                setTimeout(() => {
                    refreshBtn.style.transform = 'rotate(0deg)';
                }, 300);
            };
            document.querySelector('.container').appendChild(refreshBtn);
        }
    }

    updateUI() {
        console.log('🔄 Updating UI with', this.events.length, 'events');
        
        const eventsList = document.getElementById('eventsList');
        const countElement = document.getElementById('count');
        
        if (this.events.length > 0) {
            // Remove empty state
            const emptyState = eventsList.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            
            eventsList.style.display = 'block';
            eventsList.innerHTML = '';
            
            // Sort by date
            const sortedEvents = [...this.events].sort((a, b) => a.date - b.date);
            
            console.log('📅 Sorted events:', sortedEvents.length);
            
            sortedEvents.forEach((event, index) => {
                console.log(`Displaying event ${index + 1}:`, event.title, event.date);
                
                const div = document.createElement('div');
                div.className = 'event-item';
                div.dataset.index = index;
                
                const dateStr = event.date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                const timeStr = event.date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
                
                div.innerHTML = `
                    <div class="event-title">${this.escapeHTML(event.title)}</div>
                    <div class="event-date">
                        <span style="color: #667eea; font-weight: 600;">📅 ${dateStr}</span>
                        <span style="color: #764ba2;">⏰ ${timeStr}</span>
                    </div>
                    ${event.source ? `<div class="event-source">🔗 ${this.escapeHTML(event.source)}</div>` : ''}
                    ${event.autoCaptured ? `<div class="event-auto">✓ Auto-captured</div>` : ''}
                `;
                
                eventsList.appendChild(div);
            });
            
            countElement.textContent = `${this.events.length} event${this.events.length !== 1 ? 's' : ''} captured`;
            countElement.style.display = 'block';
            this.exportBtn.disabled = false;
            this.clearBtn.disabled = false;
            
        } else {
            console.log('⚠️ No events to display');
            // Show empty state
            eventsList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📋</div>
                    <p>No events yet.</p>
                    <p style="font-size: 12px; color: #666;">Check console for debug info</p>
                </div>
            `;
            eventsList.style.display = 'block';
            countElement.textContent = 'Storage has data but display failed';
            countElement.style.display = 'block';
            this.exportBtn.disabled = true;
            this.clearBtn.disabled = true;
        }
    }
    async removeEvent(index) {
        this.events.splice(index, 1);
        await this.saveEvents();
        this.updateUI();
        this.showStatus('Event removed');
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showStatus(message, isError = false) {
        this.status.textContent = message;
        this.status.className = 'status ' + (isError ? 'error' : 'success');
        this.status.style.display = 'block';
        
        setTimeout(() => {
            this.status.style.display = 'none';
        }, 3000);
    }

    async processClipboardManually() {
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                this.showStatus('Clipboard is empty', true);
                return;
            }

            const newEvents = this.parser.parseDate(text);
            
            if (newEvents.length === 0) {
                this.showStatus('No dates found in clipboard', true);
                return;
            }

            // Add metadata
            const eventsWithMetadata = newEvents.map(event => ({
                ...event,
                source: 'manual_clipboard',
                added: new Date().toISOString(),
                autoCaptured: false
            }));

            // Merge with existing events
            const existingSet = new Set(this.events.map(e => `${e.title}|${e.date.getTime()}`));
            const uniqueNewEvents = eventsWithMetadata.filter(e => 
                !existingSet.has(`${e.title}|${e.date.getTime()}`)
            );

            if (uniqueNewEvents.length === 0) {
                this.showStatus('All dates already captured', false);
                return;
            }

            this.events.push(...uniqueNewEvents);
            await this.saveEvents();
            
            this.showStatus(`Added ${uniqueNewEvents.length} date${uniqueNewEvents.length !== 1 ? 's' : ''} from clipboard`);
            this.updateUI();
            
        } catch (error) {
            console.error('Clipboard error:', error);
            this.showStatus('Clipboard access denied. Check permissions.', true);
        }
    }

    exportToICS() {
        if (this.events.length === 0) {
            this.showStatus('No events to export', true);
            return;
        }

        try {
            // Ensure all dates are valid
            const validEvents = this.events.filter(event => 
                event.date instanceof Date && !isNaN(event.date.getTime())
            );
            
            if (validEvents.length === 0) {
                this.showStatus('No valid events to export', true);
                return;
            }

            const icsContent = this.icsGenerator.generate(validEvents);
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `syllabus_dates_${new Date().toISOString().slice(0, 10)}.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatus(`Exported ${validEvents.length} event${validEvents.length !== 1 ? 's' : ''} to calendar file`);
            
        } catch (error) {
            console.error('Export error:', error);
            this.showStatus('Error exporting events', true);
        }
    }

    async clearEvents() {
        if (this.events.length === 0) {
            this.showStatus('No events to clear', true);
            return;
        }

        if (confirm(`Clear all ${this.events.length} events? This cannot be undone.`)) {
            await chrome.storage.local.set({ syllabusEvents: [] });
            this.events = [];
            this.updateUI();
            this.showStatus('All events cleared');
        }
    }

    async saveEvents() {
        try {
            // Convert dates to ISO strings for storage
            const eventsToSave = this.events.map(event => ({
                ...event,
                date: event.date instanceof Date ? event.date.toISOString() : event.date
            }));
            
            await chrome.storage.local.set({ syllabusEvents: eventsToSave });
            console.log('Saved', eventsToSave.length, 'events to storage');
            
        } catch (error) {
            console.error('Error saving events:', error);
            throw error;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing SyllabusDateExtractor...');
    try {
        new SyllabusDateExtractor();
        
        // Add some helpful debug info
        setTimeout(() => {
            console.log('Extension loaded successfully');
            console.log('Chrome storage API available:', typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined');
            console.log('Clipboard API available:', typeof navigator.clipboard !== 'undefined');
        }, 100);
        
    } catch (error) {
        console.error('Failed to initialize SyllabusDateExtractor:', error);
        document.body.innerHTML = `
            <div style="padding: 20px; color: #721c24; background: #f8d7da; border-radius: 8px; margin: 20px;">
                <h3>Error Loading Extension</h3>
                <p>${error.message}</p>
                <p>Please try refreshing the extension or contact support.</p>
            </div>
        `;
    }
});

// Export for testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DateParser, ICSGenerator, SyllabusDateExtractor };
}