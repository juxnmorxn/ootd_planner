import React, { useEffect, useState, useMemo } from 'react';
import { Search, MessageCircle, ChevronDown, Users } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useContacts } from '../hooks/useContacts';
import { useStore } from '../lib/store';
import { ChatWindow } from '../components/chat/ChatWindow';
import type { User, ConversationWithData } from '../types';
import './ChatInbox.css';

const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    return '/api';
})();

interface ChatInboxProps {
    userId: string;
}

type TabType = 'messages' | 'requests';

export const ChatInbox: React.FC<ChatInboxProps> = ({ userId }) => {
    const { conversations, getConversations } = useChat(userId);
    const { sendRequest } = useContacts();
    const { currentUser } = useStore();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [showChatView, setShowChatView] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('messages');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [searchUsers, setSearchUsers] = useState<User[]>([]);
    const [friendRequests, setFriendRequests] = useState<any[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(false);

    // Cargar solicitudes pendientes
    const loadPendingRequests = async () => {
        setRequestsLoading(true);
        try {
            const response = await fetch(`${API_URL}/contacts/pending/${userId}`);
            if (response.ok) {
                const requests = await response.json();
                setFriendRequests(requests || []);
            }
        } catch (err) {
            console.error('Error loading pending requests:', err);
        } finally {
            setRequestsLoading(false);
        }
    };

    // Cargar chats y solicitudes pendientes
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await getConversations(userId);
            await loadPendingRequests();
            setLoading(false);
        };
        load();
    }, [userId, getConversations]);

    // Buscar usuarios cuando escribe en la barra
    useEffect(() => {
        const search = async () => {
            if (!searchQuery.trim()) {
                setSearchUsers([]);
                return;
            }

            try {
                const response = await fetch(`${API_URL}/contacts/search/${encodeURIComponent(searchQuery)}?excludeUserId=${userId}`);
                if (response.ok) {
                    const results = await response.json();
                    // Filtrar usuarios que ya son contactos
                    setSearchUsers(results || []);
                } else {
                    setSearchUsers([]);
                }
            } catch (err) {
                console.error('Search error:', err);
                setSearchUsers([]);
            }
        };

        const debounce = setTimeout(search, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery, userId]);

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
            conv.other_user?.username?.toLowerCase().includes(query)
        );

        return { chats, users: searchUsers };
    }, [searchQuery, conversations, searchUsers]);

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    // Manejar abrir chat
    const handleOpenChat = async (conversation: ConversationWithData) => {
        setSelectedConversationId(conversation.id);
        if (isMobile) {
            setShowChatView(true);
        }
    };

    // Manejar agregar amigo desde búsqueda
    const handleAddFriend = async (contactId: string) => {
        try {
            await sendRequest(userId, contactId);
            // Remover usuario de la lista de búsqueda
            setSearchUsers(prev => prev.filter(u => u.id !== contactId));
        } catch (err: any) {
            console.error('Error sending friend request:', err);
            // Mostrar error específico
            const errorMsg = err?.message || 'Error al enviar solicitud';
            console.error('Error details:', errorMsg);
        }
    };

    // Manejar abrir chat desde usuario en búsqueda
    const handleOpenChatWithUser = async (user: User) => {
        try {
            // Crear conversación con el usuario
            const response = await fetch(`${API_URL}/contacts/open-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, contact_id: user.id }),
            });
            
            if (response.ok) {
                // Recarga conversaciones y busca la nueva
                await getConversations(userId);
                const convs = conversations.find(c => c.other_user?.id === user.id);
                if (convs) {
                    setSelectedConversationId(convs.id);
                    if (isMobile) {
                        setShowChatView(true);
                    }
                }
                
                // Limpiar búsqueda
                setSearchQuery('');
            }
        } catch (err) {
            console.error('Error opening chat:', err);
        }
    };

    // Función para aceptar/rechazar solicitud
    const handleFriendRequest = async (contactId: string, accept: boolean) => {
        try {
            if (accept) {
                // Aceptar solicitud
                const response = await fetch(`${API_URL}/contacts/accept`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, contact_id: contactId }),
                });

                if (response.ok) {
                    // Recargar solicitudes y conversaciones
                    await loadPendingRequests();
                    await getConversations(userId);
                } else {
                    console.error('Error accepting request');
                }
            } else {
                // Rechazar solicitud
                const response = await fetch(`${API_URL}/contacts/reject`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, contact_id: contactId }),
                });

                if (response.ok) {
                    // Recargar solicitudes
                    await loadPendingRequests();
                } else {
                    console.error('Error rejecting request');
                }
            }
        } catch (err) {
            console.error('Error handling friend request:', err);
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
                        className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >
                        Solicitudes
                        {friendRequests.length > 0 && <span className="badge">{friendRequests.length}</span>}
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
                                    {searchResults.chats.length > 0 && (
                                        <div className="search-section">
                                            <h3 className="section-title">Chats</h3>
                                            {searchResults.chats.map((conv) => (
                                                <div
                                                    key={conv.id}
                                                    className="chat-item"
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
                                                    {conv.unread_count! > 0 && (
                                                        <span className="unread-dot"></span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.users.length > 0 && (
                                        <div className="search-section">
                                            <h3 className="section-title">Usuarios</h3>
                                            {searchResults.users.map((user) => (
                                                <div
                                                    key={user.id}
                                                    className="chat-item user-item"
                                                    onClick={() => handleOpenChatWithUser(user)}
                                                >
                                                    <div className="chat-avatar">
                                                        {user.profile_pic ? (
                                                            <img src={user.profile_pic} alt="" />
                                                        ) : (
                                                            <div className="avatar-placeholder">
                                                                {(user.username || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="chat-content">
                                                        <p className="chat-name">{user.username}</p>
                                                        <p className="chat-message">Desconectado</p>
                                                    </div>
                                                    <button 
                                                        className="btn-follow"
                                                        onClick={() => handleAddFriend(user.id)}
                                                    >
                                                        Seguir
                                                    </button>
                                                </div>
                                            ))}
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
                                                    {conv.unread_count! > 0 && (
                                                        <span className="unread-dot"></span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        // TAB: SOLICITUDES
                        <>
                            {friendRequests.length === 0 ? (
                                <div className="empty-state">
                                    <Users size={48} />
                                    <p>No hay solicitudes</p>
                                </div>
                            ) : (
                                <div className="requests-list">
                                    {friendRequests.map((req) => (
                                        <div key={req.id} className="request-item">
                                            <div className="chat-avatar">
                                                {req.contact_user?.profile_pic ? (
                                                    <img src={req.contact_user.profile_pic} alt="" />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {(req.contact_user?.username || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="request-content">
                                                <p className="request-name">{req.contact_user?.username}</p>
                                            </div>
                                            <div className="request-actions">
                                                <button 
                                                    className="btn-accept"
                                                    onClick={() => handleFriendRequest(req.user_id, true)}
                                                    disabled={requestsLoading}
                                                >
                                                    ✓
                                                </button>
                                                <button 
                                                    className="btn-reject"
                                                    onClick={() => handleFriendRequest(req.user_id, false)}
                                                    disabled={requestsLoading}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
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
