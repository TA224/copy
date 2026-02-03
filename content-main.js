// content-main.js - MAIN ORCHESTRATOR FOR ALL FUNCTIONALITIES
console.log('🎯 Syllabus Date Extractor Content Script loaded');

class ContentOrchestrator {
    constructor() {
        this.modules = {
            dateScanner: null,
            dateLens: null,
            lmsExtractor: null,
            pdfExtractor: null
        };
        
        this.currentMode = 'auto'; // auto, pdf, lms, regular
        this.activeModule = null;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing content orchestrator...');
        
        // Detect page type
        this.detectPageType();
        
        // Initialize appropriate modules
        await this.initializeModules();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Setup message listener
        this.setupMessageListener();
        
        console.log('✅ Content orchestrator ready');
    }
    
    detectPageType() {
        const url = window.location.href;
        const bodyClasses = document.body.className;
        
        // Check for PDF
        if (url.includes('.pdf') || 
            document.querySelector('embed[type="application/pdf"]') ||
            document.querySelector('object[type="application/pdf"]')) {
            this.currentMode = 'pdf';
            console.log('📄 PDF page detected');
        }
        // Check for LMS
        else if (document.querySelector('d2l-html-block, .d2l-htmlblock-untrusted') ||
                document.querySelector('#content, .ic-Dashboard-card') || // Canvas
                document.querySelector('.breadcrumbs, .container') || // Blackboard
                url.includes('brightspace') || 
                url.includes('d2l') ||
                url.includes('canvas') ||
                url.includes('blackboard') ||
                url.includes('moodle')) {
            this.currentMode = 'lms';
            console.log('🎓 LMS page detected');
        }
        // Regular page
        else {
            this.currentMode = 'regular';
            console.log('🌐 Regular page detected');
        }
    }
    
    async initializeModules() {
        try {
            // Always load DateScanner (base functionality)
            if (typeof DateScanner !== 'undefined') {
                this.modules.dateScanner = new DateScanner();
                console.log('✅ DateScanner loaded');
            }
            
            // Load LMS Extractor if on LMS page
            if (this.currentMode === 'lms' && typeof LMSExtractor !== 'undefined') {
                this.modules.lmsExtractor = new LMSExtractor();
                console.log('✅ LMS Extractor loaded');
                
                // Auto-extract from LMS after delay
                setTimeout(async () => {
                    await this.autoExtractFromLMS();
                }, 3000);
            }
            
            // Load DateLens for regular pages (optional)
            if (typeof DateLens !== 'undefined' && this.currentMode === 'regular') {
                this.modules.dateLens = new DateLens();
                console.log('✅ DateLens loaded');
            }
            
        } catch (error) {
            console.error('Error loading modules:', error);
        }
    }
    
    async autoExtractFromLMS() {
        if (!this.modules.lmsExtractor) return;
        
        console.log('🔄 Auto-extracting from LMS...');
        
        try {
            const dates = await this.modules.lmsExtractor.extract();
            
            if (dates.length > 0) {
                console.log(`✅ Found ${dates.length} dates in LMS`);
                
                // Send to background for storage
                await this.sendDatesToBackground(dates, 'lms-auto');
                
                // Show notification
                this.showLMSNotification(dates);
            }
        } catch (error) {
            console.error('Auto-extraction failed:', error);
        }
    }
    
