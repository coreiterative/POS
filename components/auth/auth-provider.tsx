"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { useFirebase } from "@/firebase/provider";
import type { UserProfile } from "@/lib/types";
import { Icons } from "@/components/icons";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isUserLoading, auth } = useFirebase();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = (user: User) => {
      if (!auth) return;
      const db = getFirestore(auth.app);
      const userDocRef = doc(db, "users", user.uid);
      
      getDoc(userDocRef).then(userDoc => {
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          // This case can happen if the user record exists in Auth but not in Firestore.
          // We can decide to create it here, or treat it as an incomplete profile.
          setUserProfile(null); 
        }
        setLoading(false);
      }).catch(error => {
        // This is where we catch the permission error
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false); // Ensure loading completes even on error
      });
    };

    if (isUserLoading) {
      setLoading(true);
    } else if (user) {
      fetchUserProfile(user);
    } else {
      setUserProfile(null);
      setLoading(false);
    }
  }, [user, isUserLoading, auth]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Icons.spinner className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading: isUserLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
