// heatmap.js - COMPLETE VERSION WITH PDF TRACKING
console.log('🔥 Date Lens loaded');

class DateLens {
    constructor() {
        this.scanner = new DateScanner();
        this.isActive = false;
        this.highlightsActive = false;
        this.datePositions = [];
        this.pdfObserver = null;
        this.scrollThrottle = null;
        this.updateInterval = null;
        this.pdfHighlights = [];
        this.pdfHighlightContainer = null;
        this.lastPageCount = 0;
        
        this.config = {
            tickColor: '#ff4444',
            highlightColor: 'rgba(255, 68, 68, 0.3)',
            contextColor: 'rgba(255, 140, 0, 0.4)',
            maxPositions: 100
        };
        
        // Bind methods
        this.toggle = this.toggle.bind(this);
        this.debugScan = this.debugScan.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.updateHighlightPositions = this.updateHighlightPositions.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        this.init();
    }
    
    init() {
        console.log('Date Lens: Press Ctrl+Shift+D to toggle');
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D' && !e.altKey) {
                e.preventDefault();
                this.toggle();
            } else if (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                this.debugScan();
            }
        });
        
        // Special setup for PDF viewers
        if (this.isPDFViewer()) {
            this.setupPDFViewer();
        }
    }
    
    isPDFViewer() {
        return window.location.href.includes('pdfjs') || 
               document.querySelector('.textLayer, .text-layer, #viewer, .pdfViewer');
    }
    
    setupPDFViewer() {
        console.log('📄 Setting up PDF viewer...');
        
        // Setup scroll listener for updating highlight positions
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        window.addEventListener('resize', this.handleResize, { passive: true });
        
        // Setup page observer
        this.setupPDFPageObserver();
    }
    
    setupPDFPageObserver() {
        // Watch for new pages loading
        this.pdfObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    const hasNewTextLayers = Array.from(mutation.addedNodes).some(node => {
                        return node.classList && 
                              (node.classList.contains('textLayer') || 
                               node.classList.contains('text-layer') ||
                               node.querySelector('.textLayer, .text-layer'));
                    });
                    
                    if (hasNewTextLayers && this.isActive) {
                        console.log('New PDF page detected, rescanning...');
                        setTimeout(() => this.rescanPDF(), 500);
                    }
                }
            });
        });
        
        const viewer = document.querySelector('#viewer, .pdfViewer, .pageContainer') || document.body;
        if (viewer) {
            this.pdfObserver.observe(viewer, { childList: true, subtree: true });
        }
    }
    
    handleScroll() {
        // Throttle scroll updates
        if (!this.scrollThrottle) {
            this.scrollThrottle = setTimeout(() => {
                if (this.isActive && this.highlightsActive && this.isPDFViewer()) {
                    this.updateHighlightPositions();
                }
                this.scrollThrottle = null;
            }, 50);
        }
    }
    
    handleResize() {
        this.handleScroll(); // Use same throttling as scroll
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
        
        console.log('Activating Date Lens...');
        this.isActive = true;
        
        // Special handling for PDF viewers
        if (this.isPDFViewer()) {
            await this.activatePDFMode();
        } else {
            await this.activateRegularMode();
        }
    }
    
    async activatePDFMode() {
        console.log('📄 Activating PDF mode...');
        
        // Try to load all pages first
        await this.loadAllPDFPages();
        
        // Wait a bit for rendering
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Scan for dates
        this.datePositions = this.scanner.scanForPositions();
        
        if (this.datePositions.length === 0) {
            console.log('No dates found in PDF');
            this.isActive = false;
            return;
        }
        
        console.log(`Found ${this.datePositions.length} dates in PDF`);
        
        // Add scrollbar ticks
        this.addScrollbarTicks();
        
        // Auto-enable highlights for PDFs
        this.highlightsActive = true;
        this.createPDFHighlights();
        
        this.showNotification(`Found ${this.datePositions.length} dates in PDF`);
    }

    async loadAllPDFPages() {
        if (!this.isPDFViewer()) return;
        
        console.log('📄 Loading all PDF pages...');
        
        const viewer = document.querySelector('#viewerContainer, .pdfViewer, .viewerContainer') || document.body;
        const originalScroll = viewer.scrollTop;
        const scrollStep = 300;
        
        // Scroll down in steps
        for (let scrollPos = 0; scrollPos <= viewer.scrollHeight; scrollPos += scrollStep) {
            viewer.scrollTop = scrollPos;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Scroll back to original position
        viewer.scrollTop = originalScroll;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    async activateRegularMode() {
        this.datePositions = this.scanner.scanForPositions();
        
        if (this.datePositions.length === 0) {
            console.log('No dates found');
            this.isActive = false;
            return;
        }
        
        this.addScrollbarTicks();
        this.showNotification(`Found ${this.datePositions.length} dates - Ctrl+Shift+D to close`);
        
        setTimeout(() => {
            if (this.datePositions.length <= 20) {
                if (confirm(`Found ${this.datePositions.length} dates. Also highlight them on page?`)) {
                    this.toggleHighlights();
                }
            } else {
                this.toggleHighlights();
            }
        }, 500);
    }
    
    startHighlightUpdates() {
        // Clear existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Start updating highlight positions
        this.updateInterval = setInterval(() => {
            if (this.isActive && this.highlightsActive && this.isPDFViewer()) {
                this.updateHighlightPositions();
            }
        }, 100);
    }
    
    createPDFHighlights() {
        console.log('Creating PDF highlights...');
        
        // Remove existing highlights
        this.removePDFHighlights();
        
        // Create container for highlights
        this.pdfHighlightContainer = document.createElement('div');
        this.pdfHighlightContainer.id = 'date-lens-pdf-highlights';
        this.pdfHighlightContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10000;
            overflow: hidden;
        `;
        document.body.appendChild(this.pdfHighlightContainer);
        
        // Create highlights for each date
        this.datePositions.forEach((datePos, index) => {
            this.createPDFHighlight(datePos, index);
        });
        
        // Initial position update
        setTimeout(() => this.updateHighlightPositions(), 100);
    }
    
    createPDFHighlight(datePos, index) {
        try {
            const rect = datePos.element.getBoundingClientRect();
            
            // Skip if element is too small or off-screen
            if (rect.width === 0 && rect.height === 0) return;
            
            // Create highlight element
            const highlight = document.createElement('div');
            highlight.className = 'date-lens-pdf-highlight';
            highlight.dataset.index = index;
            
            // Store reference
            highlight._datePos = datePos;
            
            // Style - position based on viewport coordinates
            highlight.style.cssText = `
                position: absolute;
                left: ${rect.left + window.scrollX}px;
                top: ${rect.top + window.scrollY}px;
                width: ${Math.max(rect.width, 20)}px;
                height: ${Math.max(rect.height, 4)}px;
                background-color: ${datePos.isAcademic ? this.config.contextColor : this.config.highlightColor};
                border: 1px solid ${datePos.isAcademic ? '#ff8c00' : '#ff4444'};
                border-radius: 2px;
                pointer-events: auto;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.3s;
                box-shadow: 0 0 3px rgba(0,0,0,0.3);
                z-index: 10001;
            `;
            
            // Position it initially
            highlight.style.left = `${rect.left + window.scrollX}px`;
            highlight.style.top = `${rect.top + window.scrollY}px`;
            highlight.style.width = `${Math.max(rect.width, 20)}px`;
            highlight.style.height = `${Math.max(rect.height, 4)}px`;
            
            // Add hover effects
            highlight.addEventListener('mouseenter', () => {
                highlight.style.opacity = '0.9';
                highlight.style.boxShadow = '0 0 6px rgba(255, 68, 68, 0.8)';
                highlight.style.zIndex = '10002';
            });
            
            highlight.addEventListener('mouseleave', () => {
                highlight.style.opacity = '0.7';
                highlight.style.boxShadow = '0 0 3px rgba(0,0,0,0.3)';
                highlight.style.zIndex = '10001';
            });
            
            // Click to scroll
            highlight.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (datePos.element) {
                        datePos.element.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                        });
                        
                        // Flash highlight
                        const originalColor = highlight.style.backgroundColor;
                        highlight.style.backgroundColor = '#ffff00';
                        setTimeout(() => {
                            highlight.style.backgroundColor = originalColor;
                        }, 300);
                    }
                }
            });
            
            // Tooltip
            highlight.title = `Date: ${datePos.text}${datePos.isAcademic ? ' (Academic)' : ''}\nCtrl+click to jump`;
            
            // Add to container
            if (this.pdfHighlightContainer) {
                this.pdfHighlightContainer.appendChild(highlight);
            }
            
            // Store reference
            this.pdfHighlights.push(highlight);
            
        } catch (e) {
            console.log('Error creating PDF highlight:', e);
        }
    }
    
    updateHighlightPositions() {
        if (!this.pdfHighlights || this.pdfHighlights.length === 0 || !this.isPDFViewer()) return;
        
        let updated = false;
        
        this.pdfHighlights.forEach(highlight => {
            try {
                const datePos = highlight._datePos;
                if (!datePos || !datePos.element) return;
                
                const rect = datePos.element.getBoundingClientRect();
                
                // Skip if element is not visible
                if (rect.width === 0 && rect.height === 0) {
                    if (highlight.style.display !== 'none') {
                        highlight.style.display = 'none';
                        updated = true;
                    }
                    return;
                }
                
                // Calculate new position
                const newLeft = rect.left + window.scrollX;
                const newTop = rect.top + window.scrollY;
                const newWidth = Math.max(rect.width, 20);
                const newHeight = Math.max(rect.height, 4);
                
                // Only update if position changed
                if (highlight.style.display === 'none' ||
                    parseInt(highlight.style.left) !== Math.round(newLeft) ||
                    parseInt(highlight.style.top) !== Math.round(newTop) ||
                    parseInt(highlight.style.width) !== Math.round(newWidth) ||
                    parseInt(highlight.style.height) !== Math.round(newHeight)) {
                    
                    highlight.style.display = 'block';
                    highlight.style.left = `${newLeft}px`;
                    highlight.style.top = `${newTop}px`;
                    highlight.style.width = `${newWidth}px`;
                    highlight.style.height = `${newHeight}px`;
                    
                    updated = true;
                }
                
            } catch (e) {
                console.log('Error updating highlight position:', e);
            }
        });
        
        return updated;
    }
    
    async scanAllPDFPages() {
        if (!this.isPDFViewer()) return;
        
        console.log('📄 Loading all PDF pages...');
        
        const viewer = document.querySelector('#viewerContainer, .pdfViewer, .viewerContainer') || document.body;
        const originalScroll = viewer.scrollTop;
        const scrollStep = 500;
        const maxScrolls = 20; // Limit to prevent infinite scrolling
        
        // Scroll down in steps to load pages
        for (let i = 0; i < maxScrolls; i++) {
            viewer.scrollTop = i * scrollStep;
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Stop if we've reached the bottom
            if (viewer.scrollTop + viewer.clientHeight >= viewer.scrollHeight - 10) {
                break;
            }
        }
        
        // Wait for rendering
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return to original position
        viewer.scrollTop = originalScroll;
    }
    
    rescanPDF() {
        if (!this.isActive || !this.isPDFViewer()) return;
        
        console.log('Rescanning PDF for dates...');
        const newPositions = this.scanner.scanForPositions();
        
        if (newPositions.length > this.datePositions.length) {
            console.log(`Found ${newPositions.length - this.datePositions.length} new dates`);
            this.datePositions = newPositions;
            this.updateScrollbarTicks();
            this.updatePDFHighlights();
        }
    }
    
    updatePDFHighlights() {
        this.removePDFHighlights();
        this.createPDFHighlights();
    }
    
    addScrollbarTicks() {
        const styleId = 'date-lens-scrollbar-style';
        let existingStyle = document.getElementById(styleId);
        if (existingStyle) existingStyle.remove();
        
        const style = document.createElement('style');
        style.id = styleId;
        
        let css = `
            /* WebKit browsers */
            ::-webkit-scrollbar {
                width: 16px;
            }
            
            ::-webkit-scrollbar-track {
                background: transparent;
            }
            
            /* Scrollbar thumb */
            ::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 8px;
                border: 3px solid transparent;
                background-clip: content-box;
            }
        `;
        
        // Group similar positions to avoid too many ticks
        const groupedPositions = this.groupSimilarPositions(this.datePositions);
        
        groupedPositions.forEach((pos, index) => {
            const positionPercent = (pos.position * 100).toFixed(2);
            const color = pos.isAcademic ? '#ff8c00' : this.config.tickColor;
            const count = pos.count || 1;
            
            css += `
                /* Date group ${index + 1} at ${positionPercent}% */
                ::-webkit-scrollbar-track::after {
                    content: "";
                    position: absolute;
                    right: 1px;
                    top: ${positionPercent}%;
                    width: ${Math.min(3 + (count * 0.5), 6)}px;
                    height: 3px;
                    background: ${color};
                    border-radius: 1px;
                    pointer-events: none;
                    opacity: ${Math.min(0.3 + (count * 0.1), 0.8)};
                    z-index: 10000;
                }
            `;
        });
        
        // Firefox support
        css += `
            /* Firefox */
            html {
                scrollbar-color: #888 transparent;
                scrollbar-width: thin;
            }
        `;
        
        style.textContent = css;
        document.head.appendChild(style);
        this.scrollbarStyle = style;
    }
    
    groupSimilarPositions(positions) {
        const groups = [];
        const threshold = 0.005; // Group positions within 0.5% of each other
        
        positions.sort((a, b) => a.position - b.position);
        
        positions.forEach(pos => {
            let added = false;
            
            for (const group of groups) {
                if (Math.abs(group.position - pos.position) < threshold) {
                    // Add to existing group
                    group.count = (group.count || 1) + 1;
                    // Average the position
                    group.position = (group.position * (group.count - 1) + pos.position) / group.count;
                    group.isAcademic = group.isAcademic || pos.isAcademic;
                    added = true;
                    break;
                }
            }
            
            if (!added) {
                // Create new group
                groups.push({
                    position: pos.position,
                    isAcademic: pos.isAcademic,
                    count: 1
                });
            }
        });
        
        return groups;
    }
    
    updateScrollbarTicks() {
        this.removeScrollbarTicks();
        this.addScrollbarTicks();
    }
    
    removeScrollbarTicks() {
        if (this.scrollbarStyle && this.scrollbarStyle.parentNode) {
            this.scrollbarStyle.parentNode.removeChild(this.scrollbarStyle);
        }
        this.scrollbarStyle = null;
    }
    
    // Regular page highlights (for non-PDF pages)
    addPageHighlights() {
        this.removePageHighlights();
        
        this.datePositions.forEach(pos => {
            if (pos.element && !pos.element.classList.contains('date-lens-highlighted')) {
                pos.element.classList.add('date-lens-highlighted');
                const color = pos.isAcademic ? this.config.contextColor : this.config.highlightColor;
                pos.element.style.backgroundColor = color;
                pos.element.style.transition = 'background-color 0.3s';
                
                pos.element.addEventListener('click', (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        pos.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const originalColor = pos.element.style.backgroundColor;
                        pos.element.style.backgroundColor = '#ffff00';
                        setTimeout(() => {
                            pos.element.style.backgroundColor = originalColor;
                        }, 300);
                    }
                });
                
                pos.element.title = `Date: ${pos.text}${pos.isAcademic ? ' (Academic)' : ''}\nCtrl+click to jump`;
            }
        });
        
        console.log(`Added highlights to ${this.datePositions.length} dates`);
    }
    
    removePageHighlights() {
        const highlights = document.querySelectorAll('.date-lens-highlighted');
        highlights.forEach(el => {
            el.classList.remove('date-lens-highlighted');
            el.style.backgroundColor = '';
            el.title = '';
        });
    }
    
    toggleHighlights() {
        if (this.isPDFViewer()) {
            // For PDFs
            this.highlightsActive = !this.highlightsActive;
            
            if (this.highlightsActive) {
                this.createPDFHighlights();
                this.startHighlightUpdates();
            } else {
                this.removePDFHighlights();
            }
        } else {
            // For regular pages
            this.highlightsActive = !this.highlightsActive;
            
            if (this.highlightsActive) {
                this.addPageHighlights();
            } else {
                this.removePageHighlights();
            }
        }
    }
    
    removePDFHighlights() {
        // Remove highlights array
        this.pdfHighlights = [];
        
        // Remove container
        if (this.pdfHighlightContainer && this.pdfHighlightContainer.parentNode) {
            this.pdfHighlightContainer.parentNode.removeChild(this.pdfHighlightContainer);
            this.pdfHighlightContainer = null;
        }
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        console.log('Deactivating Date Lens...');
        this.isActive = false;
        this.highlightsActive = false;
        
        // Clean up interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        // Clean up observer
        if (this.pdfObserver) {
            this.pdfObserver.disconnect();
            this.pdfObserver = null;
        }
        
        // Remove event listeners
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        
        // Clear throttle
        if (this.scrollThrottle) {
            clearTimeout(this.scrollThrottle);
            this.scrollThrottle = null;
        }
        
        // Remove all visual elements
        this.removeScrollbarTicks();
        this.removePDFHighlights();
        this.removePageHighlights();
        
        // Clear data
        this.datePositions = [];
        this.lastPageCount = 0;
        
        console.log('Date Lens off');
    }
    
    showNotification(message) {
        console.log(`📅 ${message}`);
        
        // Optional browser notification
        if (chrome && chrome.runtime && chrome.notifications) {
            try {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icon48.png'),
                    title: 'Date Lens',
                    message: message,
                    priority: 0
                });
            } catch (e) {
                // Notification permission not granted
            }
        }
    }
    
    debugScan() {
        console.log('=== DEBUG MODE ===');
        console.log('Page URL:', window.location.href);
        console.log('Is PDF viewer?', this.isPDFViewer());
        console.log('Active?', this.isActive);
        console.log('Highlights active?', this.highlightsActive);
        console.log('Date positions:', this.datePositions.length);
        console.log('PDF highlights:', this.pdfHighlights ? this.pdfHighlights.length : 0);
        
        if (this.isPDFViewer()) {
            console.log('PDF viewer structure:');
            const pages = document.querySelectorAll('.page');
            console.log(`Total pages in DOM: ${pages.length}`);
            
            // Show date positions
            this.datePositions.forEach((pos, i) => {
                console.log(`${i+1}. "${pos.text}" at ${(pos.position*100).toFixed(1)}%`);
                const rect = pos.element.getBoundingClientRect();
                console.log(`   Element: ${pos.element.tagName} ${pos.element.className || ''}`);
                console.log(`   Rect: ${rect.left},${rect.top} ${rect.width}x${rect.height}`);
                console.log(`   Scroll: ${window.scrollX},${window.scrollY}`);
            });
        }
    }
}

// Auto-initialize
(function() {
    const init = () => {
        console.log('🚀 Initializing Date Lens...');
        
        if (typeof DateScanner === 'undefined') {
            console.error('❌ DateScanner not found!');
            return;
        }
        
        window.dateLens = new DateLens();
        console.log('✅ Date Lens ready! Press Ctrl+Shift+D to toggle');
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 1000);
        });
    } else {
        setTimeout(init, 1000);
    }
})();


