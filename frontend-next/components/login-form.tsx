"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { usePreferences } from "@/contexts/PreferencesContext";

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  general?: string;
}

const LOGIN_TEXT = {
  ru: {
    welcome: "Добро пожаловать в B2B платформу оценки",
    signIn: "Войти",
    signUp: "Регистрация",
    username: "Имя пользователя",
    password: "Пароль",
    email: "Email",
    forgot: "Забыли?",
    fillAll: "Пожалуйста, заполните все поля",
    loggedIn: "Вход выполнен успешно",
    loginFailed: "Ошибка входа",
    invalidCredentials: "Неверные учетные данные",
    accountCreated: "Аккаунт создан",
    registrationFailed: "Ошибка регистрации",
    signInButton: "ВОЙТИ",
    createAccount: "СОЗДАТЬ АККАУНТ",
    analyticsTitle: "Продвинутая аналитика авто",
    analyticsText: "Профессиональная база данных для оценки автомобилей и исследования рынка.",
    termsPrefix: "Нажимая продолжить, вы соглашаетесь с",
    terms: "Условиями",
    privacy: "Политикой конфиденциальности",
    and: "и",
  },
  en: {
    welcome: "Welcome to the B2B Valuation Platform",
    signIn: "Sign In",
    signUp: "Sign Up",
    username: "Username",
    password: "Password",
    email: "Email",
    forgot: "Forgot?",
    fillAll: "Please fill all fields",
    loggedIn: "Logged in successfully",
    loginFailed: "Login failed",
    invalidCredentials: "Invalid credentials",
    accountCreated: "Account created!",
    registrationFailed: "Registration failed",
    signInButton: "SIGN IN",
    createAccount: "CREATE ACCOUNT",
    analyticsTitle: "Advanced Car Analytics",
    analyticsText: "The professional backbone database for automotive pricing and market research.",
    termsPrefix: "By clicking continue, you agree to our",
    terms: "Terms",
    privacy: "Privacy Policy",
    and: "and",
  },
} as const;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const { login, register } = useAuth();
  const { language } = usePreferences();
  const text = LOGIN_TEXT[language];

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeTab, setActiveTab] = useState("login");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    if (!loginUsername.trim() || !loginPassword) {
      setErrors({ general: text.fillAll });
      return;
    }

    setLoading(true);
    try {
      await login({ username: loginUsername, password: loginPassword });
      toast.success(text.loggedIn);
      router.push("/");
    } catch (error: unknown) {
      const authError = error as { detail?: string };
      setErrors({ general: authError?.detail || text.invalidCredentials });
      toast.error(text.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    if (!regUsername.trim() || !regEmail.trim() || !regPassword) {
      setErrors({ general: text.fillAll });
      return;
    }

    setLoading(true);
    try {
      await register({ username: regUsername, email: regEmail, password: regPassword });
      toast.success(text.accountCreated);
      router.push("/");
    } catch (error: unknown) {
      const authError = error as { detail?: string };
      setErrors({ general: authError?.detail || text.registrationFailed });
      toast.error(text.registrationFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden border-zinc-800 bg-zinc-900 p-0 shadow-2xl">
        <CardContent className="grid min-h-[500px] p-0 md:grid-cols-2">
          <div className="flex flex-col justify-start p-6 md:p-8">
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <h1 className="flex items-center gap-2 text-3xl font-black uppercase tracking-tighter text-white">
                CarSpecs
              </h1>
              <p className="text-sm text-zinc-400">{text.welcome}</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="relative mb-6 grid h-12 w-full grid-cols-2 overflow-hidden bg-zinc-800 p-1">
                <TabsTrigger
                  value="login"
                  className={cn(
                    "relative z-10 h-full transition-colors duration-200",
                    "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                    activeTab === "login" ? "text-white" : "text-zinc-400"
                  )}
                >
                  {activeTab === "login" && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 rounded-md bg-zinc-700"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-20">{text.signIn}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className={cn(
                    "relative z-10 h-full transition-colors duration-200",
                    "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                    activeTab === "register" ? "text-white" : "text-zinc-400"
                  )}
                >
                  {activeTab === "register" && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 rounded-md bg-zinc-700"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-20">{text.signUp}</span>
                </TabsTrigger>
              </TabsList>

              <div className="min-h-[300px]">
                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username" className="text-zinc-300">
                        {text.username}
                      </Label>
                      <Input
                        id="login-username"
                        value={loginUsername}
                        onChange={(event) => setLoginUsername(event.target.value)}
                        className="h-10 border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password" className="text-zinc-300">
                          {text.password}
                        </Label>
                        <a href="#" className="text-xs text-zinc-500 transition-colors hover:text-white">
                          {text.forgot}
                        </a>
                      </div>
                      <Input
                        id="login-password"
                        type="password"
                        value={loginPassword}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        className="h-10 border-zinc-700 bg-zinc-800 text-white"
                      />
                    </div>
                    {errors.general && (
                      <p className="text-center text-xs text-red-500">{errors.general}</p>
                    )}
                    <Button
                      type="submit"
                      variant="ghost"
                      className="mt-2 h-10 w-full bg-white font-bold text-black hover:bg-zinc-200"
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {text.signInButton}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="mt-0">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-username" className="text-zinc-300">
                        {text.username}
                      </Label>
                      <Input
                        id="reg-username"
                        value={regUsername}
                        onChange={(event) => setRegUsername(event.target.value)}
                        className="h-10 border-zinc-700 bg-zinc-800 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email" className="text-zinc-300">
                        {text.email}
                      </Label>
                      <Input
                        id="reg-email"
                        type="email"
                        value={regEmail}
                        onChange={(event) => setRegEmail(event.target.value)}
                        className="h-10 border-zinc-700 bg-zinc-800 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password" className="text-zinc-300">
                        {text.password}
                      </Label>
                      <Input
                        id="reg-password"
                        type="password"
                        value={regPassword}
                        onChange={(event) => setRegPassword(event.target.value)}
                        className="h-10 border-zinc-700 bg-zinc-800 text-white"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="ghost"
                      className="mt-2 h-10 w-full bg-white font-bold text-black hover:bg-zinc-200"
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {text.createAccount}
                    </Button>
                  </form>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="relative hidden flex-col items-center justify-center overflow-hidden border-l border-zinc-700 bg-zinc-800 p-12 md:flex">
            <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-zinc-950/50 to-transparent" />
            <div className="relative z-10 space-y-6 text-center">
              <div className="mx-auto flex h-24 w-24 rotate-3 items-center justify-center rounded-2xl bg-white shadow-2xl">
                <span className="text-4xl font-black text-black">C.</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  {text.analyticsTitle}
                </h2>
                <p className="mx-auto max-w-[280px] text-sm text-zinc-400">
                  {text.analyticsText}
                </p>
              </div>
            </div>

            <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full bg-white/5 blur-3xl" />
          </div>
        </CardContent>
      </Card>
      <p className="px-6 text-center text-xs text-zinc-500">
        {text.termsPrefix} <a href="#" className="underline">{text.terms}</a>{" "}
        {text.and} <a href="#" className="underline">{text.privacy}</a>.
      </p>
    </div>
  );
}
