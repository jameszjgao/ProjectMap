/**
 * 处理邀请浮窗：列表展示待处理邀请，支持接受/拒绝
 */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  getPendingInvitationsForUser,
  acceptInvitation,
  declineInvitation,
  type SpaceInvitation,
} from '../lib/shared/space-invitations';
import './InvitationsPanel.css';

interface InvitationsPanelProps {
  open: boolean;
  onClose: () => void;
  onAccepted?: () => void;
}

export default function InvitationsPanel({ open, onClose, onAccepted }: InvitationsPanelProps) {
  const [list, setList] = useState<SpaceInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPendingInvitationsForUser();
      setList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleAccept = async (inv: SpaceInvitation) => {
    setActingId(inv.id);
    try {
      const { error } = await acceptInvitation(inv.id);
      if (error) {
        alert(error.message || 'Accept failed');
        return;
      }
      window.dispatchEvent(new Event('space-changed'));
      onAccepted?.();
      setList((prev) => prev.filter((x) => x.id !== inv.id));
    } catch (e) {
      console.error(e);
      alert('Accept failed');
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (inv: SpaceInvitation) => {
    setActingId(inv.id);
    try {
      const { error } = await declineInvitation(inv.id);
      if (error) {
        alert(error.message || 'Decline failed');
        return;
      }
      setList((prev) => prev.filter((x) => x.id !== inv.id));
    } catch (e) {
      console.error(e);
      alert('Decline failed');
    } finally {
      setActingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="invitations-panel-overlay" onClick={onClose}>
      <div className="invitations-panel" onClick={(e) => e.stopPropagation()}>
        <div className="invitations-panel-header">
          <h2 className="invitations-panel-title">Invitations</h2>
          <button type="button" className="invitations-panel-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="invitations-panel-body">
          {loading ? (
            <p className="invitations-panel-loading">Loading...</p>
          ) : list.length === 0 ? (
            <p className="invitations-panel-empty">No pending invitations.</p>
          ) : (
            <ul className="invitations-panel-list">
              {list.map((inv) => (
                <li key={inv.id} className="invitations-panel-item">
                  <div className="invitations-panel-item-info">
                    <span className="invitations-panel-item-space">{inv.spaceName || 'Space'}</span>
                    {inv.inviterEmail && (
                      <span className="invitations-panel-item-inviter">from {inv.inviterEmail}</span>
                    )}
                  </div>
                  <div className="invitations-panel-item-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={actingId !== null}
                      onClick={() => handleAccept(inv)}
                    >
                      {actingId === inv.id ? '...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={actingId !== null}
                      onClick={() => handleDecline(inv)}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
