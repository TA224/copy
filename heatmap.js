// heatmap.js
// Adds red scrollbar ticks for dates when Date Lens is active

console.log('🔥 Heat Map System initialized (scrollbar version)');

class HeatMapSystem {
    constructor() {
        this.dateScanner = new DateScanner();
        this.isActive = false;
        this.dateLensTimeout = null;
        this.inactivityTimer = null;
        this.scrollbarStyle = null;
        
        // Configuration
        this.config = {
            inactivityTimeout: 5 * 60 * 1000, // 5 minutes
            tickColor: '#ff4444', // Red color for ticks
            tickWidth: '3px',
            highlightColor: 'rgba(255, 68, 68, 0.15)', // Light red for highlights
            highlightDuration: 3000 // ms to keep highlights after click
        };
        
        this.init();
    }
    
    init() {
        console.log('🔥 Initializing Date Lens...');
        
        // Try to inject toggle button when find bar appears
        this.setupFindBarObserver();
        
        // Listen for Ctrl+F to potentially add our button
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        
        console.log('✅ Date Lens ready (will add 📅 button to find bar)');
    }
    
    setupFindBarObserver() {
        // Watch for browser find bar appearance
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    this.checkForFindBar();
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Also check initially
        setTimeout(() => this.checkForFindBar(), 1000);
    }
    
    checkForFindBar() {
        // Look for browser find bar (different browsers)
        const findBars = [
            document.querySelector('input[type="search"][aria-label="Find"]'),
            document.querySelector('input[aria-label="Find in page"]'),
            document.querySelector('.findbar-textbox'),
            document.querySelector('input.find-input'),
            document.querySelector('#find-field'),
            document.querySelector('input[name="find"]')
        ].filter(Boolean);
        
        for (const findBar of findBars) {
            if (findBar && !findBar.hasAttribute('data-date-lens-added')) {
                this.addDateLensToggle(findBar);
            }
        }
    }
    
