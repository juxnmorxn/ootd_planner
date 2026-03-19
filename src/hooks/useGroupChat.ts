import { useState, useEffect, useCallback } from 'react';
import type { GroupWithData, GroupMessageWithSender } from '../types';
import { useWebSocket } from './useWebSocket';

const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    return '/api';
})();

export const useGroupChat = (userId?: string) => {
    const [groups, setGroups] = useState<GroupWithData[]>([]);
    const [currentGroupMessages, setCurrentGroupMessages] = useState<GroupMessageWithSender[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const webSocket = useWebSocket(userId || null);

    // WS: mensajes recibidos de grupo
    useEffect(() => {
        const unsubscribe = webSocket.onGroupMessageReceived?.((message) => {
            const groupId = message.group_id;

            // Actualizar mensajes visibles si este grupo está activo y es un mensaje entrante
            setCurrentGroupMessages((prev) => {
                if (!activeGroupId || activeGroupId !== groupId) return prev;

                if (userId && message.sender_id === userId) {
                    // Mensaje saliente nuestro: ya existe el bubble optimista
                    return prev;
                }

                return [...prev, message];
            });

            // Actualizar lista de grupos (last_message & unread_count)
            setGroups((prev) => {
                const updated = prev.map((g) => {
                    if (g.id !== groupId) return g;

                    let unreadBase = g.unread_count ?? 0;

                    // Solo contar como no leído si el mensaje no es nuestro
                    if (userId && message.sender_id !== userId) {
                        unreadBase += 1;
                    }

                    return {
                        ...g,
                        last_message: {
                            id: message.id,
                            group_id: message.group_id,
                            sender_id: message.sender_id,
                            content: message.content,
                            message_type: message.message_type,
                            read_by_json: message.read_by_json,
                            created_at: message.created_at,
                        },
                        unread_count: unreadBase,
                        updated_at: message.created_at,
                    };
                });

                return [...updated].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
            });
        });

        return unsubscribe;
    }, [webSocket, activeGroupId, userId]);

    // WS: confirmación de mensaje enviado (casar clientId)
    useEffect(() => {
        const unsubscribe = webSocket.onGroupMessageSent?.((data) => {
            setCurrentGroupMessages((prev) =>
                prev.map((msg) => {
                    const anyMsg: any = msg as any;
                    if (data.clientId && anyMsg.client_id === data.clientId) {
                        return {
                            ...msg,
                            id: data.id,
                            created_at: data.created_at,
                        };
                    }
                    if (!data.clientId && msg.id === 'pending') {
                        return {
                            ...msg,
                            id: data.id,
                            created_at: data.created_at,
                        };
                    }
                    return msg;
                })
            );
        });

        return unsubscribe;
    }, [webSocket]);

    // WS: lecturas de mensajes de grupo
    useEffect(() => {
        const unsubscribe = webSocket.onGroupMessageRead?.((event) => {
            const { groupId, messageId, userId: readerId } = event;

            setCurrentGroupMessages((prev) =>
                prev.map((msg) => {
                    if (msg.group_id !== groupId || msg.id !== messageId) return msg;
                    let readBy: string[] = [];
                    try {
                        readBy = msg.read_by_json ? JSON.parse(msg.read_by_json) : [];
                        if (!Array.isArray(readBy)) readBy = [];
                    } catch {
                        readBy = [];
                    }
                    if (!readBy.includes(readerId)) {
                        readBy.push(readerId);
                    }
                    return {
                        ...msg,
                        read_by_json: JSON.stringify(readBy),
                    };
                })
            );
        });

        return unsubscribe;
    }, [webSocket]);

    // WS: errores de mensajes de grupo
    useEffect(() => {
        const unsubscribe = webSocket.onGroupMessageError?.((err) => {
            console.error('[GroupChat] Message error:', err);
            setError(err.error || 'Error al enviar mensaje de grupo');
        });
        return unsubscribe;
    }, [webSocket]);

    const getGroups = useCallback(async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/groups/by-user/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch groups');
            const data: GroupWithData[] = await response.json();
            setGroups(data || []);
        } catch (err: any) {
            console.error('[GroupChat] getGroups error:', err);
            setError(err.message || 'Error al cargar grupos');
        } finally {
            setLoading(false);
        }
    }, []);

    const getGroupMessages = useCallback(async (groupId: string) => {
        setLoading(true);
        setError(null);
        setActiveGroupId(groupId);
        try {
            const response = await fetch(`${API_URL}/groups/${groupId}/messages`);
            if (!response.ok) throw new Error('Failed to fetch group messages');
            const data: GroupMessageWithSender[] = await response.json();
            setCurrentGroupMessages(data || []);
        } catch (err: any) {
            console.error('[GroupChat] getGroupMessages error:', err);
            setError(err.message || 'Error al cargar mensajes del grupo');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const sendGroupMessage = useCallback(async (groupId: string, senderId: string, content: string) => {
        setError(null);

        const trimmed = content.trim();
        if (!trimmed) {
            throw new Error('El mensaje no puede estar vacío');
        }

        try {
            if (webSocket.socket?.connected) {
                const clientId = (window.crypto && 'randomUUID' in window.crypto)
                    ? window.crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

                const optimistic: GroupMessageWithSender = {
                    id: 'pending',
                    group_id: groupId,
                    sender_id: senderId,
                    content: trimmed,
                    message_type: 'text',
                    read_by_json: '[]',
                    created_at: new Date().toISOString(),
                } as any;

                (optimistic as any).client_id = clientId;

                setCurrentGroupMessages((prev) => [...prev, optimistic]);

                webSocket.sendGroupMessage?.(groupId, senderId, trimmed, clientId, 'text');
                return optimistic;
            }

            // Fallback HTTP
            const response = await fetch(`${API_URL}/groups/${groupId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: senderId,
                    content: trimmed,
                    message_type: 'text',
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            const msg: GroupMessageWithSender = await response.json();
            setCurrentGroupMessages((prev) => [...prev, msg]);
            return msg;
        } catch (err: any) {
            console.error('[GroupChat] sendGroupMessage error:', err);
            setError(err.message || 'Error al enviar mensaje de grupo');
            throw err;
        }
    }, [webSocket]);

    const markGroupMessageAsRead = useCallback(async (groupId: string, messageId: string, userId: string) => {
        try {
            if (webSocket.socket?.connected) {
                webSocket.markGroupMessageAsRead?.(groupId, messageId, userId);
            } else {
                await fetch(`${API_URL}/groups/${groupId}/messages/${messageId}/read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId }),
                });
            }
        } catch (err) {
            console.error('[GroupChat] markGroupMessageAsRead error:', err);
        }
    }, [webSocket]);

    return {
        groups,
        currentGroupMessages,
        activeGroupId,
        loading,
        error,
        getGroups,
        getGroupMessages,
        sendGroupMessage,
        markGroupMessageAsRead,
        setActiveGroupId,
    };
};
