import React, { useEffect, useState } from 'react';
import { ContactSearch } from '../components/chat/ContactSearch';
import { FriendRequests } from '../components/chat/FriendRequests';
import { useContacts } from '../hooks/useContacts';
import { useStore } from '../lib/store';
import type { User, Contact as ContactModel } from '../types';
import './Contacts.css';

interface ContactsPageProps {
    userId: string;
}

export const Contacts: React.FC<ContactsPageProps> = ({ userId }) => {
    const [refreshKey, setRefreshKey] = useState(0);
    const { contacts, getContacts, ensureConversation } = useContacts();
    const setView = useStore((state) => state.setCurrentView);
    const setCurrentChatTargetUserId = useStore((state) => state.setCurrentChatTargetUserId);

    type ContactWithUser = ContactModel & {
        contact_user?: Pick<User, 'id' | 'username' | 'profile_pic'> | null;
    };

    useEffect(() => {
        getContacts(userId);
    }, [userId, refreshKey]);

    const handleRequestSent = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const handleRequestHandled = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const enrichedContacts = (contacts as unknown as ContactWithUser[]) || [];

    const handleOpenChat = async (contactUserId?: string | null) => {
        if (!contactUserId) return;

        try {
            // Garantizar que exista conversación, incluso para contactos antiguos
            await ensureConversation(userId, contactUserId);
        } catch (err) {
            console.error('[Contacts] Failed to ensure conversation:', err);
        }

        setCurrentChatTargetUserId(contactUserId);
        setView('chats');
    };

    return (
        <div className="contacts-page">
            <div className="contacts-shell">
                <header className="contacts-header">
                    <div className="contacts-title-group">
                        <h1>Contactos</h1>
                        <span className="contacts-subtitle">Personas con las que chateas</span>
                    </div>
                    <div className="contacts-header-icons">
                        <span className="icon-circle" />
                        <span className="icon-circle" />
                    </div>
                </header>

                <div className="contacts-content">
                    <div className="contacts-search-wrapper">
                        <ContactSearch userId={userId} onRequestSent={handleRequestSent} />
                    </div>

                    <section className="contacts-list-section">
                        <h2 className="section-title">Tus contactos</h2>
                        {enrichedContacts.length === 0 ? (
                            <p className="empty-text">Todavía no tienes contactos. Envía una solicitud.</p>
                        ) : (
                            <div className="contacts-list">
                                {enrichedContacts.map((c) => (
                                    <div
                                        key={c.id}
                                        className="contact-item"
                                        onClick={() => handleOpenChat(c.contact_user?.id)}
                                    >
                                        <div className="contact-avatar">
                                            {c.contact_user?.profile_pic ? (
                                                <img
                                                    src={c.contact_user.profile_pic}
                                                    alt={c.contact_user.username}
                                                />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {(c.contact_user?.username || '?').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="contact-info">
                                            <div className="contact-name">{c.contact_user?.username}</div>
                                            <div className="contact-status">Contacto agregado</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="contacts-requests-section" key={refreshKey}>
                        <FriendRequests userId={userId} onRequestHandled={handleRequestHandled} />
                    </section>
                </div>
            </div>
        </div>
    );
};
