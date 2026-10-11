import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Home } from "lucide-react";
import { SignedIn, UserButton } from "@clerk/nextjs";

export default function SiteNav() {
  return <header className="topbar"><div className="container topbar-inner"><Link className="brand" href="/">Nexora <span>Placement Prep</span></Link><nav className="nav" aria-label="Primary navigation"><Link className="home-button" href="/placement-prep"><Home size={16} /> Prep Home</Link><Link className="main-site-link" href="/"><ArrowLeft size={15} /> Main site</Link><Link href="/placement-prep/dashboard">Workspace</Link><Link href="/placement-prep/profile">Profile</Link><details className="feature-menu"><summary>Features <ChevronDown size={15} /></summary><div className="feature-dropdown"><Link href="/placement-prep/assessment">Assessment</Link><Link href="/placement-prep/readiness">Assessment analysis</Link><Link href="/placement-prep/placement-score">Placement score</Link><Link href="/placement-prep/careers">Career paths</Link><Link href="/placement-prep/what-if">Career what-if</Link><Link className="feature-more-link" href="/placement-prep/modules">More <ChevronRight size={15} /></Link></div></details><SignedIn><UserButton /></SignedIn></nav></div></header>;
}
