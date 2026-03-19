import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export interface WebSocketMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    message_type: 'text' | 'image' | 'file';
    read: boolean;
    created_at: string;
}

export interface UserStatus {
    userId: string;
    status: 'online' | 'offline';
    timestamp?: string;
}

export interface TypingIndicator {
    userId: string;
    isTyping: boolean;
    conversationId: string;
}

export interface ContactRequestEvent {
    id: string;
    user_id: string;
    contact_id: string;
    status: string;
    created_at: string;
    updated_at: string;
    from_user?: {
        id: string;
        username: string;
        profile_pic?: string | null;
    } | null;
}

export interface ContactAcceptedEvent {
    user_id: string;
    contact_id: string;
    conversation_id: string;
    created_at: string;
    updated_at: string;
    other_user?: {
        id: string;
        username: string;
        profile_pic?: string | null;
    } | null;
}

export const useWebSocket = (userId: string | null) => {
    const socketRef = useRef<any | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Listas de handlers por tipo de evento para poder registrar callbacks
    // aunque el socket aún no se haya conectado.
    const messageReceivedHandlers = useRef<Array<(m: WebSocketMessage) => void>>([]);
    const messageSentHandlers = useRef<Array<(d: { id: string; created_at: string; clientId?: string }) => void>>([]);
    const messageDeliveredHandlers = useRef<Array<(d: { id: string }) => void>>([]);
    const messageReadHandlers = useRef<Array<(d: { messageId: string; userId: string }) => void>>([]);
    const messageErrorHandlers = useRef<Array<(e: { error: string; details?: string }) => void>>([]);
    const userStatusHandlers = useRef<Array<(s: UserStatus) => void>>([]);
    const userTypingHandlers = useRef<Array<(t: TypingIndicator) => void>>([]);
    const contactRequestHandlers = useRef<Array<(e: ContactRequestEvent) => void>>([]);
    const contactAcceptedHandlers = useRef<Array<(e: ContactAcceptedEvent) => void>>([]);

    // Inicializar conexión WebSocket
    useEffect(() => {
        if (!userId) return;

        // Determinar la URL del servidor
        let socketUrl: string;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            socketUrl = 'http://localhost:3001';
        } else {
            // En producción, usar el mismo dominio (Render)
            socketUrl = window.location.origin;
        }

        const socket = io(socketUrl, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            transports: ['polling', 'websocket'],
            upgrade: true,
        });

        socket.on('connect', () => {
            console.log('[WS] Connected to server');
            // Informar al servidor que este usuario se conectó
            socket.emit('user:connect', userId);
        });

        socket.on('disconnect', () => {
            console.log('[WS] Disconnected from server');
        });

        socket.on('connect_error', (error: any) => {
            console.error('[WS] Connection error:', error);
        });

        // Puente de eventos: reenviar a todos los handlers registrados
        socket.on('message:received', (message: WebSocketMessage) => {
            messageReceivedHandlers.current.forEach((cb) => cb(message));
        });

        socket.on('message:sent', (data: { id: string; created_at: string; clientId?: string }) => {
            messageSentHandlers.current.forEach((cb) => cb(data));
        });

        socket.on('message:delivered', (data: { id: string }) => {
            messageDeliveredHandlers.current.forEach((cb) => cb(data));
        });

        socket.on('message:read', (data: { messageId: string; userId: string }) => {
            messageReadHandlers.current.forEach((cb) => cb(data));
        });

        socket.on('message:error', (err: { error: string; details?: string }) => {
            messageErrorHandlers.current.forEach((cb) => cb(err));
        });

        socket.on('user:status', (status: UserStatus) => {
            userStatusHandlers.current.forEach((cb) => cb(status));
        });

        socket.on('user:typing', (typing: TypingIndicator) => {
            userTypingHandlers.current.forEach((cb) => cb(typing));
        });

        socket.on('contact:request', (event: ContactRequestEvent) => {
            contactRequestHandlers.current.forEach((cb) => cb(event));
        });

        socket.on('contact:accepted', (event: ContactAcceptedEvent) => {
            contactAcceptedHandlers.current.forEach((cb) => cb(event));
        });

        socketRef.current = socket;

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [userId]);

    // Enviar mensaje
    const sendMessage = useCallback((
        conversationId: string,
        senderId: string,
        recipientId: string,
        content: string,
        clientId?: string
    ) => {
        if (!socketRef.current) return;

        socketRef.current.emit('message:send', {
            conversationId,
            senderId,
            recipientId,
            content,
            clientId,
        });
    }, []);

    // Indicador de escritura
    const sendTypingIndicator = useCallback((
        conversationId: string,
        userId: string,
        recipientId: string,
        isTyping: boolean
    ) => {
        if (!socketRef.current) return;

        socketRef.current.emit('user:typing', {
            conversationId,
            userId,
            recipientId,
            isTyping,
        });
    }, []);

    // Marcar mensaje como leído
    const markMessageAsRead = useCallback((
        messageId: string,
        conversationId: string,
        userId: string
    ) => {
        if (!socketRef.current) return;

        socketRef.current.emit('message:markAsRead', {
            messageId,
            conversationId,
            userId,
        });
    }, []);

    // Escuchar eventos
    const onMessageReceived = useCallback((callback: (message: WebSocketMessage) => void) => {
        messageReceivedHandlers.current.push(callback);
        return () => {
            messageReceivedHandlers.current = messageReceivedHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    const onMessageSent = useCallback((callback: (data: { id: string; created_at: string; clientId?: string }) => void) => {
        messageSentHandlers.current.push(callback);
        return () => {
            messageSentHandlers.current = messageSentHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    const onMessageDelivered = useCallback((callback: (data: { id: string }) => void) => {
        messageDeliveredHandlers.current.push(callback);
        return () => {
            messageDeliveredHandlers.current = messageDeliveredHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    const onMessageRead = useCallback((callback: (data: { messageId: string; userId: string }) => void) => {
        messageReadHandlers.current.push(callback);
        return () => {
            messageReadHandlers.current = messageReadHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    const onMessageError = useCallback((callback: (error: { error: string; details?: string }) => void) => {
        messageErrorHandlers.current.push(callback);
        return () => {
            messageErrorHandlers.current = messageErrorHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    const onUserStatus = useCallback((callback: (status: UserStatus) => void) => {
        userStatusHandlers.current.push(callback);
        return () => {
            userStatusHandlers.current = userStatusHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    const onUserTyping = useCallback((callback: (typing: TypingIndicator) => void) => {
        userTypingHandlers.current.push(callback);
        return () => {
            userTypingHandlers.current = userTypingHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    const onContactRequest = useCallback((callback: (event: ContactRequestEvent) => void) => {
        contactRequestHandlers.current.push(callback);
        return () => {
            contactRequestHandlers.current = contactRequestHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    const onContactAccepted = useCallback((callback: (event: ContactAcceptedEvent) => void) => {
        contactAcceptedHandlers.current.push(callback);
        return () => {
            contactAcceptedHandlers.current = contactAcceptedHandlers.current.filter((cb) => cb !== callback);
        };
    }, []);

    return {
        socket: socketRef.current,
        sendMessage,
        sendTypingIndicator,
        markMessageAsRead,
        onMessageReceived,
        onMessageSent,
        onMessageDelivered,
        onMessageRead,
        onMessageError,
        onUserStatus,
        onUserTyping,
        onContactRequest,
        onContactAccepted,
    };
};
