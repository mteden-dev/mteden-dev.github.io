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
                // Pobierz dane ze wszystkich dostępnych krajów
                const fetchPromises = Object.values(Config.api.urls).map(url => 
                    this.fetchPointsFromUrl(url)
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
                // Pobierz dane tylko dla wybranego kraju
                const apiUrl = Config.api.urls[countryCode] || Config.api.urls.pl;
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
     * Pobieranie punktów z konkretnego URL
     * @param {string} url - URL API
     * @returns {Promise<Array>} - Promise z tablicą punktów
     */
    fetchPointsFromUrl: async function(url) {
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Błąd HTTP: ${response.status}`);
            }
            
            // Pobierz surowy tekst odpowiedzi
            const responseText = await response.text();
            
            // Próbuj sparsować jako JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error("Nie można sparsować odpowiedzi jako JSON:", parseError);
                throw new Error('Otrzymane dane nie są w formacie JSON');
            }
            
            // Wyodrębnij punkty z odpowiedzi
            const points = this.extractPoints(data);
            
            // Ustal kraj na podstawie URL
            const countryId = url.includes('countryId=12') ? 'fr' : 
                             url.includes('countryId=33') ? 'other' : 'pl';
            
            // Dodaj informację o kraju do każdego punktu
            return points.map(point => ({
                ...point,
                countryId: countryId,
                countryName: countryId === 'pl' ? 'Polska' : 
                            countryId === 'fr' ? 'Francja' : 'Inny kraj'
            }));
        } catch (error) {
            console.error(`Błąd pobierania z ${url}:`, error);
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
    fetchPointsForCarrier: async function(countryCode, carrier) {
        Utils.updateStatus(`Pobieranie punktów przewoźnika ${carrier}...`, true);
        
        try {
            let pointsToFetch = [];
            
            if (countryCode === 'all') {
                // Sprawdź, czy przewoźnik ma konfigurację dla wszystkich krajów
                if (Config.api.carriers[carrier]) {
                    const fetchPromises = Object.values(Config.api.carriers[carrier]).map(url => 
                        this.fetchPointsFromUrl(url)
                    );
                    
                    const results = await Promise.allSettled(fetchPromises);
                    pointsToFetch = results
                        .filter(result => result.status === 'fulfilled')
                        .flatMap(result => result.value);
                } else {
                    throw new Error(`Brak konfiguracji dla przewoźnika ${carrier}`);
                }
            } else {
                // Pobierz dane dla konkretnego kraju i przewoźnika
                if (Config.api.carriers[carrier] && Config.api.carriers[carrier][countryCode]) {
                    const apiUrl = Config.api.carriers[carrier][countryCode];
                    pointsToFetch = await this.fetchPointsFromUrl(apiUrl);
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