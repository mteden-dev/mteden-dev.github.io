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
        if (!points || !Array.isArray(points)) {
            console.error("Invalid points array provided");
            return;
        }
        
        // Log the types of points being set
        const inpostPoints = points.filter(p => 
            p && ((p.type && p.type.toLowerCase().includes('inpost')) || 
                  (p.type && p.type.toLowerCase().includes('paczkomat')))
        ).length;
        
        const dpdPoints = points.filter(p => 
            p && p.name && p.name.toLowerCase().includes('dpd')
        ).length;
        
        console.log(`Setting points: Total: ${points.length}, InPost: ${inpostPoints}, DPD: ${dpdPoints}`);
        
        // Always make a copy to avoid reference issues
        this.allPoints = [...points];
        this.markersById = {};
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
     * Create marker for a point
     * @param {Object} point - The point data
     * @returns {Object} - Leaflet marker
     */
    createMarker: function(point) {
        if (!point || !point.latitude || !point.longitude) {
            console.error('Cannot create marker: invalid point data', point);
            return null;
        }

        // Get marker color from Config based on carrier identification
        let markerColor = '#f39c12'; // Default orange as fallback
        
        // Identify carrier using the same logic as in createCustomClusterIcon
        for (const carrierId in Config.carriers) {
            const carrier = Config.carriers[carrierId];
            
            // If carrier has a pointIdentifier function, use that
            if (carrier.pointIdentifier && carrier.pointIdentifier(point)) {
                markerColor = carrier.color || markerColor;
                break;
            }
            
            // Check explicit carrier property
            if (point.carrier === carrierId) {
                markerColor = carrier.color || markerColor;
                break;
            }
            
            // Fallback for basic name/type checks
            if ((point.name && point.name.toLowerCase().includes(carrierId)) || 
                (point.type && point.type.toLowerCase().includes(carrierId))) {
                markerColor = carrier.color || markerColor;
                break;
            }
        }
        
        // Create marker with appropriate icon
        const markerIcon = L.divIcon({
            className: 'simple-marker',
            html: `<div style="background-color: ${markerColor};"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5]
        });
        
        const marker = L.marker([point.latitude, point.longitude], {
            icon: markerIcon,
            title: point.name || point.id,
            point: point // Store point data directly on marker for clustering
        });
        
        // Create popup content
        let popupContent = this.createPopupContent(point);
        marker.bindPopup(popupContent);
        
        // Store reference to marker by ID
        if (point.id) {
            this.markersById[point.id] = {
                marker: marker,
                point: point
            };
        }
        
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
        if (!point) return '#f39c12'; // Default color
        
        // Check each carrier configuration
        for (const carrierId in Config.carriers) {
            const carrier = Config.carriers[carrierId];
            
            // Use pointIdentifier if available
            if (carrier.pointIdentifier && carrier.pointIdentifier(point)) {
                return carrier.color || '#f39c12';
            }
            
            // Check explicit carrier property
            if (point.carrier === carrierId) {
                return carrier.color || '#f39c12';
            }
            
            // Basic name/type check
            if ((point.name && point.name.toLowerCase().includes(carrierId)) || 
                (point.type && point.type.toLowerCase().includes(carrierId))) {
                return carrier.color || '#f39c12';
            }
        }
        
        return '#f39c12'; // Default color
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
     * Filter points by carrier
     * @param {string} carrierId - Carrier ID to filter by, or 'all' for all carriers
     */
    filterByCarrier: function(carrierId) {
        console.log(`Filtering by carrier: ${carrierId}`);
        
        let filteredPoints;
        
        if (carrierId === 'all') {
            // Show all points
            filteredPoints = [...this.allPoints];
        } else if (Config.carriers && Config.carriers[carrierId]) {
            const carrier = Config.carriers[carrierId];
            
            // Filter by carrier using the carrier-specific pointIdentifier
            filteredPoints = this.allPoints.filter(point => {
                // First check explicit carrier property
                if (point.carrier === carrierId) return true;
                
                // Then use the carrier's custom identifier function
                return carrier.pointIdentifier && carrier.pointIdentifier(point);
            });
        } else {
            console.error(`Unknown carrier: ${carrierId}`);
            return;
        }
        
        console.log(`Filtered to ${filteredPoints.length} points for carrier: ${carrierId}`);
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
     * Create a better-looking marker icon with the specified color
     */
    createMarkerIcon: function(color) {
        return L.divIcon({
            className: 'custom-marker-icon',
            html: `
                <div class="marker-pin" style="background-color: ${color};">
                    <div class="marker-pin-inner"></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 24],
            popupAnchor: [0, -24]
        });
    },

    /**
     * Create custom cluster icon with pie chart
     * @param {Object} cluster - Leaflet cluster
     * @returns {Object} - Custom divIcon
     */
    createCustomClusterIcon: function(cluster) {
        // Get all markers in the cluster
        const markers = cluster.getAllChildMarkers();
        const count = markers.length;
        
        // Dynamic carrier counting - detect all carriers in the cluster
        const carrierCounts = {};
        let unidentifiedCount = 0;
        
        // Count markers by carrier
        markers.forEach(marker => {
            const point = marker.options.point;
            if (!point) {
                unidentifiedCount++;
                return;
            }
            
            // Try to identify carrier
            let identified = false;
            
            // Check all configured carriers
            for (const carrierId in Config.carriers) {
                const carrier = Config.carriers[carrierId];
                
                // If carrier has a pointIdentifier function, use that
                if (carrier.pointIdentifier && carrier.pointIdentifier(point)) {
                    carrierCounts[carrierId] = (carrierCounts[carrierId] || 0) + 1;
                    identified = true;
                    break;
                }
                
                // Fallback check for explicit carrier property
                if (point.carrier === carrierId) {
                    carrierCounts[carrierId] = (carrierCounts[carrierId] || 0) + 1;
                    identified = true;
                    break;
                }
                
                // Fallback for basic name/type checks
                if ((point.name && point.name.toLowerCase().includes(carrierId)) || 
                    (point.type && point.type.toLowerCase().includes(carrierId))) {
                    carrierCounts[carrierId] = (carrierCounts[carrierId] || 0) + 1;
                    identified = true;
                    break;
                }
            }
            
            if (!identified) {
                unidentifiedCount++;
            }
        });
        
        // Create SVG pie chart
        let svgContent = '<svg width="100%" height="100%" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">';
        
        // Check if we have only one carrier type (for simplicity)
        const carrierIds = Object.keys(carrierCounts);
        if (carrierIds.length === 1 && carrierCounts[carrierIds[0]] === count) {
            // Single carrier type, show full circle
            const carrierId = carrierIds[0];
            const color = Config.carriers[carrierId]?.color || '#3388ff';
            svgContent += `<circle cx="20" cy="20" r="20" fill="${color}" />`;
        } else {
            // Mixed carriers, create pie chart
            let startAngle = 0;
            
            // Add slice for each carrier
            for (const carrierId in carrierCounts) {
                const carrierCount = carrierCounts[carrierId];
                const percentage = carrierCount / count;
                const endAngle = startAngle + (percentage * Math.PI * 2);
                
                const x1 = 20 + 20 * Math.sin(startAngle);
                const y1 = 20 - 20 * Math.cos(startAngle);
                const x2 = 20 + 20 * Math.sin(endAngle);
                const y2 = 20 - 20 * Math.cos(endAngle);
                
                const largeArc = percentage > 0.5 ? 1 : 0;
                const color = Config.carriers[carrierId]?.color || '#3388ff';
                
                if (startAngle === 0) {
                    // First slice starts at top (0 degrees)
                    svgContent += `<path d="M 20 0 A 20 20 0 ${largeArc} 1 ${x2} ${y2} L 20 20 Z" fill="${color}" />`;
                } else {
                    // Other slices start from end of previous slice
                    svgContent += `<path d="M 20 20 L ${x1} ${y1} A 20 20 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" />`;
                }
                
                startAngle = endAngle;
            }
            
            // Add slice for unidentified points if any
            if (unidentifiedCount > 0) {
                const percentage = unidentifiedCount / count;
                const endAngle = startAngle + (percentage * Math.PI * 2);
                
                const x1 = 20 + 20 * Math.sin(startAngle);
                const y1 = 20 - 20 * Math.cos(startAngle);
                
                const largeArc = percentage > 0.5 ? 1 : 0;
                const color = '#3388ff'; // Default color for unknown carriers
                
                svgContent += `<path d="M 20 20 L ${x1} ${y1} A 20 20 0 ${largeArc} 1 20 0 Z" fill="${color}" />`;
            }
        }
        
        // Add the count text
        svgContent += `
            <circle cx="20" cy="20" r="14" fill="white" />
            <text x="20" y="24" font-size="14" text-anchor="middle" fill="black" font-family="Arial">${count}</text>
        `;
        
        svgContent += '</svg>';
        
        // Return a divIcon with the SVG
        return L.divIcon({
            html: svgContent,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40),
            iconAnchor: [20, 20]
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
    },

    /**
     * Get carrier color based on point properties (fallback method)
     * @param {Object} point - The point
     * @returns {string} - Color code
     */
    getCarrierColor: function(point) {
        if (!point) return '#3388ff'; // Default blue
        
        if (point.name && point.name.toLowerCase().includes('dpd')) {
            return '#DC0032'; // DPD color
        }
        
        if (!point.type) return '#f39c12'; // Default orange
        
        const lowerType = point.type.toLowerCase();
        if (lowerType.includes('inpost') || lowerType.includes('paczkomat')) {
            return '#FFCC00'; // InPost yellow
        } else if (lowerType.includes('dhl')) {
            return '#FFCC00'; // DHL yellow
        } else if (lowerType.includes('orlen')) {
            return '#FF0000'; // Orlen red
        }
        
        return '#f39c12'; // Default orange
    },

    /**
     * Filter markers by carrier
     * @param {string} carrierId - Carrier ID to filter by, or 'all' for all carriers
     */
    filterByCarrier: function(carrierId) {
        console.log(`Filtering by carrier: ${carrierId}`);
        
        // First, ensure we have a valid map instance
        if (!MapService.map) {
            console.error('Map is not initialized, cannot filter markers');
            return;
        }
        
        // Ensure markerClusterGroup is initialized and attached to the map
        if (!this.markerClusterGroup) {
            this.markerClusterGroup = L.markerClusterGroup(Config.map.clusterOptions);
            this.markerClusterGroup.addTo(MapService.map);
        }
        
        // Save the filtered points to display
        let filteredPoints = [];
        
        // Remove all existing markers from the cluster group
        this.markerClusterGroup.clearLayers();
        
        // Check if we want to show all markers
        if (!carrierId || carrierId === 'all') {
            filteredPoints = [...this.allPoints];
        } else {
            // Filter points for the specified carrier
            filteredPoints = this.allPoints.filter(point => {
                if (!point) return false;
                
                // Check if carrier has a custom pointIdentifier function
                if (Config.carriers[carrierId]?.pointIdentifier) {
                    return Config.carriers[carrierId].pointIdentifier(point);
                }
                
                // Fallback to basic identification
                return (point.carrier === carrierId) ||
                       (point.name && point.name.toLowerCase().includes(carrierId)) ||
                       (point.type && point.type.toLowerCase().includes(carrierId));
            });
        }
        
        console.log(`Found ${filteredPoints.length} points matching carrier: ${carrierId || 'all'}`);
        
        // Create and add markers in batches for better performance
        const batchSize = 500;
        const totalBatches = Math.ceil(filteredPoints.length / batchSize);
        
        const addBatch = (batchIndex) => {
            if (batchIndex >= totalBatches) {
                console.log('All batches added');
                return;
            }
            
            // Safety check - make sure we still have a valid map
            if (!MapService.map) {
                console.error('Map became null during batch processing');
                return;
            }
            
            const start = batchIndex * batchSize;
            const end = Math.min(start + batchSize, filteredPoints.length);
            const batch = filteredPoints.slice(start, end);
            
            // Create markers for this batch
            const markers = batch.map(point => this.createMarker(point)).filter(marker => marker);
            
            // Add markers to cluster group with error handling
            try {
                if (this.markerClusterGroup && markers.length > 0) {
                    this.markerClusterGroup.addLayers(markers);
                }
            } catch (error) {
                console.error('Error adding markers to cluster group:', error);
            }
            
            // Process next batch
            setTimeout(() => addBatch(batchIndex + 1), 10);
        };
        
        // Start adding batches
        addBatch(0);
        
        return filteredPoints.length;
    }
};