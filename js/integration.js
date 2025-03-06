import { Config } from './config.js';

/**
 * Serwis integracji z zewnętrznymi systemami
 */
export const IntegrationService = {
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
        
        // Obsługa przycisku "Pokaż punkty w tej okolicy"
        this.setupViewportPointsButton();
        
        // Dodaj nasłuchiwanie zmian widoku mapy
        this.setupMapMoveEndEvent();
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
        MarkersService.popupSelectButtonText = Config.mode.modalSelectButtonText;
        
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
     * Konfiguracja przycisku do pokazywania punktów w widocznym obszarze
     */
    setupViewportPointsButton: function() {
        // Utwórz przycisk jeśli nie istnieje
        if (!document.getElementById('viewport-points-btn')) {
            const viewportPointsBtn = document.createElement('button');
            viewportPointsBtn.id = 'viewport-points-btn';
            viewportPointsBtn.className = 'viewport-points-btn';
            viewportPointsBtn.textContent = 'Pokaż punkty w tej okolicy';
            viewportPointsBtn.style.display = 'none';
            viewportPointsBtn.style.position = 'absolute';
            viewportPointsBtn.style.top = '10px';
            viewportPointsBtn.style.left = '50%';
            viewportPointsBtn.style.transform = 'translateX(-50%)';
            viewportPointsBtn.style.zIndex = '1000';
            viewportPointsBtn.style.padding = '8px 16px';
            viewportPointsBtn.style.backgroundColor = '#fff';
            viewportPointsBtn.style.border = '2px solid rgba(0,0,0,0.2)';
            viewportPointsBtn.style.borderRadius = '4px';
            viewportPointsBtn.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
            viewportPointsBtn.addEventListener('click', () => {
                this.loadPointsInViewport();
            });
            
            document.body.appendChild(viewportPointsBtn);
        }
    },
    
    /**
     * Konfiguracja nasłuchiwania zmian widoku mapy
     */
    setupMapMoveEndEvent: function() {
        if (MapService.map) {
            MapService.map.on('moveend', () => {
                // Jeśli mapa została przesunięta przez użytkownika, a nie przez autocentrowanie
                if (!MapService.map._enforcingCenter) {
                    this.showViewportPointsButton();
                }
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
     * Pokazanie przycisku do ładowania punktów w widocznym obszarze
     */
    showViewportPointsButton: function() {
        const btn = document.getElementById('viewport-points-btn');
        if (btn) {
            btn.style.display = 'block';
        }
    },
    
    /**
     * Ukrycie przycisku do ładowania punktów w widocznym obszarze
     */
    hideViewportPointsButton: function() {
        const btn = document.getElementById('viewport-points-btn');
        if (btn) {
            btn.style.display = 'none';
        }
    },
    
    /**
     * Ładowanie punktów w aktualnie widocznym obszarze mapy
     */
    loadPointsInViewport: function() {
        const bounds = MapService.map.getBounds();
        
        const center = bounds.getCenter();
        const radius = Math.max(
            Math.abs(bounds.getNorth() - bounds.getSouth()),
            Math.abs(bounds.getEast() - bounds.getWest())
        ) / 2;
        
        Utils.updateStatus('Wyszukiwanie punktów w widocznym obszarze...', true);
        
        // Załaduj punkty w obszarze
        ApiService.fetchPointsInArea(center.lat, center.lng, radius)
            .then(points => {
                if (points.length > 0) {
                    Utils.updateStatus(`Znaleziono ${points.length} punktów w okolicy`, false);
                    MarkersService.setPoints(points);
                    MarkersService.addMarkers('all');
                    SearchService.buildSearchIndex();
                    this.hideViewportPointsButton();
                } else {
                    Utils.updateStatus('Nie znaleziono punktów w tej okolicy', false);
                }
            })
            .catch(error => {
                Utils.updateStatus(`Błąd wczytywania punktów: ${error.message}`, false);
            });
    },
    
    /**
     * Wybór punktu w trybie modalnym - przekazuje dane do rodzica
     * @param {Object} point - Wybrany punkt
     */
    selectPoint: function(point) {
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
            UIService.selectPoint(point);
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
                if (countrySelector && Config.countries[this.params.country]) {
                    countrySelector.value = this.params.country;
                }
            }
            
            // Zastosuj filtr miasta (jeśli podano)
            if (this.params.city) {
                // Miasto zostanie ustawione po załadowaniu punktów w updateCityFilterOptions
            }
            
            // Zastosuj wyszukiwanie adresu (jeśli podano)
            if (this.params.address) {
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
    },
    
    /**
     * Znalezienie najbliższych punktów do podanej lokalizacji
     */
    findNearestPoints: async function(lat, lng) {
        // Jeśli punkty są już załadowane, znajdź wśród nich
        if (MarkersService.allPoints && MarkersService.allPoints.length > 0) {
            return MarkersService.findNearestPoints(lat, lng, Config.search.nearestPointsLimit);
        }
        
        // Jeśli nie, pobierz punkty w okolicy
        return await ApiService.fetchPointsInArea(lat, lng, Config.search.approximateSearchRadius);
    },
    
    /**
     * Pokazanie najbliższych punktów na mapie
     */
    showNearestPoints: function(points) {
        if (!points || points.length === 0) return;
        
        // Dodaj markery dla znalezionych punktów
        points.forEach(point => {
            MarkersService.addSingleMarker(point);
        });
        
        // Dopasuj widok mapy do znalezionych punktów
        const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude]));
        MapService.map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 16
        });
    },
    
    /**
     * Wysłanie wybranego punktu do rodzica (w trybie modalnym)
     */
    sendSelectedPoint: function(point) {
        if (this.mode === 'modal' && window.parent) {
            window.parent.postMessage({
                action: 'selectPoint',
                point: point
            }, '*');
        }
    },
    
    /**
     * Funkcja wywoływana po kliknięciu "Wybierz ten punkt"
     */
    selectPoint: function(point) {
        // Wyślij dane do rodzica
        this.sendSelectedPoint(point);
        
        // Informacja dla użytkownika
        Utils.updateStatus('Wybrano punkt: ' + (point.name || point.id), false);
    }
};