/**
 * 空间邀请：获取待处理邀请、接受/拒绝（与移动端 space-invitations 逻辑一致）
 */
import { supabase } from '../supabase';

export interface SpaceInvitation {
  id: string;
  spaceId: string;
  inviterId: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled' | 'declined' | 'removed';
  createdAt: string;
  acceptedAt?: string;
  spaceName?: string;
  inviterEmail?: string;
}

export async function getInvitationById(invitationId: string): Promise<SpaceInvitation | null> {
  try {
    const { data, error } = await supabase
      .from('space_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    if (!data) return null;

    return {
      id: data.id,
      spaceId: data.space_id,
      inviterId: data.inviter_id,
      inviteeEmail: data.invitee_email,
      status: data.status,
      createdAt: data.created_at,
      acceptedAt: data.accepted_at,
      spaceName: data.space_name ?? undefined,
      inviterEmail: data.inviter_email ?? undefined,
    };
  } catch (error) {
    console.error('Error getting invitation by id:', error);
    return null;
  }
}

export async function getPendingInvitationsForUser(): Promise<SpaceInvitation[]> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) return [];

    const userEmail = authUser.email.toLowerCase();
    const { data, error } = await supabase
      .from('space_invitations')
      .select('*')
      .eq('invitee_email', userEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42501' || error.message?.includes('permission denied')) return [];
      console.log('Invitations query failed (non-blocking):', error.code);
      return [];
    }
    if (!data?.length) return [];

    return data.map((row: any) => ({
      id: row.id,
      spaceId: row.space_id,
      inviterId: row.inviter_id,
      inviteeEmail: row.invitee_email,
      status: row.status,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
      spaceName: row.space_name ?? undefined,
      inviterEmail: row.inviter_email ?? undefined,
    }));
  } catch (error) {
    console.error('Error getting pending invitations:', error);
    return [];
  }
}

export async function acceptInvitation(invitationId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { error: new Error('Not logged in') };

    const invitation = await getInvitationById(invitationId);
    if (!invitation) return { error: new Error('Invitation not found or expired') };
    if (invitation.status !== 'pending') return { error: new Error('Invitation has already been used or cancelled') };

    const userEmail = authUser.email?.toLowerCase();
    if (!userEmail || userEmail !== invitation.inviteeEmail.toLowerCase()) return { error: new Error('Email does not match invitation') };

    const normalizedEmail = userEmail.trim();

    const { data: existingMember } = await supabase
      .from('user_spaces')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('space_id', invitation.spaceId)
      .single();

    if (existingMember) {
      await supabase
        .from('space_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('space_id', invitation.spaceId)
        .ilike('invitee_email', normalizedEmail);
      try {
        await supabase.rpc('update_user_current_space', { p_user_id: authUser.id, p_space_id: invitation.spaceId });
      } catch {
        await supabase.from('users').update({ current_space_id: invitation.spaceId }).eq('id', authUser.id);
      }
      return { error: null };
    }

    const { error: insertError } = await supabase.from('user_spaces').insert({
      user_id: authUser.id,
      space_id: invitation.spaceId,
      is_admin: false,
    });
    if (insertError) throw insertError;

    await supabase
      .from('space_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('space_id', invitation.spaceId)
      .ilike('invitee_email', normalizedEmail);

    try {
      await supabase.rpc('update_user_current_space', { p_user_id: authUser.id, p_space_id: invitation.spaceId });
    } catch {
      await supabase.from('users').update({ current_space_id: invitation.spaceId }).eq('id', authUser.id);
    }
    return { error: null };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { error: error instanceof Error ? error : new Error('Failed to accept invitation') };
  }
}

export async function declineInvitation(invitationId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { error: new Error('Not logged in') };

    const invitation = await getInvitationById(invitationId);
    if (!invitation) return { error: new Error('Invitation not found or expired') };
    if (invitation.status !== 'pending') return { error: new Error('Invitation has already been used or cancelled') };

    const userEmail = authUser.email?.toLowerCase();
    if (!userEmail || userEmail !== invitation.inviteeEmail.toLowerCase()) return { error: new Error('Email does not match invitation') };

    const { error: updateError } = await supabase
      .from('space_invitations')
      .update({ status: 'declined' })
      .eq('space_id', invitation.spaceId)
      .ilike('invitee_email', userEmail.trim());

    if (updateError) throw updateError;
    return { error: null };
  } catch (error) {
    console.error('Error declining invitation:', error);
    return { error: error instanceof Error ? error : new Error('Failed to decline invitation') };
  }
}
