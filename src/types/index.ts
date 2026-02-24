// 小票状态
export type ReceiptStatus = 'pending' | 'processing' | 'confirmed' | 'needs_retake' | 'duplicate';

// 商品用途（用途主数据表 purposes）
export interface Purpose {
  id: string;
  spaceId: string;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 消费分类
export interface Category {
  id: string;
  spaceId: string;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 账户（收付款共用，原 PaymentAccount）
export interface Account {
  id: string;
  spaceId: string;
  name: string;
  isAiRecognized: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 供应商
export interface Supplier {
  id: string;
  spaceId: string;
  name: string;
  taxNumber?: string;
  phone?: string;
  address?: string;
  isAiRecognized: boolean;
  isCustomer?: boolean; // 是否也作为客户；为 true 时在客户列表和选客户时可选，不创建 customers 行
  createdAt?: string;
  updatedAt?: string;
}

// 客户
export interface Customer {
  id: string;
  spaceId: string;
  name: string;
  taxNumber?: string;
  phone?: string;
  address?: string;
  isAiRecognized: boolean;
  isSupplier?: boolean; // 是否也作为供应商；为 true 时在供应商列表和选供应商时可选，不创建 suppliers 行
  createdAt?: string;
  updatedAt?: string;
}

// 小票商品项
export interface ReceiptItem {
  id?: string;
  name: string;
  categoryId: string;
  category?: Category; // 关联的分类对象
  purposeId: string | null; // 引用 purposes 表
  purpose?: Purpose | null; // 关联的用途对象
  price: number;
  isAsset: boolean;
  confidence?: number; // AI识别置信度
}

// 提交方式类型
export type InputType = 'image' | 'text' | 'audio';

// 小票数据
export interface Receipt {
  id?: string;
  spaceId: string;
  supplierName: string;
  storeName?: string;
  supplierId?: string; // 关联的供应商ID（suppliers 表）
  supplierCustomerId?: string; // 当供应商实为"标记也是供应商"的客户时，填客户ID
  supplier?: Supplier; // 关联的供应商对象（supplier_id 时）
  supplierCustomer?: Customer; // 关联的客户对象（supplier_customer_id 时，作为供应商）
  totalAmount: number;
  date: string;
  accountId?: string;
  account?: Account; // 关联的账户对象（付款）
  status: ReceiptStatus;
  imageUrl?: string;
  inputType?: InputType; // 提交方式：image（相机）、text（文字）、audio（语音）
  items: ReceiptItem[];
  createdAt?: string;
  updatedAt?: string;
  processedBy?: string;
  confidence?: number; // 整体识别置信度
  currency?: string; // 币种，如：CNY、USD
  tax?: number; // 税费
  createdBy?: string; // 提交者用户ID
  createdByUser?: User; // 提交者用户信息
}

// 用户数据
export interface User {
  id: string;
  email: string;
  name?: string; // 用户自定义名字
  spaceId: string | null; // 保留向后兼容，但优先使用 currentSpaceId（可能为 null）
  currentSpaceId?: string; // 当前活动的空间ID（可能为 undefined）
  createdAt?: string;
}

// 用户-空间关联
export interface UserSpace {
  id: string;
  userId: string;
  spaceId: string;
  space?: Space; // 关联的空间信息
  createdAt?: string;
}

// 空间账户
export interface Space {
  id: string;
  name: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 图片质量评价
export interface ImageQuality {
  clarity?: number; // 清晰度评分 0-1
  completeness?: number; // 完整度评分 0-1
  clarityComment?: string; // 清晰度评价文字
  completenessComment?: string; // 完整度评价文字
}

// 数据一致性检查
export interface DataConsistency {
  itemsSum?: number; // 明细金额总和
  itemsSumMatchesTotal?: boolean; // 明细总和是否与总金额一致
  missingItems?: boolean; // 是否可能有遗漏的商品项
  consistencyComment?: string; // 一致性评价文字
}

// ---------- AI 进销存 ----------

// 仓库
export interface Warehouse {
  id: string;
  spaceId: string;
  name: string;
  code?: string;
  address?: string;
  /** 合并指向：已并入的目标仓库 ID，NULL 表示未被合并 */
  mergedIntoId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// 仓位（归属仓库）
export interface Location {
  id: string;
  warehouseId: string;
  name: string;
  code?: string;
  /** 合并指向：已并入的目标仓位 ID（同仓库内），NULL 表示未被合并 */
  mergedIntoId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// 标准 SKU（商品主数据）
export interface Sku {
  id: string;
  spaceId: string;
  code?: string;
  name: string;
  unit: string;
  description?: string;
  isAiRecognized?: boolean;
  /** 合并指向：已并入的目标 SKU ID，NULL 表示未被合并 */
  mergedIntoId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// 发票/入库/出库通用状态
export type VoucherStatus = 'pending' | 'processing' | 'confirmed' | 'needs_retake';

// 发票明细
export interface InvoiceItem {
  id?: string;
  name: string;
  categoryId?: string | null;
  category?: Category;
  purposeId?: string | null;
  purpose?: Purpose | null;
  price: number;
  isAsset?: boolean;
  confidence?: number;
}

// 销售发票（资金流入）
export interface Invoice {
  id?: string;
  spaceId: string;
  customerName: string;
  customerId?: string; // 关联的客户ID（customers 表）
  customerSupplierId?: string; // 当客户实为"标记也是客户"的供应商时，填供应商ID
  customer?: Customer; // 关联的客户对象（customer_id 时）
  customerSupplier?: Supplier; // 关联的供应商对象（customer_supplier_id 时，作为客户）
  totalAmount: number;
  currency?: string;
  tax?: number;
  date: string;
  accountId?: string | null;
  account?: Account;
  status: VoucherStatus;
  imageUrl?: string;
  inputType?: InputType;
  confidence?: number;
  processedBy?: string;
  createdBy?: string | null;
  createdByUser?: User;
  items: InvoiceItem[];
  createdAt?: string;
  updatedAt?: string;
}

// 入库/出库明细（含数量，可关联 SKU；名称/单位/规格通过 sku_id 关联 skus 获取，不冗余存储）
export interface InboundItem {
  id?: string;
  inboundId: string;
  skuId?: string | null;
  lineNo?: number;
  /** 展示用，来自 SKU.code */
  productCode?: string;
  /** 展示用，来自 SKU.name */
  productName?: string;
  /** 展示用，来自 SKU.description */
  specification?: string;
  quantity: number;
  qualifiedQuantity?: number;
  defectiveQuantity?: number;
  /** 展示用，来自 SKU.unit */
  unit?: string;
  unitPrice?: number;
  amount?: number;
  locationId?: string | null;
  confidence?: number;
  remarks?: string;
}

export interface OutboundItem {
  id?: string;
  outboundId: string;
  skuId?: string | null;
  lineNo?: number;
  /** 展示用，来自 SKU.name */
  productName?: string;
  /** 展示用，来自 SKU.description */
  specification?: string;
  quantity: number;
  /** 展示用，来自 SKU.unit */
  unit?: string;
  unitPrice?: number;
  amount?: number;
  supplyPrice?: number;
  tax?: number;
  confidence?: number;
  remarks?: string;
}

// 入库单（采购端）
export interface Inbound {
  id?: string;
  spaceId: string;
  documentNo?: string;
  supplierId?: string | null;
  supplierName?: string;
  warehouseId?: string | null;
  locationId?: string | null;
  inboundType?: string;
  totalAmount?: number;
  totalAmountChinese?: string;
  currency?: string;
  date: string;
  status: VoucherStatus;
  handlerId?: string | null;
  handlerName?: string;
  warehouseKeeperId?: string | null;
  warehouseKeeperName?: string;
  accountantId?: string | null;
  accountantName?: string;
  remarks?: string;
  imageUrl?: string;
  inputType?: InputType;
  confidence?: number;
  createdBy?: string | null;
  items: InboundItem[];
  createdAt?: string;
  updatedAt?: string;
}

// 出库单（销售端）
export interface Outbound {
  id?: string;
  spaceId: string;
  documentNo?: string;
  customerId?: string | null;
  customerName?: string;
  warehouseId?: string | null;
  locationId?: string | null;
  totalAmount?: number;
  totalTax?: number;
  currency?: string;
  date: string;
  status: VoucherStatus;
  handlerId?: string | null;
  handlerName?: string;
  preparerId?: string | null;
  preparerName?: string;
  accountantId?: string | null;
  accountantName?: string;
  remarks?: string;
  imageUrl?: string;
  inputType?: InputType;
  confidence?: number;
  createdBy?: string | null;
  items: OutboundItem[];
  createdAt?: string;
  updatedAt?: string;
}

// 凭证记录类别：由列表页入口决定，不由大模型判断
export type VoucherLogType = 'receipt' | 'invoice' | 'inbound' | 'outbound';

// Gemini识别结果（使用分类名称，后续会匹配到分类ID）
export interface GeminiReceiptResult {
  supplierName: string;
  supplierInfo?: {
    taxNumber?: string; // 税号
    phone?: string; // 电话
    address?: string; // 地址
  };
  date: string;
  totalAmount: number;
  currency?: string; // 币种，如：CNY、USD
  paymentAccountName?: string; // 支付账户，包含卡号尾号信息
  tax?: number; // 税费
  items: Array<{
    name: string;
    categoryName: string; // 分类名称，从[食品,外餐, 居家, 交通, 购物, 医疗, 教育]中选择
    price: number;
    purposeName?: string; // 用途名称，将映射到 purposes.name
    isAsset?: boolean; // 可选
    confidence?: number; // 可选
  }>;
  confidence?: number; // 可选，整体识别置信度 0-1
  imageQuality?: ImageQuality; // 图片质量评价
  dataConsistency?: DataConsistency; // 数据一致性检查
}

/** 出入库识别结果：表头 + 明细，与样例表格最完整字段对齐 */
export interface GeminiInboundOutboundResult {
  documentNo?: string;
  supplierName?: string;
  customerName?: string;
  warehouseName?: string;
  locationName?: string;
  date: string;
  inboundType?: string;
  totalAmount?: number;
  totalAmountChinese?: string;
  totalTax?: number;
  currency?: string;
  handlerName?: string;
  warehouseKeeperName?: string;
  preparerName?: string;
  accountantName?: string;
  remarks?: string;
  items: Array<{
    lineNo?: number;
    productCode?: string;
    productName: string;
    specification?: string;
    quantity: number;
    qualifiedQuantity?: number;
    defectiveQuantity?: number;
    unit: string;
    unitPrice?: number;
    amount?: number;
    supplyPrice?: number;
    tax?: number;
    skuCode?: string;
    remarks?: string;
  }>;
  confidence?: number;
}

/** 统一凭证识别结果：receipt 用 supplierName，invoice 用 customerName，其余字段共用 */
export interface GeminiVoucherResult {
  supplierName?: string;
  customerName?: string;
  supplierInfo?: {
    taxNumber?: string;
    phone?: string;
    address?: string;
  };
  date: string;
  totalAmount: number;
  currency?: string;
  paymentAccountName?: string;
  tax?: number;
  items: Array<{
    name: string;
    categoryName: string;
    price: number;
    purposeName?: string;
    isAsset?: boolean;
    confidence?: number;
  }>;
  confidence?: number;
  imageQuality?: ImageQuality;
  dataConsistency?: DataConsistency;
}
