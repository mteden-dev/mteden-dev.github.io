/**
 * Obsługa interfejsu użytkownika
 */
const UIService = {
    /**
     * Inicjalizacja UI
     */
    initialize: function() {
        // Hide old search panel and toggle
        const oldSearchPanel = document.getElementById('search-panel');
        const oldSearchToggle = document.getElementById('search-toggle');
        
        if (oldSearchPanel) oldSearchPanel.style.display = 'none';
        if (oldSearchToggle) oldSearchToggle.style.display = 'none';
        
        // Continue with normal initialization
        this.restoreUIState();
        this.initEventListeners();
    },
    
    /**
     * Przywracanie stanu UI z localStorage
     */
    restoreUIState: function() {
        try {
            const uiState = localStorage.getItem('mapaUIState');
            if (uiState) {
                const state = JSON.parse(uiState);
                
                // Przywróć stan filtrów
                if (state.countryFilter) {
                    const countrySelector = document.getElementById('country-filter');
                    if (countrySelector) countrySelector.value = state.countryFilter;
                }
            }
        } catch (error) {
            console.warn('Nie można przywrócić stanu UI:', error);
        }
    },
    
    /**
     * Zapisanie stanu UI do localStorage
     */
    saveUIState: function() {
        try {
            const countrySelector = document.getElementById('country-filter');
            const citySelector = document.getElementById('city-filter');
            
            const uiState = {
                countryFilter: countrySelector ? countrySelector.value : 'pl',
                cityFilter: citySelector ? citySelector.value : 'all',
                lastUpdate: new Date().toISOString()
            };
            
            localStorage.setItem('mapaUIState', JSON.stringify(uiState));
        } catch (error) {
            console.warn('Nie można zapisać stanu UI:', error);
        }
    },
    
    /**
     * Inicjalizacja nasłuchiwania zdarzeń
     */
    initEventListeners: function() {
        // Obsługa filtrów
        document.getElementById('city-filter').addEventListener('change', () => {
            const selectedCity = document.getElementById('city-filter').value;
            MarkersService.addMarkers(selectedCity);
            this.saveUIState();
        });
        
        document.getElementById('country-filter').addEventListener('change', () => {
            const country = document.getElementById('country-filter').value;
            // Aktualizuj nagłówek aplikacji w zależności od wybranego kraju
            const headerTitle = document.querySelector('.header h1');
            if (headerTitle) {
                const countryName = Config.countries[country] || "Mapa Paczkomatów";
                headerTitle.textContent = `Mapa Paczkomatów - ${countryName}`;
            }
            
            App.loadPointsForSelectedCountry();
            this.saveUIState();
        });
        
        // Obsługa przycisku odświeżania
        document.getElementById('refresh-btn').addEventListener('click', () => {
            App.loadPointsForSelectedCountry();
        });
        
        // Obsługa przycisków cache
        document.getElementById('save-cache-btn').addEventListener('click', () => {
            CacheService.savePointsToCache();
        });
        
        document.getElementById('load-cache').addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                CacheService.loadPointsFromFile(event.target.files[0]);
            }
        });
        
        // Obsługa panelu wyszukiwania
        const searchToggleBtn = document.getElementById('search-toggle');
        if (!searchToggleBtn) {
            console.error("Search toggle button not found in DOM!");
            return;
        }
        
        console.log("Setting up search toggle event listener");
        searchToggleBtn.addEventListener('click', (event) => {
            console.log("Search toggle button clicked");
            event.preventDefault();
            this.toggleSearchPanel();
        });

        // Add direct test event after 3 seconds
        setTimeout(() => {
            console.log("Testing search panel toggle after timeout");
            this.toggleSearchPanel();
        }, 3000);
    },
    
    /**
     * Obsługa wyboru punktu
     * @param {Object} point - Wybrany punkt
     */
    selectPoint: function(point) {
        const selectedPointContainer = document.getElementById('selected-point-container');
        const selectedPointName = document.getElementById('selected-point-name');
        
        selectedPointName.textContent = point.name || point.id;
        selectedPointContainer.style.display = 'block';
        
        // Zapisz ostatnio wybrany punkt
        this.saveLastSelectedPoint(point);
        
        // Centruj mapę na wybranym punkcie
        if (point.latitude && point.longitude) {
            MapService.setView([point.latitude, point.longitude], 16);
            
            // Znajdź marker i otwórz popup
            if (MarkersService.markersById[point.id]) {
                MarkersService.markersById[point.id].marker.openPopup();
            }
        }
        
        // Zamknij panel wyszukiwania
        this.closeSearchPanel();
    },
    
    /**
     * Zapisz ostatnio wybrany punkt
     * @param {Object} point - Wybrany punkt
     */
    saveLastSelectedPoint: function(point) {
        try {
            localStorage.setItem('mapaLastSelectedPoint', JSON.stringify({
                id: point.id,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.warn('Nie można zapisać ostatnio wybranego punktu:', error);
        }
    },
    
    /**
     * Przełączanie widoczności panelu wyszukiwania
     */
    toggleSearchPanel: function() {
        console.log("Toggle search panel called");
        const searchPanel = document.getElementById('search-panel');
        
        if (!searchPanel) {
            console.error("Search panel element not found!");
            return;
        }
        
        console.log("Search panel current state:", searchPanel.classList.contains('open') ? "open" : "closed");
        
        if (searchPanel.classList.contains('open')) {
            console.log("Closing search panel");
            this.closeSearchPanel();
        } else {
            console.log("Opening search panel");
            this.openSearchPanel();
        }
    },
    
    /**
     * Otwarcie panelu wyszukiwania
     */
    openSearchPanel: function() {
        console.log("Open search panel called");
        const searchPanel = document.getElementById('search-panel');
        if (!searchPanel) {
            console.error("Search panel element not found in openSearchPanel!");
            return;
        }
        
        searchPanel.classList.add('open');
        console.log("Added 'open' class, current classes:", searchPanel.className);
        
        // Force panel visibility as a test
        searchPanel.style.display = 'block';
        searchPanel.style.transform = 'translateX(0)';
    },
    
    /**
     * Zamknięcie panelu wyszukiwania
     */
    closeSearchPanel: function() {
        console.log("Close search panel called");
        const searchPanel = document.getElementById('search-panel');
        if (!searchPanel) {
            console.error("Search panel element not found in closeSearchPanel!");
            return;
        }
        
        searchPanel.classList.remove('open');
        console.log("Removed 'open' class, current classes:", searchPanel.className);
        
        // Reset any forced styles
        searchPanel.style.display = '';
        searchPanel.style.transform = '';
    }
};