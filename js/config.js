// @ts-nocheck
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
            other: 'https://api.globkurier.pl/v1/points?productId=3508&countryId=33',
            dpd: 'https://api.globkurier.pl/v1/points?productId=3341'
        },
        // If the API requires headers, add them here
        headers: {
            'Content-Type': 'application/json'
        },
        // Konfiguracja API dla konkretnych przewoźników
        carriers: {
            inpost: {
                pl: 'https://api.globkurier.pl/v1/points?productId=420',
                fr: 'https://api.globkurier.pl/v1/points?productId=3492&countryId=12'
            },
            dpd: {
                pl: 'https://api.globkurier.pl/v1/points?productId=3341'
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
        viewportSearchRadius: 0.1,
        cityZoom: 13,
        addressZoom: 16
    },
    
    // Domyślne wartości dla mapy
    mapDefaults: {
        center: [52.0689, 19.4803],
        zoom: 7,
        minZoom: 6,
        maxZoom: 18,
        countryCodes: {
            pl: 'pl',
            fr: 'fr'
        },
        countryBounds: {
            pl: [[49.0, 14.0], [55.0, 24.0]],
            fr: [[41.0, -5.0], [51.0, 10.0]]
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
        getGeocodingParams: function(country) {
            return {
                format: 'json',
                countrycodes: country || 'pl',
                limit: 3
            };
        },
        nearestPointsLimit: 5, 
        approximateSearchRadius: {
            lat: 0.18,
            lon: 0.3
        }
    },
    
    // Konfiguracja cache
    cache: {
        filename: 'paczkomaty_cache.json',
        version: '1.1',
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
        default: 'standalone',
        modalSelectButtonText: 'Wybierz ten punkt'
    }
};