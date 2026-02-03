import { useState } from 'react';
import type { Contact, User } from '../types';

const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    return '/api';
})();

export const useContacts = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Buscar usuario por username
    const searchUser = async (username: string): Promise<User | null> => {
        setError(null);
        try {
            const response = await fetch(`${API_URL}/contacts/search/${username}`);
            if (response.status === 404) return null;
            if (!response.ok) throw new Error('Failed to search user');
            return await response.json();
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    };

    // Enviar solicitud de amistad
    const sendRequest = async (userId: string, contactId: string) => {
        setError(null);
        try {
            const response = await fetch(`${API_URL}/contacts/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, contact_id: contactId }),
            });

            if (!response.ok) throw new Error('Failed to send request');
            return await response.json();
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    // Obtener contactos aceptados
    const getContacts = async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/contacts/accepted/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch contacts');
            const data = await response.json();
            setContacts(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Obtener solicitudes pendientes
    const getPendingRequests = async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/contacts/pending/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch pending requests');
            const data = await response.json();
            setPendingRequests(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Aceptar solicitud
    const acceptRequest = async (userId: string, contactId: string) => {
        setError(null);
        try {
            const response = await fetch(`${API_URL}/contacts/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, contact_id: contactId }),
            });

            if (!response.ok) throw new Error('Failed to accept request');
            await getPendingRequests(userId);
            return await response.json();
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    // Rechazar solicitud
    const rejectRequest = async (userId: string, contactId: string) => {
        setError(null);
        try {
            const response = await fetch(`${API_URL}/contacts/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, contact_id: contactId }),
            });

            if (!response.ok) throw new Error('Failed to reject request');
            await getPendingRequests(userId);
            return await response.json();
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    // Bloquear contacto
    const blockContact = async (userId: string, contactId: string) => {
        setError(null);
        try {
            const response = await fetch(`${API_URL}/contacts/block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, contact_id: contactId }),
            });

            if (!response.ok) throw new Error('Failed to block contact');
            await getContacts(userId);
            return await response.json();
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    // Eliminar contacto
    const removeContact = async (userId: string, contactId: string) => {
        setError(null);
        try {
            const response = await fetch(`${API_URL}/contacts/${userId}/${contactId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to remove contact');
            await getContacts(userId);
            return await response.json();
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    return {
        contacts,
        pendingRequests,
        loading,
        error,
        searchUser,
        sendRequest,
        getContacts,
        getPendingRequests,
        acceptRequest,
        rejectRequest,
        blockContact,
        removeContact,
    };
};
