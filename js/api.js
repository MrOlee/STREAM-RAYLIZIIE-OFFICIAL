const API_BASE_URL = 'https://api-rayliziie.rayyankrens0304.workers.dev';

const API = {
    // Ambil Data Beranda Per Kategori
    async fetchCategory(category, path = '/home') {
        try {
            const response = await fetch(`${API_BASE_URL}/${category}${path}`);
            if (!response.ok) throw new Error('Network response failure');
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${category}:`, error);
            return null;
        }
    },

    // Pencarian Konten Global
    async search(category, keyword) {
        try {
            const response = await fetch(`${API_BASE_URL}/${category}/search?keyword=${encodeURIComponent(keyword)}`);
            return await response.json();
        } catch (error) {
            console.error('Error searching:', error);
            return null;
        }
    },

    // Ambil Detail & Stream URL
    async fetchDetail(category, idOrSlug) {
        try {
            const response = await fetch(`${API_BASE_URL}/${category}/detail?id=${idOrSlug}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching detail:', error);
            return null;
        }
    }
};
