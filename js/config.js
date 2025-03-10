console.log('Defining Config');

/**
 * Konfiguracja aplikacji
 */
const Config = {
    // Konfiguracja API
    api: {
        urls: {
            pl: 'https://api.globkurier.pl/v1/points?productId=420',
            fr: 'https://api.globkurier.pl/v1/points?productId=3492&countryId=12',
            other: 'https://api.globkurier.pl/v1/points?productId=3508&countryId=33'
        },
        // Konfiguracja API dla konkretnych przewoźników
        carriers: {
            inpost: {
                pl: 'https://api.globkurier.pl/v1/points?productId=420',
                fr: 'https://api.globkurier.pl/v1/points?productId=3492&countryId=12'
            }
        }
    },
    
    // Konfiguracja mapy
    map: {
        defaultView: {
            pl: {center: [52.0, 19.0], zoom: 6},  // Polska
            fr: {center: [46.6, 2.5], zoom: 6},   // Francja
            other: {center: [47.0, 2.0], zoom: 5},  // Inny kraj
            all: {center: [50.0, 10.0], zoom: 4}    // Europa
        },
        clusterOptions: {
            maxClusterRadius: 80,
            spiderfyOnMaxZoom: false,
            disableClusteringAtZoom: 17,
            chunkedLoading: true,
            zoomToBoundsOnClick: true
        },
        // Konfiguracja dla wyświetlania punktów w okolicy
        viewportSearchRadius: 0.1, // Promień w stopniach dla wyszukiwania punktów w widocznym obszarze
        cityZoom: 13, // Poziom przybliżenia dla miasta
        addressZoom: 16 // Poziom przybliżenia dla adresu
    },
    
    // Domyślne wartości dla mapy
    mapDefaults: {
        center: [52.0689, 19.4803], // Środek Polski
        zoom: 7,
        minZoom: 6,
        maxZoom: 18,
        countryCodes: {
            pl: 'pl',
            fr: 'fr'
        },
        countryBounds: {
            pl: [[49.0, 14.0], [55.0, 24.0]], // przybliżone granice Polski
            fr: [[41.0, -5.0], [51.0, 10.0]]  // przybliżone granice Francji
        }
    },
    
    // Konfiguracja wyszukiwania
    search: {
        geocodingUrl: 'https://nominatim.openstreetmap.org/search',
        geocodingParams: {
            format: 'json', 
            countrycodes: 'pl', 
            limit: 3
        },
        // Funkcja pomocnicza do dynamicznego ustawiania kodu kraju
        getGeocodingParams: function(country) {
            return {
                format: 'json',
                countrycodes: country || 'pl',
                limit: 3
            };
        },
        nearestPointsLimit: 5, 
        approximateSearchRadius: {
            lat: 0.18, // ok. 20km w szerokości geograficznej
            lon: 0.3   // ok. 20km w długości geograficznej
        }
    },
    
    // Konfiguracja cache
    cache: {
        filename: 'paczkomaty_cache.json',
        version: '1.1',  // Zwiększona wersja, aby uwzględnić dodanie nowego kraju
        countryVersions: {
            pl: '1.0',
            fr: '1.0',
            other: '1.0',
            all: '1.1'
        }
    },
    
    // Dostępne kraje
    countries: {
        pl: "Polska",
        fr: "Francja",
        other: "Inny kraj"
    },
    
    // Tryb aplikacji
    mode: {
        default: 'standalone', // standalone lub modal
        modalSelectButtonText: 'Wybierz ten punkt' // Tekst przycisku wyboru w trybie modalnym
    }
};