export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Animated background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[100vw] h-[100vw] bg-primary/10 rounded-full blur-3xl animate-[pulse_20s_ease-in-out_infinite]"></div>
        <div className="absolute top-1/4 -left-1/4 w-[80vw] h-[80vw] bg-blue-600/10 rounded-full blur-3xl animate-[pulse_25s_ease-in-out_infinite_reverse]"></div>
        <div className="absolute bottom-0 right-0 w-[60vw] h-[60vw] bg-indigo-600/10 rounded-full blur-3xl animate-[pulse_30s_ease-in-out_infinite]"></div>
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs font-medium text-primary">New: Payroll & Payslips</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-tight">
              Multi-tenant HR <br className="hidden lg:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
                for Agencies & Consultancies
              </span>
            </h1>

            <p className="text-xl text-foreground/70 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Streamline your HR operations with Tiny HR. Manage attendance, leaves, payroll, payslips, onboarding, and offboarding—all in one place.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <a
                href="#features"
                className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-lg text-lg font-medium hover:bg-primary/90 transition-all shadow-xl shadow-primary/25 hover:shadow-primary/35 hover:-translate-y-1"
              >
                Get started free
              </a>
              <a
                href="https://github.com/Rajkumar-Rangala-Dev/Tiny-Hr"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 bg-background border border-border hover:border-primary/50 text-foreground rounded-lg text-lg font-medium hover:bg-secondary transition-all flex items-center justify-center gap-2"
              >
                View on GitHub
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            </div>

            <div className="flex items-center gap-6 justify-center lg:justify-start pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-xs font-medium text-foreground/60">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div className="text-sm text-foreground/60">
                Trusted by <span className="font-semibold text-foreground">200+</span> agencies
              </div>
            </div>
          </div>

          {/* Right: Floating Dashboard Card */}
          <div className="relative hidden lg:block">
            <div className="relative z-10 animate-[float_6s_ease-in-out_infinite]">
              <div className="bg-background/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden">
                {/* Mockup Header */}
                <div className="border-b border-border p-4 flex items-center gap-4 bg-gradient-to-r from-background to-primary/5">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-400/80"></div>
                  </div>
                  <div className="flex-1 h-6 bg-foreground/5 rounded-md"></div>
                </div>

                {/* Mockup Body */}
                <div className="p-6 space-y-6">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 rounded-xl bg-secondary/30">
                        <div className="h-4 w-12 bg-foreground/20 rounded mb-3"></div>
                        <div className="h-8 w-16 bg-primary/80 rounded-lg mb-2"></div>
                        <div className="h-3 w-8 bg-foreground/10 rounded"></div>
                      </div>
                    ))}
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <div className="h-4 w-32 bg-foreground/20 rounded mb-4"></div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/40 transition-colors">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <div className="h-4 w-4 bg-primary rounded"></div>
                          </div>
                          <div className="flex-1">
                            <div className="h-3 w-3/4 bg-foreground/20 rounded mb-2"></div>
                            <div className="h-2 w-1/2 bg-foreground/10 rounded"></div>
                          </div>
                          <div className="h-3 w-12 bg-primary/20 rounded"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-border pt-4 flex items-center justify-between">
                    <div className="h-3 w-24 bg-foreground/10 rounded"></div>
                    <div className="h-8 w-8 rounded-lg bg-primary/10"></div>
                  </div>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "2s" }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
    </section>
  );
}
