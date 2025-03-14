console.log('Loading App');

// Sprawdź dostępność globalnych obiektów
console.log('Global objects available:', {
    Config: typeof Config !== 'undefined',
    Utils: typeof Utils !== 'undefined',
    MapService: typeof MapService !== 'undefined',
    ApiService: typeof ApiService !== 'undefined',
    MarkersService: typeof MarkersService !== 'undefined'
});

// Funkcja pomocnicza do bezpiecznego używania Utils
function safeUseUtils(callback, fallback) {
    if (typeof Utils !== 'undefined') {
        return callback(Utils);
    } else {
        console.error('Utils not available, using fallback');
        return fallback ? fallback() : null;
    }
}

/**
 * Główny moduł aplikacji
 */
console.log('Loading App');

// Dodaj kontener dla serwisów jako globalny obiekt
window.Services = {};

class App {
    constructor() {
        console.log('App constructor');
        
        // Cache DOM elements
        this.countrySelector = document.getElementById('country-filter');
        this.citySelector = document.getElementById('city-filter');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.saveCacheBtn = document.getElementById('save-cache-btn');
        this.loadCacheInput = document.getElementById('load-cache');
        this.searchToggle = document.getElementById('search-toggle');
        this.searchPanel = document.getElementById('search-panel');
        this.searchInput = document.getElementById('unified-search-input');
        this.searchBtn = document.getElementById('search-btn');
        this.searchResults = document.getElementById('search-results');
        this.searchResultsTitle = document.getElementById('search-results-title');
        this.statusText = document.getElementById('status-text');
        this.loadingIndicator = document.getElementById('loading-indicator');
        
        // Zamiast tego użyj bezpośrednio zmiennych globalnych i zapisz je w lokalnych referencjach
        this.apiService = ApiService || {};
        this.mapService = MapService || {};
        this.markersService = MarkersService || {};
        this.searchService = SearchService || {};
        this.uiService = UIService || {};
        this.integrationService = IntegrationService || {};
        this.cacheService = CacheService || {};
        this.geocodingService = GeocodingService || {};
        
        // Zapisz referencje w globalnym obiekcie Services dla dostępu z innych miejsc
        window.Services.apiService = this.apiService;
        window.Services.mapService = this.mapService;
        window.Services.markersService = this.markersService;
        window.Services.searchService = this.searchService;
        window.Services.uiService = this.uiService;
        window.Services.integrationService = this.integrationService;
        window.Services.cacheService = this.cacheService;
        window.Services.geocodingService = this.geocodingService;
        
        // Diagnostyka
        console.log('Config available:', typeof Config !== 'undefined');
        console.log('ApiService available:', !!this.apiService);
        console.log('MapService available:', !!this.mapService);
        console.log('MarkersService available:', !!this.markersService);
    }
    
    /**
     * Inicjalizacja aplikacji
     */
    async initialize() {
        console.log('Initializing application');
        
        try {
            // Initialize map and UI first
            if (this.mapService && typeof this.mapService.initialize === 'function') {
                this.mapService.initialize();
            }
            
            if (this.uiService && typeof this.uiService.initialize === 'function') {
                this.uiService.initialize();
            }
            
            if (this.searchService && typeof this.searchService.initNewSearchInterface === 'function') {
                this.searchService.initNewSearchInterface();
            }
            
            if (SearchService && typeof SearchService.createSearchElements === 'function') {
                SearchService.createSearchElements();
            }
            
            // First load main points
            await this.loadPointsForSelectedCountry();
            
            // Then load DPD points once
            await this.loadDPDPoints();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize integration service
            if (this.integrationService && typeof this.integrationService.initialize === 'function') {
                this.integrationService.initialize();
            }
            
            this.updateStatus('Aplikacja gotowa', false);
            console.log('Application initialized');
        } catch (error) {
            console.error('Error during app initialization:', error);
            this.updateStatus('Błąd inicjalizacji aplikacji: ' + error.message, false);
        }
    }
    
