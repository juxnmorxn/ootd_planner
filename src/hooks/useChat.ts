import { useState, useEffect, useCallback } from 'react';
import type { ConversationWithData, MessageWithSender } from '../types';
import { useWebSocket } from './useWebSocket';
import type { ContactRequestEvent, ContactAcceptedEvent } from './useWebSocket';

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

    // Escuchar mensajes recibidos y actualizar conversación + mensajes actuales
    useEffect(() => {
        const unsubscribe = webSocket.onMessageReceived((message) => {
            console.log('[Chat] Message received via WS:', message);

            // Si el mensaje es nuestro (saliente), no duplicar: el bubble ya
            // existe como "pending" y se actualizará con message:sent.
            setCurrentMessages((prev) => {
                if (userId && message.sender_id === userId) {
                    return prev;
                }
                return [...prev, message];
            });

            // Actualizar la lista de conversaciones (último mensaje y contadores)
            setConversations((prev) => {
                const updated = prev.map((conv) => {
                    if (conv.id !== message.conversation_id) return conv;

                    const unreadBase = conv.unread_count ?? 0;
                    const isIncoming = userId && message.sender_id !== userId;

                    return {
                        ...conv,
                        last_message: {
                            id: message.id,
                            content: message.content,
                            created_at: message.created_at,
                            sender_id: message.sender_id,
                            read: message.read,
                        } as any,
                        unread_count: isIncoming ? unreadBase + 1 : unreadBase,
                        // Mantener orden local coherente con la última actividad
                        updated_at: message.created_at,
                    };
                });

                // Reordenar conversaciones por última actividad (updated_at desc)
                return [...updated].sort((a, b) => {
                    const aTime = a.updated_at || a.last_message?.created_at || '';
                    const bTime = b.updated_at || b.last_message?.created_at || '';
                    return bTime.localeCompare(aTime);
                });
            });
        });
        return unsubscribe;
    }, [webSocket, userId]);

    // Escuchar confirmación de mensajes enviados
    useEffect(() => {
        const unsubscribe = webSocket.onMessageSent((data) => {
            console.log('[Chat] Message confirmed sent:', data);

            // Actualizar el estado local del mensaje optimista casando por clientId
            setCurrentMessages((prev) =>
                prev.map((msg) => {
                    const anyMsg = msg as any;

                    // Si tenemos clientId, usarlo para identificar el mensaje concreto
                    if (data.clientId && anyMsg.client_id === data.clientId) {
                        return {
                            ...msg,
                            id: data.id,
                            created_at: data.created_at,
                            delivery_status: 'sent',
                        };
                    }

                    // Fallback legacy: si no hay clientId, usar el antiguo id 'pending'
                    if (!data.clientId && msg.id === 'pending') {
                        return {
                            ...msg,
                            id: data.id,
                            created_at: data.created_at,
                            delivery_status: 'sent',
                        };
                    }

                    return msg;
                })
            );
        });
        return unsubscribe;
    }, [webSocket]);

    // Escuchar estado "delivered" (llegó al dispositivo del otro usuario)
    useEffect(() => {
        const unsubscribe = webSocket.onMessageDelivered?.((data) => {
            console.log('[Chat] Message delivered:', data);
            setCurrentMessages((prev) =>
                prev.map((msg) =>
                    msg.id === data.id
                        ? {
                            ...msg,
                            // Si ya está marcado como leído, no degradar el estado
                            delivery_status: msg.delivery_status === 'read' ? 'read' : 'delivered',
                        }
                        : msg
                )
            );
        });
        return unsubscribe;
    }, [webSocket]);

    // Escuchar lecturas en tiempo real
    useEffect(() => {
        const unsubscribe = webSocket.onMessageRead?.((data) => {
            console.log('[Chat] Message read:', data);
            const { messageId } = data;

            // Actualizar mensajes actuales
            setCurrentMessages((prev) =>
                prev.map((msg) =>
                    msg.id === messageId
                        ? {
                            ...msg,
                            read: true,
                            delivery_status: 'read',
                        }
                        : msg
                )
            );

            // Actualizar last_message en conversaciones si coincide
            setConversations((prev) =>
                prev.map((conv) => {
                    if (!conv.last_message || conv.last_message.id !== messageId) return conv;
                    return {
                        ...conv,
                        last_message: {
                            ...conv.last_message,
                            read: true,
                        } as any,
                    };
                })
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

    // Reexpone eventos de contactos para que otras pantallas puedan reaccionar
    const onContactRequest = useCallback((callback: (event: ContactRequestEvent) => void) => {
        return webSocket.onContactRequest(callback);
    }, [webSocket]);

    const onContactAccepted = useCallback((callback: (event: ContactAcceptedEvent) => void) => {
        return webSocket.onContactAccepted(callback);
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
                // ID temporal único en cliente para casar mensaje optimista con confirmación
                const clientId = (window.crypto && 'randomUUID' in window.crypto)
                    ? window.crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

                // Mensaje optimista local (tipo WhatsApp)
                const optimisticMessage: MessageWithSender = {
                    id: 'pending',
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content: contentTrimmed,
                    message_type: 'text',
                    read: false,
                    created_at: new Date().toISOString(),
                    delivery_status: 'pending',
                    client_id: clientId,
                };

                setCurrentMessages((prev) => [...prev, optimisticMessage]);

                // Enviar por WebSocket; el servidor luego emitirá message:sent
                // para completar id/fecha y message:received para el receptor.
                webSocket.sendMessage(conversationId, senderId, recipientId, contentTrimmed, clientId);

                return optimisticMessage;
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

            // Actualizar localmente los contadores de no leídos
            setConversations((prev) =>
                prev.map((conv) =>
                    conv.id === conversationId
                        ? { ...conv, unread_count: 0 }
                        : conv
                )
            );
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
        onContactRequest,
        onContactAccepted,
    };
};
