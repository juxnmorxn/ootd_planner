import React, { useState } from 'react';
import { ContactSearch } from '../components/chat/ContactSearch';
import { FriendRequests } from '../components/chat/FriendRequests';
import './Contacts.css';

interface ContactsPageProps {
    userId: string;
    username: string;
}

export const Contacts: React.FC<ContactsPageProps> = ({ userId, username }) => {
    const [refreshKey, setRefreshKey] = useState(0);

    const handleRequestSent = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const handleRequestHandled = () => {
        setRefreshKey((prev) => prev + 1);
    };

    return (
        <div className="contacts-page">
            <h1>👥 Contactos</h1>

            <div className="contacts-grid">
                <section className="contacts-section">
                    <ContactSearch userId={userId} onRequestSent={handleRequestSent} />
                </section>

                <section className="contacts-section" key={refreshKey}>
                    <FriendRequests userId={userId} onRequestHandled={handleRequestHandled} />
                </section>
            </div>
        </div>
    );
};