    /**
     * Konfiguracja obsługi zdarzeń
     */
    setupEventListeners() {
        console.log('Setting up event listeners');
        
        try {
            // Filtrowanie po kraju
            if (this.countrySelector) {
                this.countrySelector.addEventListener('change', () => {
                    this.loadPointsForSelectedCountry();
                    
                    // Dostosuj widok mapy do wybranego kraju
                    const countryCode = this.countrySelector.value;
                    if (countryCode !== 'all' && this.mapService && typeof this.mapService.fitToCountry === 'function') {
                        this.mapService.fitToCountry(countryCode);
                    }
                });
            }
            
            // Filtrowanie po mieście
            if (this.citySelector) {
                this.citySelector.addEventListener('change', () => {
                    const cityName = this.citySelector.value;
                    if (this.markersService && typeof this.markersService.filterByCity === 'function') {
                        this.markersService.filterByCity(cityName);
                    }
                });
            }
            
            // Przycisk odświeżania
            if (this.refreshBtn) {
                this.refreshBtn.addEventListener('click', () => {
                    this.loadPointsForSelectedCountry(true);
                });
            }
            
            // Obsługa zapisywania cache
            if (this.saveCacheBtn && this.cacheService) {
                this.saveCacheBtn.addEventListener('click', () => {
                    if (typeof this.cacheService.savePointsToFile === 'function') {
                        this.cacheService.savePointsToFile();
                    }
                });
            }
            
            // Obsługa wczytywania cache
            if (this.loadCacheInput && this.cacheService) {
                this.loadCacheInput.addEventListener('change', (event) => {
                    if (typeof this.cacheService.loadPointsFromFile === 'function') {
                        const file = event.target.files[0];
                        if (file) {
                            this.cacheService.loadPointsFromFile(file)
                                .then(points => {
                                    if (this.markersService) {
                                        this.markersService.clearMarkers();
                                        this.markersService.addMarkers(points);
                                    }
                                    this.updateCityFilter();
                                })
                                .catch(error => {
                                    console.error('Error loading points from file:', error);
                                    this.updateStatus('Błąd podczas ładowania punktów: ' + error.message, false);
                                });
                        }
                    }
                });
            }
            
            // Przełączanie panelu wyszukiwania
            if (this.searchToggle && this.searchPanel) {
                this.searchToggle.addEventListener('click', () => {
                    this.searchPanel.classList.toggle('active');
                });
            }
            
            // Obsługa wyszukiwania
            if (this.searchBtn && this.searchInput && this.searchService) {
                this.searchBtn.addEventListener('click', () => {
                    const query = this.searchInput.value.trim();
                    if (query && typeof this.searchService.search === 'function') {
                        this.performSearch(query);
                    }
                });
                
                // Obsługa wciśnięcia Enter w polu wyszukiwania
                this.searchInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter') {
                        const query = this.searchInput.value.trim();
                        if (query && typeof this.searchService.search === 'function') {
                            this.performSearch(query);
                        }
                    }
                });
                
