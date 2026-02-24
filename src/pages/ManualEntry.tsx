/**
 * Add Expense (Manual Entry) - 与移动端 app/manual-entry.tsx 对应
 * Web 端：跳转到新建支出详情页
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ManualEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/detail/expenditure/new', { replace: true });
  }, [navigate]);
  return null;
}
