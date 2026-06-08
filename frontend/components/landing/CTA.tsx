export function CTA() {
  return (
    <section id="contact" className="py-24 bg-gradient-to-br from-primary via-blue-700 to-indigo-700 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
          Ready to Streamline Your HR?
        </h2>
        <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
          Join hundreds of agencies and consultancies using Tiny HR to manage their HR operations efficiently.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/register"
            className="px-8 py-4 bg-white text-primary font-bold text-lg rounded-lg hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
          >
            Get Started for Free
          </a>
          <a
            href="mailto:support@tinyhr.com"
            className="px-8 py-4 bg-white/10 text-white font-medium text-lg rounded-lg hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20"
          >
            Contact Sales
          </a>
        </div>

        <p className="mt-6 text-blue-200 text-sm">
          No credit card required. 14-day free trial. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
