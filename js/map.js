/**
 * Serwis obsługujący mapę
 */

// Debugowanie globalnych zmiennych
console.log('map.js loading, Config available?', typeof Config !== 'undefined');

const MapService = {
    map: null,
    markerCluster: null,
    markers: [],
    
    initialize() {
        // Sprawdź czy Config jest dostępny
        if (typeof Config === 'undefined') {
            console.error('Config is not defined!');
            return;
        }
        
        console.log('Initializing map service');
        
        // Inicjalizacja mapy
        this.map = L.map('map').setView(
            Config.mapDefaults.center, 
            Config.mapDefaults.zoom
        );
        
        // Dodanie warstwy kafli OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Inicjalizacja klastra markerów
        this.markerCluster = L.markerClusterGroup();
        this.map.addLayer(this.markerCluster);
        
        // Dopasuj widok do wybranego kraju
        this.fitToCountry('pl');
        
        return this.map;
    },
    
    /**
     * Inicjalizacja kontrolki "Pokaż punkty w tej okolicy"
     */
    initViewportControl: function() {
        // Utwórz niestandardową kontrolkę Leaflet
        this.viewportControl = L.control({ position: 'topcenter' });
        
        this.viewportControl.onAdd = function() {
            const container = L.DomUtil.create('div', 'map-viewport-control');
            container.innerHTML = '<button id="load-viewport-btn">Pokaż punkty w tym obszarze</button>';
            container.style.display = 'none'; // Ukryta domyślnie
            return container;
        };
        
        // Dodaj kontrolkę do mapy
        this.viewportControl.addTo(this.map);
        
        // Dodaj nasłuchiwanie dla przycisku
        setTimeout(() => {
            const button = document.getElementById('load-viewport-btn');
            if (button) {
                button.addEventListener('click', () => {
                    this.loadPointsInViewport();
                    this.hideViewportControl();
                });
            }
        }, 500);
    },
    
    /**
     * Inicjalizacja nasłuchiwania zdarzeń mapy
     */
    initMapEvents: function() {
        this.map.on('moveend', () => {
            this.mapMoved = true;
            this.showViewportControl();
        });
        
        this.map.on('zoomend', () => {
            this.mapMoved = true;
            this.showViewportControl();
        });
    },
    
    /**
     * Pokazanie kontrolki "Pokaż punkty w tym obszarze"
     */
    showViewportControl: function() {
        if (this.mapMoved) {
            const controlElement = document.querySelector('.map-viewport-control');
            if (controlElement) {
                controlElement.style.display = 'block';
            }
        }
    },
    
    /**
     * Ukrycie kontrolki "Pokaż punkty w tym obszarze"
     */
    hideViewportControl: function() {
        const controlElement = document.querySelector('.map-viewport-control');
        if (controlElement) {
            controlElement.style.display = 'none';
        }
        this.mapMoved = false;
    },
    
    /**
     * Ładowanie punktów w aktualnym widoku mapy
     */
    loadPointsInViewport: async function() {
        try {
            Utils.updateStatus('Pobieranie punktów w tym obszarze...', true);
            
            // Pobierz granice aktualnego widoku
            const bounds = this.map.getBounds();
            const center = bounds.getCenter();
            
            // Ustal promień wyszukiwania
            const radius = {
                lat: Math.abs(bounds.getNorth() - bounds.getSouth()) / 2,
                lng: Math.abs(bounds.getEast() - bounds.getWest()) / 2
            };
            
            // Pobierz punkty w tym obszarze
            const points = await ApiService.fetchPointsInArea(
                center.lat, center.lng, radius
            );
            
            // Ustaw nowe punkty (zachowując filtry)
            MarkersService.setPoints(points);
            
            // Dodaj markery na mapę
            const citySelector = document.getElementById('city-filter');
            MarkersService.addMarkers(citySelector ? citySelector.value : 'all');
            
            // Zaktualizuj filtry miast
            App.updateCityFilterOptions();
            
            Utils.updateStatus(`Załadowano ${points.length} punktów w tym obszarze`, false);
        } catch (error) {
            console.error('Błąd podczas ładowania punktów w widoku:', error);
            Utils.updateStatus('Błąd ładowania punktów w tym obszarze', false);
        }
    },
    
    /**
     * Dostosowanie widoku mapy do wybranego kraju
     * @param {string} countryCode - Kod kraju
     */
    fitToCountry(countryCode) {
        console.log('Fitting to country:', countryCode);
        
        // Dodaj zabezpieczenie
        if (!Config || !Config.mapDefaults || !Config.mapDefaults.countryBounds) {
            console.error('Config.mapDefaults.countryBounds is missing!');
            return;
        }
        
        const bounds = Config.mapDefaults.countryBounds[countryCode];
        if (bounds) {
            this.map.fitBounds(bounds);
        } else {
            console.warn(`No bounds defined for country: ${countryCode}`);
        }
    },
    
    /**
     * Dodanie legendy do mapy
     */
    addLegend: function() {
        if (this.legendControl) {
            this.map.removeControl(this.legendControl);
        }
        
        this.legendControl = L.control({position: 'bottomright'});
        
        this.legendControl.onAdd = function() {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <h4>Legenda</h4>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #e74c3c;"></span>
                    <span>Paczkomat InPost</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #3498db;"></span>
                    <span>Punkt DHL</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #2ecc71;"></span>
                    <span>Orlen Paczka</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon" style="background-color: #f39c12;"></span>
                    <span>Inny punkt</span>
                </div>
            `;
            return div;
        };
        
        this.legendControl.addTo(this.map);
    },
    
    /**
     * Ustawienie widoku mapy na określone współrzędne
     * @param {Array} latLng - Współrzędne [lat, lng]
     * @param {number} zoom - Poziom przybliżenia
     */
    setView: function(latLng, zoom) {
        this.map.setView(latLng, zoom);
    }
};