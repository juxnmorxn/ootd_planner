import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useGroupChat } from '../../hooks/useGroupChat';
import './ChatWindow.css';

interface GroupChatWindowProps {
    groupId: string;
    groupName: string;
    userId: string;
    onBack?: () => void;
}

export const GroupChatWindow: React.FC<GroupChatWindowProps> = ({ groupId, groupName, userId, onBack }) => {
    const { currentGroupMessages, getGroupMessages, sendGroupMessage, markGroupMessageAsRead } = useGroupChat(userId);
    const [messageContent, setMessageContent] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const markedMessagesRef = useRef<Set<string>>(new Set());

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                await getGroupMessages(groupId);
            } catch {
                // el error ya se registra en el hook
            }
        };
        load();
    }, [groupId, getGroupMessages]);

    // Scroll al fondo cuando cambian mensajes
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
    }, [currentGroupMessages]);

    // Marcar como leídos mensajes donde aún no estamos en read_by_json
    useEffect(() => {
        if (!currentGroupMessages.length) return;

        currentGroupMessages.forEach((msg) => {
            if (markedMessagesRef.current.has(msg.id)) return;

            let readBy: string[] = [];
            try {
                readBy = msg.read_by_json ? JSON.parse(msg.read_by_json) : [];
                if (!Array.isArray(readBy)) readBy = [];
            } catch {
                readBy = [];
            }

            if (!readBy.includes(userId)) {
                markedMessagesRef.current.add(msg.id);
                markGroupMessageAsRead(groupId, msg.id, userId);
            }
        });
    }, [currentGroupMessages, groupId, markGroupMessageAsRead, userId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageContent.trim()) return;

        setLoading(true);
        try {
            await sendGroupMessage(groupId, userId, messageContent.trim());
            setMessageContent('');
            if (inputRef.current) inputRef.current.focus();
        } catch (err) {
            console.error('[GroupChatWindow] Error sending message:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-window">
            <div className="chat-header">
                {onBack && isMobile && (
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
                    <h2>{groupName}</h2>
                    <p className="chat-header-status">Grupo</p>
                </div>
            </div>

            <div className="messages-container" ref={messagesContainerRef}>
                {currentGroupMessages.length === 0 ? (
                    <p className="no-messages">Aún no hay mensajes en este grupo.</p>
                ) : (
                    currentGroupMessages.map((msg) => (
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
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSend} className="chat-input-form">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Escribe un mensaje para el grupo..."
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
