/**
 * Space Select - 与移动端 app/space-select.tsx 对应
 * 多空间时选择当前空间，Web 端可跳转到空间管理
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SpaceSelect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/space-manage', { replace: true });
  }, [navigate]);
  return null;
}
