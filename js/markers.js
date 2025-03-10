/**
 * Serwis obsługujący markery na mapie
 */
const MarkersService = {
    // Wszystkie punkty
    allPoints: [],
    
    // Markery według ID
    markersById: {},
    
    // Grupa markerów dla clustrowania
    markerClusterGroup: null,
    
    // Tekst przycisku wyboru w popupie
    popupSelectButtonText: 'Wybierz ten punkt',
    
    /**
     * Ustawienie punktów
     * @param {Array} points - Tablica punktów
     */
    setPoints: function(points) {
        this.allPoints = points;
        this.markersById = {};
    },
    
    /**
     * Dodanie markerów na mapę
     * @param {string|Array} cityFilterOrPoints - Filtr miasta lub tablica punktów
     */
    addMarkers: function(cityFilterOrPoints) {
        console.log('Adding markers with:', cityFilterOrPoints);
        
        // Remove existing markers
        if (this.markerClusterGroup) {
            MapService.map.removeLayer(this.markerClusterGroup);
        }
        
        // Create new marker cluster group with explicit options
        this.markerClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 80,
            spiderfyOnMaxZoom: false,
            disableClusteringAtZoom: 17,
            chunkedLoading: true,
            zoomToBoundsOnClick: true
        });
        
        let filteredPoints;
        
        // Handle different parameter types
        if (Array.isArray(cityFilterOrPoints)) {
            console.log(`Received array of ${cityFilterOrPoints.length} points`);
            filteredPoints = cityFilterOrPoints;
            this.allPoints = cityFilterOrPoints;
        } else {
            console.log('Received city filter:', cityFilterOrPoints);
            const cityFilter = cityFilterOrPoints;
            filteredPoints = cityFilter === 'all'
                ? this.allPoints
                : this.allPoints.filter(point => point.city === cityFilter);
            
            console.log(`Filtered to ${filteredPoints.length} points for city: ${cityFilter}`);
        }
        
        console.log(`Adding ${filteredPoints.length} markers to map`);
        
        // Debug: check first point to ensure it has coordinates
        if (filteredPoints.length > 0) {
            console.log('Sample point:', filteredPoints[0]);
        }
        
        // Add markers for filtered points
        let addedMarkers = 0;
        filteredPoints.forEach(point => {
            if (point.latitude && point.longitude) {
                this.addSingleMarker(point);
                addedMarkers++;
            }
        });
        console.log(`Actually added ${addedMarkers} markers with valid coordinates`);
        
        // Add marker cluster group to map
        MapService.map.addLayer(this.markerClusterGroup);
        
        // Update point counter
        Utils.updateStatus(`Wyświetlono ${filteredPoints.length} punktów`, false);
    },
    
    /**
     * Dodanie pojedynczego markera
     * @param {Object} point - Punkt do dodania
     */
    addSingleMarker: function(point) {
        if (!point.latitude || !point.longitude) {
            console.warn('Punkt bez współrzędnych:', point);
            return;
        }
        
        // Określ kolor markera na podstawie typu punktu
        const markerColor = this.getMarkerColor(point);
        
        // Utwórz niestandardowy marker
        const marker = L.circleMarker([point.latitude, point.longitude], {
            radius: 8,
            fillColor: markerColor,
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        });
        
        // Utwórz treść popupu
        const popupContent = this.createPopupContent(point);
        
        // Dodaj popup do markera
        marker.bindPopup(popupContent);
        
        // Zapisz marker w słowniku
        this.markersById[point.id] = {
            marker: marker,
            point: point
        };
        
        // Dodaj marker do grupy
        if (this.markerClusterGroup) {
            this.markerClusterGroup.addLayer(marker);
        }
        
        return marker;
    },
    
    /**
     * Utworzenie treści popupu
     * @param {Object} point - Punkt
     * @returns {string} - Treść HTML popupu
     */
    createPopupContent: function(point) {
        const inModal = IntegrationService.mode === 'modal';
        const selectButton = inModal ? 
            `<button class="select-point-btn" onclick="IntegrationService.selectPoint(${JSON.stringify(point)})">${this.popupSelectButtonText}</button>` : 
            '';
        
        return `
            <div class="popup-content">
                <h3>${point.name || point.id}</h3>
                <p><strong>Adres:</strong> ${point.address || 'Brak adresu'}</p>
                <p><strong>Miasto:</strong> ${point.city || 'Brak miasta'}</p>
                <p><strong>Kod pocztowy:</strong> ${point.postalCode || 'Brak kodu'}</p>
                ${point.description ? `<p>${point.description}</p>` : ''}
                ${point.openingHours ? `<p><strong>Godziny otwarcia:</strong> ${point.openingHours}</p>` : ''}
                ${selectButton}
            </div>
        `;
    },
    
    /**
     * Określenie koloru markera na podstawie typu punktu
     * @param {Object} point - Punkt
     * @returns {string} - Kolor w formacie hex
     */
    getMarkerColor: function(point) {
        if (!point.type) return '#f39c12'; // domyślny kolor
        
        const lowerType = point.type.toLowerCase();
        
        if (lowerType.includes('inpost') || lowerType.includes('paczkomat')) {
            return '#e74c3c'; // czerwony
        } else if (lowerType.includes('dhl')) {
            return '#3498db'; // niebieski
        } else if (lowerType.includes('orlen')) {
            return '#2ecc71'; // zielony
        }
        
        return '#f39c12'; // pomarańczowy dla innych
    },
    
    /**
     * Znalezienie najbliższych punktów do podanej lokalizacji
     * @param {number} lat - Szerokość geograficzna
     * @param {number} lng - Długość geograficzna
     * @param {number} limit - Limit punktów
     * @returns {Array} - Najbliższe punkty
     */
    findNearestPoints: function(lat, lng, limit = 5) {
        if (!this.allPoints || this.allPoints.length === 0) {
            return [];
        }
        
        // Oblicz odległości dla wszystkich punktów
        const pointsWithDistance = this.allPoints
            .filter(point => point.latitude && point.longitude)
            .map(point => {
                const distance = this.calculateDistance(
                    lat, lng, 
                    parseFloat(point.latitude), 
                    parseFloat(point.longitude)
                );
                return { ...point, distance };
            });
        
        // Posortuj według odległości i zwróć limit
        return pointsWithDistance
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);
    },
    
    /**
     * Obliczenie odległości między dwoma punktami (w km)
     * @param {number} lat1 - Szerokość geograficzna punktu 1
     * @param {number} lng1 - Długość geograficzna punktu 1
     * @param {number} lat2 - Szerokość geograficzna punktu 2
     * @param {number} lng2 - Długość geograficzna punktu 2
     * @returns {number} - Odległość w kilometrach
     */
    calculateDistance: function(lat1, lng1, lat2, lng2) {
        // Promień Ziemi w kilometrach
        const R = 6371;
        
        const dLat = this.deg2rad(lat2 - lat1);
        const dLng = this.deg2rad(lng2 - lng1);
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return distance;
    },
    
    /**
     * Konwersja stopni na radiany
     * @param {number} deg - Kąt w stopniach
     * @returns {number} - Kąt w radianach
     */
    deg2rad: function(deg) {
        return deg * (Math.PI/180);
    },

    /**
     * Filter markers by carrier
     * @param {string} carrierId - Carrier identifier (e.g., 'inpost', 'dhl')
     */
    filterByCarrier: function(carrierId) {
        if (carrierId === 'all') {
            // Show all markers
            this.addMarkers('all');
            return;
        }
        
        // Filter points by carrier
        const filteredPoints = this.allPoints.filter(point => {
            if (!point.type) return false;
            
            const lowerType = point.type.toLowerCase();
            
            switch(carrierId) {
                case 'inpost':
                    return lowerType.includes('inpost') || lowerType.includes('paczkomat');
                case 'dhl':
                    return lowerType.includes('dhl');
                case 'orlen':
                    return lowerType.includes('orlen');
                default:
                    return true;
            }
        });
        
        // Add filtered markers to map
        if (this.markerClusterGroup) {
            MapService.map.removeLayer(this.markerClusterGroup);
        }
        
        this.markerClusterGroup = L.markerClusterGroup(Config.map.clusterOptions);
        
        filteredPoints.forEach(point => {
            this.addSingleMarker(point);
        });
        
        MapService.map.addLayer(this.markerClusterGroup);
        
        // Update UI
        Utils.updateStatus(`Wyświetlono ${filteredPoints.length} punktów przewoźnika`, false);
        
        // Update nearest points list
        if (MapService && typeof MapService.updateNearestPointsList === 'function') {
            MapService.updateNearestPointsList();
        }
    }
};