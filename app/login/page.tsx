import Link from "next/link";
import { Icons } from "@/components/icons";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <Icons.logo className="mx-auto h-8 w-8 text-primary" />
          <h1 className="font-headline text-2xl font-semibold tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </div>
        <LoginForm />
        <p className="px-8 text-center text-sm text-muted-foreground">
          <Link
            href="/signup"
            className="hover:text-brand underline underline-offset-4"
          >
            Don't have an account? Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