    addDateLensToggle(findInput) {
        console.log('🎯 Found find bar, adding Date Lens toggle');
        
        // Create toggle button container
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'date-lens-toggle';
        toggleContainer.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 8px;
            cursor: pointer;
            user-select: none;
        `;
        
        // Create the toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.innerHTML = '📅';
        toggleBtn.title = 'Toggle Date Lens - show dates in scrollbar';
        toggleBtn.style.cssText = `
            background: ${this.isActive ? '#4CAF50' : '#f0f0f0'};
            border: 1px solid ${this.isActive ? '#388E3C' : '#ccc'};
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 14px;
            cursor: pointer;
            margin-right: 4px;
            transition: all 0.2s;
        `;
        
        // Create status indicator
        const status = document.createElement('span');
        status.textContent = this.isActive ? 'ON' : 'OFF';
        status.style.cssText = `
            font-size: 11px;
            color: ${this.isActive ? '#4CAF50' : '#666'};
            font-weight: ${this.isActive ? 'bold' : 'normal'};
        `;
        
        // Assemble
        toggleContainer.appendChild(toggleBtn);
        toggleContainer.appendChild(status);
        
        // Insert after find input
        findInput.parentNode.insertBefore(toggleContainer, findInput.nextSibling);
        
        // Mark as added
        findInput.setAttribute('data-date-lens-added', 'true');
        
        // Setup click handler
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleDateLens();
            
            // Update button appearance
            toggleBtn.style.background = this.isActive ? '#4CAF50' : '#f0f0f0';
            toggleBtn.style.borderColor = this.isActive ? '#388E3C' : '#ccc';
            status.textContent = this.isActive ? 'ON' : 'OFF';
            status.style.color = this.isActive ? '#4CAF50' : '#666';
            status.style.fontWeight = this.isActive ? 'bold' : 'normal';
        };
        
        // Also add on find bar container if possible
        const findBar = findInput.closest('.findbar, .browser-findbar, [role="toolbar"]');
        if (findBar && !findBar.hasAttribute('data-date-lens-added')) {
            findBar.setAttribute('data-date-lens-added', 'true');
            
            // Reset inactivity timer when find bar is interacted with
            const resetTimer = () => this.resetInactivityTimer();
            findBar.addEventListener('input', resetTimer);
            findBar.addEventListener('click', resetTimer);
            findBar.addEventListener('keydown', resetTimer);
        }
    }
    
    handleKeyDown(e) {
        // Check for Ctrl+F
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.altKey && !e.shiftKey) {
            console.log('🎯 Ctrl+F detected, find bar should appear soon');
            
            // Brief delay to let browser find bar appear, then add our button
            setTimeout(() => this.checkForFindBar(), 100);
        }
    }
    
    toggleDateLens() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
        
        this.resetInactivityTimer();
    }
    
    async activate() {
        if (this.isActive) return;
        
        console.log('🚀 Activating Date Lens...');
        this.isActive = true;
        
        try {
            // Scan for dates
            const datePositions = this.dateScanner.scanForScrollbar();
            
            if (datePositions.length === 0) {
                console.log('❌ No dates found');
                this.showNotification('No dates found on this page', true);
                this.isActive = false;
                return;
            }
            
            console.log(`📅 Found ${datePositions.length} dates, adding scrollbar indicators`);
            
            // Add scrollbar ticks
            this.addScrollbarTicks(datePositions);
            
            // Add page highlights
            this.addPageHighlights(datePositions);
            
            // Setup scrollbar click handler
            this.setupScrollbarClick(datePositions);
            
            // Show notification
            this.showNotification(`Date Lens ON - ${datePositions.length} dates found`);
            
        } catch (error) {
            console.error('❌ Error activating Date Lens:', error);
            this.isActive = false;
        }
        
        this.resetInactivityTimer();
    }
    
    addScrollbarTicks(datePositions) {
        // Remove existing styles
        this.removeScrollbarTicks();
        
        // Create style for scrollbar ticks
        this.scrollbarStyle = document.createElement('style');
        this.scrollbarStyle.id = 'date-lens-scrollbar';
        
        let css = `
            /* Scrollbar container */
            ::-webkit-scrollbar {
                width: 16px; /* Make room for ticks */
            }
            
            /* Scrollbar track */
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
        
        // Add a tick for each date position
        datePositions.forEach((pos, index) => {
            const positionPercent = (pos.position * 100).toFixed(2);
            
            css += `
                /* Date tick ${index} at ${positionPercent}% */
                ::-webkit-scrollbar-track::after {
                    content: "";
                    position: absolute;
                    right: 2px;
                    top: ${positionPercent}%;
                    width: ${this.config.tickWidth};
                    height: 2px;
                    background: ${this.config.tickColor};
                    border-radius: 1px;
                    pointer-events: none;
                }
            `;
        });
        
        // For Firefox (different scrollbar styling)
        css += `
            /* Firefox scrollbar */
            * {
                scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
                scrollbar-width: thin;
            }
            
            /* Date highlights in page */
            .date-lens-highlight {
                background-color: ${this.config.highlightColor} !important;
                transition: background-color 0.3s ease;
                border-radius: 2px;
                padding: 0 2px;
            }
            
            .date-lens-highlight-fade {
                background-color: transparent !important;
                transition: background-color 1s ease;
            }
        `;
        
        this.scrollbarStyle.textContent = css;
        document.head.appendChild(this.scrollbarStyle);
    }
    
    addPageHighlights(datePositions) {
        // Clear existing highlights
        this.removePageHighlights();
        
        // For each date position, try to highlight the element
        datePositions.forEach(pos => {
            if (pos.element && !pos.element.classList.contains('date-lens-highlight')) {
                pos.element.classList.add('date-lens-highlight');
                
                // Add click handler to highlight
                pos.element.addEventListener('click', (e) => {
                    if (this.isActive) {
                        this.highlightDateElement(pos.element);
                    }
                }, { once: true });
                
                // Add mouseover tooltip
                pos.element.title = 'Date detected: ' + pos.text.substring(0, 50) + '...';
            }
        });
    }
    
    highlightDateElement(element) {
        // Add temporary stronger highlight
        element.classList.add('date-lens-highlight-fade');
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove highlight after duration
        setTimeout(() => {
            element.classList.remove('date-lens-highlight-fade');
        }, this.config.highlightDuration);
    }
    
