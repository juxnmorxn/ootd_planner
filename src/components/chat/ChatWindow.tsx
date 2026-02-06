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
    const { currentMessages, getMessages, sendMessage, markConversationAsRead, sendTypingIndicator, typingUsers, userStatuses } = useChat(userId);
    const [messageContent, setMessageContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartXRef = useRef<number>(0);
    const touchStartTimeRef = useRef<number>(0);

    useEffect(() => {
        getMessages(conversationId);
        markConversationAsRead(conversationId);
    }, [conversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentMessages, typingUsers]);

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
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setLoading(false);
        }
    };

    const otherUserStatus = userStatuses.get(recipientId);
    const isOtherUserTyping = typingUsers.has(recipientId);

    return (
        <div 
            className="chat-window"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="chat-header">
                {onBack && (
                    <button
                        type="button"
                        className="chat-header-back"
                        onClick={onBack}
                        title="Atrás (también puedes deslizar)"
                    >
                        <ArrowLeft size={20} />
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

            <div className="messages-container">
                {currentMessages.length === 0 ? (
                    <p className="no-messages">No hay mensajes aún. ¡Inicia la conversación!</p>
                ) : (
                    currentMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`message ${msg.sender_id === userId ? 'sent' : 'received'}`}
                        >
                            <div className="message-content">{msg.content}</div>
                            <div className="message-time">
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                                {msg.sender_id === userId && (msg.read ? ' ✓✓' : ' ✓')}
                            </div>
                        </div>
                    ))
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
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={messageContent}
                    onChange={handleMessageChange}
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !messageContent.trim()}>
                    {loading ? '↻' : '➤'}
                </button>
            </form>
        </div>
    );
};
