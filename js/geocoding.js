/**
 * Obsługa geokodowania (zamiana adresów na współrzędne)
 */
const GeocodingService = {
    addressMarker: null,
    
    /**
     * Wyszukiwanie adresów w Nominatim OpenStreetMap
     * @param {string} query - Fraza wyszukiwania
     * @param {Function} callback - Callback do obsługi wyników
     */
    searchAddresses: async function(query, callback) {
        try {
            // Dostosuj parametry wyszukiwania do wybranego kraju
            const countrySelector = document.getElementById('country-filter');
            const country = countrySelector ? countrySelector.value : 'pl';
            
            const params = new URLSearchParams({
                ...Config.search.getGeocodingParams(country),
                q: query
            });
            
            const response = await fetch(`${Config.search.geocodingUrl}?${params}`);
            const data = await response.json();
            
            if (callback && typeof callback === 'function') {
                callback(data);
            }
            
            return data;
        } catch (error) {
            console.error('Błąd podczas wyszukiwania adresów:', error);
            return [];
        }
    },
    
    /**
     * Wyszukiwanie adresu i wyświetlanie na mapie
     * @param {string} address - Adres do wyszukania
     */
    searchAddress: async function(address) {
        if (!address) return;
        
        try {
            Utils.updateStatus('Wyszukiwanie adresu...', true);
            
            // Dostosuj parametry wyszukiwania do wybranego kraju
            const countrySelector = document.getElementById('country-filter');
            const country = countrySelector ? countrySelector.value : 'pl';
            
            const params = new URLSearchParams({
                ...Config.search.getGeocodingParams(country),
                q: address,
                limit: 1
            });
            
            const response = await fetch(`${Config.search.geocodingUrl}?${params}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                this.showAddressOnMap(result.lat, result.lon, result.display_name);
                Utils.updateStatus('Znaleziono adres', false);
            } else {
                Utils.updateStatus('Nie znaleziono adresu', false);
            }
        } catch (error) {
            console.error('Błąd podczas wyszukiwania adresu:', error);
            Utils.updateStatus('Błąd wyszukiwania adresu', false);
        }
    },
    
    /**
     * Wyszukiwanie miasta i wyświetlanie na mapie
     * @param {string} city - Nazwa miasta
     * @param {string} country - Kod kraju (opcjonalny)
     */
    searchCity: async function(city, country) {
        if (!city) return;
        
        try {
            Utils.updateStatus(`Wyszukiwanie miasta: ${city}...`, true);
            
            // Dopasuj parametry wyszukiwania do kraju
            const countryCode = country || 
                (document.getElementById('country-filter') ? 
                    document.getElementById('country-filter').value : 'pl');
            
            const params = new URLSearchParams({
                ...Config.search.getGeocodingParams(countryCode),
                q: city,
                city: city,
                limit: 1
            });
            
            const response = await fetch(`${Config.search.geocodingUrl}?${params}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                
                // Ustaw widok mapy na miasto
                MapService.setView([result.lat, result.lon], Config.map.cityZoom);
                
                // Dodaj marker dla miasta z niebieską pinezką
                const blueIcon = new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });
                
                if (this.addressMarker) {
                    MapService.map.removeLayer(this.addressMarker);
                }
                
                this.addressMarker = L.marker([result.lat, result.lon], { icon: blueIcon }).addTo(MapService.map);
                this.addressMarker.bindPopup(`<b>Miasto:</b><br>${result.display_name}`);
                
                // Załaduj punkty z tego miasta
                const citySelector = document.getElementById('city-filter');
                if (citySelector) {
                    // Sprawdź, czy miasto jest już w selektorze
                    let cityInSelector = false;
                    for (let i = 0; i < citySelector.options.length; i++) {
                        if (citySelector.options[i].value.toLowerCase() === city.toLowerCase()) {
                            citySelector.selectedIndex = i;
                            cityInSelector = true;
                            break;
                        }
                    }
                    
                    if (cityInSelector) {
                        // Uruchom event change ręcznie
                        const event = new Event('change');
                        citySelector.dispatchEvent(event);
                    } else {
                        // Jeśli miasto nie jest w selektorze, dodaj je
                        const option = document.createElement('option');
                        option.value = city;
                        option.textContent = city;
                        citySelector.appendChild(option);
                        citySelector.value = city;
                        
                        // Uruchom event change
                        const event = new Event('change');
                        citySelector.dispatchEvent(event);
                    }
                }
                
                Utils.updateStatus(`Znaleziono miasto: ${city}`, false);
            } else {
                Utils.updateStatus(`Nie znaleziono miasta: ${city}`, false);
            }
        } catch (error) {
            console.error('Błąd podczas wyszukiwania miasta:', error);
            Utils.updateStatus('Błąd wyszukiwania miasta', false);
        }
    },
    
    /**
     * Wyświetla adres na mapie i znajduje najbliższe punkty
     * @param {number|string} lat - Szerokość geograficzna
     * @param {number|string} lon - Długość geograficzna
     * @param {string} addressName - Nazwa adresu
     */
    showAddressOnMap: function(lat, lon, addressName) {
        const searchResultsTitle = document.getElementById('search-results-title');
        
        // Konwersja do liczb zmiennoprzecinkowych
        lat = parseFloat(lat);
        lon = parseFloat(lon);
        
        // Usuń poprzedni marker adresu
        this.removeAddressMarker();
        
        // Ustaw widok mapy
        MapService.setView([lat, lon], 13);
        
        // Dodaj marker dla wyszukanego adresu z czerwoną pinezką
        const redIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        
        this.addressMarker = L.marker([lat, lon], { icon: redIcon }).addTo(MapService.map);
        
        // Dodaj popup do markera
        this.addressMarker.bindPopup(`<b>Wyszukany adres:</b><br>${addressName}`).openPopup();
        
        // Znajdź najbliższe punkty
        const nearestPoints = SearchService.findNearestPoints(lat, lon, Config.search.nearestPointsLimit);
        
        // Wyświetl wyniki
        SearchService.displaySearchResults(nearestPoints);
        
        // Podświetl najbliższe punkty na mapie
        MarkersService.highlightNearestPoints(nearestPoints);
        
        // Aktualizuj tytuł wyników
        searchResultsTitle.textContent = 'Najbliższe paczkomaty:';
        searchResultsTitle.style.display = 'block';
    },
    
    /**
     * Usuwa marker adresu z mapy
     */
    removeAddressMarker: function() {
        if (this.addressMarker) {
            MapService.map.removeLayer(this.addressMarker);
            this.addressMarker = null;
        }
    }
};