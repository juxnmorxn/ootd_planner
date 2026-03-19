import React, { useEffect, useState, useMemo } from 'react';
import { Search, MessageCircle, ChevronDown } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useStore } from '../lib/store';
import { ChatWindow } from '../components/chat/ChatWindow';
import type { ConversationWithData } from '../types';
import './ChatInbox.css';

interface ChatInboxProps {
    userId: string;
}

type TabType = 'messages' | 'groups';

export const ChatInbox: React.FC<ChatInboxProps> = ({ userId }) => {
    const { conversations, getConversations, onContactAccepted, onContactRequest, markConversationAsRead } = useChat(userId);
    const { currentUser, setIsViewingIndividualChat, currentChatTargetUserId, setCurrentChatTargetUserId, pendingRequestsCount, setPendingRequestsCount } = useStore();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [showChatView, setShowChatView] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('messages');
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Control bottom nav visibility when opening/closing individual chat
    useEffect(() => {
        setIsViewingIndividualChat(showChatView && isMobile);
    }, [showChatView, isMobile, setIsViewingIndividualChat]);

    // Asegurar que al desmontar la bandeja de entrada se restaure la BottomNav
    useEffect(() => {
        return () => {
            setIsViewingIndividualChat(false);
        };
    }, [setIsViewingIndividualChat]);

    // Cargar chats
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await getConversations(userId);
            setLoading(false);
        };
        load();
    }, [userId, getConversations]);

    // Si viene una orden externa (notificación) para abrir chat con un usuario concreto
    useEffect(() => {
        if (!currentChatTargetUserId) return;

        const targetConv = conversations.find(
            (c) => c.other_user?.id === currentChatTargetUserId,
        );

        if (targetConv) {
            setSelectedConversationId(targetConv.id);
            setActiveTab('messages');
            if (isMobile) {
                setShowChatView(true);
            }
        }

        // Consumir la orden para no reabrir en bucle
        setCurrentChatTargetUserId(null);
    }, [currentChatTargetUserId, conversations, isMobile, setCurrentChatTargetUserId]);

    // Escuchar cambios de contactos en tiempo real (solicitudes nuevas y aceptaciones)
    useEffect(() => {
        const unsubscribeRequest = onContactRequest?.(() => {
            // Nueva solicitud de amistad para este usuario: incrementar badge global
            setPendingRequestsCount((pendingRequestsCount || 0) + 1);
        });

        const unsubscribeAccepted = onContactAccepted?.(() => {
            // Alguna solicitud fue aceptada: recargar conversaciones
            getConversations(userId);
        });

        return () => {
            if (unsubscribeRequest) unsubscribeRequest();
            if (unsubscribeAccepted) unsubscribeAccepted();
        };
    }, [onContactRequest, onContactAccepted, getConversations, userId, pendingRequestsCount, setPendingRequestsCount]);

    // Buscar solo dentro de los chats existentes (amigos con conversación)

    // Detectar mobile
    useEffect(() => {
        const updateIsMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        updateIsMobile();
        window.addEventListener('resize', updateIsMobile);
        return () => window.removeEventListener('resize', updateIsMobile);
    }, []);

    // Búsqueda solo en chats existentes
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return { chats: conversations };

        const query = searchQuery.toLowerCase();
        
        // Filtrar chats existentes
        const chats = conversations.filter(conv =>
            conv.other_user?.username?.toLowerCase().includes(query)
        );

        return { chats };
    }, [searchQuery, conversations]);

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    // Manejar abrir chat
    const handleOpenChat = async (conversation: ConversationWithData) => {
        setSelectedConversationId(conversation.id);
        // Marcar la conversación como leída al abrirla (estilo WhatsApp)
        try {
            await markConversationAsRead(conversation.id);
        } catch (err) {
            console.error('Error marking conversation as read:', err);
        }
        if (isMobile) {
            setShowChatView(true);
        }
    };

    // La gestión de solicitudes y agregar amigos ahora vive en la vista "Amigos"

    // Vista mobile: mostrar solo chat a pantalla completa (tipo WhatsApp)
    if (isMobile && showChatView && selectedConversation) {
        return (
            <div className="chat-inbox chat-inbox-fullscreen">
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
                {/* Header con dropdown usuario */}
                <div className="inbox-top-header">
                    <div className="user-menu-wrapper">
                        <button 
                            className="user-dropdown-btn"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                        >
                            <span>{currentUser?.username || 'Usuario'}</span>
                            <ChevronDown size={18} />
                        </button>
                        {showUserMenu && (
                            <div className="user-dropdown-menu">
                                <div className="dropdown-item">{currentUser?.email}</div>
                                <button className="dropdown-item logout-btn">Cerrar sesión</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Búsqueda */}
                <div className="inbox-search">
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs-wrapper">
                    <button 
                        className={`tab ${activeTab === 'messages' ? 'active' : ''}`}
                        onClick={() => setActiveTab('messages')}
                    >
                        Mensajes
                    </button>
                    <button 
                        className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
                        onClick={() => setActiveTab('groups')}
                    >
                        Grupos
                    </button>
                </div>

                {/* Contenido según tab */}
                <div className="inbox-content">
                    {activeTab === 'messages' ? (
                        // TAB: MENSAJES
                        <>
                            {loading ? (
                                <p className="loading">Cargando...</p>
                            ) : searchQuery.trim() ? (
                                // Resultados de búsqueda
                                <>
                                    {searchResults.chats.length > 0 ? (
                                        <div className="search-section">
                                            <h3 className="section-title">Chats</h3>
                                            {searchResults.chats.map((conv) => {
                                                const hasUnread = (conv.unread_count ?? 0) > 0;
                                                return (
                                                    <div
                                                        key={conv.id}
                                                        className={`chat-item ${hasUnread ? 'unread' : ''}`}
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
                                                            <div className="online-indicator"></div>
                                                        </div>
                                                        <div className="chat-content">
                                                            <div className="chat-header">
                                                                <p className="chat-name">{conv.other_user?.username}</p>
                                                                <p className="chat-time">
                                                                    {conv.last_message?.created_at
                                                                        ? formatMessageTime(new Date(conv.last_message.created_at))
                                                                        : ''}
                                                                </p>
                                                            </div>
                                                            <p className="chat-message">
                                                                {conv.last_message?.content || 'Sin mensajes aún'}
                                                            </p>
                                                        </div>
                                                        {hasUnread && (
                                                            <span className="unread-dot"></span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <p>No se encontraron chats</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Vista normal: lista de chats
                                <>
                                    {conversations.length === 0 ? (
                                        <div className="empty-state">
                                            <MessageCircle size={48} />
                                            <p>No tienes chats aún</p>
                                        </div>
                                    ) : (
                                        <div className="chats-list">
                                            {conversations.map((conv) => {
                                                const hasUnread = (conv.unread_count ?? 0) > 0;
                                                return (
                                                    <div
                                                        key={conv.id}
                                                        className={`chat-item ${selectedConversationId === conv.id ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
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
                                                        <div className="online-indicator"></div>
                                                    </div>
                                                    <div className="chat-content">
                                                        <div className="chat-header">
                                                            <p className="chat-name">{conv.other_user?.username}</p>
                                                            <p className="chat-time">
                                                                {conv.last_message?.created_at
                                                                    ? formatMessageTime(new Date(conv.last_message.created_at))
                                                                    : ''}
                                                            </p>
                                                        </div>
                                                        <p className="chat-message">
                                                            {conv.last_message?.content || 'Sin mensajes aún'}
                                                        </p>
                                                    </div>
                                                    {hasUnread && (
                                                        <span className="unread-dot"></span>
                                                    )}
                                                </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        // TAB: GRUPOS (UI básica sin funcionalidad)
                        <div className="groups-tab">
                            <div className="groups-header">
                                <button type="button" className="create-group-btn">
                                    + Crear grupo
                                </button>
                            </div>
                            <div className="empty-state">
                                <p>Aún no tienes grupos.</p>
                                <p className="empty-hint">Pronto podrás crear y ver tus grupos aquí.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Vista desktop: chat al lado */}
            {!isMobile && activeTab === 'messages' && (
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

// Función helper para formatear tiempo
function formatMessageTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString();
}
