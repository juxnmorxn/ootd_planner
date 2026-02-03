import { useState } from 'react';
import type { ConversationWithData, MessageWithSender } from '../types';

const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    return '/api';
})();

export const useChat = () => {
    const [conversations, setConversations] = useState<ConversationWithData[]>([]);
    const [currentMessages, setCurrentMessages] = useState<MessageWithSender[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Obtener conversaciones de un usuario
    const getConversations = async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/conversations/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch conversations');
            const data = await response.json();
            setConversations(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Obtener mensajes de una conversación
    const getMessages = async (conversationId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`);
            if (!response.ok) throw new Error('Failed to fetch messages');
            const data = await response.json();
            setCurrentMessages(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Enviar mensaje
    const sendMessage = async (conversationId: string, senderId: string, content: string) => {
        setError(null);
        try {
            const response = await fetch(`${API_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content,
                    message_type: 'text',
                }),
            });

            if (!response.ok) throw new Error('Failed to send message');
            const newMessage = await response.json();

            // Agregar mensaje a la lista
            setCurrentMessages((prev) => [...prev, newMessage]);
            return newMessage;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    // Marcar mensaje como leído
    const markAsRead = async (messageId: string) => {
        try {
            await fetch(`${API_URL}/messages/${messageId}/read`, {
                method: 'PUT',
            });
        } catch (err: any) {
            console.error('Failed to mark message as read:', err);
        }
    };

    // Marcar conversación como leída
    const markConversationAsRead = async (conversationId: string) => {
        try {
            await fetch(`${API_URL}/conversations/${conversationId}/read`, {
                method: 'PUT',
            });
        } catch (err: any) {
            console.error('Failed to mark conversation as read:', err);
        }
    };

    return {
        conversations,
        currentMessages,
        loading,
        error,
        getConversations,
        getMessages,
        sendMessage,
        markAsRead,
        markConversationAsRead,
    };
};
