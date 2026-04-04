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
import { Loader2, Car } from "lucide-react";
import { motion } from "framer-motion";

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  general?: string;
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const { login, register } = useAuth();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeTab, setActiveTab] = useState("login");

  /* ─── State ────────────────────────────────────────────────── */
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  /* ─── Handlers ─────────────────────────────────────────────── */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!loginUsername.trim() || !loginPassword) {
      setErrors({ general: "Please fill all fields" });
      return;
    }

    setLoading(true);
    try {
      await login({ username: loginUsername, password: loginPassword });
      toast.success("Logged in successfully");
      router.push("/");
    } catch (err: any) {
      setErrors({ general: err?.detail || "Invalid credentials" });
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!regUsername.trim() || !regEmail.trim() || !regPassword) {
      setErrors({ general: "Please fill all fields" });
      return;
    }

    setLoading(true);
    try {
      await register({ username: regUsername, email: regEmail, password: regPassword });
      toast.success("Account created!");
      router.push("/");
    } catch (err: any) {
      setErrors({ general: err?.detail || "Registration failed" });
      toast.error("Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 border-zinc-800 bg-zinc-900 shadow-2xl">
        <CardContent className="grid p-0 md:grid-cols-2 min-h-[500px]">
          {/* Form Side */}
          <div className="p-6 md:p-8 flex flex-col justify-start">
            <div className="flex flex-col items-center gap-2 text-center mb-6">
              <h1 className="text-3xl font-black tracking-tighter text-white uppercase flex items-center gap-2">
                CarSpecs
              </h1>
              <p className="text-sm text-zinc-400">
                Welcome to the B2B Valuation Platform
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-zinc-800 mb-6 p-1 h-12 relative overflow-hidden">
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
                      className="absolute inset-0 bg-zinc-700 rounded-md"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-20">Sign In</span>
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
                      className="absolute inset-0 bg-zinc-700 rounded-md"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-20">Sign Up</span>
                </TabsTrigger>
              </TabsList>
              <div className="min-h-[300px]">

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username" className="text-zinc-300">Username</Label>
                    <Input
                      id="login-username"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-zinc-300">Password</Label>
                      <a href="#" className="text-xs text-zinc-500 hover:text-white transition-colors">Forgot?</a>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                    />
                  </div>
                  {errors.general && <p className="text-xs text-red-500 text-center">{errors.general}</p>}
                  <Button type="submit" variant="ghost" className="w-full bg-white text-black hover:bg-zinc-200 mt-2 h-10 font-bold" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    SIGN IN
                  </Button>
                </form>
              </TabsContent>


              <TabsContent value="register" className="mt-0">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-username" className="text-zinc-300">Username</Label>
                    <Input
                      id="reg-username"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-zinc-300">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-zinc-300">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                    />
                  </div>
                  <Button type="submit" variant="ghost" className="w-full bg-white text-black hover:bg-zinc-200 mt-2 h-10 font-bold" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    CREATE ACCOUNT
                  </Button>
                </form>
              </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Marketing/Branding Side (Grey as requested) */}
          <div className="relative hidden bg-zinc-800 md:flex flex-col items-center justify-center p-12 overflow-hidden border-l border-zinc-700">
            <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-zinc-950/50 to-transparent" />
            <div className="relative z-10 text-center space-y-6">
              <div className="mx-auto w-24 h-24 rounded-2xl bg-white flex items-center justify-center shadow-2xl rotate-3">
                <span className="text-4xl font-black text-black">C.</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Advanced Car Analytics</h2>
                <p className="text-zinc-400 text-sm max-w-[280px]">
                  The professional backbone database for automotive pricing and market research.
                </p>
              </div>
            </div>

            {/* Subtle background decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-white/5 rounded-full blur-3xl" />
          </div>
        </CardContent>
      </Card>
      <p className="px-6 text-center text-xs text-zinc-500">
        By clicking continue, you agree to our <a href="#" className="underline">Terms</a>{" "}
        and <a href="#" className="underline">Privacy Policy</a>.
      </p>
    </div>
  );
}
