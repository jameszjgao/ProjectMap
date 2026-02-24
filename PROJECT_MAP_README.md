# Project Map 模块

团队多人协同编辑的 Mind Map，支持文件夹、权限，后续可发布为 WBS。

## 1. 数据库

在 Supabase SQL Editor 中执行 `add-workmap-schema.sql`，然后在 Dashboard → Settings → API 将 `workmap` 加入 Exposed schemas。

## 2. 技术栈

- **UI**: React Flow (@xyflow/react)
- **协同**: Yjs（待接入）
- **存储**: Supabase workmap schema

## 3. 功能

- 公共空间：Space 成员可创建文件夹和 Mind Map 文件
- 权限：创建人（管理员）可配置 manage / edit / view 给其他成员（待实现 UI）
- WBS 结构：projects → lists → tasks → subtasks 已建表，供后续「发布为任务」使用

## 4. Yjs 协同（待完成）

当前 Mind Map 编辑器为本地状态。接入 Yjs 需：

1. 部署 **HocusPocus** 或自建 y-websocket 服务
2. 安装 `y-websocket`，将 React Flow 的 nodes/edges 与 Yjs Y.Map 双向同步
3. 参考：<https://reactflow.dev/examples/interaction/collaborative>

doc_id 已存在 `mind_maps.doc_id`，可作为 Yjs 文档 ID。

## 5. 路由

- `/project-map` - 文件夹/文件列表
- `/project-map/map/:id` - Mind Map 编辑器
