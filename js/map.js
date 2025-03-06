/**
 * Serwis obsługujący mapę
 */
export const MapService = {
    // Obiekt mapy Leaflet
    map: null,
    
    // Kontrolka legendy
    legendControl: null,
    
    // Stan przesunięcia mapy
    mapMoved: false,
    
    // Kontrolka "Pokaż punkty w tej okolicy"
    viewportControl: null,
    
    /**
     * Inicjalizacja mapy
     */
    initialize: function() {
        // Utwórz mapę
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        });
        
        // Dodaj kontrolki
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        L.control.attribution({ position: 'bottomleft' }).addTo(this.map)
            .setPrefix('').addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
        
        // Dodaj warstwę kafelków (tiles)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(this.map);
        
        // Ustaw widok na Polskę (domyślnie)
        this.fitToCountry('pl');
        
        // Inicjalizuj kontrolkę "Pokaż punkty w tej okolicy"
        this.initViewportControl();
        
        // Nasłuchuj zdarzeń mapy
        this.initMapEvents();
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
    fitToCountry: function(countryCode) {
        const viewConfig = Config.map.defaultView[countryCode] || Config.map.defaultView.pl;
        this.map.setView(viewConfig.center, viewConfig.zoom);
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