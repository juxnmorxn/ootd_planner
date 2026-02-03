import { useEffect } from 'react';

/**
 * Hook para escuchar cambios en datos sincronizados en background
 * 
 * Uso:
 * useDataSync((data) => {
 *   if (data.type === 'garments') {
 *     console.log('Nuevas prendas disponibles:', data.data);
 *   }
 * });
 */
export function useDataSync(
  callback: (data: { type: string; data: any }) => void
) {
  useEffect(() => {
    const handleDataUpdated = (event: any) => {
      console.log('[useDataSync] Nuevos datos disponibles:', event.detail);
      callback(event.detail);
    };

    window.addEventListener('data-updated', handleDataUpdated);

    return () => {
      window.removeEventListener('data-updated', handleDataUpdated);
    };
  }, [callback]);
}
