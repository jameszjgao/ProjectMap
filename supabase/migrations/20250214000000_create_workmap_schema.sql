-- ============================================
-- workmap schema: Project Map / Mind Map 模块
-- 团队多人协同编辑的 Mind Map，支持文件夹、权限、后续发布为 WBS
-- ============================================
-- 执行后需在 Supabase Dashboard → Settings → API 将 workmap 加入 Exposed schemas

CREATE SCHEMA IF NOT EXISTS workmap;

-- 权限角色（幂等：已存在则跳过）
DO $$ BEGIN
  CREATE TYPE workmap.perm_role AS ENUM ('view', 'edit', 'manage');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 文件夹（公共空间内，space 成员可创建）
CREATE TABLE IF NOT EXISTS workmap.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES workmap.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workmap_folders_space ON workmap.folders(space_id);
CREATE INDEX IF NOT EXISTS idx_workmap_folders_parent ON workmap.folders(parent_id);

-- Mind Map 文件
CREATE TABLE IF NOT EXISTS workmap.mind_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES workmap.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL UNIQUE,  -- Yjs 文档 ID，用于 HocusPocus/WebSocket 同步
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workmap_mind_maps_space ON workmap.mind_maps(space_id);
CREATE INDEX IF NOT EXISTS idx_workmap_mind_maps_folder ON workmap.mind_maps(folder_id);

-- 文件夹权限（创建人可授予其他成员）
CREATE TABLE IF NOT EXISTS workmap.folder_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES workmap.folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role workmap.perm_role NOT NULL DEFAULT 'view',
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workmap_folder_perms_folder ON workmap.folder_permissions(folder_id);
CREATE INDEX IF NOT EXISTS idx_workmap_folder_perms_user ON workmap.folder_permissions(user_id);

-- Mind Map 文件权限
CREATE TABLE IF NOT EXISTS workmap.mind_map_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mind_map_id UUID NOT NULL REFERENCES workmap.mind_maps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role workmap.perm_role NOT NULL DEFAULT 'view',
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mind_map_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workmap_mind_map_perms_map ON workmap.mind_map_permissions(mind_map_id);
CREATE INDEX IF NOT EXISTS idx_workmap_mind_map_perms_user ON workmap.mind_map_permissions(user_id);

-- ============================================
-- 后续 WBS 发布：项目-清单-任务-子任务 结构
-- ============================================

-- 项目（从 Mind Map 发布）
CREATE TABLE IF NOT EXISTS workmap.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  mind_map_id UUID REFERENCES workmap.mind_maps(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workmap_projects_space ON workmap.projects(space_id);

-- 清单（项目下的分组）
CREATE TABLE IF NOT EXISTS workmap.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES workmap.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workmap_lists_project ON workmap.lists(project_id);

-- 任务
CREATE TABLE IF NOT EXISTS workmap.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES workmap.lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workmap_tasks_list ON workmap.tasks(list_id);

-- 子任务
CREATE TABLE IF NOT EXISTS workmap.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES workmap.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workmap_subtasks_task ON workmap.subtasks(task_id);

-- ============================================
-- RLS & Grants
-- ============================================

GRANT USAGE ON SCHEMA workmap TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA workmap TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workmap TO authenticated;

ALTER TABLE workmap.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE workmap.mind_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workmap.folder_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workmap.mind_map_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workmap.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workmap.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE workmap.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workmap.subtasks ENABLE ROW LEVEL SECURITY;

-- 空间成员可访问：需在 user_spaces 中（幂等：先 DROP 再 CREATE）
DROP POLICY IF EXISTS workmap_folders_space_member ON workmap.folders;
CREATE POLICY workmap_folders_space_member ON workmap.folders
  FOR ALL USING (space_id IN (SELECT space_id FROM public.user_spaces WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS workmap_mind_maps_space_member ON workmap.mind_maps;
CREATE POLICY workmap_mind_maps_space_member ON workmap.mind_maps
  FOR ALL USING (space_id IN (SELECT space_id FROM public.user_spaces WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS workmap_folder_perms_space ON workmap.folder_permissions;
CREATE POLICY workmap_folder_perms_space ON workmap.folder_permissions
  FOR ALL USING (folder_id IN (SELECT id FROM workmap.folders WHERE space_id IN (SELECT space_id FROM public.user_spaces WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS workmap_mind_map_perms_space ON workmap.mind_map_permissions;
CREATE POLICY workmap_mind_map_perms_space ON workmap.mind_map_permissions
  FOR ALL USING (mind_map_id IN (SELECT id FROM workmap.mind_maps WHERE space_id IN (SELECT space_id FROM public.user_spaces WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS workmap_projects_space ON workmap.projects;
CREATE POLICY workmap_projects_space ON workmap.projects
  FOR ALL USING (space_id IN (SELECT space_id FROM public.user_spaces WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS workmap_lists_via_project ON workmap.lists;
CREATE POLICY workmap_lists_via_project ON workmap.lists
  FOR ALL USING (project_id IN (SELECT id FROM workmap.projects WHERE space_id IN (SELECT space_id FROM public.user_spaces WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS workmap_tasks_via_list ON workmap.tasks;
CREATE POLICY workmap_tasks_via_list ON workmap.tasks
  FOR ALL USING (list_id IN (SELECT id FROM workmap.lists WHERE project_id IN (SELECT id FROM workmap.projects WHERE space_id IN (SELECT space_id FROM public.user_spaces WHERE user_id = auth.uid()))));

DROP POLICY IF EXISTS workmap_subtasks_via_task ON workmap.subtasks;
CREATE POLICY workmap_subtasks_via_task ON workmap.subtasks
  FOR ALL USING (task_id IN (SELECT id FROM workmap.tasks WHERE list_id IN (SELECT id FROM workmap.lists WHERE project_id IN (SELECT id FROM workmap.projects WHERE space_id IN (SELECT space_id FROM public.user_spaces WHERE user_id = auth.uid())))));
