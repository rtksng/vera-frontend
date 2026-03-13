import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import axios from 'axios';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.9:8000';

interface AuthContextType {
  // State
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  completeOnboarding: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level persisted state to survive component remounts
let persistedState = {
  onboardingCompletedLocally: false,
  lastUserId: null as string | null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  
  const profileCheckRef = useRef(false);

  // Check profile completion via backend API
  const checkProfile = useCallback(async (token: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const profile = res.data?.profile;
      return !!profile && !!profile.name;
    } catch (error: any) {
      console.log('[AuthContext] Profile check error:', error?.message || error);
      
      // Handle auth errors
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        console.log('[AuthContext] Auth error during profile check');
        await supabase.auth.signOut();
        return false;
      }
      
      // For network errors, assume no profile
      return false;
    }
  }, []);

  // Refresh profile status
  const refreshProfile = useCallback(async () => {
    if (!session?.access_token) return;
    
    const hasProfile = await checkProfile(session.access_token);
    setIsProfileComplete(hasProfile);
    setProfileChecked(true);
  }, [session, checkProfile]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      console.log('[AuthContext] Starting auth initialization...');
      
      try {
        // Set timeout for session check
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 5000)
        );
        
        const sessionPromise = supabase.auth.getSession().then(({ data }) => data.session);
        const initialSession = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (!mounted) return;
        
        console.log('[AuthContext] Initial session check result:', {
          hasSession: !!initialSession,
          userId: initialSession?.user?.id?.substring(0, 8) + '...',
          email: initialSession?.user?.email,
        });
        
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Check if this is the same user who completed onboarding locally
          if (persistedState.onboardingCompletedLocally && 
              persistedState.lastUserId === initialSession.user.id) {
            console.log('[AuthContext] Restoring local onboarding completion');
            setIsProfileComplete(true);
            setProfileChecked(true);
          } else {
            // Check profile from server
            console.log('[AuthContext] Checking profile from server...');
            const hasProfile = await checkProfile(initialSession.access_token);
            console.log('[AuthContext] Profile check result:', hasProfile);
            if (mounted) {
              setIsProfileComplete(hasProfile);
              setProfileChecked(true);
            }
          }
        } else {
          console.log('[AuthContext] No session found - user needs to authenticate');
          setProfileChecked(true);
        }
      } catch (error) {
        console.log('[AuthContext] Init error:', error);
        if (mounted) setProfileChecked(true);
      } finally {
        if (mounted) {
          console.log('[AuthContext] Auth initialization complete');
          setIsLoading(false);
        }
      }
    };
    
    initAuth();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[AuthContext] Auth state changed:', event);
        
        if (!mounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (!newSession) {
          // User signed out - reset all state
          setIsProfileComplete(false);
          setProfileChecked(true);
          profileCheckRef.current = false;
          persistedState.onboardingCompletedLocally = false;
          persistedState.lastUserId = null;
        } else if (event === 'SIGNED_IN') {
          // New sign in - check profile
          if (!profileCheckRef.current) {
            profileCheckRef.current = true;
            const hasProfile = await checkProfile(newSession.access_token);
            if (mounted) {
              setIsProfileComplete(hasProfile);
              setProfileChecked(true);
            }
          }
        }
      }
    );
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkProfile]);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      
      if (error) {
        return { error: error.message };
      }
      
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'An unexpected error occurred' };
    }
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      
      if (error) {
        return { error: error.message };
      }
      
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'An unexpected error occurred' };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    persistedState.onboardingCompletedLocally = false;
    persistedState.lastUserId = null;
  }, []);

  // Mark onboarding as complete (called after saving profile)
  const completeOnboarding = useCallback(() => {
    console.log('[AuthContext] Onboarding completed');
    setIsProfileComplete(true);
    persistedState.onboardingCompletedLocally = true;
    persistedState.lastUserId = user?.id ?? null;
  }, [user]);

  const value: AuthContextType = {
    session,
    user,
    isLoading: isLoading || !profileChecked,
    isProfileComplete,
    signIn,
    signUp,
    signOut,
    completeOnboarding,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
