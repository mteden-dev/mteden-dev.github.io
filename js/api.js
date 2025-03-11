/**
 * Obsługa API
 */
const ApiService = {
    // Dodaj alias dla metody fetchPoints jako getPoints
    /**
     * Pobieranie danych punktów (alias dla zgodności)
     * @param {string} countryCode - Kod kraju (pl, other, all)
     * @returns {Promise<Array>} - Promise z tablicą punktów
     */
    getPoints: function(countryCode) {
        return this.fetchPoints(countryCode);
    },

    /**
     * Pobieranie danych punktów
     * @param {string} countryCode - Kod kraju (pl, other, all)
     * @returns {Promise<Array>} - Promise z tablicą punktów
     */
    fetchPoints: async function(countryCode) {
        Utils.updateStatus('Pobieranie danych...', true);
        
        try {
            let pointsToFetch = [];
            
            if (countryCode === 'all') {
                // Pobierz dane ze wszystkich dostępnych przewoźników
                const fetchPromises = Object.keys(Config.carriers).map(carrierId => 
                    this.fetchPointsFromUrl(Config.carriers[carrierId].apiUrl)
                );
                
                const results = await Promise.allSettled(fetchPromises);
                
                // Połącz wyniki ze wszystkich krajów
                pointsToFetch = results
                    .filter(result => result.status === 'fulfilled')
                    .flatMap(result => result.value);
                    
                // Sprawdź, czy jakieś zapytania się nie powiodły
                const failedRequests = results.filter(result => result.status === 'rejected');
                if (failedRequests.length > 0) {
                    console.warn(`${failedRequests.length} żądań nie powiodło się`);
                }
            } else {
                // Pobierz dane dla przewoźnika inpost w wybranym kraju
                let apiUrl;
                if (Config.carriers.inpost.countryUrls && Config.carriers.inpost.countryUrls[countryCode]) {
                    apiUrl = Config.carriers.inpost.countryUrls[countryCode];
                } else {
                    apiUrl = Config.carriers.inpost.apiUrl;
                }
                pointsToFetch = await this.fetchPointsFromUrl(apiUrl);
            }
            
            Utils.updateStatus(`Pobrano ${pointsToFetch.length} punktów`, false);
            return pointsToFetch;
            
        } catch (error) {
            console.error('Błąd podczas pobierania danych:', error);
            Utils.updateStatus(`Błąd: ${error.message}`, false);
            throw error;
        }
    },
    
    /**
     * Pobieranie danych z URL API
     * @param {string} url - Adres URL API
     * @returns {Promise<Array>} - Promise z tablicą punktów
     */
    fetchPointsFromUrl: async function(url) {
        try {
            console.log(`Fetching points from URL: ${url}`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Response received for ${url}:`, data);
            
            // Extract points from the response
            let extractedPoints = this.extractPoints(data);
            
            // Ensure required fields exist on all points
            extractedPoints = extractedPoints.map(point => {
                // Check if this point has DPD in its name but doesn't have a proper type
                if (point.name && point.name.toLowerCase().includes('dpd') && 
                    (!point.type || point.type === 'PUDO')) {
                    return {...point, type: 'DPD'};
                }
                return point;
            });
            
            console.log(`Extracted ${extractedPoints.length} points from response`);
            return extractedPoints;
            
        } catch (error) {
            console.error('Error fetching points:', error);
            throw error;
        }
    },
    
    /**
     * Wyodrębnienie danych punktów z odpowiedzi API
     * @param {Object|Array} data - Dane z API
     * @returns {Array} - Tablica punktów
     */
    extractPoints: function(data) {
        if (data && data.points && Array.isArray(data.points)) {
            return data.points;
        } else if (Array.isArray(data)) {
            return data;
        } else if (data && typeof data === 'object') {
            const sampleKeys = ['id', 'type', 'address', 'latitude', 'longitude'];
            const possiblePoints = [];
            
            if (sampleKeys.some(key => key in data)) {
                possiblePoints.push(data);
            } else {
                for (const key in data) {
                    if (data[key] && typeof data[key] === 'object') {
                        if (sampleKeys.some(sampleKey => sampleKey in data[key])) {
                            possiblePoints.push(data[key]);
                        }
                    }
                }
            }
            
            if (possiblePoints.length > 0) {
                return possiblePoints;
            }
        }
        
        throw new Error('Nieprawidłowy format danych');
    },

    /**
     * Pobieranie punktów dla konkretnego przewoźnika
     * @param {string} countryCode - Kod kraju (pl, fr, other, all)
     * @param {string} carrier - Identyfikator przewoźnika (np. inpost)
     * @returns {Promise<Array>} - Promise z tablicą punktów
     */
    fetchPointsForCarrier: async function(carrier, countryCode = 'pl') {
        Utils.updateStatus(`Pobieranie punktów przewoźnika ${carrier}...`, true);
        
        try {
            let pointsToFetch = [];
            
            if (countryCode === 'all') {
                // Sprawdź, czy przewoźnik ma konfigurację dla wszystkich krajów
                if (Config.carriers[carrier]) {
                    const urls = [];
                    
                    // Get all country URLs if available
                    if (Config.carriers[carrier].countryUrls) {
                        Object.values(Config.carriers[carrier].countryUrls).forEach(url => {
                            urls.push(url);
                        });
                    }
                    
                    // Add the default URL if no country URLs or as a fallback
                    if (urls.length === 0 && Config.carriers[carrier].apiUrl) {
                        urls.push(Config.carriers[carrier].apiUrl);
                    }
                    
                    const fetchPromises = urls.map(url => this.fetchPointsFromUrl(url));
                    
                    const results = await Promise.allSettled(fetchPromises);
                    pointsToFetch = results
                        .filter(result => result.status === 'fulfilled')
                        .flatMap(result => result.value);
                } else {
                    throw new Error(`Brak konfiguracji dla przewoźnika ${carrier}`);
                }
            } else {
                // Pobierz dane dla konkretnego kraju i przewoźnika
                if (Config.carriers[carrier] && Config.carriers[carrier].countryUrls && 
                    Config.carriers[carrier].countryUrls[countryCode]) {
                    const apiUrl = Config.carriers[carrier].countryUrls[countryCode];
                    pointsToFetch = await this.fetchPointsFromUrl(apiUrl);
                } else if (Config.carriers[carrier] && Config.carriers[carrier].apiUrl) {
                    // Fall back to default apiUrl if country-specific one isn't available
                    pointsToFetch = await this.fetchPointsFromUrl(Config.carriers[carrier].apiUrl);
                } else {
                    throw new Error(`Brak konfiguracji dla przewoźnika ${carrier} w kraju ${countryCode}`);
                }
            }
            
            Utils.updateStatus(`Pobrano ${pointsToFetch.length} punktów przewoźnika ${carrier}`, false);
            return pointsToFetch;
            
        } catch (error) {
            console.error(`Błąd podczas pobierania danych przewoźnika ${carrier}:`, error);
            Utils.updateStatus(`Błąd: ${error.message}`, false);
            throw error;
        }
    },

    /**
     * Pobieranie punktów w obszarze mapy
     * @param {number} lat - Szerokość geograficzna środka obszaru
     * @param {number} lng - Długość geograficzna środka obszaru
     * @param {number} radius - Promień obszaru w stopniach
     * @returns {Promise<Array>} - Promise z tablicą punktów
     */
    fetchPointsInArea: async function(lat, lng, radius) {
        Utils.updateStatus('Pobieranie punktów w wybranym obszarze...', true);
        
        try {
            // Pobierz wszystkie punkty z aktualnie wybranego kraju
            const countrySelector = document.getElementById('country-filter');
            const selectedCountry = countrySelector.value;
            
            let points;
            if (IntegrationService.params.carrier) {
                points = await this.fetchPointsForCarrier(selectedCountry, IntegrationService.params.carrier);
            } else {
                points = await this.fetchPoints(selectedCountry);
            }
            
            // Filtruj punkty w obszarze
            const filteredPoints = points.filter(point => {
                if (!point.latitude || !point.longitude) return false;
                
                const latDiff = Math.abs(point.latitude - lat);
                const lngDiff = Math.abs(point.longitude - lng);
                
                return latDiff <= radius && lngDiff <= radius;
            });
            
            Utils.updateStatus(`Znaleziono ${filteredPoints.length} punktów w obszarze`, false);
            return filteredPoints;
            
        } catch (error) {
            console.error('Błąd podczas pobierania punktów w obszarze:', error);
            Utils.updateStatus(`Błąd: ${error.message}`, false);
            throw error;
        }
    }
};

// Na końcu pliku api.js dodaj:
console.log('ApiService loaded and available in global scope:', typeof ApiService !== 'undefined');

// Upewnij się, że usługa jest dostępna globalnie
if (typeof window !== 'undefined') {
    window.ApiService = ApiService;
}