                // Autouzupełnianie
                if (typeof this.searchService.setupAutocomplete === 'function') {
                    this.searchService.setupAutocomplete(
                        this.searchInput,
                        document.getElementById('unified-autocomplete')
                    );
                }
            }
            
            console.log('Event listeners set up');
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }
    
    /**
     * Ładowanie punktów dla wybranego kraju
     * @param {boolean} forceRefresh - Czy wymusić odświeżenie z API zamiast cache
     * @returns {Promise<Array>} - Promise z tablicą punktów
     */
    async loadPointsForSelectedCountry(forceRefresh = false) {
        const countryCode = this.countrySelector ? this.countrySelector.value : 'all';
        console.log('Loading points for country:', countryCode, forceRefresh ? '(forced refresh)' : '');
        
        this.updateStatus('Pobieranie danych...', true);
        
        try {
            // Sprawdź czy apiService jest dostępny
            if (!this.apiService || typeof this.apiService.getPoints !== 'function') {
                throw new Error('API service not available');
            }
            
            // Załaduj punkty z API
            const points = await this.apiService.getPoints(countryCode);
            
            if (!points || !points.length) {
                console.warn('No points received from API');
                this.updateStatus('Nie znaleziono żadnych punktów', false);
                return [];
            }
            
            console.log(`Received ${points.length} points`);
            console.log('Points:', points); // Log the points received
            
            // Dodaj markery na mapę
            if (this.markersService) {
                if (typeof this.markersService.clearMarkers === 'function') {
                    this.markersService.clearMarkers();
                }
                
                if (typeof this.markersService.addMarkers === 'function') {
                    this.markersService.addMarkers(points);
                } else {
                    console.error('MarkersService.addMarkers method not available');
                }
            } else {
                console.error('MarkersService not available');
            }
            
            // Aktualizuj filtr miast
            this.updateCityFilter();
            
            this.updateStatus(`Załadowano ${points.length} punktów`, false);
            return points;
        } catch (error) {
            console.error('Error loading points:', error);
            this.updateStatus('Błąd podczas ładowania punktów: ' + error.message, false);
            return [];
        }
    }
    
    /**
     * Aktualizacja filtra miast
     */
    updateCityFilter() {
        console.log('Updating city filter');
        
        try {
            if (!this.citySelector || !this.markersService || 
                typeof this.markersService.getUniqueCities !== 'function') {
                return;
            }
            
            const cities = this.markersService.getUniqueCities();
            
            // Zachowaj aktualnie wybraną wartość
            const currentValue = this.citySelector.value;
            
            // Wyczyść opcje filtra miast, zachowując opcję "wszystkie"
            while (this.citySelector.options.length > 1) {
                this.citySelector.remove(1);
            }
            
            // Dodaj opcje dla każdego miasta
            cities.sort().forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                this.citySelector.appendChild(option);
            });
            
            // Przywróć poprzednią wartość, jeśli istnieje w nowej liście
            if (currentValue !== 'all') {
                const exists = Array.from(this.citySelector.options)
                    .some(option => option.value === currentValue);
                
                if (exists) {
                    this.citySelector.value = currentValue;
                    
                    // Filtruj markery zgodnie z wybranym miastem
                    if (typeof this.markersService.filterByCity === 'function') {
                        this.markersService.filterByCity(currentValue);
                    }
                }
            }
            
            console.log(`City filter updated with ${cities.length} cities`);
        } catch (error) {
            console.error('Error updating city filter:', error);
        }
    }
    
    /**
     * Wykonanie wyszukiwania
     * @param {string} query - Zapytanie wyszukiwania
     */
    async performSearch(query) {
        console.log('Performing search for:', query);
        this.updateStatus('Wyszukiwanie...', true);
        
        try {
            if (!this.searchService || typeof this.searchService.search !== 'function') {
                throw new Error('Search service not available');
            }
            
            const results = await this.searchService.search(query);
            
            // Wyświetl wyniki
            this.displaySearchResults(results);
            
            this.updateStatus('Wyszukiwanie zakończone', false);
        } catch (error) {
            console.error('Search error:', error);
            this.updateStatus('Błąd wyszukiwania: ' + error.message, false);
            
            // Wyświetl pusty wynik
            this.displaySearchResults([]);
        }
    }
    
    /**
     * Wyświetlenie wyników wyszukiwania
     * @param {Array} results - Wyniki wyszukiwania
     */
    displaySearchResults(results) {
        console.log(`Displaying ${results.length} search results`);
        
        if (!this.searchResults || !this.searchResultsTitle) {
            console.error('Search results elements not found');
            return;
        }
        
        // Wyczyść poprzednie wyniki
        this.searchResults.innerHTML = '';
        
        if (results.length === 0) {
            // Brak wyników
            this.searchResultsTitle.style.display = 'block';
            this.searchResults.innerHTML = '<div class="no-results">Brak wyników</div>';
            return;
        }
        
        // Pokaż tytuł sekcji wyników
        this.searchResultsTitle.style.display = 'block';
        
        // Dodaj elementy dla każdego wyniku
        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.className = 'search-result-item';
            
            let content = '';
            
            if (result.type === 'point') {
                // Wynik jest punktem (paczkomat, placówka, itp.)
                content = `
                    <div class="result-name">${result.name || 'Nieznany punkt'}</div>
                    <div class="result-address">${result.address || ''}</div>
                `;
            } else if (result.type === 'address') {
                // Wynik jest adresem (wynik geokodowania)
                content = `
                    <div class="result-name">${result.display_name || result.formatted || 'Adres'}</div>
                    <div class="result-address">${result.address || ''}</div>
                `;
            }
            
            resultElement.innerHTML = content;
            
            // Dodaj obsługę kliknięcia
            resultElement.addEventListener('click', () => {
                if (result.lat && result.lng && this.mapService && 
                    typeof this.mapService.panTo === 'function') {
                    
                    this.mapService.panTo([result.lat, result.lng], 15);
                    
                    // Jeśli to jest punkt, pokaż go na mapie
                    if (result.type === 'point' && this.markersService &&
                        typeof this.markersService.highlightMarker === 'function') {
                        
                        this.markersService.highlightMarker(result.id);
                    }
                    
                    // Zamknij panel wyszukiwania na urządzeniach mobilnych
                    if (window.innerWidth < 768 && this.searchPanel) {
                        this.searchPanel.classList.remove('active');
                    }
                }
            });
            
            this.searchResults.appendChild(resultElement);
        });
    }
    
    /**
     * Aktualizacja paska statusu
     * @param {string} message - Wiadomość do wyświetlenia
     * @param {boolean} loading - Czy pokazać wskaźnik ładowania
     */
    updateStatus(message, loading = false) {
        console.log('Status update:', message, loading ? '(loading)' : '');
        
        if (this.statusText) {
            this.statusText.textContent = message;
        }
        
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = loading ? 'inline-block' : 'none';
        }
    }

    /**
     * Load DPD points from API
     */
    loadDPDPoints() {
        console.log('Loading DPD points from:', Config.carriers.dpd.apiUrl);
        Utils.updateStatus('Ładowanie punktów DPD...', true);
        
        return fetch(Config.carriers.dpd.apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`Loaded ${data.length} DPD points`);
                
                // Process points to ensure they have the right type
                const processedPoints = data.map(point => {
                    return {...point, type: 'DPD'};
                });
                
                // IMPORTANT: Get a count of current InPost points for verification
                const currentInpostPoints = MarkersService.allPoints.filter(p => 
                    p && ((p.type && p.type.toLowerCase().includes('inpost')) || 
                         (p.type && p.type.toLowerCase().includes('paczkomat')))
                ).length;
                
                console.log(`Current points before adding DPD: ${MarkersService.allPoints.length} (InPost: ${currentInpostPoints})`);
                
                // Preserve all existing points (especially InPost) by creating a new combined array
                const combinedPoints = [...MarkersService.allPoints];
                
                // Add only new DPD points that don't already exist
                const existingIds = new Set(combinedPoints.map(p => p.id));
                const newPoints = processedPoints.filter(p => !existingIds.has(p.id));
                
                // Add the new DPD points to the combined array
                combinedPoints.push(...newPoints);
                
                // Update the marker service with the combined points
                MarkersService.setPoints(combinedPoints);
                
                console.log(`Added ${newPoints.length} new DPD points to total collection`);
                
                // Re-apply current carrier filter
                const activeLogo = document.querySelector('.carrier-logo.active');
                const currentCarrier = activeLogo ? activeLogo.getAttribute('data-carrier') : 'all';
                console.log(`Re-applying current carrier filter: ${currentCarrier}`);
                
                // Always show all points initially after adding DPD
                MarkersService.filterByCarrier('all');
                
                // Verify the counts after loading
                const afterInpostPoints = MarkersService.allPoints.filter(p => 
                    p && ((p.type && p.type.toLowerCase().includes('inpost')) || 
                         (p.type && p.type.toLowerCase().includes('paczkomat')))
                ).length;
                
                console.log(`After adding DPD - Total: ${MarkersService.allPoints.length}, InPost: ${afterInpostPoints}, DPD: ${newPoints.length}`);
                
                Utils.updateStatus(`Załadowano ${newPoints.length} punktów DPD`, false);
                return newPoints;
            })
            .catch(error => {
                console.error('Error loading DPD points:', error);
                Utils.updateStatus('Błąd ładowania punktów DPD', false);
                return [];
            });
    }

    /**
     * Load points for a country
     * @param {string} countryCode - Country code
     * @param {string} city - Optional city filter
     */
    async loadPointsForCountry(countryCode, city) {
        console.log(`Loading points for country: ${countryCode} ${city || ''}`);
        
        // Update status
        Utils.updateStatus('Pobieranie danych...', true);
        
        try {
            // First, load all types of points at once to ensure they're displayed properly
            const [inpostPoints, dpdPoints] = await Promise.all([
                // Load InPost points
                ApiService.fetchPointsFromUrl(Config.carriers.inpost.apiUrl),
                // Load DPD points
                ApiService.fetchPointsFromUrl(Config.carriers.dpd.apiUrl)
            ]);
            
            console.log(`Received ${inpostPoints.length} InPost points and ${dpdPoints.length} DPD points`);
            
            // Combine all points
            const allPoints = [...inpostPoints, ...dpdPoints];
            
            // Set the combined points at once in MarkersService
            MarkersService.setPoints(allPoints);
            
            // Add markers for all points immediately
            MarkersService.addMarkers('all');
            
            // Update city filter
            this.updateCityFilterOptions();
            
            // Update status with total count
            Utils.updateStatus(`Załadowano ${allPoints.length} punktów`, false);
            
            // Build search index with all points
            if (SearchService && typeof SearchService.buildSearchIndex === 'function') {
                SearchService.buildSearchIndex(allPoints);
            }
        } catch (error) {
            console.error('Error loading points:', error);
            Utils.updateStatus('Błąd pobierania danych', false);
        }
    }
}

