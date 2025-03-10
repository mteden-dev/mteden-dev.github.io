/**
 * Obsługa interfejsu użytkownika
 */
const UIService = {
    /**
     * Inicjalizacja UI
     */
    initialize: function() {
        // Remove old search elements
        const oldSearchPanel = document.getElementById('search-panel');
        const oldSearchToggle = document.getElementById('search-toggle');
        const mapSearchContainer = document.querySelector('.map-search-container');
        
        if (oldSearchPanel) oldSearchPanel.parentNode.removeChild(oldSearchPanel);
        if (oldSearchToggle) oldSearchToggle.parentNode.removeChild(oldSearchToggle);
        if (mapSearchContainer) mapSearchContainer.parentNode.removeChild(mapSearchContainer);
        
        // Continue with normal initialization
        this.restoreUIState();
        this.initEventListeners();
        
        // Initialize the new panel
        this.initializePanel();
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
        console.log("Point selected:", point.id);
        
        // Ensure we have a point with valid coordinates
        if (!point || !point.latitude || !point.longitude) {
            console.error("Invalid point or missing coordinates:", point);
            return;
        }
        
        const selectedPointContainer = document.getElementById('selected-point-container');
        const selectedPointName = document.getElementById('selected-point-name');
        
        // Update selected point info
        if (selectedPointName) {
            selectedPointName.textContent = point.name || point.id;
        }
        
        if (selectedPointContainer) {
            selectedPointContainer.style.display = 'block';
        }
        
        // Save last selected point
        this.saveLastSelectedPoint(point);
        
        // Center map on the selected point
        if (MapService && MapService.map) {
            // Always ensure we zoom to at least level 17, which is when clustering is disabled
            const currentZoom = MapService.map.getZoom();
            const targetZoom = Math.max(17, currentZoom); // Force level 17 minimum
            
            // Set view with animation
            MapService.setView([point.latitude, point.longitude], targetZoom);
            
            // Ensure the marker popup is opened
            if (MarkersService && MarkersService.markersById && MarkersService.markersById[point.id]) {
                console.log("Opening popup for marker:", point.id);
                MarkersService.markersById[point.id].marker.openPopup();
            }
            
            // Update nearest points list after zooming
            setTimeout(() => {
                if (MapService && typeof MapService.updateNearestPointsList === 'function') {
                    MapService.updateNearestPointsList();
                    
                    // Highlight the point in the nearest list
                    setTimeout(() => {
                        const nearestList = document.getElementById('nearest-points-list');
                        if (nearestList && nearestList.style.display !== 'none') {
                            // Find the selected point in the list
                            const pointItems = nearestList.querySelectorAll('.nearest-point-item');
                            let found = false;
                            
                            for (let i = 0; i < pointItems.length; i++) {
                                if (pointItems[i].textContent.includes(point.name || point.id)) {
                                    found = true;
                                    pointItems[i].classList.add('highlighted');
                                    pointItems[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    
                                    setTimeout(() => {
                                        pointItems[i].classList.remove('highlighted');
                                    }, 3000);
                                    break;
                                }
                            }
                            
                            // If not found, might need to zoom in more
                            if (!found && MapService.map.getZoom() < 18) {
                                MapService.setView([point.latitude, point.longitude], 18);
                            }
                        }
                    }, 300);
                }
            }, 300);
        }
        
        // On mobile, make sure the left panel is visible
        const leftPanel = document.getElementById('left-panel');
        if (leftPanel && window.innerWidth <= 768) {
            leftPanel.classList.add('open');
        }
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
    },

    /**
     * Zamyka kontener wybranego punktu
     */
    closeSelectedPoint: function() {
        const selectedPointContainer = document.getElementById('selected-point-container');
        const mapContainer = document.getElementById('map');
        
        selectedPointContainer.style.display = 'none';
        mapContainer.classList.remove('has-selected-point');
        
        // Adjust Leaflet map size
        if (MapService && MapService.map) {
            setTimeout(() => {
                MapService.map.invalidateSize();
            }, 100);
        }
    },

    /**
     * Initialize panel functionality
     */
    initializePanel: function() {
        // Set up carrier logo filters
        const carrierLogos = document.querySelectorAll('.carrier-logo');
        carrierLogos.forEach(logo => {
            logo.addEventListener('click', () => {
                // Remove active class from all logos
                carrierLogos.forEach(l => l.classList.remove('active'));
                
                // Add active class to clicked logo
                logo.classList.add('active');
                
                // Filter markers by carrier
                const carrier = logo.getAttribute('data-carrier');
                if (MarkersService && typeof MarkersService.filterByCarrier === 'function') {
                    MarkersService.filterByCarrier(carrier);
                }
            });
        });
        
        // Set up panel search
        const panelSearchButton = document.getElementById('panel-search-button');
        const panelSearchInput = document.getElementById('panel-search-input');
        const panelAutocomplete = document.getElementById('panel-search-autocomplete');

        if (panelSearchButton && panelSearchInput) {
            // Handle input for autocomplete
            let debounceTimer;
            
            panelSearchInput.addEventListener('input', function(e) {
                const query = e.target.value.trim();
                
                // Clear any existing timer
                clearTimeout(debounceTimer);
                
                // Clear the autocomplete container
                if (panelAutocomplete) {
                    panelAutocomplete.innerHTML = '';
                    panelAutocomplete.style.display = 'none';
                }
                
                if (query.length >= 2) {
                    debounceTimer = setTimeout(() => {
                        if (SearchService && typeof SearchService.searchPoints === 'function') {
                            const results = SearchService.searchPoints(query);
                            
                            if (results && results.length > 0 && panelAutocomplete) {
                                // Display autocomplete results
                                panelAutocomplete.innerHTML = '';
                                results.slice(0, 5).forEach(point => {
                                    const item = document.createElement('div');
                                    item.className = 'autocomplete-item';
                                    item.innerHTML = `<strong>${point.name || point.id}</strong><br>${point.address || ''}, ${point.city || ''}`;
                                    
                                    item.addEventListener('click', () => {
                                        panelSearchInput.value = point.name || point.id;
                                        panelAutocomplete.style.display = 'none';
                                        if (typeof this.selectPoint === 'function') {
                                            this.selectPoint(point);
                                        }
                                    });
                                    
                                    panelAutocomplete.appendChild(item);
                                });
                                
                                panelAutocomplete.style.display = 'block';
                            }
                        }
                        
                        // Try geocoding for longer queries
                        if (query.length >= 3 && GeocodingService && typeof GeocodingService.searchAddresses === 'function') {
                            GeocodingService.searchAddresses(query, (addresses) => {
                                if (addresses && addresses.length > 0 && panelAutocomplete) {
                                    // Add a separator if we already have results
                                    if (panelAutocomplete.children.length > 0) {
                                        const separator = document.createElement('div');
                                        separator.style.borderTop = '1px solid #ccc';
                                        separator.style.margin = '5px 0';
                                        separator.style.padding = '5px 12px';
                                        separator.style.color = '#666';
                                        separator.style.fontSize = '12px';
                                        separator.textContent = 'Adresy:';
                                        panelAutocomplete.appendChild(separator);
                                    }
                                    
                                    // Add address results
                                    addresses.slice(0, 3).forEach(address => {
                                        const item = document.createElement('div');
                                        item.className = 'autocomplete-item';
                                        item.innerHTML = `<em>Adres:</em> ${address.display_name}`;
                                        
                                        item.addEventListener('click', () => {
                                            panelSearchInput.value = address.display_name;
                                            panelAutocomplete.style.display = 'none';
                                            
                                            if (GeocodingService && typeof GeocodingService.showAddressOnMap === 'function') {
                                                GeocodingService.showAddressOnMap(address.lat, address.lon, address.display_name);
                                            }
                                        });
                                        
                                        panelAutocomplete.appendChild(item);
                                    });
                                    
                                    panelAutocomplete.style.display = 'block';
                                }
                            });
                        }
                    }, 300);
                }
            });
            
            // Handle search button click
            panelSearchButton.addEventListener('click', () => {
                const query = panelSearchInput.value.trim();
                if (query && SearchService && typeof SearchService.performSearch === 'function') {
                    SearchService.performSearch(query);
                    
                    // Hide autocomplete
                    if (panelAutocomplete) {
                        panelAutocomplete.style.display = 'none';
                    }
                }
            });
            
            // Handle Enter key
            panelSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = panelSearchInput.value.trim();
                    if (query && SearchService && typeof SearchService.performSearch === 'function') {
                        SearchService.performSearch(query);
                        
                        // Hide autocomplete
                        if (panelAutocomplete) {
                            panelAutocomplete.style.display = 'none';
                        }
                    }
                }
            });
        }
        
        // Add responsive panel toggle for mobile
        const body = document.body;
        const panelToggle = document.createElement('button');
        panelToggle.className = 'panel-toggle';
        panelToggle.innerHTML = '☰';
        panelToggle.title = 'Pokaż/ukryj panel';
        
        panelToggle.addEventListener('click', () => {
            const panel = document.getElementById('left-panel');
            if (panel) {
                panel.classList.toggle('open');
            }
        });
        
        if (window.innerWidth <= 768) {
            body.appendChild(panelToggle);
        }
        
        // Initial update of nearest points
        setTimeout(() => {
            if (MapService && typeof MapService.updateNearestPointsList === 'function') {
                MapService.updateNearestPointsList();
            }
        }, 1000);
    }
};