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
        // Check if there are DPD points to preserve
        const existingDPDPoints = this.allPoints.filter(point => 
            point && point.name && point.name.toLowerCase().includes('dpd')
        );
        
        if (existingDPDPoints.length > 0) {
            // If we have DPD points, use the method that preserves them
            this.setPointsPreservingDPD(points, existingDPDPoints);
        } else {
            // Otherwise, just replace all points
            this.allPoints = points;
            this.markersById = {};
        }
    },
    
    /**
     * Set points while preserving specific points (like DPD)
     * @param {Array} newPoints - New points to add
     * @param {Array} dpdPoints - DPD points to preserve
     */
    setPointsPreservingDPD: function(newPoints, dpdPoints) {
        console.log(`Setting ${newPoints.length} points while preserving ${dpdPoints.length} DPD points`);
        
        // Create a set of IDs from the new points for quick lookup
        const newPointIds = new Set(newPoints.map(p => p.id));
        
        // Filter out any DPD points that might already be in the new points to avoid duplicates
        const uniqueDPDPoints = dpdPoints.filter(p => !newPointIds.has(p.id));
        
        console.log(`Adding ${uniqueDPDPoints.length} unique DPD points to ${newPoints.length} new points`);
        
        // Combine the new points with the preserved DPD points
        this.allPoints = [...newPoints, ...uniqueDPDPoints];
        
        // Reset the markers by ID
        this.markersById = {};
    },
    
    /**
     * Add markers with performance optimization
     */
    addMarkers: function(cityFilterOrPoints) {
        console.log('Adding markers with:', typeof cityFilterOrPoints === 'object' ? `Array[${cityFilterOrPoints.length}]` : cityFilterOrPoints);
        
        // Remove existing markers
        if (this.markerClusterGroup) {
            MapService.map.removeLayer(this.markerClusterGroup);
            this.markerClusterGroup = null; // Important: clear reference
        }
        
        // Create new marker cluster group with optimized settings
        this.markerClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 100,
            spiderfyOnMaxZoom: false,
            disableClusteringAtZoom: 18,
            chunkedLoading: true,
            chunkDelay: 50,
            chunkInterval: 100,
            zoomToBoundsOnClick: true,
            iconCreateFunction: (cluster) => this.createCustomClusterIcon(cluster)
        });
        
        // IMPORTANT: Add cluster group to map BEFORE adding markers to it
        MapService.map.addLayer(this.markerClusterGroup);
        
        // Get filtered points
        let filteredPoints;
        
        if (Array.isArray(cityFilterOrPoints)) {
            filteredPoints = cityFilterOrPoints;
        } else {
            const cityFilter = cityFilterOrPoints;
            filteredPoints = cityFilter === 'all'
                ? this.allPoints
                : this.allPoints.filter(point => point.city === cityFilter);
        }
        
        // For very large datasets, limit points by viewport and sampling
        let pointsToAdd = filteredPoints;
        const currentZoom = MapService.map.getZoom();
        const MAX_MARKERS = 5000;
        
        if (filteredPoints.length > MAX_MARKERS && currentZoom < 10) {
            console.log(`Too many points (${filteredPoints.length}), limiting and sampling`);
            
            // First filter by viewport with buffer
            const bounds = MapService.map.getBounds().pad(0.5);
            
            const viewportPoints = filteredPoints.filter(point => 
                point && point.latitude && point.longitude && 
                bounds.contains([point.latitude, point.longitude])
            );
            
            console.log(`Filtered to ${viewportPoints.length} points in viewport`);
            
            // Then sample if still too many
            if (viewportPoints.length > MAX_MARKERS) {
                const sampling = MAX_MARKERS / viewportPoints.length;
                pointsToAdd = viewportPoints.filter(() => Math.random() < sampling);
                console.log(`Sampled to ${pointsToAdd.length} points`);
            } else {
                pointsToAdd = viewportPoints;
            }
        }
        
        // Prepare temporary array to hold markers before adding them to the cluster
        const tempMarkers = [];
        
        // Add markers with batching for better performance
        const BATCH_SIZE = 1000;
        
        const addBatch = (startIdx) => {
            const endIdx = Math.min(startIdx + BATCH_SIZE, pointsToAdd.length);
            
            for (let i = startIdx; i < endIdx; i++) {
                const point = pointsToAdd[i];
                if (point && point.latitude && point.longitude) {
                    // Create marker but don't add directly to cluster
                    const marker = this.createMarker(point);
                    tempMarkers.push(marker);
                    
                    // Store reference to marker
                    this.markersById[point.id] = { marker, point };
                }
            }
            
            if (endIdx < pointsToAdd.length) {
                // Schedule next batch
                setTimeout(() => addBatch(endIdx), 10);
            } else {
                // All markers created, now add them all at once to the cluster
                this.markerClusterGroup.addLayers(tempMarkers);
                Utils.updateStatus(`Wyświetlono ${tempMarkers.length} punktów`, false);
            }
        };
        
        // Start adding in batches
        addBatch(0);
    },
    
    /**
     * Create a marker without adding it to cluster
     */
    createMarker: function(point) {
        // Create marker
        const marker = L.marker([point.latitude, point.longitude], {
            icon: this.getSimplifiedMarkerIcon(point),
            point: point
        });
        
        // Use event delegation pattern - only create popup when clicked
        marker.on('click', () => {
            if (!marker.getPopup()) {
                const popupContent = this.createPopupContent(point);
                marker.bindPopup(popupContent);
            }
            
            marker.openPopup();
            
            // Select point in UI
            if (UIService && typeof UIService.selectPoint === 'function') {
                UIService.selectPoint(point);
            }
        });
        
        return marker;
    },
    
    /**
     * Original addSingleMarker (now uses createMarker and adds directly to cluster)
     */
    addSingleMarker: function(point) {
        if (!point.latitude || !point.longitude) {
            return;
        }
        
        // Create marker
        const marker = this.createMarker(point);
        
        // IMPORTANT: Only add to cluster if it exists and has been added to map
        if (this.markerClusterGroup && this.markerClusterGroup._map) {
            this.markerClusterGroup.addLayer(marker);
        }
        
        // Store reference
        this.markersById[point.id] = { marker, point };
    },

    /**
     * Get a simplified marker icon - faster than full getMarkerIcon
     */
    getSimplifiedMarkerIcon: function(point) {
        // Determine color based on point type/name
        let color = '#f39c12'; // default
        
        if (point.name && point.name.toLowerCase().includes('dpd')) {
            color = '#BB0033'; // DPD
        } else if (point.type) {
            const type = point.type.toLowerCase();
            if (type.includes('inpost') || type.includes('paczkomat')) {
                color = '#e74c3c'; // InPost
            } else if (type.includes('dhl')) {
                color = '#3498db'; // DHL
            } else if (type.includes('orlen')) {
                color = '#2ecc71'; // Orlen
            }
        }
        
        // Use a simpler divIcon
        return L.divIcon({
            className: 'simple-marker',
            html: `<div style="background:${color};"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
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
        } else if (point.name && point.name.toLowerCase().includes('dpd')) {
            return '#BB0033'; // kolor DPD
        }
        
        return '#f39c12'; // domyślny pomarańczowy
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
        console.log(`Filtering by carrier: ${carrierId}`);
        
        // For "all" carrier, make sure we include DPD points
        if (carrierId === 'all') {
            // Debug: Check if we have DPD points
            const dpdPoints = this.allPoints.filter(point => 
                point && point.name && point.name.toLowerCase().includes('dpd')
            );
            console.log(`Total points: ${this.allPoints.length}, DPD points: ${dpdPoints.length}`);
            
            // Show all markers
            this.addMarkers(this.allPoints);
            return;
        }
        
        // For other carriers, filter as usual
        const filteredPoints = this.allPoints.filter(point => {
            if (!point) return false;
            
            const lowerType = point.type ? point.type.toLowerCase() : '';
            const lowerName = point.name ? point.name.toLowerCase() : '';
            
            switch(carrierId) {
                case 'inpost':
                    return lowerType.includes('inpost') || lowerType.includes('paczkomat');
                case 'dhl':
                    return lowerType.includes('dhl');
                case 'orlen':
                    return lowerType.includes('orlen');
                case 'dpd':
                    return lowerType.includes('dpd') || lowerName.includes('dpd');
                default:
                    return true;
            }
        });

        console.log(`Found ${filteredPoints.length} points for carrier: ${carrierId}`);
        
        // Use addMarkers function with the filtered points array
        this.addMarkers(filteredPoints);
    },

    /**
     * Filter DPD points specifically
     */
    filterDPDPoints: function() {
        const dpdPoints = this.allPoints.filter(point => {
            if (!point) return false;
            return point.name && point.name.toLowerCase().includes('dpd');
        });
        
        console.log(`Found ${dpdPoints.length} DPD points`);
        
        // Use addMarkers function with the filtered points array
        this.addMarkers(dpdPoints);
    },

    /**
     * Tworzenie ikony markera na podstawie typu
     * @param {string} type - Typ punktu (np. 'inpost', 'dhl', etc.)
     * @returns {L.Icon} - Ikona Leaflet
     */
    getMarkerIcon: function(type) {
        // Default color if no type is provided
        let markerColor = '#f39c12'; // default orange
        
        // Get the point (we need to check the full point object to look at name property)
        const point = this.currentPoint || {};
        
        // First check if it's a DPD point by name
        if (point.name && point.name.toLowerCase().includes('dpd')) {
            return this.createMarkerIcon('#BB0033'); // DPD color
        }
        
        if (type) {
            // Convert type to lowercase for case-insensitive comparisons
            const lowerType = type.toLowerCase();
            
            // Set color based on point type
            if (lowerType.includes('inpost') || lowerType.includes('paczkomat')) {
                markerColor = '#e74c3c'; // red for InPost
            } else if (lowerType.includes('dhl')) {
                markerColor = '#3498db'; // blue for DHL
            } else if (lowerType.includes('orlen')) {
                markerColor = '#2ecc71'; // green for Orlen
            } else if (lowerType === 'dpd' || lowerType.includes('dpd')) {
                markerColor = '#BB0033'; // DPD color
            }
        }
        
        return this.createMarkerIcon(markerColor);
    },

    /**
     * Create a simpler marker icon with the specified color
     */
    createMarkerIcon: function(color) {
        // Use a simpler div icon with fewer DOM elements
        return L.divIcon({
            className: 'simple-marker',
            html: `<div style="background:${color};"></div>`,
            iconSize: [16, 16], // Smaller icon size (was 24x24)
            iconAnchor: [8, 8]  // Adjusted anchor
        });
    },

    /**
     * Create custom cluster icon based on the carriers contained within
     * @param {L.MarkerCluster} cluster - The marker cluster
     * @returns {L.DivIcon} - Custom icon for the cluster
     */
    createCustomClusterIcon: function(cluster) {
        // Get all child markers
        const markers = cluster.getAllChildMarkers();
        const count = markers.length;
        
        // Count markers by carrier
        const carrierCounts = {
            inpost: 0,
            dhl: 0,
            orlen: 0,
            dpd: 0,
            other: 0
        };
        
        // Count points by carrier
        markers.forEach(marker => {
            const point = marker.options.point || {};
            
            if (!point.type && !point.name) {
                carrierCounts.other++;
                return;
            }
            
            const lowerType = point.type ? point.type.toLowerCase() : '';
            const lowerName = point.name ? point.name.toLowerCase() : '';
            
            if (lowerType.includes('inpost') || lowerType.includes('paczkomat')) {
                carrierCounts.inpost++;
            } else if (lowerType.includes('dhl')) {
                carrierCounts.dhl++;
            } else if (lowerType.includes('orlen')) {
                carrierCounts.orlen++;
            } else if (lowerType.includes('dpd') || lowerName.includes('dpd')) {
                carrierCounts.dpd++;
            } else {
                carrierCounts.other++;
            }
        });
        
        // Get carrier colors and percentages
        const colors = {
            inpost: '#e74c3c', // red
            dhl: '#3498db',    // blue
            orlen: '#2ecc71',  // green
            dpd: '#BB0033',    // DPD color
            other: '#f39c12'   // orange
        };
        
        // Create SVG pie chart
        let svgContent = '<svg width="100%" height="100%" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">';
        
        // If only one carrier type, just use a solid circle
        const carrierTypes = Object.keys(carrierCounts).filter(c => carrierCounts[c] > 0);
        if (carrierTypes.length === 1) {
            const carrierType = carrierTypes[0];
            svgContent += `<circle cx="20" cy="20" r="16" fill="${colors[carrierType]}" />`;
        } else {
            // Create pie chart segments for multiple carriers
            let startAngle = 0;
            
            for (const carrier in carrierCounts) {
                if (carrierCounts[carrier] > 0) {
                    const percentage = carrierCounts[carrier] / count;
                    const angle = percentage * 360;
                    const endAngle = startAngle + angle;
                    
                    // Convert angles to radians
                    const startRad = (startAngle - 90) * Math.PI / 180;
                    const endRad = (endAngle - 90) * Math.PI / 180;
                    
                    // Calculate arc path
                    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                    
                    const x1 = 20 + 16 * Math.cos(startRad);
                    const y1 = 20 + 16 * Math.sin(startRad);
                    const x2 = 20 + 16 * Math.cos(endRad);
                    const y2 = 20 + 16 * Math.sin(endRad);
                    
                    svgContent += `<path d="M 20 20 L ${x1} ${y1} A 16 16 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[carrier]}" />`;
                    
                    startAngle = endAngle;
                }
            }
        }
        
        // Add count text
        svgContent += `
            <circle cx="20" cy="20" r="12" fill="white" fill-opacity="0.7" />
            <text x="20" y="24" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold">${count}</text>
        </svg>`;
        
        return L.divIcon({
            html: svgContent,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40),
            iconAnchor: L.point(20, 20)
        });
    },

    /**
     * Add markers only in the current viewport
     * @param {Array} points - All available points
     */
    addMarkersInViewport: function(points) {
        // Get current map bounds with a buffer
        const bounds = MapService.map.getBounds().pad(0.5); // 50% buffer around viewport
        
        // Filter points to only those in the current viewport
        const viewportPoints = points.filter(point => {
            return point && 
                   point.latitude && 
                   point.longitude && 
                   bounds.contains([point.latitude, point.longitude]);
        });
        
        console.log(`Filtered ${points.length} points to ${viewportPoints.length} in viewport`);
        
        // Add only viewport points to map
        this.addMarkers(viewportPoints);
    },

    /**
     * Clear all markers
     */
    clearMarkers: function() {
        // Remove marker cluster from map
        if (this.markerClusterGroup) {
            MapService.map.removeLayer(this.markerClusterGroup);
            this.markerClusterGroup.clearLayers();
        }
        
        // Clear marker references
        this.markersById = {};
        
        // Run garbage collection hint (for some browsers)
        if (window.gc) {
            window.gc();
        }
    }
};