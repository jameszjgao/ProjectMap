import { Bell, User } from 'lucide-react';

interface HeaderProps {
    user: any;
}

const Header = ({ user }: HeaderProps) => {
    return (
        <header className="dashboard-header">
            <div className="header-search">
                <input type="text" placeholder="Search records..." className="search-input" />
            </div>

            <div className="header-actions">
                <button className="icon-btn">
                    <Bell size={20} />
                    <span className="notification-dot"></span>
                </button>

                <div className="user-profile">
                    <div className="user-info">
                        <span className="user-email">{user.email}</span>
                        <span className="user-role">Administrator</span>
                    </div>
                    <div className="avatar">
                        <User size={20} />
                    </div>
                </div>
            </div>

            <style>{`
        .dashboard-header {
          height: 80px;
          padding: 0 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .search-input {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          padding: 0.6rem 1rem;
          color: white;
          width: 300px;
          outline: none;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          border-color: #6366f1;
          background: rgba(30, 41, 59, 0.8);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .icon-btn {
          position: relative;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .icon-btn:hover {
          color: #f1f5f9;
        }

        .notification-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid #0f172a;
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding-left: 1.5rem;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }

        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .user-email {
          font-size: 0.875rem;
          font-weight: 500;
          color: #f1f5f9;
        }

        .user-role {
          font-size: 0.75rem;
          color: #64748b;
        }

        .avatar {
          width: 40px;
          height: 40px;
          background: #334155;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
        }
      `}</style>
        </header>
    );
};

export default Header;
