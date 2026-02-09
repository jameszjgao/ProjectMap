import { supabase } from './supabase';

export interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  currentSpaceId: string | null;
  createdAt?: string;
}

export interface SpaceInfo {
  id: string;
  name: string;
  address: string | null;
}

// 获取当前用户信息
export async function getCurrentUserInfo(): Promise<UserInfo | null> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;

    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, current_space_id, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error || !data) {
      // 如果用户记录不存在，尝试创建
      const userName = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
          name: userName,
          current_space_id: null,
        })
        .select('id, email, name, current_space_id, created_at')
        .single();

      if (newUser) {
        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          currentSpaceId: newUser.current_space_id,
          createdAt: newUser.created_at,
        };
      }
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      currentSpaceId: data.current_space_id,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// 获取当前空间信息
export async function getCurrentSpaceInfo(): Promise<SpaceInfo | null> {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo || !userInfo.currentSpaceId) return null;

    const { data, error } = await supabase
      .from('spaces')
      .select('id, name, address')
      .eq('id', userInfo.currentSpaceId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      address: data.address,
    };
  } catch (error) {
    console.error('Error getting current space:', error);
    return null;
  }
}

// 获取用户的所有空间
export async function getUserSpaces(): Promise<Array<{ id: string; spaceId: string; space?: SpaceInfo }>> {
  try {
    const userInfo = await getCurrentUserInfo();
    if (!userInfo) return [];

    const { data, error } = await supabase
      .from('user_spaces')
      .select('id, space_id, spaces(id, name, address)')
      .eq('user_id', userInfo.id);

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      spaceId: item.space_id,
      space: item.spaces ? {
        id: item.spaces.id,
        name: item.spaces.name,
        address: item.spaces.address,
      } : undefined,
    }));
  } catch (error) {
    console.error('Error getting user spaces:', error);
    return [];
  }
}
