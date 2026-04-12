import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        // Logged in but not admin
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isLoggedInButNotAdmin = user && user.role !== "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f7f0] via-background to-[#fdf6f0] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">FreshSelect Meals</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sign in to manage applications and track submissions
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="p-8">
            {isLoggedInButNotAdmin ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <Lock className="w-7 h-7 text-destructive" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Access Denied</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your account ({user.name || user.email}) does not have admin privileges.
                    Please contact the system administrator.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = "/"}
                >
                  Back to Home
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This area is restricted to authorized administrators only.
                    Sign in with your Manus account to continue.
                  </p>
                </div>

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
                  onClick={() => {
                    window.location.href = getLoginUrl();
                  }}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Sign In as Administrator
                </Button>

                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Secured with Manus OAuth
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <a href="/" className="hover:text-primary transition-colors">
            ← Back to FreshSelect Meals
          </a>
        </p>
      </div>
    </div>
  );
}
