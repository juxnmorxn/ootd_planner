import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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

export const useWebSocket = (userId: string | null) => {
    const socketRef = useRef<Socket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        content: string
    ) => {
        if (!socketRef.current) return;

        socketRef.current.emit('message:send', {
            conversationId,
            senderId,
            recipientId,
            content,
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
        if (!socketRef.current) return () => {};
        socketRef.current.on('message:received', callback);
        return () => socketRef.current?.off('message:received', callback);
    }, []);

    const onMessageSent = useCallback((callback: (data: { id: string; created_at: string }) => void) => {
        if (!socketRef.current) return () => {};
        socketRef.current.on('message:sent', callback);
        return () => socketRef.current?.off('message:sent', callback);
    }, []);

    const onMessageRead = useCallback((callback: (data: { messageId: string; userId: string }) => void) => {
        if (!socketRef.current) return () => {};
        socketRef.current.on('message:read', callback);
        return () => socketRef.current?.off('message:read', callback);
    }, []);

    const onUserStatus = useCallback((callback: (status: UserStatus) => void) => {
        if (!socketRef.current) return () => {};
        socketRef.current.on('user:status', callback);
        return () => socketRef.current?.off('user:status', callback);
    }, []);

    const onUserTyping = useCallback((callback: (typing: TypingIndicator) => void) => {
        if (!socketRef.current) return () => {};
        socketRef.current.on('user:typing', callback);
        return () => socketRef.current?.off('user:typing', callback);
    }, []);

    return {
        socket: socketRef.current,
        sendMessage,
        sendTypingIndicator,
        markMessageAsRead,
        onMessageReceived,
        onMessageSent,
        onMessageRead,
        onUserStatus,
        onUserTyping,
    };
};
