import { Briefcase } from "lucide-react";
import Link from "next/link";

const footerLinks = {
  Product: [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
    { name: "Integrations", href: "#integrations" },
    { name: "Changelog", href: "#changelog" },
  ],
  Company: [
    { name: "About Us", href: "/about" },
    { name: "Careers", href: "/careers" },
    { name: "Contact", href: "/contact" },
    { name: "Privacy", href: "/privacy" },
  ],
  Resources: [
    { name: "Blog", href: "/blog" },
    { name: "Help Center", href: "/help" },
    { name: "API Docs", href: "/docs" },
    { name: "Status", href: "/status" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-background border-t border-border pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <div className="bg-primary rounded-lg p-1.5">
                <Briefcase className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">Tiny HR</span>
            </Link>
            <p className="text-foreground/60 mb-6">
              Multi-tenant HR SaaS for agencies and consultancies. Simple, powerful, and built for scale.
            </p>
            <div className="flex gap-4">
              {["twitter", "github", "linkedin", "facebook"].map((social) => (
                <a
                  key={social}
                  href={`https://${social}.com/tinyhr`}
                  className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground/60 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <span className="sr-only">{social}</span>
                  <div className="w-5 h-5 bg-current rounded-sm"></div>
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold mb-6 text-foreground">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-foreground/60 hover:text-primary transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-foreground/40 text-sm">
            © {new Date().getFullYear()} Tiny HR. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="/terms" className="text-sm text-foreground/40 hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="/privacy" className="text-sm text-foreground/40 hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="/cookies" className="text-sm text-foreground/40 hover:text-foreground transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
