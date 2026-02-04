import React, { useState } from 'react';
import { useContacts } from '../../hooks/useContacts';
import type { User } from '../../types';
import './ContactSearch.css';

interface ContactSearchProps {
    userId: string;
    onRequestSent?: () => void;
}

export const ContactSearch: React.FC<ContactSearchProps> = ({ userId, onRequestSent }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [sentToId, setSentToId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { searchUser, sendRequest, error: contactError } = useContacts();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const query = searchQuery.trim();
        if (!query) return;

        setLoading(true);
        const users = await searchUser(query, userId);
        setLoading(false);

        setSearchResults(users);
        setSentToId(null);
    };

    const handleSendRequest = async (contact: User) => {
        if (!contact) return;

        setLoading(true);
        try {
            await sendRequest(userId, contact.id);
            setSentToId(contact.id);
            onRequestSent?.();
        } catch (err) {
            console.error('Error sending request:', err);
        }
        setLoading(false);
    };

    return (
        <div className="contact-search">
            <h2>🔍 Buscar Contacto</h2>

            <form onSubmit={handleSearch} className="search-form">
                <input
                    type="text"
                    placeholder="Ingresa el username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={loading}
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Buscando...' : 'Buscar'}
                </button>
            </form>

            {contactError && <p className="error">{contactError}</p>}

            {searchResults.length > 0 && (
                <div className="search-result">
                    {searchResults.map((result) => (
                        <div key={result.id} className="result-item">
                            <div className="result-header">
                                {result.profile_pic && (
                                    <img src={result.profile_pic} alt={result.username} className="profile-pic" />
                                )}
                                <div className="result-info">
                                    <h3>{result.username}</h3>
                                    <p>{result.email}</p>
                                </div>
                            </div>

                            {sentToId === result.id ? (
                                <p className="status-sent">✓ Solicitud enviada</p>
                            ) : (
                                <button
                                    onClick={() => handleSendRequest(result)}
                                    disabled={loading}
                                    className="btn-send-request"
                                >
                                    ➕ Enviar solicitud
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {searchResults.length === 0 && searchQuery && !loading && (
                <p className="not-found">No se encontraron usuarios</p>
            )}
        </div>
    );
};
