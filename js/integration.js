/**
 * Serwis integracji z zewnętrznymi systemami
 */
const IntegrationService = {
    // Parametry przekazane do aplikacji
    params: {},
    
    // Tryb aplikacji (standalone lub modal)
    mode: 'standalone',
    
    /**
     * Inicjalizacja serwisu integracji
     */
    initialize: function() {
        console.log('Initializing integration service with config:', Config);
        this.parseUrlParams();
        
        // Ustaw tryb aplikacji
        this.mode = this.params.mode || Config.mode.default;
        
        console.log('Tryb aplikacji:', this.mode);
        console.log('Parametry:', this.params);
        
        // Dostosuj interfejs do trybu
        if (this.mode === 'modal') {
            this.setupModalMode();
        }
        
        // Dodaj nasłuchiwanie zmian widoku mapy
        this.setupMapMoveEndEvent();
        
        // Dodaj opóźnienie, aby mapa zdążyła się zainicjalizować przed ładowaniem punktów
        console.log('Setting timeout for automatic points loading');
        setTimeout(() => {
            console.log('Automatically loading points in viewport');
            this.loadPointsInViewport();
        }, 500);
    },
    
    /**
     * Parsowanie parametrów z URL
     */
    parseUrlParams: function() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Odczytaj wszystkie parametry
        this.params = {
            mode: urlParams.get('mode'),
            country: urlParams.get('country'),
            city: urlParams.get('city'),
            address: urlParams.get('address'),
            carrier: urlParams.get('carrier')
        };
        
        // Odfiltruj parametry null/undefined
        Object.keys(this.params).forEach(key => {
            if (this.params[key] === null) {
                delete this.params[key];
            }
        });
    },
    
    /**
     * Konfiguracja trybu modalnego
     */
    setupModalMode: function() {
        // Dodaj klasę do body wskazującą na tryb modalny
        document.body.classList.add('modal-mode');
        
        // Dodaj przycisk wyboru punktu do popupu markera
        if (MarkersService) {
            MarkersService.popupSelectButtonText = Config.mode.modalSelectButtonText;
        }
        
        // Ukryj niektóre elementy UI w trybie modalnym (opcjonalnie)
        const elementsToHide = document.querySelectorAll('.hide-in-modal');
        elementsToHide.forEach(el => {
            el.style.display = 'none';
        });
        
        // Dodaj przycisk powrotu/zamknięcia
        const closeButton = document.createElement('button');
        closeButton.id = 'close-modal-btn';
        closeButton.textContent = '✕';
        closeButton.className = 'modal-close-btn';
        closeButton.title = 'Zamknij';
        closeButton.addEventListener('click', () => {
            window.parent.postMessage({ action: 'closeModal' }, '*');
        });
        
        document.body.appendChild(closeButton);
        
        // Zmień tekst przycisku wybierania punktu w popupie
        const style = document.createElement('style');
        style.textContent = `
            .leaflet-popup-content button {
                background-color: #4CAF50;
                color: white;
                border: none;
                padding: 8px 12px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 14px;
                margin: 4px 2px;
                cursor: pointer;
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    },
    
    /**
     * Konfiguracja nasłuchiwania zmian widoku mapy
     */
    setupMapMoveEndEvent: function() {
        console.log('Setting up map move end event');
        if (MapService && MapService.map) {
            MapService.map.on('moveend', () => {
                // Opcjonalnie: Automatyczne ładowanie punktów przy każdej zmianie widoku mapy
                // this.loadPointsInViewport();
            });
            
            // Dodatkowe flagi do śledzenia interakcji użytkownika
            MapService.map.on('dragstart', () => {
                MapService.map._userInteracted = true;
            });
            
            MapService.map.on('zoomstart', () => {
                MapService.map._userInteracted = true;
            });
        }
    },
    
    /**
     * Ładowanie punktów w aktualnie widocznym obszarze mapy
     */
    loadPointsInViewport: function() {
        console.log('LOADING POINTS IN VIEWPORT STARTED');
        
        if (!MapService || !MapService.map) {
            console.error('Map not initialized');
            return;
        }
        
        const bounds = MapService.map.getBounds();
        console.log('Current map bounds:', bounds);
        
        const center = bounds.getCenter();
        const radius = Math.max(
            Math.abs(bounds.getNorth() - bounds.getSouth()),
            Math.abs(bounds.getEast() - bounds.getWest())
        ) / 2;
        
        console.log('Search center:', center, 'radius:', radius);
        
        if (Utils && typeof Utils.updateStatus === 'function') {
            Utils.updateStatus('Wyszukiwanie punktów w widocznym obszarze...', true);
        }
        
        console.log('Calling API to fetch points');
        // Załaduj punkty w obszarze
        if (ApiService && typeof ApiService.fetchPointsInArea === 'function') {
            ApiService.fetchPointsInArea(center.lat, center.lng, radius)
                .then(points => {
                    console.log(`API returned ${points.length} points`);
                    if (points.length > 0) {
                        if (Utils && typeof Utils.updateStatus === 'function') {
                            Utils.updateStatus(`Znaleziono ${points.length} punktów w okolicy`, false);
                        }
                        console.log('Setting points in MarkersService');
                        if (MarkersService && typeof MarkersService.setPoints === 'function') {
                            MarkersService.setPoints(points);
                        }
                        console.log('Adding markers to map');
                        if (MarkersService && typeof MarkersService.addMarkers === 'function') {
                            MarkersService.addMarkers(points);
                        }
                        console.log('Building search index');
                        if (SearchService && typeof SearchService.buildSearchIndex === 'function') {
                            SearchService.buildSearchIndex();
                        }
                    } else {
                        if (Utils && typeof Utils.updateStatus === 'function') {
                            Utils.updateStatus('Nie znaleziono punktów w tej okolicy', false);
                        }
                    }
                })
                .catch(error => {
                    console.error('Error loading points:', error);
                    if (Utils && typeof Utils.updateStatus === 'function') {
                        Utils.updateStatus(`Błąd wczytywania punktów: ${error.message}`, false);
                    }
                });
        } else {
            console.error('ApiService or fetchPointsInArea method not available');
        }
    },
    
    /**
     * Wybór punktu w trybie modalnym - przekazuje dane do rodzica
     * @param {Object} point - Wybrany punkt
     */
    selectPoint: function(point) {
        if (!point) {
            console.error('No point provided to selectPoint');
            return;
        }

        if (this.params.mode === 'modal') {
            // Przygotuj dane do przekazania
            const pointData = {
                action: 'selectPoint',
                id: point.id,
                name: point.name || 'Punkt',
                address: point.address || '',
                city: point.city || '',
                postCode: point.postCode || '',
                latitude: point.latitude,
                longitude: point.longitude,
                countryId: point.countryId || 'pl',
                fullData: point
            };
            
            // Wyślij dane do rodzica
            window.parent.postMessage(pointData, '*');
        } else {
            // W trybie standalone wykonaj standardową akcję
            if (UIService && typeof UIService.selectPoint === 'function') {
                UIService.selectPoint(point);
            }
        }
    },
    
    /**
     * Zastosowanie początkowych parametrów
     */
    applyInitialParams: async function() {
        try {
            // Zastosuj parametr kraju
            if (this.params.country) {
                const countrySelector = document.getElementById('country-filter');
                if (countrySelector && Config.countries && Config.countries[this.params.country]) {
                    countrySelector.value = this.params.country;
                }
            }
            
            // Zastosuj filtr miasta (jeśli podano)
            if (this.params.city) {
                // Miasto zostanie ustawione po załadowaniu punktów w updateCityFilterOptions
            }
            
            // Zastosuj wyszukiwanie adresu (jeśli podano)
            if (this.params.address && GeocodingService && typeof GeocodingService.searchAddress === 'function') {
                await GeocodingService.searchAddress(this.params.address);
                
                // Znajdź i pokaż najbliższe punkty
                const geocodingResult = GeocodingService.lastSearchResult;
                if (geocodingResult && geocodingResult.lat && geocodingResult.lon) {
                    const nearestPoints = await this.findNearestPoints(
                        parseFloat(geocodingResult.lat), 
                        parseFloat(geocodingResult.lon)
                    );
                    
                    // Pokaż znalezione punkty
                    this.showNearestPoints(nearestPoints);
                }
            }
        } catch (error) {
            console.error('Błąd podczas stosowania parametrów początkowych:', error);
        }
    }, // Added missing comma here
    
    /**
     * Znalezienie najbliższych punktów do podanej lokalizacji
     */
    findNearestPoints: async function(lat, lng) {
        if (!lat || !lng) {
            console.error('Invalid coordinates for findNearestPoints');
            return [];
        }

        // Jeśli punkty są już załadowane, znajdź wśród nich
        if (MarkersService && MarkersService.allPoints && MarkersService.allPoints.length > 0 && 
            typeof MarkersService.findNearestPoints === 'function') {
            return MarkersService.findNearestPoints(lat, lng, Config.search.nearestPointsLimit);
        }
        
        // Jeśli nie, pobierz punkty w okolicy
        if (ApiService && typeof ApiService.fetchPointsInArea === 'function') {
            return await ApiService.fetchPointsInArea(
                lat, 
                lng, 
                Config && Config.search ? Config.search.approximateSearchRadius : 5000
            );
        }
        
        return [];
    },
    
    /**
     * Pokazanie najbliższych punktów na mapie
     */
    showNearestPoints: function(points) {
        if (!points || points.length === 0) return;
        
        // Dodaj markery dla znalezionych punktów
        if (MarkersService && typeof MarkersService.addSingleMarker === 'function') {
            points.forEach(point => {
                MarkersService.addSingleMarker(point);
            });
        }
        
        // Dopasuj widok mapy do znalezionych punktów
        if (MapService && MapService.map && typeof L !== 'undefined') {
            try {
                const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude]));
                MapService.map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 16
                });
            } catch (error) {
                console.error('Error fitting bounds to points:', error);
            }
        }
    },
    
    /**
     * Wysłanie wybranego punktu do rodzica (w trybie modalnym)
     */
    sendSelectedPoint: function(point) {
        if (!point) {
            console.error('No point provided to sendSelectedPoint');
            return;
        }

        if (this.mode === 'modal' && window.parent) {
            window.parent.postMessage({
                action: 'selectPoint',
                point: point
            }, '*');
        }
    }
};