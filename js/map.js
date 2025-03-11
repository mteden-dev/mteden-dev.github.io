/**
 * Serwis obsługujący mapę
 */

// Debugowanie globalnych zmiennych
console.log('map.js loading, Config available?', typeof Config !== 'undefined');

const MapService = {
    map: null,
    markerCluster: null,
    markers: [],
    numberedMarkers: [],
    
    /**
     * Initialize the map
     */
    initialize: function() {
        console.log('Initializing map service');
        
        try {
            // Create map with optimized settings
            this.map = L.map('map', {
                center: Config.mapDefaults.center,
                zoom: Config.mapDefaults.zoom,
                minZoom: Config.mapDefaults.minZoom,
                maxZoom: Config.mapDefaults.maxZoom,
                zoomSnap: 0.5,               // Allow finer zoom increments
                wheelDebounceTime: 200,      // Debounce wheel events
                preferCanvas: true,          // Use Canvas for better performance
                renderer: L.canvas()         // Force canvas renderer
            });
            
            // Add tile layer with optimizations
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                updateWhenIdle: true,        // Only update when panning stops
                updateWhenZooming: false,    // Don't update while zooming
                maxNativeZoom: 19,
                minZoom: Config.mapDefaults.minZoom,
                maxZoom: Config.mapDefaults.maxZoom
            }).addTo(this.map);
            
            // Setup events
            this.setupMapEvents();
            
            // Add legend
            this.addLegend();
            
            console.log('Map initialized successfully');
            
            // Fit to initial country
            this.fitToCountry('pl');
            
        } catch (error) {
            console.error('Error initializing map:', error);
        }
    },
    
    /**
     * Inicjalizacja kontrolki "Pokaż punkty w tej okolicy"
     * This entire function can be left as is, since we're not calling it anymore
     */
    initViewportControl() {
        // The existing implementation can remain unchanged
        // It won't be executed since we removed the call to it above
    },
    
    /**
     * Inicjalizacja nasłuchiwania zdarzeń mapy
     */
    initMapEvents: function() {
        this.map.on('moveend', () => {
            this.mapMoved = true;
            this.showViewportControl();
        });
        
        this.map.on('zoomend', () => {
            this.mapMoved = true;
            this.showViewportControl();
        });
    },
    
    /**
     * Pokazanie kontrolki "Pokaż punkty w tym obszarze"
     */
    showViewportControl: function() {
        if (this.mapMoved) {
            const controlElement = document.querySelector('.map-viewport-control');
            if (controlElement) {
                controlElement.style.display = 'block';
            }
        }
    },
    
    /**
     * Ukrycie kontrolki "Pokaż punkty w tym obszarze"
     */
    hideViewportControl: function() {
        const controlElement = document.querySelector('.map-viewport-control');
        if (controlElement) {
            controlElement.style.display = 'none';
        }
        this.mapMoved = false;
    },
    
    /**
     * Ładowanie punktów w aktualnym widoku mapy
     */
    loadPointsInViewport: async function() {
        try {
            Utils.updateStatus('Pobieranie punktów w tym obszarze...', true);
            
            // Pobierz granice aktualnego widoku
            const bounds = this.map.getBounds();
            const center = bounds.getCenter();
            
            // Ustal promień wyszukiwania
            const radius = {
                lat: Math.abs(bounds.getNorth() - bounds.getSouth()) / 2,
                lng: Math.abs(bounds.getEast() - bounds.getWest()) / 2
            };
            
            // Pobierz punkty w tym obszarze
            const points = await ApiService.fetchPointsInArea(
                center.lat, center.lng, radius
            );
            
            // Ustaw nowe punkty (zachowując filtry)
            MarkersService.setPoints(points);
            
            // Dodaj markery na mapę
            const citySelector = document.getElementById('city-filter');
            MarkersService.addMarkers(citySelector ? citySelector.value : 'all');
            
            // Zaktualizuj filtry miast
            App.updateCityFilterOptions();
            
            Utils.updateStatus(`Załadowano ${points.length} punktów w tym obszarze`, false);
        } catch (error) {
            console.error('Błąd podczas ładowania punktów w widoku:', error);
            Utils.updateStatus('Błąd ładowania punktów w tym obszarze', false);
        }
    },
    
    /**
     * Dostosowanie widoku mapy do wybranego kraju
     * @param {string} countryCode - Kod kraju
     */
    fitToCountry(countryCode) {
        console.log('Fitting to country:', countryCode);
        
        // Dodaj zabezpieczenie
        if (!Config || !Config.mapDefaults || !Config.mapDefaults.countryBounds) {
            console.error('Config.mapDefaults.countryBounds is missing!');
            return;
        }
        
        const bounds = Config.mapDefaults.countryBounds[countryCode];
        if (bounds) {
            this.map.fitBounds(bounds);
        } else {
            console.warn(`No bounds defined for country: ${countryCode}`);
        }
    },
    
    /**
     * Dodanie legendy do mapy
     */
    addLegend: function() {
        if (this.legendControl) {
            this.map.removeControl(this.legendControl);
        }
        
        this.legendControl = L.control({position: 'bottomright'});
        
        this.legendControl.onAdd = function() {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <h4>Legenda</h4>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #e74c3c;"></span>
                    <span>Paczkomat InPost</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #3498db;"></span>
                    <span>Punkt DHL</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #2ecc71;"></span>
                    <span>Orlen Paczka</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #BB0033;"></span>
                    <span>Punkt DPD</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #f39c12;"></span>
                    <span>Inny punkt</span>
                </div>
            `;
            return div;
        };
        
        this.legendControl.addTo(this.map);
    },
    
    /**
     * Ustawienie widoku mapy na określone współrzędne
     * @param {Array} latLng - Współrzędne [lat, lng]
     * @param {number} zoom - Poziom przybliżenia
     */
    setView: function(latLng, zoom) {
        this.map.setView(latLng, zoom);
    },

    /**
     * Check if clustering is active at current zoom level
     * @returns {boolean} true if clustering is active
     */
    isClusteringActive: function() {
        // Make sure this.map exists before checking zoom
        if (!this.map) return true;
        
        console.log("Current zoom level:", this.map.getZoom());
        
        // Use the same threshold as the marker cluster configuration
        return this.map.getZoom() < 17;
    },

    /**
     * Get all visible points in the current map view
     * @returns {Array} Array of points visible in current map bounds
     */
    getVisiblePoints: function() {
        if (!this.map) {
            console.error("Map not initialized");
            return [];
        }
        
        if (!MarkersService || !MarkersService.allPoints || !Array.isArray(MarkersService.allPoints)) {
            console.error("MarkersService.allPoints not available or not an array");
            console.log("MarkersService availability:", !!MarkersService);
            console.log("allPoints availability:", MarkersService ? !!MarkersService.allPoints : false);
            return [];
        }
        
        console.log(`Getting visible points from ${MarkersService.allPoints.length} total points`);
        
        const bounds = this.map.getBounds();
        
        return MarkersService.allPoints.filter(point => {
            if (!point || typeof point !== 'object') return false;
            if (!point.latitude || !point.longitude) return false;
            
            const lat = parseFloat(point.latitude);
            const lng = parseFloat(point.longitude);
            
            if (isNaN(lat) || isNaN(lng)) return false;
            
            return bounds.contains([lat, lng]);
        });
    },

    /**
     * Update the nearest points list based on current map view
     */
    updateNearestPointsList: function() {
        console.log("Updating nearest points list");
        
        const nearestInfo = document.getElementById('nearest-info');
        const nearestList = document.getElementById('nearest-points-list');
        
        if (!nearestInfo || !nearestList) {
            console.error("Nearest points DOM elements not found");
            console.log("nearestInfo found:", !!nearestInfo);
            console.log("nearestList found:", !!nearestList);
            return;
        }
        
        // If clustering is active, don't show individual points
        if (this.isClusteringActive()) {
            console.log("Clustering is active, not showing nearest points");
            nearestInfo.style.display = 'block';
            nearestInfo.innerHTML = '<p>Przybliż mapę, aby zobaczyć punkty w okolicy.</p>';
            nearestList.style.display = 'none';
            
            // Remove numbered markers when zooming out
            this.removeNumberedMarkers();
            return;
        }
        
        // Get visible points
        const visiblePoints = this.getVisiblePoints();
        console.log(`Found ${visiblePoints.length} visible points`);
        
        if (visiblePoints.length === 0) {
            nearestInfo.style.display = 'block';
            nearestInfo.innerHTML = '<p>Brak punktów w tym obszarze.</p>';
            nearestList.style.display = 'none';
            
            // Remove numbered markers when no points
            this.removeNumberedMarkers();
            return;
        }
        
        // Sort points by distance to center if possible
        let sortedPoints = [...visiblePoints];
        const center = this.map.getCenter();
        
        if (Utils && typeof Utils.calculateDistance === 'function') {
            try {
                sortedPoints.sort((a, b) => {
                    const distA = Utils.calculateDistance(
                        center.lat, center.lng, 
                        parseFloat(a.latitude), parseFloat(a.longitude)
                    );
                    const distB = Utils.calculateDistance(
                        center.lat, center.lng, 
                        parseFloat(b.latitude), parseFloat(b.longitude)
                    );
                    return distA - distB;
                });
            } catch (error) {
                console.error("Error sorting points by distance:", error);
            }
        }
        
        // Limit to 10 nearest points
        const nearestPoints = sortedPoints.slice(0, 10);
        
        // Update UI
        nearestInfo.style.display = 'none';
        nearestList.style.display = 'block';
        nearestList.innerHTML = '';
        
        // Remove previous numbered markers
        this.removeNumberedMarkers();
        
        // Add numbered markers for the nearest points
        nearestPoints.forEach((point, index) => {
            try {
                const distance = Utils.calculateDistance(
                    center.lat, center.lng, 
                    parseFloat(point.latitude), parseFloat(point.longitude)
                );
                
                const pointElement = document.createElement('div');
                pointElement.className = 'nearest-point-item';
                pointElement.innerHTML = `
                    <h4>${index + 1}. ${point.name || point.id}</h4>
                    <p>${point.address || ''}, ${point.city || ''}</p>
                    <p class="distance">${distance.toFixed(2)} km</p>
                `;
                
                pointElement.addEventListener('click', () => {
                    if (UIService && typeof UIService.selectPoint === 'function') {
                        UIService.selectPoint(point);
                    }
                });
                
                nearestList.appendChild(pointElement);
                
                // Add numbered marker for this point
                this.addNumberedMarker(point, index + 1);
            } catch (error) {
                console.error("Error adding point to nearest list:", error, point);
            }
        });
        
        console.log(`Displayed ${nearestPoints.length} nearest points`);
    },

    /**
     * Add a numbered marker to the map
     * @param {Object} point - The point to mark
     * @param {number} number - The number to display on marker
     */
    addNumberedMarker: function(point, number) {
        if (!point.latitude || !point.longitude) return;
        
        // Determine marker color based on point type/name
        let markerColor = '#f39c12'; // default orange
        
        // Check if it's a DPD point by name first
        if (point.name && point.name.toLowerCase().includes('dpd')) {
            markerColor = '#BB0033'; // DPD color
        } else if (point.type) {
            // Otherwise check by type
            const lowerType = point.type.toLowerCase();
            if (lowerType.includes('inpost') || lowerType.includes('paczkomat')) {
                markerColor = '#e74c3c'; // red for InPost
            } else if (lowerType.includes('dhl')) {
                markerColor = '#3498db'; // blue for DHL
            } else if (lowerType.includes('orlen')) {
                markerColor = '#2ecc71'; // green for Orlen
            }
        }
        
        // Create a custom numbered icon with the appropriate color
        const numberedIcon = L.divIcon({
            className: 'numbered-marker',
            html: `<div class="numbered-marker-inner" style="background-color: ${markerColor};">${number}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        // Create marker with the numbered icon
        const marker = L.marker([point.latitude, point.longitude], {
            icon: numberedIcon,
            zIndexOffset: 1000 + number // Make sure numbered markers appear on top
        });
        
        // Create and bind popup content
        if (MarkersService && typeof MarkersService.createPopupContent === 'function') {
            const popupContent = MarkersService.createPopupContent(point);
            marker.bindPopup(popupContent);
        }
        
        // Add click event handler to open popup and select point
        marker.on('click', function() {
            console.log("Numbered marker clicked:", point.id);
            
            // Open the popup
            marker.openPopup();
            
            // Call UIService.selectPoint
            if (UIService && typeof UIService.selectPoint === 'function') {
                UIService.selectPoint(point);
            }
        });
        
        // Add marker to map
        marker.addTo(this.map);
        
        // Store the numbered marker for later removal
        if (!this.numberedMarkers) this.numberedMarkers = [];
        this.numberedMarkers.push(marker);
    },

    /**
     * Remove all numbered markers from the map
     */
    removeNumberedMarkers: function() {
        if (this.numberedMarkers && this.numberedMarkers.length > 0) {
            this.numberedMarkers.forEach(marker => {
                this.map.removeLayer(marker);
            });
            this.numberedMarkers = [];
        }
    },

    /**
     * Helper function for debouncing events
     * @param {Function} func - Function to debounce 
     * @param {number} wait - Time to wait in ms
     * @returns {Function} - Debounced function
     */
    debounce: function(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },

    /**
     * Setup map event handlers
     */
    setupMapEvents: function() {
        // Debounced handler for map movements
        const debouncedMoveEndHandler = this.debounce(() => {
            console.log("Map move end (debounced)");
            this.updateNearestPointsList();
            
            // If integration service has viewport loading
            if (IntegrationService && typeof IntegrationService.loadPointsInViewport === 'function') {
                IntegrationService.loadPointsInViewport();
            }
        }, 300); // 300ms delay
        
        // Add event listener using debounced handler
        this.map.on('moveend', debouncedMoveEndHandler);
        this.map.on('zoomend', debouncedMoveEndHandler);
        
        // Add performance optimization - reduce rendering on drag
        this.map.on('dragstart', () => {
            document.getElementById('map').style.opacity = '0.7';
            document.getElementById('map').classList.add('map-dragging');
        });
        
        this.map.on('dragend', () => {
            document.getElementById('map').style.opacity = '1';
            document.getElementById('map').classList.remove('map-dragging');
        });
    },

    /**
     * Add limited number of markers to the map for better performance
     */
    addLimitedMarkers: function(points, limit = 2000) {
        console.log(`Adding up to ${limit} markers from ${points.length} total points`);
        
        // If too many points, sample them
        let markersToAdd = points;
        if (points.length > limit) {
            // Random sampling
            markersToAdd = [];
            const samplingRate = limit / points.length;
            
            for (let i = 0; i < points.length; i++) {
                if (Math.random() < samplingRate) {
                    markersToAdd.push(points[i]);
                }
                
                if (markersToAdd.length >= limit) break;
            }
            
            console.log(`Sampled down to ${markersToAdd.length} markers`);
        }
        
        // Use markers service to add the markers
        if (MarkersService && typeof MarkersService.addMarkers === 'function') {
            MarkersService.addMarkers(markersToAdd);
        }
    }
};