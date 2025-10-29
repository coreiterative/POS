"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
// Removed zodResolver to avoid missing module errors; using RHF built-in rules
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { useAuth as useFirebaseAuth } from "@/firebase/provider";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/icons";

type UserFormValue = { email: string; password: string };

export function SignUpForm() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useFirebaseAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormValue>();

  const onSubmit = async (data: UserFormValue) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      const user = userCredential.user;
      const db = getFirestore(auth.app);

      // Assign 'Admin' role if email is admin@gmail.com
      const role = data.email === 'admin@gmail.com' ? 'Admin' : 'Staff';

      // Create a user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.email, // Default display name
        photoURL: null,
        role: role,
      });
      
      toast({
        title: "Account Created",
        description: "You have been successfully signed up.",
      });

      router.push("/dashboard");
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              {...register("email")}
            />
            {errors?.email && (
              <p className="px-1 text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="grid gap-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              placeholder="Password"
              type="password"
              disabled={isLoading}
              {...register("password")}
            />
            {errors?.password && (
              <p className="px-1 text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <Button disabled={isLoading}>
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Account
          </Button>
        </div>
      </form>
    </div>
  );
}
