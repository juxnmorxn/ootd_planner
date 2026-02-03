import React, { useState } from 'react';
import { useContacts } from '../../hooks/useContacts';
import './ContactSearch.css';

interface ContactSearchProps {
    userId: string;
    onRequestSent?: () => void;
}

export const ContactSearch: React.FC<ContactSearchProps> = ({ userId, onRequestSent }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<any | null>(null);
    const [requestStatus, setRequestStatus] = useState<'none' | 'sent' | 'existing'>('none');
    const [loading, setLoading] = useState(false);
    const { searchUser, sendRequest, error: contactError } = useContacts();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        const user = await searchUser(searchQuery.trim());
        setLoading(false);

        if (user) {
            setSearchResult(user);
            setRequestStatus('none');
        } else {
            setSearchResult(null);
            setRequestStatus('none');
        }
    };

    const handleSendRequest = async () => {
        if (!searchResult) return;

        setLoading(true);
        try {
            await sendRequest(userId, searchResult.id);
            setRequestStatus('sent');
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

            {searchResult && (
                <div className="search-result">
                    <div className="result-header">
                        {searchResult.profile_pic && (
                            <img src={searchResult.profile_pic} alt={searchResult.username} className="profile-pic" />
                        )}
                        <div className="result-info">
                            <h3>{searchResult.username}</h3>
                            <p>{searchResult.email}</p>
                        </div>
                    </div>

                    {requestStatus === 'sent' && (
                        <p className="status-sent">✓ Solicitud enviada</p>
                    )}

                    {requestStatus === 'none' && (
                        <button onClick={handleSendRequest} disabled={loading} className="btn-send-request">
                            ➕ Enviar solicitud
                        </button>
                    )}
                </div>
            )}

            {!searchResult && searchQuery && !loading && (
                <p className="not-found">No se encontró usuario</p>
            )}
        </div>
    );
};
