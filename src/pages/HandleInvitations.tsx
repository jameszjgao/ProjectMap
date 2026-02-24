/**
 * Handle Invitations - 与移动端 app/handle-invitations.tsx 对应
 * 处理空间邀请，Web 端占位
 */
import { useNavigate } from 'react-router-dom';

export default function HandleInvitations() {
  const navigate = useNavigate();
  return (
    <div className="page-common">
      <h1>Invitations</h1>
      <p>查看并处理空间邀请。可在「Space Members」或「Space Information」中管理邀请。</p>
      <button type="button" className="btn btn-primary" onClick={() => navigate('/space-manage')}>
        空间管理
      </button>
    </div>
  );
}
