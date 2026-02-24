/**
 * Project Map / Mind Map 模块 - workmap schema 访问
 */

import { supabase } from './supabase';

export type PermRole = 'view' | 'edit' | 'manage';

export interface Folder {
  id: string;
  space_id: string;
  parent_id: string | null;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MindMap {
  id: string;
  space_id: string;
  folder_id: string | null;
  name: string;
  created_by: string;
  doc_id: string;
  created_at: string;
  updated_at: string;
}

export interface FolderPermission {
  id: string;
  folder_id: string;
  user_id: string;
  role: PermRole;
  granted_by: string;
  created_at: string;
}

export interface MindMapPermission {
  id: string;
  mind_map_id: string;
  user_id: string;
  role: PermRole;
  granted_by: string;
  created_at: string;
}

const SCHEMA = 'workmap' as const;

function workmapDb() {
  // 需要在 Supabase Dashboard → Settings → API → Exposed schemas 中添加 workmap
  return supabase.schema(SCHEMA);
}

export async function getFolders(spaceId: string, parentId: string | null = null) {
  let q = workmapDb()
    .from('folders')
    .select('*')
    .eq('space_id', spaceId);
  if (parentId === null) {
    q = q.is('parent_id', null);
  } else {
    q = q.eq('parent_id', parentId);
  }
  const { data, error } = await q.order('name');
  if (error) throw error;
  return (data || []) as Folder[];
}

export async function getMindMapsInFolder(spaceId: string, folderId: string | null) {
  let q = workmapDb()
    .from('mind_maps')
    .select('*')
    .eq('space_id', spaceId);
  if (folderId === null) {
    q = q.is('folder_id', null);
  } else {
    q = q.eq('folder_id', folderId);
  }
  const { data, error } = await q.order('name');
  if (error) throw error;
  return (data || []) as MindMap[];
}

export async function createFolder(spaceId: string, name: string, parentId: string | null, createdBy: string) {
  const { data, error } = await workmapDb()
    .from('folders')
    .insert({
      space_id: spaceId,
      parent_id: parentId,
      name: name.trim(),
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Folder;
}

export async function createMindMap(spaceId: string, name: string, folderId: string | null, createdBy: string) {
  const docId = `mindmap-${crypto.randomUUID()}`;
  const { data, error } = await workmapDb()
    .from('mind_maps')
    .insert({
      space_id: spaceId,
      folder_id: folderId,
      name: name.trim(),
      created_by: createdBy,
      doc_id: docId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MindMap;
}

export async function getFolderPermissions(folderId: string) {
  const { data, error } = await workmapDb()
    .from('folder_permissions')
    .select('*')
    .eq('folder_id', folderId);
  if (error) throw error;
  return (data || []) as FolderPermission[];
}

export async function getMindMapPermissions(mindMapId: string) {
  const { data, error } = await workmapDb()
    .from('mind_map_permissions')
    .select('*')
    .eq('mind_map_id', mindMapId);
  if (error) throw error;
  return (data || []) as MindMapPermission[];
}

export async function upsertFolderPermission(
  folderId: string,
  userId: string,
  role: PermRole,
  grantedBy: string
) {
  const { data, error } = await workmapDb()
    .from('folder_permissions')
    .upsert(
      { folder_id: folderId, user_id: userId, role, granted_by: grantedBy },
      { onConflict: 'folder_id,user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as FolderPermission;
}

export async function upsertMindMapPermission(
  mindMapId: string,
  userId: string,
  role: PermRole,
  grantedBy: string
) {
  const { data, error } = await workmapDb()
    .from('mind_map_permissions')
    .upsert(
      { mind_map_id: mindMapId, user_id: userId, role, granted_by: grantedBy },
      { onConflict: 'mind_map_id,user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as MindMapPermission;
}

export async function deleteFolder(folderId: string) {
  const { error } = await workmapDb().from('folders').delete().eq('id', folderId);
  if (error) throw error;
}

export async function deleteMindMap(mindMapId: string) {
  const { error } = await workmapDb().from('mind_maps').delete().eq('id', mindMapId);
  if (error) throw error;
}

export interface SpaceMember {
  id: string;
  name: string | null;
  email: string;
}

export async function getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  // Two-step query: avoid FK-join issues across schemas
  const { data: spaceRows, error: e1 } = await supabase
    .from('user_spaces')
    .select('user_id')
    .eq('space_id', spaceId);
  if (e1 || !spaceRows?.length) return [];

  const ids = spaceRows.map((r: any) => r.user_id);
  const { data: userRows, error: e2 } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', ids);
  if (e2) throw e2;
  return (userRows || []).map((u: any) => ({
    id:    u.id,
    name:  u.name  ?? null,
    email: u.email ?? '',
  }));
}

export async function getMindMapById(id: string) {
  const { data, error } = await workmapDb()
    .from('mind_maps')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as MindMap;
}
