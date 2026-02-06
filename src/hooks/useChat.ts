import { useState, useEffect, useCallback } from 'react';
import type { ConversationWithData, MessageWithSender } from '../types';
import { useWebSocket } from './useWebSocket';

const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    return '/api';
})();

export const useChat = (userId?: string) => {
    const [conversations, setConversations] = useState<ConversationWithData[]>([]);
    const [currentMessages, setCurrentMessages] = useState<MessageWithSender[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [userStatuses, setUserStatuses] = useState<Map<string, 'online' | 'offline'>>(new Map());

    const webSocket = useWebSocket(userId || null);

    // Escuchar mensajes recibidos
    useEffect(() => {
        const unsubscribe = webSocket.onMessageReceived((message) => {
            console.log('[Chat] Message received via WS:', message);
            setCurrentMessages((prev) => [...prev, message]);
        });
        return unsubscribe;
    }, [webSocket]);

    // Escuchar confirmación de mensajes enviados
    useEffect(() => {
        const unsubscribe = webSocket.onMessageSent((data) => {
            console.log('[Chat] Message confirmed sent:', data);
            // Actualizar el estado local si es necesario
            setCurrentMessages((prev) => 
                prev.map((msg) => 
                    msg.id === 'pending' ? { ...msg, id: data.id, created_at: data.created_at, status: 'delivered' } : msg
                )
            );
        });
        return unsubscribe;
    }, [webSocket]);

    // Escuchar errores de mensajes
    useEffect(() => {
        const unsubscribe = webSocket.onMessageError((err) => {
            console.error('[Chat] Message error:', err);
            setError(`Failed to send message: ${err.error}`);
        });
        return unsubscribe;
    }, [webSocket]);

    // Escuchar indicadores de escritura
    useEffect(() => {
        const unsubscribe = webSocket.onUserTyping((typing) => {
            setTypingUsers((prev) => {
                const newSet = new Set(prev);
                if (typing.isTyping) {
                    newSet.add(typing.userId);
                } else {
                    newSet.delete(typing.userId);
                }
                return newSet;
            });
        });
        return unsubscribe;
    }, [webSocket]);

    // Escuchar estado de usuarios
    useEffect(() => {
        const unsubscribe = webSocket.onUserStatus((status) => {
            setUserStatuses((prev) => new Map(prev).set(status.userId, status.status));
        });
        return unsubscribe;
    }, [webSocket]);

    // Obtener conversaciones de un usuario
    const getConversations = useCallback(async (userId: string) => {
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
    }, []);

    // Obtener mensajes de una conversación (con sincronización garantizada)
    const getMessages = useCallback(async (conversationId: string) => {
        setLoading(true);
        setError(null);
        try {
            console.log('[Chat] Fetching messages for conversation:', conversationId);
            
            const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`);
            if (!response.ok) {
                throw new Error(`Failed to fetch messages: HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`[Chat] Fetched ${data.length} messages from server`, data);
            
            // Sincronizar: eliminar duplicados locales que ya están en el servidor
            setCurrentMessages(data || []);
        } catch (err: any) {
            console.error('[Chat] getMessages error:', err.message);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Enviar mensaje (ahora usa WebSocket)
    const sendMessage = useCallback(async (conversationId: string, senderId: string, recipientId: string, content: string) => {
        setError(null);
        
        // Validar entrada
        if (!content || !content.trim()) {
            throw new Error('Message content cannot be empty');
        }

        if (!conversationId || !senderId || !recipientId) {
            throw new Error('Missing required message fields');
        }

        try {
            const contentTrimmed = content.trim();
            const messageData = {
                conversationId,
                senderId,
                recipientId,
                content: contentTrimmed,
            };

            console.log('[Chat] Sending message:', messageData);

            // Usar WebSocket si está conectado
            if (webSocket.socket?.connected) {
                // Enviar por WebSocket
                webSocket.sendMessage(conversationId, senderId, recipientId, contentTrimmed);
                
                // Retornar optimista - será confirmado por message:sent
                return { 
                    id: 'pending', 
                    created_at: new Date().toISOString(),
                    status: 'sending'
                };
            } else {
                // Fallback a HTTP con reintentos
                console.warn('[Chat] WebSocket not connected, using HTTP fallback');
                
                const response = await fetch(`${API_URL}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: conversationId,
                        sender_id: senderId,
                        content: contentTrimmed,
                        message_type: 'text',
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}: Failed to send message`);
                }
                
                const newMessage = await response.json();
                console.log('[Chat] Message sent via HTTP:', newMessage);
                
                // Agregar a la lista local
                setCurrentMessages((prev) => [...prev, newMessage]);
                return newMessage;
            }
        } catch (err: any) {
            const errorMsg = err.message || 'Failed to send message';
            console.error('[Chat] sendMessage error:', errorMsg);
            setError(errorMsg);
            throw err;
        }
    }, [webSocket]);

    // Marcar mensaje como leído
    const markAsRead = useCallback(async (messageId: string, conversationId: string, userId: string) => {
        try {
            if (webSocket.socket?.connected) {
                webSocket.markMessageAsRead(messageId, conversationId, userId);
            } else {
                await fetch(`${API_URL}/messages/${messageId}/read`, {
                    method: 'PUT',
                });
            }
        } catch (err: any) {
            console.error('Failed to mark message as read:', err);
        }
    }, [webSocket]);

    // Marcar conversación como leída
    const markConversationAsRead = useCallback(async (conversationId: string) => {
        try {
            await fetch(`${API_URL}/conversations/${conversationId}/read`, {
                method: 'PUT',
            });
        } catch (err: any) {
            console.error('Failed to mark conversation as read:', err);
        }
    }, []);

    // Indicador de escribiendo
    const sendTypingIndicator = useCallback((conversationId: string, userId: string, recipientId: string, isTyping: boolean) => {
        if (webSocket.socket?.connected) {
            webSocket.sendTypingIndicator(conversationId, userId, recipientId, isTyping);
        }
    }, [webSocket]);

    return {
        conversations,
        currentMessages,
        loading,
        error,
        typingUsers,
        userStatuses,
        getConversations,
        getMessages,
        sendMessage,
        markAsRead,
        markConversationAsRead,
        sendTypingIndicator,
    };
};
