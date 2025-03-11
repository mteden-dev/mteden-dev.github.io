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
        
        // Create carrier filters dynamically
        this.createCarrierFilters();
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
     * Handle point selection 
     * @param {Object} point - The selected point
     */
    selectPoint: function(point) {
        if (!point) return;
        
        console.log("Point selected:", point.id, point.name);
        
        // Skip showing the selection panel as it's been removed
        // The point will still be selected for other operations but won't show in a panel
        
        // If you need any other functionality when a point is selected, keep it below:
        // For example, highlighting the point on the map
        if (MarkersService && MarkersService.markersById && MarkersService.markersById[point.id]) {
            const marker = MarkersService.markersById[point.id].marker;
            if (marker) {
                marker.openPopup();
            }
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
    },

    /**
     * Create carrier filter buttons dynamically
     */
    createCarrierFilters: function() {
        const carrierFiltersContainer = document.getElementById('carrier-filters');
        if (!carrierFiltersContainer) return;
        
        // Clear existing filters
        carrierFiltersContainer.innerHTML = '';
        
        // Add "All" filter first
        const allFilterBtn = document.createElement('div');
        allFilterBtn.className = 'carrier-logo active';
        allFilterBtn.setAttribute('data-carrier', 'all');
        allFilterBtn.title = 'All carriers';
        allFilterBtn.innerHTML = '<img src="img/all-carriers.png" alt="All carriers">';
        
        allFilterBtn.addEventListener('click', () => {
            // Remove active class from all carrier logos
            document.querySelectorAll('.carrier-logo').forEach(logo => {
                logo.classList.remove('active');
            });
            
            // Add active class to clicked logo
            allFilterBtn.classList.add('active');
            
            // Apply filter
            if (MarkersService && typeof MarkersService.filterByCarrier === 'function') {
                MarkersService.filterByCarrier('all');
            }
        });
        
        carrierFiltersContainer.appendChild(allFilterBtn);
        
        // Add carrier-specific filters
        if (Config.carriers) {
            Object.entries(Config.carriers).forEach(([carrierId, carrier]) => {
                const filterBtn = document.createElement('div');
                filterBtn.className = 'carrier-logo';
                filterBtn.setAttribute('data-carrier', carrierId);
                filterBtn.title = carrier.name;
                filterBtn.innerHTML = `<img src="${carrier.logo}" alt="${carrier.name}">`;
                
                filterBtn.addEventListener('click', () => {
                    // Remove active class from all carrier logos
                    document.querySelectorAll('.carrier-logo').forEach(logo => {
                        logo.classList.remove('active');
                    });
                    
                    // Add active class to clicked logo
                    filterBtn.classList.add('active');
                    
                    // Apply filter
                    if (MarkersService && typeof MarkersService.filterByCarrier === 'function') {
                        MarkersService.filterByCarrier(carrierId);
                    }
                });
                
                carrierFiltersContainer.appendChild(filterBtn);
            });
        }
    },

    /**
     * Initialize carrier filter panel
     */
    initializeCarrierPanel: function() {
        const carrierPanel = document.getElementById('carrier-panel');
        if (!carrierPanel) return;
        
        // Clear existing content
        carrierPanel.innerHTML = '';
        
        // Add "All" option
        const allDiv = document.createElement('div');
        allDiv.className = 'carrier-logo active';
        allDiv.setAttribute('data-carrier', 'all');
        allDiv.innerHTML = '<span>Wszystkie</span>';
        allDiv.addEventListener('click', (e) => {
            // Remove active class from all filters
            document.querySelectorAll('.carrier-logo').forEach(el => {
                el.classList.remove('active');
            });
            
            // Add active class to clicked filter
            e.currentTarget.classList.add('active');
            
            // Apply filter but with error handling
            try {
                if (MarkersService && typeof MarkersService.filterByCarrier === 'function') {
                    // Make sure MapService.map is initialized
                    if (!MapService.map) {
                        console.error('Map is not initialized');
                        MapService.initialize();
                    }
                    
                    // Now filter the markers
                    MarkersService.filterByCarrier('all');
                } else {
                    console.error('MarkersService.filterByCarrier not available');
                }
            } catch (err) {
                console.error('Error filtering by carrier:', err);
            }
        });
        carrierPanel.appendChild(allDiv);
        
        // Add configured carriers
        for (const carrierId in Config.carriers) {
            const carrier = Config.carriers[carrierId];
            const carrierDiv = document.createElement('div');
            carrierDiv.className = 'carrier-logo';
            carrierDiv.setAttribute('data-carrier', carrierId);
            
            // Create content based on available info
            if (carrier.logo) {
                carrierDiv.innerHTML = `<img src="${carrier.logo}" alt="${carrier.name}" title="${carrier.name}">`;
            } else {
                carrierDiv.innerHTML = `<span style="background-color:${carrier.color}">${carrier.name}</span>`;
            }
            
            // Add click handler with proper error handling
            carrierDiv.addEventListener('click', (e) => {
                // Remove active class from all filters
                document.querySelectorAll('.carrier-logo').forEach(el => {
                    el.classList.remove('active');
                });
                
                // Add active class to clicked filter
                e.currentTarget.classList.add('active');
                
                // Apply filter with error handling
                try {
                    if (MarkersService && typeof MarkersService.filterByCarrier === 'function') {
                        // Make sure MapService.map is initialized
                        if (!MapService.map) {
                            console.error('Map is not initialized');
                            MapService.initialize();
                        }
                        
                        // Now filter the markers
                        MarkersService.filterByCarrier(carrierId);
                    } else {
                        console.error('MarkersService.filterByCarrier not available');
                    }
                } catch (err) {
                    console.error('Error filtering by carrier:', err);
                }
            });
            
            carrierPanel.appendChild(carrierDiv);
        }
    }
};