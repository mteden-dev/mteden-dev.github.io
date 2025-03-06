/**
 * Obsługa wyszukiwania
 */
const SearchService = {
    autocompleteData: [],  // Dane dla autouzupełniania
    searchIndex: [],       // Indeks wyszukiwania
    lastQuery: '',         // Ostatnie zapytanie
    lastSearchResults: [], // Ostatnie wyniki wyszukiwania
    
    /**
     * Inicjalizacja wyszukiwania
     */
    initialize: function() {
        console.log("Initializing search service");
        
        // Initialize the search interface using existing HTML elements
        this.initNewSearchInterface();
        
        // Other initialization tasks
        this.setupEventListeners();
        
        console.log("Search service initialized");
    },
    
    /**
     * Budowanie indeksu wyszukiwania z punktów
     */
    buildSearchIndex: function() {
        console.log("Building search index...");
        if (!MarkersService || !MarkersService.allPoints) {
            console.error("Cannot build search index - points not available");
            return;
        }
        
        this.searchIndex = MarkersService.allPoints.map(point => {
            // Create searchable text from point properties
            const searchText = [
                point.name || '',
                point.address || '',
                point.city || '',
                point.postCode || '',
                point.id || ''
            ].join(' ').toLowerCase();
            
            return {
                point: point,
                searchText: searchText
            };
        });
        
        console.log(`Zbudowano indeks wyszukiwania z ${this.searchIndex.length} punktów`);
    },
    
    /**
     * Wyszukiwanie punktów po frazie
     */
    searchPoints: function(phrase) {
        console.log(`Searching for: "${phrase}"`);
        if (!phrase || phrase.length < 2) {
            console.log("Search phrase too short");
            return [];
        }
        
        if (!this.searchIndex || this.searchIndex.length === 0) {
            console.log("Search index empty, rebuilding...");
            this.buildSearchIndex();
        }
        
        const searchPhrase = phrase.toLowerCase();
        const results = this.searchIndex
            .filter(item => item.searchText.includes(searchPhrase))
            .map(item => item.point);
        
        console.log(`Found ${results.length} results for "${phrase}"`);
        this.lastSearchResults = results;
        return results;
    },
    
    /**
     * Wyszukiwanie adresu przez geocoding
     */
    searchAddress: async function(phrase) {
        console.log(`Geocoding address: "${phrase}"`);
        if (!GeocodingService || typeof GeocodingService.searchAddress !== 'function') {
            console.error("GeocodingService not available");
            return [];
        }
        
        try {
            const result = await GeocodingService.searchAddress(phrase);
            console.log("Geocoding result:", result);
            return result;
        } catch (error) {
            console.error("Geocoding error:", error);
            return null;
        }
    },
    
    /**
     * Konfiguracja nasłuchiwania zdarzeń
     */
    setupEventListeners: function() {
        const unifiedSearchInput = document.getElementById('unified-search-input');
        const searchBtn = document.getElementById('search-btn');
        
        if (unifiedSearchInput) {
            // Obsługa wprowadzania tekstu
            unifiedSearchInput.addEventListener('input', this.handleInputChange.bind(this));
            
            // Obsługa przycisku wyszukiwania
            if (searchBtn) {
                searchBtn.addEventListener('click', this.handleSearch.bind(this));
            }
            
            // Obsługa klawisza Enter
            unifiedSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }
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
            if (item.searchText.includes(queryLower)) {
                matches.push(item.point);
                if (matches.length >= 5) break; // Limit do 5 wyników
            }
        }
        
        return matches;
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
                div.innerHTML = Utils.highlightText(match.name || 'Bez nazwy', query);
                div.dataset.type = 'point';
                div.dataset.id = match.id;
                div.addEventListener('click', () => {
                    document.getElementById('unified-search-input').value = match.name || 'Bez nazwy';
                    autocompleteContainer.style.display = 'none';
                    UIService.selectPoint(match);
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
            this.searchAddress(query);
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
    },

    /**
     * Inicjalizacja nowego interfejsu wyszukiwania
     */
    initNewSearchInterface: function() {
        console.log("Initializing new search interface - looking for elements");
        
        const searchInput = document.getElementById('map-search-input');
        const locationButton = document.getElementById('location-button');
        
        console.log("Search input found:", !!searchInput);
        console.log("Location button found:", !!locationButton);
        
        if (!searchInput || !locationButton) {
            console.error("New search interface elements not found");
            this.createSearchElements(); // Try to create them
            return;
        }
        
        // Create autocomplete container only if it doesn't exist
        let autocompleteContainer = document.getElementById('map-search-autocomplete');
        if (!autocompleteContainer) {
            console.log("Creating autocomplete container");
            autocompleteContainer = document.createElement('div');
            autocompleteContainer.id = 'map-search-autocomplete';
            autocompleteContainer.className = 'autocomplete-container';
            autocompleteContainer.style.cssText = 'display:none;position:absolute;top:48px;left:70px;width:240px;background:white;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 5px rgba(0,0,0,0.2);max-height:300px;overflow-y:auto;z-index:1002;';
            document.body.appendChild(autocompleteContainer);
        }
        
        console.log("Setting up search input events");
        // Setup input events
        searchInput.addEventListener('input', this.handleNewSearchInput.bind(this));
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const query = event.target.value.trim();
                if (query) {
                    this.performSearch(query);
                    autocompleteContainer.style.display = 'none';
                }
            }
        });
        
        console.log("Setting up location button events");
        // Setup location button
        locationButton.addEventListener('click', this.handleLocationButtonClick.bind(this));
        
        console.log("New search interface initialization complete");
    },

    /**
     * Obsługa kliknięcia przycisku lokalizacji
     */
    handleLocationButtonClick: function() {
        console.log("Location button clicked");
        
        if (navigator.geolocation) {
            Utils.updateStatus('Ustalanie lokalizacji...', true);
            
            navigator.geolocation.getCurrentPosition(
                // Success callback
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    console.log(`User location: ${lat}, ${lng}`);
                    
                    // Update map view
                    MapService.setView([lat, lng], 15);
                    
                    // Add marker for current location
                    this.addCurrentLocationMarker(lat, lng);
                    
                    // Find nearest points
                    this.findAndShowNearestPoints(lat, lng);
                    
                    Utils.updateStatus('Znaleziono Twoją lokalizację', false);
                },
                // Error callback
                (error) => {
                    console.error("Geolocation error:", error);
                    let errorMsg = "Nie udało się ustalić lokalizacji.";
                    
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMsg = "Dostęp do lokalizacji został zablokowany.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMsg = "Dane lokalizacji są niedostępne.";
                            break;
                        case error.TIMEOUT:
                            errorMsg = "Upłynął limit czasu dla ustalenia lokalizacji.";
                            break;
                    }
                    
                    Utils.updateStatus(errorMsg, false);
                    alert(errorMsg);
                },
                // Options
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            Utils.updateStatus('Geolokalizacja nie jest wspierana przez przeglądarkę', false);
            alert("Twoja przeglądarka nie obsługuje geolokalizacji.");
        }
    },

    /**
     * Dodaje marker w aktualnej lokalizacji użytkownika
     */
    addCurrentLocationMarker: function(lat, lng) {
        if (!MapService || !MapService.map) return;
        
        // Remove previous marker if exists
        if (this.currentLocationMarker) {
            MapService.map.removeLayer(this.currentLocationMarker);
        }
        
        // Create current location marker with a pulsing effect
        const locationIcon = L.divIcon({
            className: 'current-location-marker',
            html: '<div class="location-marker-inner"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        this.currentLocationMarker = L.marker([lat, lng], {
            icon: locationIcon,
            zIndexOffset: 1000
        }).addTo(MapService.map);
        
        // Add a tooltip
        this.currentLocationMarker.bindTooltip("Twoja lokalizacja", {
            permanent: true,
            direction: 'top',
            offset: [0, -10]
        }).openTooltip();
    },

    /**
     * Wyszukuje i pokazuje najbliższe punkty do podanej lokalizacji
     */
    findAndShowNearestPoints: function(lat, lng) {
        if (!IntegrationService || !IntegrationService.findNearestPoints) {
            console.error("IntegrationService.findNearestPoints not available");
            return;
        }
        
        IntegrationService.findNearestPoints(lat, lng)
            .then(nearestPoints => {
                if (nearestPoints && nearestPoints.length > 0) {
                    console.log(`Found ${nearestPoints.length} nearest points`);
                    
                    // Show points on map
                    if (IntegrationService.showNearestPoints) {
                        IntegrationService.showNearestPoints(nearestPoints);
                    }
                    
                    // Display in search results
                    this.displaySearchResults(nearestPoints.map(point => ({ 
                        point: point,
                        distance: Utils.calculateDistance(lat, lng, point.latitude, point.longitude)
                    })));
                } else {
                    Utils.updateStatus("Nie znaleziono punktów w pobliżu", false);
                }
            })
            .catch(error => {
                console.error("Error finding nearest points:", error);
                Utils.updateStatus("Błąd wyszukiwania punktów", false);
            });
    },

    /**
     * Obsługa wpisywania w polu wyszukiwania
     */
    handleNewSearchInput: function(event) {
        const query = event.target.value.trim();
        const autocompleteContainer = document.getElementById('map-search-autocomplete');
        
        // Clear any existing timers
        if (this.searchInputTimer) clearTimeout(this.searchInputTimer);
        
        // Clear container
        if (autocompleteContainer) {
            autocompleteContainer.innerHTML = '';
            
            if (!query) {
                autocompleteContainer.style.display = 'none';
                return;
            }
            
            if (query.length >= 2) {
                this.searchInputTimer = setTimeout(() => {
                    // Search points
                    const pointResults = this.searchPoints(query);
                    
                    // Display results
                    if (pointResults.length > 0) {
                        pointResults.slice(0, 5).forEach(point => {
                            const item = document.createElement('div');
                            item.className = 'autocomplete-item';
                            item.innerHTML = `<strong>${point.name || point.id}</strong><br>${point.address || ''}, ${point.city || ''}`;
                            
                            item.addEventListener('click', () => {
                                document.getElementById('map-search-input').value = point.name || point.id;
                                autocompleteContainer.style.display = 'none';
                                UIService.selectPoint(point);
                            });
                            
                            autocompleteContainer.appendChild(item);
                        });
                        
                        autocompleteContainer.style.display = 'block';
                    } else {
                        // If no point results, try address search
                        if (query.length >= 3) {
                            GeocodingService.searchAddresses(query, (addressResults) => {
                                if (addressResults && addressResults.length > 0) {
                                    addressResults.slice(0, 3).forEach(result => {
                                        const item = document.createElement('div');
                                        item.className = 'autocomplete-item';
                                        item.innerHTML = `<em>Adres:</em> ${result.display_name}`;
                                        
                                        item.addEventListener('click', () => {
                                            document.getElementById('map-search-input').value = result.display_name;
                                            autocompleteContainer.style.display = 'none';
                                            GeocodingService.showAddressOnMap(result.lat, result.lon, result.display_name);
                                        });
                                        
                                        autocompleteContainer.appendChild(item);
                                    });
                                    
                                    autocompleteContainer.style.display = 'block';
                                } else {
                                    autocompleteContainer.style.display = 'none';
                                }
                            });
                        } else {
                            autocompleteContainer.style.display = 'none';
                        }
                    }
                }, 300);
            }
        }
    },

    /**
     * Wykonuje wyszukiwanie dla podanej frazy
     */
    performSearch: function(query) {
        if (!query || query.length < 2) return;
        
        console.log(`Performing search for: ${query}`);
        Utils.updateStatus('Szukam...', true);
        
        // First try searching points
        const pointResults = this.searchPoints(query);
        
        if (pointResults.length > 0) {
            console.log(`Found ${pointResults.length} matching points`);
            Utils.updateStatus(`Znaleziono ${pointResults.length} punktów`, false);
            
            // Focus on the first result
            const point = pointResults[0];
            if (point && point.latitude && point.longitude) {
                MapService.setView([point.latitude, point.longitude], 15);
                
                if (MarkersService && MarkersService.markersById && MarkersService.markersById[point.id]) {
                    MarkersService.markersById[point.id].marker.openPopup();
                }
            }
            
            // Display all results
            this.displaySearchResults(pointResults.map(p => ({ point: p })));
        } else {
            // If no points found, try geocoding
            console.log('No points found, trying address search');
            
            GeocodingService.searchAddress(query)
                .then(() => {
                    Utils.updateStatus('Wyszukiwanie zakończone', false);
                })
                .catch(error => {
                    console.error('Search error:', error);
                    Utils.updateStatus(`Nie znaleziono "${query}"`, false);
                });
        }
    },

    /**
     * Dodaje elementy wyszukiwania do DOM
     */
    createSearchElements: function() {
        console.log("Creating search elements in DOM");
        
        // Check if elements already exist
        if (document.getElementById('map-search-input')) {
            console.log("Search elements already exist, skipping creation");
            this.initNewSearchInterface();
            return;
        }
        
        // Create the container
        const searchContainer = document.createElement('div');
        searchContainer.className = 'map-search-container';
        searchContainer.style.cssText = 'position:absolute;top:12px;left:70px;z-index:1001;display:flex;';
        
        // Create the search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'map-search-input';
        searchInput.placeholder = 'Wyszukaj punkt lub adres...';
        searchInput.style.cssText = 'height:36px;width:240px;padding:0 10px;border:2px solid rgba(0,0,0,0.2);border-radius:4px;margin-right:8px;';
        
        // Create the location button
        const locationButton = document.createElement('button');
        locationButton.id = 'location-button';
        locationButton.title = 'Pokaż moją lokalizację';
        locationButton.style.cssText = 'width:36px;height:36px;border-radius:50%;border:2px solid rgba(0,0,0,0.2);background-color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;';
        
        // Create the location icon inside the button
        const locationIcon = document.createElement('span');
        locationIcon.className = 'location-icon';
        locationIcon.style.cssText = 'width:18px;height:18px;background-color:#3498db;border-radius:50%;position:relative;';
        
        // Add the inner dot to the location icon
        const innerDot = document.createElement('span');
        innerDot.style.cssText = 'position:absolute;width:8px;height:8px;background-color:white;border-radius:50%;top:5px;left:5px;';
        locationIcon.appendChild(innerDot);
        
        locationButton.appendChild(locationIcon);
        
        // Add elements to the container
        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(locationButton);
        
        // Remove any existing search container to avoid duplicates
        const existingContainer = document.querySelector('.map-search-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // Add the container directly to the body for maximum z-index
        document.body.appendChild(searchContainer);
        
        console.log("Search elements added to body");
        
        // Add autocomplete container
        const autocompleteContainer = document.createElement('div');
        autocompleteContainer.id = 'map-search-autocomplete';
        autocompleteContainer.className = 'autocomplete-container';
        autocompleteContainer.style.cssText = 'display:none;position:absolute;top:48px;left:70px;width:240px;background:white;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 5px rgba(0,0,0,0.2);max-height:300px;overflow-y:auto;z-index:1002;';
        document.body.appendChild(autocompleteContainer);
        
        // Now initialize the search interface
        this.initNewSearchInterface();
    }
};