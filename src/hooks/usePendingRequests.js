import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export const usePendingRequests = (user) => {
    const [pendingCount, setPendingCount] = useState(0);

    const fetchCount = async () => {
        if (!user) return;
        try {
            // 1. Obtener Org ID
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
            if (!profile?.organization_id) return;

            // 2. Contar solicitudes con status 'pending'
            const { count, error } = await supabase
                .from('rrhh_employee_absences')
                .select('*', { count: 'exact', head: true }) // head: true significa "solo dame el número, no los datos" (más rápido)
                .eq('organization_id', profile.organization_id)
                .eq('status', 'pending');

            if (!error) setPendingCount(count || 0);

        } catch (error) {
            console.error("Error contando pendientes:", error);
        }
    };

    useEffect(() => {
        fetchCount();
        
        // (Opcional) Suscripción en tiempo real: Si alguien crea una solicitud, actualizamos el número al instante
        const subscription = supabase
            .channel('public:rrhh_employee_absences')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rrhh_employee_absences' }, () => {
                fetchCount(); // Recalcular si entra una nueva
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rrhh_employee_absences' }, () => {
                fetchCount(); // Recalcular si se aprueba/rechaza una
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [user]);

    return pendingCount;
};