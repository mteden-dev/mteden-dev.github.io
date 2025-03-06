/**
 * Funkcje narzędziowe (utilities)
 */
console.log('Defining Utils global object');

// USUŃ EXPORT - po prostu zdefiniuj jako zmienną globalną
const Utils = {
    /**
     * Aktualizacja paska statusu
     * @param {string} message - Wiadomość do wyświetlenia
     * @param {boolean} isLoading - Czy pokazać ikonę ładowania
     */
    updateStatus: function(message, isLoading) {
        const statusText = document.getElementById('status-text');
        const loadingIndicator = document.getElementById('loading-indicator');
        
        statusText.textContent = message;
        loadingIndicator.style.display = isLoading ? 'inline-block' : 'none';
    },
    
    /**
     * Oblicza odległość między dwoma punktami w kilometrach
     * @param {number} lat1 - Szerokość geograficzna pierwszego punktu
     * @param {number} lon1 - Długość geograficzna pierwszego punktu 
     * @param {number} lat2 - Szerokość geograficzna drugiego punktu
     * @param {number} lon2 - Długość geograficzna drugiego punktu
     * @returns {number} Odległość w kilometrach
     */
    calculateDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; // Promień Ziemi w kilometrach
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = R * c; // Odległość w kilometrach
        return distance;
    },
    
    /**
     * Konwertuje stopnie na radiany
     * @param {number} deg - Stopnie
     * @returns {number} Radiany
     */
    deg2rad: function(deg) {
        return deg * (Math.PI/180);
    },
    
    /**
     * Wyróżnia wyszukiwany tekst w podanym tekście
     * @param {string} text - Tekst do przeszukania
     * @param {string} query - Fraza do wyróżnienia
     * @returns {string} Tekst z wyróżnioną frazą
     */
    highlightText: function(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    },
    
    formatDate(date) {
        return new Date(date).toLocaleDateString('pl-PL');
    },
    
    formatDateTime(date) {
        return new Date(date).toLocaleString('pl-PL');
    },
    
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
};

// Sprawdź czy Utils jest dostępny
console.log('Utils defined:', typeof Utils !== 'undefined');