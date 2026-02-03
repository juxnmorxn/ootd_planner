import React, { useEffect, useState } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatWindow } from '../components/chat/ChatWindow';
import './Chats.css';

interface ChatsPageProps {
    userId: string;
}

export const Chats: React.FC<ChatsPageProps> = ({ userId }) => {
    const { conversations, getConversations } = useChat();
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadConversations = async () => {
            setLoading(true);
            await getConversations(userId);
            setLoading(false);
        };

        loadConversations();

        // Poll cada 3 segundos para actualizar
        const interval = setInterval(loadConversations, 3000);
        return () => clearInterval(interval);
    }, [userId]);

    const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

    return (
        <div className="chats-page">
            <div className="conversations-list">
                <h1>💬 Chats</h1>

                {loading ? (
                    <p className="loading">Cargando chats...</p>
                ) : conversations.length === 0 ? (
                    <p className="no-chats">No tienes chats. Busca contactos para iniciar.</p>
                ) : (
                    <div className="conversations-container">
                        {conversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={`conversation-item ${selectedConversationId === conv.id ? 'active' : ''}`}
                                onClick={() => setSelectedConversationId(conv.id)}
                            >
                                <div className="conv-header">
                                    {conv.other_user?.profile_pic && (
                                        <img
                                            src={conv.other_user.profile_pic}
                                            alt={conv.other_user.username}
                                            className="profile-pic"
                                        />
                                    )}
                                    <div className="conv-info">
                                        <h3>{conv.other_user?.username}</h3>
                                        <p className="last-message">
                                            {conv.last_message?.content || 'Sin mensajes aún'}
                                        </p>
                                    </div>
                                </div>
                                {conv.unread_count! > 0 && (
                                    <span className="unread-badge">{conv.unread_count}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="chat-main">
                {selectedConversation ? (
                    <ChatWindow
                        conversationId={selectedConversation.id}
                        userId={userId}
                        otherUsername={selectedConversation.other_user?.username || 'Usuario'}
                    />
                ) : (
                    <div className="no-chat-selected">
                        <p>Selecciona un chat para comenzar</p>
                    </div>
                )}
            </div>
        </div>
    );
};