    async sendDatesToBackground(dates, source) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'processExtractedDates',
                dates: dates.map(date => ({
                    title: date.title,
                    date: date.date.toISOString(),
                    source: window.location.href,
                    context: date.context || '',
                    type: date.type || 'lms',
                    confidence: date.confidence || 0.8,
                    extractedFrom: source
                })),
                url: window.location.href,
                timestamp: Date.now()
            });
            
            return response;
        } catch (error) {
            console.error('Failed to send dates to background:', error);
            return null;
        }
    }
    
    showLMSNotification(dates) {
        // Only show if user hasn't dismissed similar notifications recently
        const lastNotification = localStorage.getItem('lastLMSNotification');
        if (lastNotification && Date.now() - parseInt(lastNotification) < 60000) {
            return; // Don't spam notifications
        }
        
        localStorage.setItem('lastLMSNotification', Date.now().toString());
        
        const notification = document.createElement('div');
        notification.id = 'lms-date-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: -apple-system, sans-serif;
            overflow: hidden;
            animation: slideIn 0.3s ease-out;
            border: 2px solid #4CAF50;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        notification.innerHTML = `
            <div style="padding: 16px; background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%); color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; font-size: 14px; font-weight: 600;">
                        🎓 Found ${dates.length} Academic Dates
                    </h4>
                    <button onclick="document.getElementById('lms-date-notification').remove()" 
                            style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;">×</button>
                </div>
            </div>
            <div style="padding: 12px 16px;">
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #666;">
                    Dates extracted from this LMS page
                </p>
                <div style="display: flex; gap: 8px;">
                    <button onclick="window.contentOrchestrator.viewDates()"
                            style="flex: 1; background: #2196F3; color: white; border: none; border-radius: 6px; padding: 8px; font-size: 13px; cursor: pointer;">
                        View Dates
                    </button>
                    <button onclick="window.contentOrchestrator.exportDates()"
                            style="flex: 1; background: #4CAF50; color: white; border: none; border-radius: 6px; padding: 8px; font-size: 13px; cursor: pointer;">
                        Export All
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Expose methods
        window.contentOrchestrator = {
            viewDates: () => this.showDatesModal(dates),
            exportDates: () => this.exportDates(dates)
        };
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 15000);
    }
    
    showDatesModal(dates) {
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
        
        // Sort by date
        const sortedDates = [...dates].sort((a, b) => a.date - b.date);
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; width: 600px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column;">
                <div style="padding: 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #2c3e50;">Academic Dates</h3>
                    <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" 
                            style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    ${sortedDates.map((date, index) => `
                        <div style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${date.type === 'exam' ? '#f44336' : date.type === 'quiz' ? '#FF9800' : '#4CAF50'};">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <div>
                                    <div style="font-weight: 600; color: #2c3e50;">${this.escapeHTML(date.title)}</div>
                                    <div style="font-size: 12px; color: #666; margin-top: 2px;">
                                        ${date.source === 'lms-auto' ? 'Auto-extracted from LMS' : 'Manually extracted'}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                        ${date.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                    <div style="font-size: 11px; color: #666; margin-top: 4px;">
                                        ${date.type || 'assignment'}
                                    </div>
                                </div>
                            </div>
                            ${date.context ? `
                                <div style="font-size: 13px; color: #666; background: white; padding: 8px; border-radius: 4px; margin-top: 8px; border: 1px solid #e0e0e0;">
                                    ${this.escapeHTML(date.context.substring(0, 150))}${date.context.length > 150 ? '...' : ''}
                                </div>
                            ` : ''}
                            <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                                <button onclick="window.contentOrchestrator.addToCalendar(${index})"
                                        style="background: #4CAF50; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer; margin-left: 8px;">
                                    Add to Calendar
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="padding: 16px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 14px; color: #666;">
                        ${sortedDates.length} date${sortedDates.length !== 1 ? 's' : ''} found
                    </div>
                    <div>
                        <button onclick="window.contentOrchestrator.exportAllDates()"
                                style="background: #2196F3; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; cursor: pointer;">
                            Export All to Calendar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Expose methods
        window.contentOrchestrator.addToCalendar = (index) => {
            this.addDateToCalendar(sortedDates[index]);
        };
        
        window.contentOrchestrator.exportAllDates = () => {
            this.exportDates(sortedDates);
        };
    }
    
    async addDateToCalendar(date) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'addDateToCalendar',
                date: {
                    title: date.title,
                    date: date.date.toISOString(),
                    source: window.location.href,
                    context: date.context || ''
                }
            });
            
            if (response.success) {
                this.showToast(`Added "${date.title.substring(0, 30)}..." to calendar`);
            }
        } catch (error) {
            console.error('Failed to add date:', error);
            this.showToast('Failed to add to calendar');
        }
    }
    
    async exportDates(dates) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'exportDatesToCalendar',
                dates: dates.map(date => ({
                    title: date.title,
                    date: date.date.toISOString(),
                    source: window.location.href,
                    context: date.context || '',
                    type: date.type || 'lms'
                }))
            });
            
            if (response.success) {
                this.showToast(`Exported ${dates.length} dates to calendar`);
            }
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed');
        }
    }
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: #2c3e50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10002;
            font-size: 14px;
            animation: fadeInOut 3s;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(20px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(20px); }
            }
        `;
        
        toast.textContent = message;
        document.head.appendChild(style);
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            if (style.parentNode) style.parentNode.removeChild(style);
        }, 3000);
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D: Toggle DateLens (for regular pages)
            if (e.ctrlKey && e.shiftKey && e.key === 'D' && !e.altKey) {
                e.preventDefault();
                
                if (this.currentMode === 'regular' && this.modules.dateLens) {
                    this.modules.dateLens.toggle();
                } else if (this.currentMode === 'lms' && this.modules.lmsExtractor) {
                    this.manualExtractFromLMS();
                } else if (this.currentMode === 'pdf') {
                    this.scanPDFForDates();
                }
            }
            
            // Ctrl+Shift+L: Force LMS extraction
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.manualExtractFromLMS();
            }
        });
    }
    
    async manualExtractFromLMS() {
        if (!this.modules.lmsExtractor) {
            this.showToast('LMS extractor not available on this page');
            return;
        }
        
        this.showToast('Extracting dates from LMS...');
        
        try {
            const dates = await this.modules.lmsExtractor.extract();
            
            if (dates.length > 0) {
                this.showToast(`Found ${dates.length} dates`);
                await this.sendDatesToBackground(dates, 'lms-manual');
                this.showDatesModal(dates);
            } else {
                this.showToast('No dates found in this LMS content');
            }
        } catch (error) {
            console.error('Manual extraction failed:', error);
            this.showToast('Extraction failed');
        }
    }
    
    async scanPDFForDates() {
        if (!this.modules.dateScanner) {
            this.showToast('Date scanner not available');
            return;
        }
        
        this.showToast('Scanning PDF for dates...');
        
        try {
            const positions = this.modules.dateScanner.scanForPositions();
            
            if (positions.length > 0) {
                const dates = positions.map(pos => ({
                    title: `PDF Date: ${pos.text}`,
                    date: new Date(), // You'd need to parse actual dates
                    source: window.location.href,
                    context: pos.text,
                    type: 'pdf'
                }));
                
                await this.sendDatesToBackground(dates, 'pdf');
                this.showToast(`Found ${positions.length} potential dates in PDF`);
            } else {
                this.showToast('No dates found in PDF');
            }
        } catch (error) {
            console.error('PDF scan failed:', error);
            this.showToast('PDF scan failed');
        }
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'extractDates':
                    this.handleExtractRequest(request).then(sendResponse);
                    return true;
                    
                case 'getPageType':
                    sendResponse({
                        type: this.currentMode,
                        hasLMS: !!this.modules.lmsExtractor,
                        hasDateLens: !!this.modules.dateLens
                    });
                    break;
                    
                case 'activateDateLens':
                    if (this.modules.dateLens) {
                        this.modules.dateLens.activate();
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'DateLens not available' });
                    }
                    break;
            }
        });
    }
    
    async handleExtractRequest(request) {
        try {
            let dates = [];
            
            if (request.source === 'lms' && this.modules.lmsExtractor) {
                dates = await this.modules.lmsExtractor.extract();
            } else if (request.source === 'pdf') {
                const positions = this.modules.dateScanner.scanForPositions();
                dates = positions.map(pos => ({
                    title: `Date: ${pos.text}`,
                    date: new Date(),
                    source: window.location.href,
                    context: pos.text
                }));
            } else {
                // Auto-detect
                if (this.currentMode === 'lms' && this.modules.lmsExtractor) {
                    dates = await this.modules.lmsExtractor.extract();
                } else if (this.modules.dateScanner) {
                    const positions = this.modules.dateScanner.scanForPositions();
                    dates = positions.map(pos => ({
                        title: `Date: ${pos.text}`,
                        date: new Date(),
                        source: window.location.href,
                        context: pos.text
                    }));
                }
            }
            
            return {
                success: true,
                dates: dates,
                count: dates.length,
                source: this.currentMode
            };
            
        } catch (error) {
            console.error('Extraction failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.contentOrchestrator = new ContentOrchestrator();
        }, 1000);
    });
} else {
    setTimeout(() => {
        window.contentOrchestrator = new ContentOrchestrator();
    }, 1000);
}