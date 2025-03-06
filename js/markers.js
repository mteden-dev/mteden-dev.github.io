/**
 * Serwis obsługujący markery na mapie
 */
export const MarkersService = {
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
     * @param {string} cityFilter - Filtr miasta
     */
    addMarkers: function(cityFilter) {
        // Usuń istniejące markery
        if (this.markerClusterGroup) {
            MapService.map.removeLayer(this.markerClusterGroup);
        }
        
        // Utwórz nową grupę markerów
        this.markerClusterGroup = L.markerClusterGroup(Config.map.clusterOptions);
        
        // Filtruj punkty według miasta
        const filteredPoints = cityFilter === 'all'
            ? this.allPoints
            : this.allPoints.filter(point => point.city === cityFilter);
        
        // Dodaj markery dla przefiltrowanych punktów
        filteredPoints.forEach(point => {
            this.addSingleMarker(point);
        });
        
        // Dodaj grupę markerów do mapy
        MapService.map.addLayer(this.markerClusterGroup);
        
        // Aktualizuj licznik punktów
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
    }
};