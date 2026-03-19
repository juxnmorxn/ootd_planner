import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import './ChatWindow.css';

interface ChatWindowProps {
    conversationId: string;
    userId: string;
    recipientId: string;
    otherUsername: string;
    onBack?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, userId, recipientId, otherUsername, onBack }) => {
    const { currentMessages, getMessages, sendMessage, markAsRead, markConversationAsRead, sendTypingIndicator, typingUsers, userStatuses } = useChat(userId);
    const [messageContent, setMessageContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const markedMessagesRef = useRef<Set<string>>(new Set());
    const touchStartXRef = useRef<number>(0);
    const touchStartTimeRef = useRef<number>(0);

    // Detectar si es móvil para mostrar botón back
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-scroll al fondo cuando se cargan mensajes (solo dentro del contenedor)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTo({
                    top: messagesContainerRef.current.scrollHeight,
                    behavior: 'smooth',
                });
            }
        }, 80);
        return () => clearTimeout(timer);
    }, [currentMessages, typingUsers]);

    // Al enfocar el input, simplemente llevamos el contenedor al fondo
    const handleInputFocus = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    };

    useEffect(() => {
        console.log('[ChatWindow] Conversation opened, fetching messages:', conversationId);
        getMessages(conversationId);
        markConversationAsRead(conversationId);
        
        // Sincronizar cada 10 segundos para garantizar que no se pierda ningún mensaje
        const syncInterval = setInterval(() => {
            console.log('[ChatWindow] Auto-syncing messages...');
            getMessages(conversationId);
        }, 10000);
        
        return () => clearInterval(syncInterval);
    }, [conversationId, getMessages, markConversationAsRead]);

    // Marcar como leídos los mensajes entrantes en cuanto estén cargados
    useEffect(() => {
        if (!currentMessages.length) return;

        currentMessages.forEach((msg) => {
            // Solo marcar como leído mensajes que vienen del otro usuario
            if (msg.sender_id === userId) return;
            if (msg.read) return;
            if (markedMessagesRef.current.has(msg.id)) return;

            markedMessagesRef.current.add(msg.id);
            markAsRead(msg.id, conversationId, userId);
        });
    }, [currentMessages, conversationId, userId, markAsRead]);

    // Detectar swipe hacia la izquierda (gesto nativo)
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartXRef.current = e.touches[0].clientX;
        touchStartTimeRef.current = Date.now();
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchDuration = Date.now() - touchStartTimeRef.current;
        const swipeDistance = touchStartXRef.current - touchEndX;

        // Si desliza más de 50px hacia la izquierda en menos de 500ms = swipe atrás
        if (swipeDistance > 50 && touchDuration < 500 && onBack) {
            onBack();
        }
    };

    const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMessageContent(value);

        // Indicador de escribiendo
        const nowTyping = value.length > 0;
        if (nowTyping !== isTyping) {
            setIsTyping(nowTyping);
            sendTypingIndicator(conversationId, userId, recipientId, nowTyping);
        }

        // Resetear timeout para "dejó de escribir"
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (nowTyping) {
            typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
                sendTypingIndicator(conversationId, userId, recipientId, false);
            }, 2000);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageContent.trim()) return;

        setLoading(true);
        setIsTyping(false);
        sendTypingIndicator(conversationId, userId, recipientId, false);

        try {
            await sendMessage(conversationId, userId, recipientId, messageContent.trim());
            setMessageContent('');

            // Mantener el foco en el input para que el teclado no se cierre
            if (inputRef.current) {
                inputRef.current.focus();
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setLoading(false);
        }
    };

    const otherUserStatus = userStatuses.get(recipientId);
    const isOtherUserTyping = typingUsers.has(recipientId);

    const getDeliveryStage = (msg: any): number | null => {
        if (msg.sender_id !== userId) return null;

        const status = msg.delivery_status as
            | 'pending'
            | 'sent'
            | 'delivered'
            | 'read'
            | undefined;

        // 0 = enviando (pendiente)
        // 1 = enviado / entregado
        // 2 = leído
        if (status === 'pending' || msg.id === 'pending') return 0;
        if (status === 'read' || msg.read) return 2;
        if (status === 'sent' || status === 'delivered') return 1;
        return 1;
    };

    return (
        <div 
            className="chat-window"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="chat-header">
                {/* Botón back siempre visible en móvil */}
                {(onBack && isMobile) && (
                    <button
                        type="button"
                        className="chat-header-back"
                        onClick={onBack}
                        title="Volver"
                        aria-label="Volver atrás"
                    >
                        <ArrowLeft size={24} strokeWidth={2.5} />
                    </button>
                )}
                <div className="chat-header-info">
                    <h2>{otherUsername}</h2>
                    <p className="chat-header-status">
                        {otherUserStatus === 'online' ? (
                            <span className="status-online">● En línea</span>
                        ) : (
                            <span className="status-offline">● Desconectado</span>
                        )}
                    </p>
                </div>
            </div>

            <div className="messages-container" ref={messagesContainerRef}>
                {currentMessages.length === 0 ? (
                    <p className="no-messages">No hay mensajes aún. ¡Inicia la conversación!</p>
                ) : (
                    currentMessages.map((msg) => {
                        const stage = getDeliveryStage(msg);
                        return (
                            <div
                                key={msg.id}
                                className={`message ${msg.sender_id === userId ? 'sent' : 'received'}`}
                            >
                                <div className="message-content">{msg.content}</div>
                                <div className="message-time">
                                    <span className="message-time-text">
                                        {new Date(msg.created_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                    {stage !== null && (
                                        <div className={`delivery-bar delivery-stage-${stage}`} aria-hidden="true">
                                            <span className="delivery-segment" />
                                            <span className="delivery-segment" />
                                            <span className="delivery-segment" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {isOtherUserTyping && (
                    <div className="message typing-indicator">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={messageContent}
                    onChange={handleMessageChange}
                    onFocus={handleInputFocus}
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !messageContent.trim()}>
                    {loading ? '↻' : '➤'}
                </button>
            </form>
        </div>
    );
};
