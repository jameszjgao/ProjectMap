/**
 * Invite accept - 与移动端 app/invite/[id].tsx 或 invite/[token].tsx 对应
 * 接受邀请链接，Web 端占位
 */
import { useParams, useNavigate } from 'react-router-dom';

export default function Invite() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <div className="page-common">
      <h1>Invitation</h1>
      <p>邀请 ID: {id}. 接受邀请后将被加入对应空间。</p>
      <button type="button" className="btn btn-primary" onClick={() => navigate('/space-manage')}>
        前往空间管理
      </button>
    </div>
  );
}
