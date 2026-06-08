"use client";

"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import { useEffect, useState } from "react";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Features", href: "#features" },
    { name: "How it works", href: "#how-it-works" },
    { name: "Pricing", href: "#pricing" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-primary rounded-lg p-1.5 group-hover:bg-primary/90 transition-colors">
            <Briefcase className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Tiny HR</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors"
            >
              {link.name}
            </a>
          ))}
          <Link href="/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            Get started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <div className="h-5 w-5 relative">
            <span className={`absolute top-1 left-0 block h-0.5 w-full bg-foreground transition-all ${isMobileMenuOpen ? "rotate-45 top-2" : ""}`}></span>
            <span className={`absolute top-2.5 left-0 block h-0.5 w-full bg-foreground transition-all ${isMobileMenuOpen ? "opacity-0" : ""}`}></span>
            <span className={`absolute bottom-1 left-0 block h-0.5 w-full bg-foreground transition-all ${isMobileMenuOpen ? "-rotate-45 top-2" : ""}`}></span>
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-xl transition-all duration-300 overflow-hidden ${
          isMobileMenuOpen ? "max-h-96" : "max-h-0"
        }`}
      >
        <div className="container mx-auto px-4 py-4 space-y-4">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="block text-base font-medium text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <div className="pt-4 flex flex-col gap-3">
            <Link
              href="/login"
              className="block text-center py-3 rounded-lg border border-border hover:border-primary transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="block text-center py-3 bg-primary text-primary-foreground rounded-lg font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
