console.log('Loading App');

// Sprawdź dostępność globalnych obiektów
console.log('Global objects available:', {
    Config: typeof Config !== 'undefined',
    Utils: typeof Utils !== 'undefined',
    MapService: typeof MapService !== 'undefined',
    ApiService: typeof ApiService !== 'undefined',
    MarkersService: typeof MarkersService !== 'undefined'
});

/**
 * Główny moduł aplikacji
 */
class App {
    constructor() {
        // Sprawdzenie dostępności zależności
        if (typeof Utils === 'undefined') {
            console.error('Utils is not defined! Make sure utils.js is loaded before app.js');
        }
        
        // Cache DOM elements
        this.countrySelector = document.getElementById('country-filter');
        this.citySelector = document.getElementById('city-filter');
        
        // Bezpieczne przypisanie zależności
        this.apiService = typeof ApiService !== 'undefined' ? ApiService : null;
        this.mapService = typeof MapService !== 'undefined' ? MapService : null;
        this.markersService = typeof MarkersService !== 'undefined' ? MarkersService : null;
        this.searchService = typeof SearchService !== 'undefined' ? SearchService : null;
        this.uiService = typeof UIService !== 'undefined' ? UIService : null;
        this.integrationService = typeof IntegrationService !== 'undefined' ? IntegrationService : null;
    }
    
    /**
     * Inicjalizacja aplikacji
     */
    async initialize() {
        console.log('Initializing application');
        
        try {
            // Sprawdź czy wszystkie serwisy są dostępne
            if (!this.mapService) throw new Error('MapService not available');
            if (!this.apiService) throw new Error('ApiService not available');
            
            // Inicjalizacja integracji (jako pierwszy, aby odczytać parametry)
            if (this.integrationService) {
                this.integrationService.initialize();
            }
            
            // Inicjalizacja pozostałych serwisów
            this.mapService.initialize();
            this.uiService.initialize();
            this.searchService.initialize();
            
            // Zastosuj przekazane parametry
            await this.integrationService.applyInitialParams();
            
            // Próba wczytania cache lokalnego jeśli nie podano konkretnych parametrów
            if (!this.integrationService.params.address && !this.integrationService.params.city) {
                if (!this.tryLoadCacheFromStorage()) {
                    // Jeśli cache nie zadziałał, wczytaj punkty
                    await this.loadPointsForSelectedCountry();
                }
            } else {
                // Jeśli podano parametry, wczytaj punkty dla kraju
                await this.loadPointsForSelectedCountry();
            }
            
            if (typeof Utils !== 'undefined') {
                // Użyj Utils tylko jeśli jest zdefiniowany
                console.log('Utils available, using them');
            } else {
                console.error('Utils not available');
            }
        } catch (error) {
            console.error('Błąd podczas inicjalizacji aplikacji:', error);
            Utils.updateStatus('Nie można zainicjalizować aplikacji. Sprawdź konsolę.', false);
        }
    }
    
    /**
     * Próba wczytania cache z localStorage
     * @returns {boolean} - Czy udało się wczytać cache
     */
    tryLoadCacheFromStorage() {
        try {
            const cachedData = localStorage.getItem('mapaCacheData');
            if (!cachedData) return false;
            
            const parsedData = JSON.parse(cachedData);
            
            // Sprawdź wersję cache
            if (parsedData.version !== Config.cache.version) return false;
            
            // Sprawdź czy dane nie są za stare (jeśli skonfigurowano TTL)
            if (Config.cache.ttlHours) {
                const cacheTime = new Date(parsedData.timestamp).getTime();
                const currentTime = new Date().getTime();
                const cacheAgeHours = (currentTime - cacheTime) / (1000 * 60 * 60);
                
                if (cacheAgeHours > Config.cache.ttlHours) {
                    console.log(`Cache przeterminowane (${cacheAgeHours.toFixed(1)} godzin)`);
                    return false;
                }
            }
            
            Utils.updateStatus('Wczytywanie danych z cache...', true);
            
            // Ustaw punkty z cache
            this.markersService.setPoints(parsedData.points);
            
            // Odśwież mapę i wyszukiwarkę
            this.refreshMap();
            this.searchService.buildSearchIndex();
            
            Utils.updateStatus(`Załadowano ${parsedData.points.length} punktów z cache lokalnego`, false);
            return true;
        } catch (error) {
            console.warn('Nie można wczytać cache z lokalnego storage:', error);
            // Usuń uszkodzony cache
            localStorage.removeItem('mapaCacheData');
            return false;
        }
    }
    
