// Servicio para conectar con mindicador.cl
export const fetchEconomicIndicators = async () => {
    try {
        const response = await fetch('https://mindicador.cl/api');
        if (!response.ok) throw new Error('No se pudo conectar con el servicio de indicadores.');
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error API Indicadores:", error);
        throw error;
    }
};