// Dodaj globalną zmienną dla instancji App
let app; // Zmień na globalną zmienną

// Na końcu pliku, gdzie tworzysz instancję:
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, explicitly initializing UI service");
    if (UIService && typeof UIService.initialize === 'function') {
        UIService.initialize();
    } else {
        console.error("UIService not available for initialization");
    }
    
    // App initialization continues...
    try {
        console.log('DOM loaded, initializing app');
        
        // Na wszelki wypadek sprawdź dostępność usług
        console.log('Services available at initialization:');
        console.log('- ApiService:', typeof ApiService !== 'undefined');
        console.log('- MapService:', typeof MapService !== 'undefined');
        console.log('- MarkersService:', typeof MarkersService !== 'undefined');
        
        // Utwórz aplikację
        window.app = new App();
        window.app.initialize();
        
        // Dla wstecznej kompatybilności z kodem używającym App.metoda()
        window.App = {
            loadPointsForSelectedCountry: (...args) => window.app.loadPointsForSelectedCountry(...args),
            updateCityFilter: (...args) => window.app.updateCityFilter(...args),
            updateCityFilterOptions: (...args) => window.app.updateCityFilter(...args),
            refreshMap: () => {
                if (window.app.mapService && window.app.mapService.initialize) {
                    window.app.mapService.initialize();
                }
            },
            savePointsToLocalStorage: (points) => {
                if (window.app.cacheService && window.app.cacheService.savePointsToLocalStorage) {
                    window.app.cacheService.savePointsToLocalStorage(points);
                }
            }
        };
    } catch (error) {
        console.error('Failed to initialize application:', error);
        
        // Wyświetl użytkownikowi informację o błędzie
        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.textContent = 'Błąd podczas inicjalizacji aplikacji: ' + error.message;
        }
    }
});

/**
 * Adjust map size to fill the viewport or modal
 */
function adjustMapSize() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;
    
    const isModalMode = document.body.classList.contains('modal-mode');
    
    if (isModalMode) {
        // In modal mode, fill the modal container
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            mapElement.style.height = `${modalContent.clientHeight}px`;
        } else {
            // If no modal content container, use viewport height minus estimated header/footer
            mapElement.style.height = 'calc(100vh - 50px)';
        }
    } else {
        // In full page mode, use full viewport height
        mapElement.style.height = '100vh';
    }
    
    // Notify the map that its container size has changed
    if (MapService && MapService.map) {
        MapService.map.invalidateSize();
    }
}

// Add this to your initialization code
window.addEventListener('load', adjustMapSize);
window.addEventListener('resize', adjustMapSize);

// Call this function whenever UI elements that might affect layout are toggled
function onUIChange() {
    setTimeout(adjustMapSize, 100);
}

// Add to the map initialization method
if (MapService && MapService.initialize) {
    const originalInitialize = MapService.initialize;
    MapService.initialize = function() {
        const result = originalInitialize.apply(this, arguments);
        adjustMapSize();
        return result;
    };
}