/**
 * Obsługa cachowania punktów
 */
const CacheService = {
    /**
     * Zapisywanie punktów do pliku
     */
    savePointsToCache: function() {
        try {
            // Przygotuj dane do zapisania
            const cacheData = {
                timestamp: new Date().toISOString(),
                points: MarkersService.allPoints,
                version: Config.cache.version,
                metadata: {
                    pointsCount: MarkersService.allPoints.length,
                    uniqueCities: this.countUniqueCities(MarkersService.allPoints),
                    appVersion: '1.0.0' // Wersja aplikacji, można dodać do Config
                }
            };
            
            // Konwertuj dane do JSON
            const jsonData = JSON.stringify(cacheData, null, 2);
            
            // Utwórz blob z danymi JSON
            const blob = new Blob([jsonData], { type: 'application/json' });
            
            // Utwórz URL dla Blob
            const url = URL.createObjectURL(blob);
            
            // Utwórz nową datę do nazwy pliku
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
            const fileName = `paczkomaty_cache_${dateStr}.json`;
            
            // Utwórz element <a> dla pobrania
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            
            // Kliknij link aby rozpocząć pobieranie
            document.body.appendChild(a);
            a.click();
            
            // Poczekaj chwilę i usuń elementy
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            Utils.updateStatus(`Zapisano ${MarkersService.allPoints.length} punktów do pliku`, false);
        } catch (error) {
            console.error('Błąd podczas zapisywania cache:', error);
            Utils.updateStatus('Błąd podczas zapisywania punktów: ' + error.message, false);
        }
    },
    
    /**
     * Wczytywanie punktów z pliku
     * @param {File} file - Plik do wczytania
     */
    loadPointsFromFile: function(file) {
        try {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    Utils.updateStatus('Przetwarzanie pliku cache...', true);
                    
                    // Parsuj zawartość pliku jako JSON
                    const cacheData = JSON.parse(event.target.result);
                    
                    // Sprawdź poprawność struktury pliku
                    if (!cacheData.points || !Array.isArray(cacheData.points)) {
                        throw new Error('Nieprawidłowa struktura pliku cache');
                    }
                    
                    // Sprawdź wersję cache
                    if (cacheData.version !== Config.cache.version) {
                        Utils.updateStatus(`Uwaga: Wersja pliku cache (${cacheData.version}) różni się od aktualnej (${Config.cache.version})`, false);
                    }
                    
                    // Wyświetl informację o czasie zapisu cache
                    if (cacheData.timestamp) {
                        const date = new Date(cacheData.timestamp);
                        console.log(`Cache zapisany: ${date.toLocaleString()}`);
                    }
                    
                    // Wyświetl informacje o metadanych
                    if (cacheData.metadata) {
                        console.log('Metadane cache:', cacheData.metadata);
                    }
                    
                    // Aktualizuj punkty
                    MarkersService.setPoints(cacheData.points);
                    
                    Utils.updateStatus(`Załadowano ${cacheData.points.length} punktów z pliku cache`, false);
                    
                    // Zaktualizuj mapę i indeksy wyszukiwania
                    App.refreshMap();
                    SearchService.buildSearchIndex();
                    
                    // Zapisz punkty również do localStorage
                    App.savePointsToLocalStorage(cacheData.points);
                    
                } catch (error) {
                    console.error('Błąd podczas parsowania pliku cache:', error);
                    Utils.updateStatus('Błąd podczas wczytywania pliku cache: ' + error.message, false);
                }
            };
            
            reader.onerror = function() {
                console.error('Błąd podczas czytania pliku');
                Utils.updateStatus('Błąd podczas czytania pliku', false);
            };
            
            // Rozpocznij czytanie pliku jako tekst
            reader.readAsText(file);
        } catch (error) {
            console.error('Błąd podczas wczytywania cache:', error);
            Utils.updateStatus('Błąd podczas wczytywania pliku cache: ' + error.message, false);
        }
    },
    
    /**
     * Liczy unikalne miasta w zbiorze punktów
     * @param {Array} points - Punkty do analizy
     * @returns {number} Liczba unikalnych miast
     */
    countUniqueCities: function(points) {
        const uniqueCities = new Set();
        points.forEach(point => {
            if (point.city) uniqueCities.add(point.city);
        });
        return uniqueCities.size;
    }
};