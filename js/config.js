// @ts-nocheck
console.log('Defining Config');

/**
 * Konfiguracja aplikacji
 */
const Config = {
    // Konfiguracja API
    api: {
        // Keep only the headers which are shared across all requests
        headers: {
            'Content-Type': 'application/json'
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

// Carrier configuration
Config.carriers = {
    inpost: {
        id: 'inpost',
        name: 'InPost',
        apiUrl: 'https://api.globkurier.pl/v1/points?productId=420',
        color: '#FFCC00',
        logo: 'img/inpost-logo.png',
        identifiers: ['inpost', 'paczkomat'],
        pointIdentifier: function(point) {
            return (point.type && (point.type.toLowerCase().includes('inpost') || 
                   point.type.toLowerCase().includes('paczkomat')));
        },
        // Add country-specific URLs if needed
        countryUrls: {
            pl: 'https://api.globkurier.pl/v1/points?productId=420',
            fr: 'https://api.globkurier.pl/v1/points?productId=3492&countryId=12'
        }
    },
    dpd: {
        id: 'dpd',
        name: 'DPD',
        apiUrl: 'https://api.globkurier.pl/v1/points?productId=3341',
        color: '#DC0032', 
        logo: 'img/dpd-logo.png',
        identifiers: ['dpd'],
        pointIdentifier: function(point) {
            return (point.name && point.name.toLowerCase().includes('dpd'));
        },
        countryUrls: {
            pl: 'https://api.globkurier.pl/v1/points?productId=3341'
        }
    },
    orlen: {
        id: 'orlen',
        name: 'Orlen',
        apiUrl: 'https://api.globkurier.pl/v1/points?productId=1987',
        color: '#920015',
        logo: 'img/orlen-logo.png',
        identifiers: ['orlen', 'ruch'],
        pointIdentifier: function(point) {
            return (point.name && (point.name.toLowerCase().includes('orlen') || 
                   point.name.toLowerCase().includes('ruch')));
        }
    },
    dhl: {
        id: 'dhl',
        name: 'DHL',
        apiUrl: 'https://api.globkurier.pl/v1/points?productId=259',
        color: '#FFCC00',
        logo: 'img/dhl-logo.png',
        identifiers: ['dhl'],
        pointIdentifier: function(point) {
            return (point.name && point.name.toLowerCase().includes('dhl'));
        }
    },
    pocztex: {
        id: 'pocztex',
        name: 'Pocztex',
        apiUrl: 'https://api.globkurier.pl/v1/points?productId=2300',
        color: '#e61614',
        logo: 'img/pocztex-logo.png',
        identifiers: ['pocztex', 'poczta'],
        pointIdentifier: function(point) {
            return (point.name && (point.name.toLowerCase().includes('pocztex') || 
                   point.name.toLowerCase().includes('poczta polska')));
        }
    }
};