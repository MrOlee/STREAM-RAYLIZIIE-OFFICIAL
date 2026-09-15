const API_BASE_URL = 'https://api-rayliziie.rayyankrens0304.workers.dev';
const DRACIN_API_URL = '/api/dracin';

const API = {
    // Ambil Data Beranda Per Kategori
    async fetchCategory(category, path = '/home') {
        try {
            let url;
            if (category === 'dracin') {
                const action = path.includes('search') ? 'search' : path.includes('episodes') ? 'episodes' : 'home';
                url = `${DRACIN_API_URL}?action=${action}&provider=melolo`;
            } else {
                url = `${API_BASE_URL}/${category}${path}`;
            }

            const response = await fetch(url);
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
            const url = category === 'dracin'
                ? `${DRACIN_API_URL}?action=search&query=${encodeURIComponent(keyword)}`
                : `${API_BASE_URL}/${category}/search?keyword=${encodeURIComponent(keyword)}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response failure');
            return await response.json();
        } catch (error) {
            console.error('Error searching:', error);
            return null;
        }
    },

    // Ambil Detail
    async fetchDetail(category, idOrSlug, provider = 'melolo') {
        try {
            const url = category === 'dracin'
                ? `${DRACIN_API_URL}?action=detail&id=${encodeURIComponent(idOrSlug)}&provider=${encodeURIComponent(provider)}`
                : `${API_BASE_URL}/${category}/detail?id=${encodeURIComponent(idOrSlug)}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response failure');
            return await response.json();
        } catch (error) {
            console.error('Error fetching detail:', error);
            return null;
        }
    },

    async fetchEpisodes(category, idOrSlug, provider = 'melolo') {
        if (category !== 'dracin') return null;
        try {
            const response = await fetch(`${DRACIN_API_URL}?action=episodes&id=${encodeURIComponent(idOrSlug)}&provider=${encodeURIComponent(provider)}`);
            if (!response.ok) throw new Error('Network response failure');
            return await response.json();
        } catch (error) {
            console.error('Error fetching Dracin episodes:', error);
            return null;
        }
    },

    async fetchStream(category, idOrSlug, episode = 1, provider = 'melolo') {
        if (category !== 'dracin') return null;
        try {
            const response = await fetch(`${DRACIN_API_URL}?action=stream&id=${encodeURIComponent(idOrSlug)}&episode=${encodeURIComponent(episode)}&provider=${encodeURIComponent(provider)}`);
            if (!response.ok) throw new Error('Network response failure');
            return await response.json();
        } catch (error) {
            console.error('Error fetching Dracin stream:', error);
            return null;
        }
    }
};
