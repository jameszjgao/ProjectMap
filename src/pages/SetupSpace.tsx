/**
 * Setup Space - 与移动端 app/setup-space.tsx 对应
 * 新用户创建空间，Web 端跳转到空间管理
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SetupSpace() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/space-manage', { replace: true });
  }, [navigate]);
  return null;
}
