/**
 * Chat to Log (Voice Input) - 与移动端 app/voice-input.tsx 对应
 * Web 端占位：语音/聊天录入在移动端实现，Web 可后续接对话界面
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function VoiceInput() {
  const navigate = useNavigate();
  const location = useLocation();
  const [voucherType, setVoucherType] = useState<'receipt' | 'invoice' | 'inbound' | 'outbound'>('receipt');

  useEffect(() => {
    const state = location.state as { voucherType?: 'receipt' | 'invoice' | 'inbound' | 'outbound' };
    if (state?.voucherType) {
      setVoucherType(state.voucherType);
    }
  }, [location]);

  const getTitle = () => {
    if (voucherType === 'invoice') return 'Chat to Log Income';
    if (voucherType === 'inbound') return 'Chat to Log Inbound';
    if (voucherType === 'outbound') return 'Chat to Log Outbound';
    return 'Chat to Log Expenses';
  };

  const getBackPath = () => {
    if (voucherType === 'invoice') return '/income';
    if (voucherType === 'inbound') return '/inbound';
    if (voucherType === 'outbound') return '/outbound';
    return '/expenditure';
  };

  return (
    <div className="page-common">
      <h1>{getTitle()}</h1>
      <p className="text-muted">此功能在移动端使用。Web 端可通过列表页点击 New 手动录入。</p>
      <button type="button" className="btn btn-primary" onClick={() => navigate(getBackPath())}>
        返回列表
      </button>
    </div>
  );
}
