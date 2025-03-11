/**
 * Service for managing carriers in a modular way
 */
const CarrierService = {
    /**
     * Load points for a specific carrier
     * @param {string} carrierId - Carrier ID from config
     * @returns {Promise<Array>} - Points array
     */
    loadCarrierPoints: function(carrierId) {
        if (!Config.carriers || !Config.carriers[carrierId]) {
            console.error(`Carrier configuration not found: ${carrierId}`);
            return Promise.reject(new Error('Carrier configuration not found'));
        }
        
        const carrier = Config.carriers[carrierId];
        Utils.updateStatus(`Loading ${carrier.name} points...`, true);
        
        return ApiService.fetchPointsFromUrl(carrier.apiUrl)
            .then(points => {
                // Add carrier information to each point
                const processedPoints = points.map(point => ({
                    ...point,
                    carrier: carrierId,
                }));
                
                console.log(`Loaded ${processedPoints.length} ${carrier.name} points`);
                return processedPoints;
            });
    },
    
    /**
     * Load points for all configured carriers
     * @returns {Promise<Array>} - Combined points from all carriers
     */
    loadAllCarrierPoints: function() {
        const carriers = Config.carriers || {};
        const carrierIds = Object.keys(carriers);
        
        if (carrierIds.length === 0) {
            console.warn('No carriers configured');
            return Promise.resolve([]);
        }
        
        Utils.updateStatus('Loading all carrier points...', true);
        
        // Load each carrier's points in parallel
        const loadPromises = carrierIds.map(id => 
            this.loadCarrierPoints(id).catch(error => {
                console.error(`Error loading ${id} points:`, error);
                return []; // Return empty array on error
            })
        );
        
        return Promise.all(loadPromises)
            .then(resultsArray => {
                // Combine all points
                const allPoints = resultsArray.flat();
                Utils.updateStatus(`Loaded ${allPoints.length} points`, false);
                return allPoints;
            });
    },
    
    /**
     * Identify carrier for a point
     * @param {Object} point - Point to identify carrier for
     * @returns {string} - Carrier ID or null
     */
    identifyCarrier: function(point) {
        if (!point) return null;
        
        // First check if carrier is explicitly defined
        if (point.carrier && Config.carriers && Config.carriers[point.carrier]) {
            return point.carrier;
        }
        
        // Otherwise try to identify by point properties
        if (Config.carriers) {
            for (const [id, carrier] of Object.entries(Config.carriers)) {
                if (carrier.pointIdentifier && carrier.pointIdentifier(point)) {
                    return id;
                }
            }
        }
        
        return null; // Unknown carrier
    },
    
    /**
     * Get carrier configuration by ID
     * @param {string} carrierId - Carrier identifier
     * @returns {Object} - Carrier configuration
     */
    getCarrierConfig: function(carrierId) {
        return Config.carriers?.[carrierId] || null;
    },
    
    /**
     * Get color for a carrier
     * @param {string} carrierId - Carrier identifier
     * @returns {string} - Color code
     */
    getCarrierColor: function(carrierId) {
        return this.getCarrierConfig(carrierId)?.color || '#3388ff'; // Default blue
    }
};