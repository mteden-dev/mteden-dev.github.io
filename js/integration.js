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
     * Load points in current viewport from all carriers
     */
    loadPointsInViewport: function() {
        // Skip if recent call (throttle)
        if (this._lastLoadTime && (Date.now() - this._lastLoadTime < 2000)) {
            console.log("Skipping viewport load - too soon since last call");
            return;
        }
        this._lastLoadTime = Date.now();
        
        // Check zoom level for performance reasons
        const currentZoom = MapService.map.getZoom();
        if (currentZoom < 8) {
            console.log("Zoom level too low for viewport loading");
            return;
        }
        
        console.log("LOADING POINTS IN VIEWPORT STARTED");
        
        // Important: Create a backup of the current marker cluster
        if (MarkersService.markerClusterGroup) {
            this._tempMarkerCluster = MarkersService.markerClusterGroup;
        }
        
        // Use the carrier service to load all points
        CarrierService.loadAllCarrierPoints()
            .then(allPoints => {
                console.log(`Loaded ${allPoints.length} total points from all carriers`);
                
                // Update points in marker service
                MarkersService.setPoints(allPoints);
                
                // Create new markers efficiently
                this._addNewMarkersWithoutRemovingOld();
                
                // Build search index
                if (SearchService && typeof SearchService.buildSearchIndex === 'function') {
                    console.log("Building search index");
                    SearchService.buildSearchIndex(allPoints);
                }
            })
            .catch(error => {
                console.error("Error loading points in viewport:", error);
            });
    },
    
    /**
     * Add new markers without removing old ones first (smoother transition)
     */
    _addNewMarkersWithoutRemovingOld: function() {
        // Create a new marker cluster group
        const newClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 100,
            spiderfyOnMaxZoom: false,
            disableClusteringAtZoom: 18,
            chunkedLoading: true,
            chunkDelay: 50,
            chunkInterval: 100,
            zoomToBoundsOnClick: true,
            iconCreateFunction: (cluster) => MarkersService.createCustomClusterIcon(cluster)
        });
        
        // Filter points for the current viewport
        const bounds = MapService.map.getBounds().pad(0.5);
        const viewportPoints = MarkersService.allPoints.filter(point => 
            point && point.latitude && point.longitude && 
            bounds.contains([point.latitude, point.longitude])
        );
        
        // Sample if too many points
        let pointsToAdd = viewportPoints;
        if (viewportPoints.length > 5000) {
            const sampling = 5000 / viewportPoints.length;
            pointsToAdd = viewportPoints.filter(() => Math.random() < sampling);
        }
        
        console.log(`Creating markers for ${pointsToAdd.length} points`);
        
        // Create markers all at once
        const markers = [];
        pointsToAdd.forEach(point => {
            if (point && point.latitude && point.longitude) {
                // Create marker but don't add directly to cluster
                const marker = MarkersService.createMarker(point);
                markers.push(marker);
            }
        });
        
        // Add markers to new cluster
        newClusterGroup.addLayers(markers);
        
        // Add new cluster to map
        MapService.map.addLayer(newClusterGroup);
        
        // ONLY NOW remove the old cluster group
        if (this._tempMarkerCluster) {
            MapService.map.removeLayer(this._tempMarkerCluster);
            this._tempMarkerCluster = null;
        }
        
        // Update the reference
        MarkersService.markerClusterGroup = newClusterGroup;
        
        console.log(`Added ${markers.length} markers to map`);
        Utils.updateStatus(`Wyświetlono ${markers.length} punktów`, false);
    },
    
    /**
     * Wybór punktu w trybie modalnym - przekazuje dane do rodzica
     * @param {Object} point - Wybrany punkt
     */
    selectPoint: function(point) {
        if (!point) return;
        
        if (this.params.mode === 'modal') {
            // Prepare data to send to parent
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
            
            // Send data to parent
            window.parent.postMessage(pointData, '*');
        }
        
        // No else branch needed since we're not showing the selection panel
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
    },  // This comma is correct - no comment needed
    
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