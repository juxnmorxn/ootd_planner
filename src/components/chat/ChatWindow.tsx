import React, { useEffect, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import './ChatWindow.css';

interface ChatWindowProps {
    conversationId: string;
    userId: string;
    otherUsername: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, userId, otherUsername }) => {
    const { currentMessages, getMessages, sendMessage, markConversationAsRead } = useChat();
    const [messageContent, setMessageContent] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        getMessages(conversationId);
        markConversationAsRead(conversationId);

        // Poll para nuevos mensajes cada 2 segundos
        const interval = setInterval(() => {
            getMessages(conversationId);
        }, 2000);

        return () => clearInterval(interval);
    }, [conversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentMessages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageContent.trim()) return;

        setLoading(true);
        try {
            await sendMessage(conversationId, userId, messageContent.trim());
            setMessageContent('');
            setTimeout(() => {
                getMessages(conversationId);
            }, 100);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-window">
            <div className="chat-header">
                <h2>{otherUsername}</h2>
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
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !messageContent.trim()}>
                    {loading ? '↻' : '➤'}
                </button>
            </form>
        </div>
    );
};
