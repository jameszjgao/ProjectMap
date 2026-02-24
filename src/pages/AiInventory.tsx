/**
 * AI Inventory - 与移动端 app/ai-inventory.tsx 一一对应
 * 入口：Purchase（Expenses, Inbound）、Sales（Income, Outbound）、Master Data（SKU, Warehouse, Suppliers, Customers）
 */
import { useNavigate } from 'react-router-dom';
import { Receipt, ArrowDownCircle, FileText, ArrowUpCircle, Box, Building, Store, Users } from 'lucide-react';
import './AiInventory.css';

const sections = [
  {
    title: 'Purchase',
    items: [
      { label: 'Expenses', route: '/expenditure', icon: Receipt },
      { label: 'Inbound Lists', route: '/inbound', icon: ArrowDownCircle },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Income', route: '/income', icon: FileText },
      { label: 'Outbound Lists', route: '/outbound', icon: ArrowUpCircle },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { label: 'SKU', route: '/skus-manage', icon: Box },
      { label: 'Warehouse', route: '/warehouse-manage', icon: Building },
      { label: 'Suppliers', route: '/suppliers-manage', icon: Store },
      { label: 'Customers', route: '/customers-manage', icon: Users },
    ],
  },
];

export default function AiInventory() {
  const navigate = useNavigate();

  return (
    <div className="page-common">
      <div className="ai-inventory-header">
        <h1>AI Inventory</h1>
        <p className="ai-inventory-subtitle">Purchase · Sales · Inventory</p>
      </div>
      <div className="ai-inventory-sections">
        {sections.map((section) => (
          <section key={section.title} className="ai-inventory-section">
            <h2 className="ai-inventory-section-title">{section.title}</h2>
            <div className="ai-inventory-cards">
              {section.items.map((item) => (
                <button
                  key={item.route}
                  type="button"
                  className="ai-inventory-card"
                  onClick={() => navigate(item.route)}
                >
                  <item.icon size={24} className="ai-inventory-card-icon" />
                  <span className="ai-inventory-card-label">{item.label}</span>
                  <span className="ai-inventory-card-arrow">›</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