    setupScrollbarClick(datePositions) {
        // Click on scrollbar track to jump to nearest date
        document.addEventListener('click', (e) => {
            if (!this.isActive || datePositions.length === 0) return;
            
            // Check if click is on scrollbar track
            const isScrollbarClick = (
                e.offsetX > window.innerWidth - 20 || // Right edge
                e.target.tagName === 'HTML' && e.offsetX > document.documentElement.clientWidth - 20
            );
            
            if (isScrollbarClick) {
                // Calculate click position as percentage
                const clickPercent = e.clientY / window.innerHeight;
                
                // Find nearest date
                let nearestDate = datePositions[0];
                let minDistance = Math.abs(clickPercent - nearestDate.position);
                
                for (const pos of datePositions) {
                    const distance = Math.abs(clickPercent - pos.position);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestDate = pos;
                    }
                }
                
                // Scroll to and highlight that date
                if (nearestDate.element) {
                    this.highlightDateElement(nearestDate.element);
                }
            }
        });
    }
    
    removeScrollbarTicks() {
        if (this.scrollbarStyle && this.scrollbarStyle.parentNode) {
            this.scrollbarStyle.parentNode.removeChild(this.scrollbarStyle);
        }
        this.scrollbarStyle = null;
    }
    
    removePageHighlights() {
        const highlights = document.querySelectorAll('.date-lens-highlight, .date-lens-highlight-fade');
        highlights.forEach(el => {
            el.classList.remove('date-lens-highlight', 'date-lens-highlight-fade');
            el.title = '';
        });
    }
    
    resetInactivityTimer() {
        // Clear existing timer
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        
        // Set new timer if active
        if (this.isActive) {
            this.inactivityTimer = setTimeout(() => {
                console.log('⏰ Date Lens inactive for 5 minutes, auto-disabling');
                this.deactivate();
            }, this.config.inactivityTimeout);
        }
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        console.log('🛑 Deactivating Date Lens...');
        this.isActive = false;
        
        // Remove scrollbar ticks
        this.removeScrollbarTicks();
        
        // Remove page highlights
        this.removePageHighlights();
        
        // Clear inactivity timer
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        
        // Update any toggle buttons in find bars
        this.updateToggleButtons();
        
        console.log('✅ Date Lens deactivated');
    }
    
    updateToggleButtons() {
        const toggleButtons = document.querySelectorAll('.date-lens-toggle button');
        toggleButtons.forEach(btn => {
            btn.style.background = this.isActive ? '#4CAF50' : '#f0f0f0';
            btn.style.borderColor = this.isActive ? '#388E3C' : '#ccc';
            
            const status = btn.nextElementSibling;
            if (status && status.tagName === 'SPAN') {
                status.textContent = this.isActive ? 'ON' : 'OFF';
                status.style.color = this.isActive ? '#4CAF50' : '#666';
                status.style.fontWeight = this.isActive ? 'bold' : 'normal';
            }
        });
    }
    
    showNotification(message, isError = false) {
        // Simple notification that doesn't interfere
        console.log(isError ? '❌ ' : '✅ ', message);
        
        // Optionally show a subtle browser notification
        if (Notification.permission === 'granted') {
            new Notification('Date Lens', {
                body: message,
                icon: 'icon48.png',
                silent: true
            });
        }
    }
    
    destroy() {
        console.log('🧹 Cleaning up Date Lens...');
        
        this.deactivate();
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyDown, true);
        
        console.log('✅ Date Lens destroyed');
    }
}

// Initialize when page loads
(function() {
    // Wait a bit for page to load
    setTimeout(() => {
        console.log('🚀 Initializing Date Lens System...');
        
        // Check if date-scanner.js is loaded
        if (typeof DateScanner === 'undefined') {
            console.error('❌ DateScanner not found! Make sure date-scanner.js is loaded first.');
            return;
        }
        
        // Create global instance
        window.DateLens = new HeatMapSystem();
        
        console.log('✅ Date Lens System ready! Press Ctrl+F and look for the 📅 button.');
        
    }, 1000);
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeatMapSystem;
}