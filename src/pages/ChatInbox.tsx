import React, { useEffect, useState, useMemo } from 'react';
import { Search, MessageCircle, UserPlus } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useContacts } from '../hooks/useContacts';
import { useStore } from '../lib/store';
import { ChatWindow } from '../components/chat/ChatWindow';
import type { User, Contact as ContactModel, ConversationWithData } from '../types';
import './ChatInbox.css';

interface ChatInboxProps {
    userId: string;
}

export const ChatInbox: React.FC<ChatInboxProps> = ({ userId }) => {
    const { conversations, getConversations } = useChat(userId);
    const { contacts, getContacts, ensureConversation } = useContacts();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [showChatView, setShowChatView] = useState(false);

    // Cargar chats y contactos
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await getConversations(userId);
            await getContacts(userId);
            setLoading(false);
        };
        load();
    }, [userId]);

    // Detectar mobile
    useEffect(() => {
        const updateIsMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        updateIsMobile();
        window.addEventListener('resize', updateIsMobile);
        return () => window.removeEventListener('resize', updateIsMobile);
    }, []);

    // Búsqueda unificada: chats + usuarios
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return { chats: conversations, users: [] };

        const query = searchQuery.toLowerCase();
        
        // Filtrar chats existentes
        const chats = conversations.filter(conv =>
            conv.other_user?.username?.toLowerCase().includes(query) ||
            conv.other_user?.email?.toLowerCase().includes(query)
        );

        // Buscar usuarios para agregar
        const users = contacts
            .filter(c => c.contact_user?.username?.toLowerCase().includes(query))
            .map(c => c.contact_user)
            .filter(u => u !== null) as User[];

        return { chats, users };
    }, [searchQuery, conversations, contacts]);

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    // Manejar abrir chat
    const handleOpenChat = async (conversation: ConversationWithData) => {
        setSelectedConversationId(conversation.id);
        if (isMobile) {
            setShowChatView(true);
        }
    };

    // Manejar agregar amigo desde búsqueda
    const handleAddFriend = async (userId: string) => {
        // Aquí se integraría con el API para enviar solicitud
        console.log('Agregar amigo:', userId);
    };

    // Manejar abrir chat desde usuario en búsqueda
    const handleOpenChatWithUser = async (user: User) => {
        try {
            await ensureConversation(userId, user.id);
            const conv = conversations.find(c => c.other_user?.id === user.id);
            if (conv) {
                await handleOpenChat(conv);
            }
        } catch (err) {
            console.error('Error opening chat:', err);
        }
    };

    // Vista mobile: mostrar solo chat
    if (isMobile && showChatView && selectedConversation) {
        return (
            <div className="chat-inbox">
                <ChatWindow
                    conversationId={selectedConversation.id}
                    userId={userId}
                    recipientId={selectedConversation.other_user?.id || ''}
                    otherUsername={selectedConversation.other_user?.username || 'Usuario'}
                    onBack={() => {
                        setShowChatView(false);
                        setSelectedConversationId(null);
                    }}
                />
            </div>
        );
    }

    // Vista inbox
    return (
        <div className="chat-inbox">
            <div className="inbox-container">
                {/* Header */}
                <div className="inbox-header">
                    <h1>💬 Mensajes</h1>
                </div>

                {/* Búsqueda unificada */}
                <div className="inbox-search">
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Busca chats o personas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                {/* Contenido */}
                <div className="inbox-content">
                    {loading ? (
                        <p className="loading">Cargando...</p>
                    ) : searchQuery.trim() ? (
                        // Resultados de búsqueda
                        <>
                            {/* Chats coincidentes */}
                            {searchResults.chats.length > 0 && (
                                <div className="search-section">
                                    <h3 className="section-title">Chats</h3>
                                    <div className="search-results">
                                        {searchResults.chats.map((conv) => (
                                            <div
                                                key={conv.id}
                                                className="search-result-item chat-result"
                                                onClick={() => handleOpenChat(conv)}
                                            >
                                                <div className="result-avatar">
                                                    {conv.other_user?.profile_pic ? (
                                                        <img src={conv.other_user.profile_pic} alt="" />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {(conv.other_user?.username || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="result-info">
                                                    <p className="result-name">{conv.other_user?.username}</p>
                                                    <p className="result-preview">{conv.last_message?.content || 'Sin mensajes'}</p>
                                                </div>
                                                <MessageCircle size={16} className="result-icon" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Usuarios para agregar */}
                            {searchResults.users.length > 0 && (
                                <div className="search-section">
                                    <h3 className="section-title">Personas</h3>
                                    <div className="search-results">
                                        {searchResults.users.map((user) => (
                                            <div
                                                key={user.id}
                                                className="search-result-item user-result"
                                            >
                                                <div className="result-avatar">
                                                    {user.profile_pic ? (
                                                        <img src={user.profile_pic} alt="" />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {(user.username || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="result-info">
                                                    <p className="result-name">{user.username}</p>
                                                </div>
                                                <button
                                                    className="add-friend-btn"
                                                    onClick={() => handleOpenChatWithUser(user)}
                                                    title="Iniciar chat"
                                                >
                                                    <MessageCircle size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {searchResults.chats.length === 0 && searchResults.users.length === 0 && (
                                <p className="no-results">No se encontraron resultados</p>
                            )}
                        </>
                    ) : (
                        // Vista normal: lista de chats
                        <>
                            {conversations.length === 0 ? (
                                <div className="empty-state">
                                    <MessageCircle size={48} />
                                    <p>No tienes chats aún</p>
                                    <p className="empty-hint">Busca personas para iniciar una conversación</p>
                                </div>
                            ) : (
                                <div className="chats-list">
                                    {conversations.map((conv) => (
                                        <div
                                            key={conv.id}
                                            className={`chat-item ${selectedConversationId === conv.id ? 'active' : ''}`}
                                            onClick={() => handleOpenChat(conv)}
                                        >
                                            <div className="chat-avatar">
                                                {conv.other_user?.profile_pic ? (
                                                    <img src={conv.other_user.profile_pic} alt="" />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {(conv.other_user?.username || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="chat-content">
                                                <div className="chat-header">
                                                    <p className="chat-name">{conv.other_user?.username}</p>
                                                    <p className="chat-time">
                                                        {conv.last_message?.created_at
                                                            ? new Date(conv.last_message.created_at).toLocaleTimeString([], {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })
                                                            : ''}
                                                    </p>
                                                </div>
                                                <p className="chat-message">
                                                    {conv.last_message?.content || 'Sin mensajes aún'}
                                                </p>
                                            </div>
                                            {conv.unread_count! > 0 && (
                                                <span className="unread-badge">{conv.unread_count}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Vista desktop: chat al lado */}
            {!isMobile && (
                <div className="chat-detail-pane">
                    {selectedConversation ? (
                        <ChatWindow
                            conversationId={selectedConversation.id}
                            userId={userId}
                            recipientId={selectedConversation.other_user?.id || ''}
                            otherUsername={selectedConversation.other_user?.username || 'Usuario'}
                        />
                    ) : (
                        <div className="no-chat-selected">
                            <MessageCircle size={64} />
                            <p>Selecciona un chat para comenzar</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
