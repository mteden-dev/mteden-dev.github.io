/**
 * Obsługa interfejsu użytkownika
 */
const UIService = {
    /**
     * Inicjalizacja UI
     */
    initialize: function() {
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
        document.getElementById('search-toggle').addEventListener('click', this.toggleSearchPanel);
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
        const searchPanel = document.getElementById('search-panel');
        
        if (searchPanel.classList.contains('open')) {
            UIService.closeSearchPanel();
        } else {
            UIService.openSearchPanel();
        }
    },
    
    /**
     * Otwarcie panelu wyszukiwania
     */
    openSearchPanel: function() {
        const searchPanel = document.getElementById('search-panel');
        searchPanel.classList.add('open');
    },
    
    /**
     * Zamknięcie panelu wyszukiwania
     */
    closeSearchPanel: function() {
        const searchPanel = document.getElementById('search-panel');
        searchPanel.classList.remove('open');
    }
};