import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

const generateUserId = () => {
  const stored = localStorage.getItem('buddy_user_id');
  if (stored) return stored;

  const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('buddy_user_id', newId);
  return newId;
};

export const useUserProfile = () => {
  const [userId] = useState(generateUserId);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
      } else {
        // Use upsert to handle duplicate keys gracefully
        const newProfile = {
          user_id: userId,
          name: '',
          personality_traits: {},
          preferences: {},
          goals: [],
          challenges: [],
          communication_style: 'balanced' as const
        };

        const { data: created, error: createError } = await supabase
          .from('user_profiles')
          .upsert(newProfile, { onConflict: 'user_id' })
          .select()
          .single();

        if (createError) throw createError;
        setProfile(created);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  return {
    userId,
    profile,
    loading,
    updateProfile
  };
};