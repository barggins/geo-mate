import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t bg-[color:var(--asphalt,#10151C)] text-white/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <p className="text-sm">© {new Date().getFullYear()} LiftClub. Built for South African commuters.</p>
        <nav className="flex flex-wrap gap-5 text-sm">
          <Link to="/" className="hover:text-white">Home</Link>
          <Link to="/contact" className="hover:text-white">Contact</Link>
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
