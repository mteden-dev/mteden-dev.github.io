/**
 * Obsługa wyszukiwania
 */
export const SearchService = {
    autocompleteData: [],  // Dane dla autouzupełniania
    searchIndex: [],       // Indeks wyszukiwania
    lastQuery: '',         // Ostatnie zapytanie
    
    /**
     * Inicjalizacja wyszukiwania
     */
    initialize: function() {
        this.setupEventListeners();
        // buildSearchIndex przeniesione do oddzielnej metody, będzie wywoływane 
        // po załadowaniu punktów
    },
    
    /**
     * Buduje indeks wyszukiwania na podstawie punktów
     */
    buildSearchIndex: function() {
        this.autocompleteData = [];
        this.searchIndex = [];
        
        // Dodaj punkty do indeksu wyszukiwania
        MarkersService.allPoints.forEach(point => {
            const displayText = `${point.name || 'Bez nazwy'} - ${point.address || ''}, ${point.city || ''}`;
            
            this.autocompleteData.push({
                id: point.id,
                text: displayText,
                type: 'point',
                point: point
            });
            
            // Dodaj frazy do indeksu
            this.searchIndex.push({
                id: point.id,
                text: displayText.toLowerCase(),
                name: (point.name || '').toLowerCase(),
                address: (point.address || '').toLowerCase(),
                city: (point.city || '').toLowerCase()
            });
        });
        
        console.log(`Zbudowano indeks wyszukiwania z ${this.searchIndex.length} punktów`);
    },
    
    /**
     * Konfiguracja nasłuchiwania zdarzeń
     */
    setupEventListeners: function() {
        const searchInput = document.getElementById('unified-search-input');
        const searchBtn = document.getElementById('search-btn');
        
        // Obsługa wprowadzania tekstu
        searchInput.addEventListener('input', this.handleInputChange.bind(this));
        
        // Obsługa przycisku wyszukiwania
        searchBtn.addEventListener('click', this.handleSearch.bind(this));
        
        // Obsługa klawisza Enter
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });
    },
    
    /**
     * Obsługa zmiany tekstu w polu wyszukiwania
     * @param {Event} event - Zdarzenie input
     */
    handleInputChange: function(event) {
        const query = event.target.value.toLowerCase().trim();
        const autocompleteContainer = document.getElementById('unified-autocomplete');
        
        // Wyczyść timery
        if (this.keyStrokeTimer) clearTimeout(this.keyStrokeTimer);
        if (this.searchTimer) clearTimeout(this.searchTimer);
        
        // Wyczyść kontener autouzupełniania
        autocompleteContainer.innerHTML = '';
        
        if (!query) {
            autocompleteContainer.style.display = 'none';
            return;
        }
        
        if (query.length >= 2) {
            // Szybkie wyszukiwanie lokalne
            this.keyStrokeTimer = setTimeout(() => {
                const quickMatches = this.quickFilter(query);
                this.displayAutocompleteResults(quickMatches, query);
            }, 50);
            
            // Wyszukiwanie adresów (tylko dla dłuższych zapytań)
            if (query.length >= 3 && query !== this.lastQuery) {
                this.searchTimer = setTimeout(() => {
                    GeocodingService.searchAddresses(query, this.handleAddressResults.bind(this, query));
                }, 500);
            }
        }
    },
    
    /**
     * Szybkie filtrowanie wyników lokalnie
     * @param {string} query - Fraza wyszukiwania
     * @returns {Array} - Pasujące elementy
     */
    quickFilter: function(query) {
        if (!query || query.length < 2) return [];
        
        const queryLower = query.toLowerCase();
        const matches = [];
        
        // Najpierw szukaj w nazwach - priorytet
        for (let i = 0; i < this.searchIndex.length; i++) {
            const item = this.searchIndex[i];
            if (item.name.includes(queryLower)) {
                matches.push(item.id);
                if (matches.length >= 5) break; // Limit do 5 wyników
            }
        }
        
        // Jeśli mamy mniej niż 5 wyników, szukaj też w adresach i miastach
        if (matches.length < 5) {
            for (let i = 0; i < this.searchIndex.length; i++) {
                const item = this.searchIndex[i];
                if (!matches.includes(item.id) && 
                    (item.address.includes(queryLower) || item.city.includes(queryLower))) {
                    matches.push(item.id);
                    if (matches.length >= 5) break; // Limit do 5 wyników
                }
            }
        }
        
        // Konwertuj ID z powrotem na obiekty
        return matches.map(id => 
            this.autocompleteData.find(item => item.id === id)
        ).filter(item => item); // Usuń undefined
    },
    
    /**
     * Wyświetla wyniki autouzupełniania
     * @param {Array} results - Wyniki wyszukiwania
     * @param {string} query - Fraza wyszukiwania
     */
    displayAutocompleteResults: function(results, query) {
        const autocompleteContainer = document.getElementById('unified-autocomplete');
        
        // Wyczyść kontener
        autocompleteContainer.innerHTML = '';
        
        if (results.length > 0) {
            results.forEach(match => {
                const div = document.createElement('div');
                div.innerHTML = Utils.highlightText(match.text, query);
                div.dataset.type = 'point';
                div.dataset.id = match.id;
                div.addEventListener('click', () => {
                    document.getElementById('unified-search-input').value = match.text;
                    autocompleteContainer.style.display = 'none';
                    UIService.selectPoint(match.point);
                });
                autocompleteContainer.appendChild(div);
            });
            
            autocompleteContainer.style.display = 'block';
        } else {
            autocompleteContainer.style.display = 'none';
        }
    },
    
    /**
     * Obsługa wyników wyszukiwania adresów
     * @param {string} query - Oryginalne zapytanie
     * @param {Array} results - Wyniki wyszukiwania adresów
     */
    handleAddressResults: function(query, results) {
        const autocompleteContainer = document.getElementById('unified-autocomplete');
        
        // Sprawdź, czy zapytanie jest nadal aktualne
        const currentQuery = document.getElementById('unified-search-input').value.toLowerCase().trim();
        if (query !== currentQuery) return;
        
        this.lastQuery = query;
        
        if (results.length > 0) {
            // Dodaj separator, jeśli są już wyniki punktów
            if (autocompleteContainer.children.length > 0) {
                const separator = document.createElement('div');
                separator.innerHTML = '<hr><div style="padding: 5px; font-size: 12px; color: #666;">Adresy:</div>';
                autocompleteContainer.appendChild(separator);
            }
            
            // Dodaj wyniki adresów
            results.forEach(result => {
                const div = document.createElement('div');
                div.textContent = result.display_name;
                div.dataset.type = 'address';
                div.dataset.lat = result.lat;
                div.dataset.lon = result.lon;
                div.addEventListener('click', () => {
                    document.getElementById('unified-search-input').value = result.display_name;
                    autocompleteContainer.style.display = 'none';
                    GeocodingService.showAddressOnMap(result.lat, result.lon, result.display_name);
                });
                autocompleteContainer.appendChild(div);
            });
            
            autocompleteContainer.style.display = 'block';
        }
    },
    
    /**
     * Obsługa wyszukiwania po kliknięciu przycisku lub klawisza Enter
     */
    handleSearch: function() {
        const query = document.getElementById('unified-search-input').value.trim();
        
        if (!query) return;
        
        // Najpierw sprawdź, czy to punkt
        const matchingPoint = this.autocompleteData.find(item => 
            item.type === 'point' && item.text.toLowerCase() === query.toLowerCase()
        );
        
        if (matchingPoint) {
            // Jeśli znaleziono dokładne dopasowanie punktu
            UIService.selectPoint(matchingPoint.point);
        } else {
            // Jeśli nie znaleziono punktu, szukaj adresu
            GeocodingService.searchAddress(query);
        }
    },
    
    /**
     * Znajdowanie najbliższych punktów do danej lokalizacji
     * @param {number} lat - Szerokość geograficzna
     * @param {number} lon - Długość geograficzna
     * @param {number} limit - Limit wyników
     * @returns {Array} - Najbliższe punkty z odległościami
     */
    findNearestPoints: function(lat, lon, limit = 5) {
        // Określ przybliżony obszar poszukiwań dla lepszej wydajności
        const latDiff = Config.search.approximateSearchRadius.lat;
        const lonDiff = Config.search.approximateSearchRadius.lon;
        
        // Filtruj punkty w przybliżonym obszarze
        const potentialCandidates = MarkersService.allPoints.filter(point => {
            if (!point.latitude || !point.longitude) return false;
            
            return Math.abs(point.latitude - lat) < latDiff && 
                   Math.abs(point.longitude - lon) < lonDiff;
        });
        
        // Jeśli mamy mało kandydatów lub duży zbiór, ogranicz liczbę punktów do przetworzenia
        const candidatesToProcess = potentialCandidates.length < 100 ? 
            potentialCandidates : MarkersService.allPoints.slice(0, 1000);
        
        // Oblicz dokładne odległości tylko dla kandydatów
        const pointsWithDistance = candidatesToProcess
            .map(point => {
                const distance = Utils.calculateDistance(
                    lat, lon, 
                    point.latitude, point.longitude
                );
                return {
                    point: point,
                    distance: distance
                };
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);
        
        return pointsWithDistance;
    },
    
    /**
     * Wyświetlanie wyników wyszukiwania
     * @param {Array} results - Wyniki z odległościami
     */
    displaySearchResults: function(results) {
        const resultsContainer = document.getElementById('search-results');
        const titleElement = document.getElementById('search-results-title');
        
        resultsContainer.innerHTML = '';
        
        if (results.length > 0) {
            titleElement.style.display = 'block';
            
            results.forEach(({ point, distance }, index) => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                
                let resultContent = `
                    <h4>${index + 1}. ${point.name || 'Bez nazwy'}</h4>
                    <p>${point.address || ''}, ${point.city || ''}</p>
                `;
                
                if (distance !== undefined) {
                    resultContent += `<p><strong>Odległość:</strong> ${distance.toFixed(2)} km</p>`;
                }
                
                resultItem.innerHTML = resultContent;
                
                resultItem.addEventListener('click', () => {
                    UIService.selectPoint(point);
                });
                
                resultsContainer.appendChild(resultItem);
            });
        } else {
            titleElement.style.display = 'none';
        }
    }
};