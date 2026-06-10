import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet, ArrowRight, Smartphone, Database, Sparkles,
  User, Lock, Mail, ShieldAlert,
} from "lucide-react";
import { sbSignUp, sbSignIn } from "../../services/supabase";
import { useSettingsStore } from "../../store/settingsStore";
import { Button, Card, Field, inputClass } from "../../components/ui";

export type AuthStep = "welcome" | "signup" | "signin";

interface AuthScreenProps {
  step: AuthStep;
  onStepChange: (step: AuthStep) => void;
}

const FEATURES = [
  {
    icon: Smartphone,
    tone: "text-indigo-400 bg-indigo-950/40",
    title: "Android SMS Interceptor",
    body: "Instantly parse incoming UPI SMS alerts from major Indian banks (HDFC, ICICI, SBI) locally.",
  },
  {
    icon: Database,
    tone: "text-emerald-400 bg-emerald-950/40",
    title: "Cloud + Notion Sync",
    body: "Offline-first ledger that syncs to your private cloud and Notion databases.",
  },
  {
    icon: Sparkles,
    tone: "text-purple-400 bg-purple-950/40",
    title: "Built-in Gemini AI",
    body: "Receipt OCR, smart categorization and heuristic fallbacks out of the box.",
  },
];

export default function AuthScreen({ step, onStepChange }: AuthScreenProps) {
  const setCurrentUser = useSettingsStore((s) => s.setCurrentUser);
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", agreed: true });
  const [signinForm, setSigninForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const go = (s: AuthStep) => {
    setError("");
    onStepChange(s);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!signupForm.name.trim() || !signupForm.email.trim() || !signupForm.password.trim())
      return setError("Please fill out all fields.");
    if (signupForm.password.length < 6)
      return setError("Password must be at least 6 characters long.");
    if (!signupForm.email.includes("@")) return setError("Please specify a valid email address.");

    setBusy(true);
    try {
      await sbSignUp(signupForm.email.trim(), signupForm.password, signupForm.name.trim());
      setCurrentUser({ email: signupForm.email.trim(), name: signupForm.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!signinForm.email.trim() || !signinForm.password.trim())
      return setError("Please fill out all fields.");

    setBusy(true);
    try {
      const user = await sbSignIn(signinForm.email.trim(), signinForm.password);
      if (user) {
        const name = user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User";
        setCurrentUser({
          email: user.email ?? signinForm.email.trim(),
          name: name.charAt(0).toUpperCase() + name.slice(1),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setBusy(false);
    }
  };

  const errorBanner = error && (
    <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-xl flex items-start gap-2 text-rose-300 text-[11px]">
      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  );

  return (
    <div className="flex-1 bg-[#0b121f] text-slate-100 flex flex-col p-6 justify-center">
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6 my-auto"
          >
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-white pt-2">
                FinSnap Ledger
              </h3>
              <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                Automated UPI SMS parsing, AI categorization & secure sync to your own cloud.
              </p>
            </div>

            <Card className="space-y-3.5">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg shrink-0 ${f.tone}`}>
                    <f.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[11.5px] font-bold text-slate-200">{f.title}</h4>
                    <p className="text-[10px] text-slate-400">{f.body}</p>
                  </div>
                </div>
              ))}
            </Card>

            <div className="space-y-2.5 pt-2">
              <Button full onClick={() => go("signup")}>
                <span>Create Free Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button full variant="secondary" onClick={() => go("signin")}>
                I already have an account
              </Button>
            </div>
            <p className="text-center text-[9px] text-slate-600 pt-1">
              v2.0.0 · End-to-end Supabase sync · RLS protected
            </p>
          </motion.div>
        )}

        {step === "signup" && (
          <motion.form
            key="signup"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSignUp}
            className="space-y-4 my-auto"
          >
            <div className="text-center space-y-1">
              <h3 className="text-lg font-extrabold text-white">Create New Account</h3>
              <p className="text-xs text-slate-500">Your data stays yours — synced privately</p>
            </div>

            {errorBanner}

            <div className="space-y-3.5">
              <Field label="Your Name" icon={<User />}>
                <input
                  type="text"
                  placeholder="e.g. Akshaya"
                  required
                  value={signupForm.name}
                  onChange={(e) => setSignupForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputClass(true)}
                />
              </Field>
              <Field label="Email Address" icon={<Mail />}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={signupForm.email}
                  onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputClass(true)}
                />
              </Field>
              <Field label="Choose Password" icon={<Lock />}>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  required
                  value={signupForm.password}
                  onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
                  className={inputClass(true)}
                />
              </Field>
            </div>

            <div className="pt-2 space-y-2">
              <Button full type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create Account"}
              </Button>
              <Button full variant="ghost" type="button" onClick={() => go("welcome")}>
                Cancel & Go Back
              </Button>
            </div>
          </motion.form>
        )}

        {step === "signin" && (
          <motion.form
            key="signin"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSignIn}
            className="space-y-4 my-auto"
          >
            <div className="text-center space-y-1">
              <h3 className="text-lg font-extrabold text-white">Welcome Back</h3>
              <p className="text-xs text-slate-500">Sign in securely to access your ledger</p>
            </div>

            {errorBanner}

            <div className="space-y-3.5">
              <Field label="Email Address" icon={<Mail />}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={signinForm.email}
                  onChange={(e) => setSigninForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputClass(true)}
                />
              </Field>
              <Field label="Password" icon={<Lock />}>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={signinForm.password}
                  onChange={(e) => setSigninForm((p) => ({ ...p, password: e.target.value }))}
                  className={inputClass(true)}
                />
              </Field>
            </div>

            <div className="pt-2 space-y-2">
              <Button full type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign In"}
              </Button>
              <Button full variant="ghost" type="button" onClick={() => go("welcome")}>
                Cancel & Go Back
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
