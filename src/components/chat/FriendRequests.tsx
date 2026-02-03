import React, { useEffect, useState } from 'react';
import { useContacts } from '../../hooks/useContacts';
import './FriendRequests.css';

interface FriendRequestsProps {
    userId: string;
    onRequestHandled?: () => void;
}

export const FriendRequests: React.FC<FriendRequestsProps> = ({ userId, onRequestHandled }) => {
    const { pendingRequests, loading, getPendingRequests, acceptRequest, rejectRequest } = useContacts();
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        getPendingRequests(userId);
    }, [userId]);

    const handleAccept = async (fromUserId: string) => {
        setProcessingId(fromUserId);
        try {
            await acceptRequest(userId, fromUserId);
            onRequestHandled?.();
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (fromUserId: string) => {
        setProcessingId(fromUserId);
        try {
            await rejectRequest(userId, fromUserId);
            onRequestHandled?.();
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return <div className="friend-requests"><p>Cargando solicitudes...</p></div>;
    }

    return (
        <div className="friend-requests">
            <h2>📩 Solicitudes de amistad</h2>

            {pendingRequests.length === 0 ? (
                <p className="no-requests">No tienes solicitudes pendientes</p>
            ) : (
                <div className="requests-list">
                    {pendingRequests.map((request: any) => (
                        <div key={request.id} className="request-item">
                            <div className="request-header">
                                {request.contact_user?.profile_pic && (
                                    <img
                                        src={request.contact_user.profile_pic}
                                        alt={request.contact_user.username}
                                        className="profile-pic"
                                    />
                                )}
                                <div className="request-info">
                                    <h3>{request.contact_user?.username}</h3>
                                    <p>{new Date(request.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="request-actions">
                                <button
                                    onClick={() => handleAccept(request.user_id)}
                                    disabled={processingId !== null}
                                    className="btn-accept"
                                >
                                    ✅ Aceptar
                                </button>
                                <button
                                    onClick={() => handleReject(request.user_id)}
                                    disabled={processingId !== null}
                                    className="btn-reject"
                                >
                                    ❌ Rechazar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