    /**
     * Ładowanie punktów dla wybranego kraju
     */
    async loadPointsForSelectedCountry() {
        try {
            const selectedCountry = this.countrySelector.value;
            
            Utils.updateStatus('Pobieranie punktów...', true);
            
            // Uwzględnij ewentualnego przewoźnika z parametrów
            let points;
            const carrier = this.integrationService.params.carrier;
            if (carrier) {
                points = await this.apiService.fetchPointsForCarrier(
                    selectedCountry,
                    carrier
                );
            } else {
                // Standardowe pobieranie punktów
                points = await this.apiService.fetchPoints(selectedCountry);
            }
            
            if (!points || points.length === 0) {
                throw new Error('Nie znaleziono punktów dla wybranego kraju');
            }
            
            // Ustaw punkty w serwisie markerów
            this.markersService.setPoints(points);
            
            // Zapisz punkty do localStorage dla szybkiego dostępu przy następnym uruchomieniu
            this.savePointsToLocalStorage(points);
            
            // Odśwież mapę
            this.refreshMap();
            
            // Zaktualizuj indeks wyszukiwania
            this.searchService.buildSearchIndex();
            
            Utils.updateStatus(`Załadowano ${points.length} punktów`, false);
        } catch (error) {
            console.error('Błąd podczas ładowania punktów:', error);
            Utils.updateStatus(`Nie udało się załadować punktów: ${error.message}`, false);
        }
    }
    
    /**
     * Zapisanie punktów do localStorage
     * @param {Array} points - Punkty do zapisania
     */
    savePointsToLocalStorage(points) {
        try {
            const cacheData = {
                timestamp: new Date().toISOString(),
                points: points,
                version: Config.cache.version
            };
            
            localStorage.setItem('mapaCacheData', JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Nie można zapisać punktów do localStorage:', error);
            // Możliwe przepełnienie localStorage lub inne ograniczenia
            try {
                localStorage.removeItem('mapaCacheData');
            } catch (e) {
                console.error('Nie można usunąć cache:', e);
            }
        }
    }
    
    /**
     * Odświeżenie mapy
     */
    refreshMap() {
        try {
            // Dostosuj widok mapy do kraju
            this.mapService.fitToCountry(this.countrySelector.value);
            
            // Zaktualizuj opcje filtra miasta
            this.updateCityFilterOptions();
            
            // Dodaj markery
            this.markersService.addMarkers(this.citySelector.value);
            
            // Dodaj legendę
            this.mapService.addLegend();
        } catch (error) {
            console.error('Błąd podczas odświeżania mapy:', error);
            Utils.updateStatus('Wystąpił błąd podczas odświeżania mapy.', false);
        }
    }
    
    /**
     * Aktualizacja opcji filtra miasta
     */
    updateCityFilterOptions() {
        const selectedCity = this.citySelector.value; // Zachowaj aktualny wybór
        
        // Wyczyść istniejące opcje, ale zachowaj domyślną
        while (this.citySelector.options.length > 1) {
            this.citySelector.remove(1);
        }
        
        // Zbierz unikalne miasta
        const cities = [...new Set(
            this.markersService.allPoints
                .map(point => point.city)
                .filter(city => city) // Wyklucz puste/undefined
        )].sort();
        
        // Utwórz fragment DOM dla wydajności
        const fragment = document.createDocumentFragment();
        
        // Dodaj miasta jako opcje
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            fragment.appendChild(option);
        });
        
        // Dodaj wszystkie opcje jednocześnie
        this.citySelector.appendChild(fragment);
        
        // Przywróć wybraną wartość lub ustaw nową z parametrów
        if (this.integrationService.params.city) {
            const cityLower = this.integrationService.params.city.toLowerCase();
            
            // Znajdź option z pasującym miastem (bez uwzględniania wielkości liter)
            for (let i = 0; i < this.citySelector.options.length; i++) {
                if (this.citySelector.options[i].value.toLowerCase() === cityLower) {
                    this.citySelector.selectedIndex = i;
                    // Uruchom event change ręcznie
                    this.citySelector.dispatchEvent(new Event('change'));
                    break;
                }
            }
        } else {
            this.citySelector.value = selectedCity;
        }
    }
}

// Uruchomienie aplikacji po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});