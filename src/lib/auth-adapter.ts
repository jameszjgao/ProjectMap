/**
 * Auth适配层：将web端的auth-helper适配为移动端期望的auth模块接口
 * 这样移动端的lib代码可以直接复用，无需修改
 */

import { getCurrentUserInfo, getCurrentSpaceInfo, getUserSpaces as getUserSpacesWeb } from './auth-helper';
import { supabase } from './supabase';
import type { User, Space, UserSpace } from '../types';

/**
 * 适配函数：将web端的getCurrentUserInfo转换为移动端期望的getCurrentUser格式
 */
export async function getCurrentUser(forceRefresh: boolean = false): Promise<User | null> {
  const userInfo = await getCurrentUserInfo();
  if (!userInfo) return null;
  
  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name || undefined,
    spaceId: userInfo.currentSpaceId,
    currentSpaceId: userInfo.currentSpaceId || undefined,
    createdAt: userInfo.createdAt,
  };
}

/**
 * 适配函数：获取当前空间
 */
export async function getCurrentSpace(forceRefresh: boolean = false): Promise<Space | null> {
  const spaceInfo = await getCurrentSpaceInfo();
  if (!spaceInfo) return null;
  
  return {
    id: spaceInfo.id,
    name: spaceInfo.name,
    address: spaceInfo.address || undefined,
  };
}

/**
 * 适配函数：获取用户的所有空间
 */
export async function getUserSpaces(): Promise<UserSpace[]> {
  const userInfo = await getCurrentUserInfo();
  if (!userInfo) return [];
  
  const spaces = await getUserSpacesWeb();
  return spaces.map(item => ({
    id: item.id,
    userId: userInfo.id,
    spaceId: item.spaceId,
    space: item.space ? {
      id: item.space.id,
      name: item.space.name,
      address: item.space.address || undefined,
    } : undefined,
    createdAt: undefined,
  }));
}
