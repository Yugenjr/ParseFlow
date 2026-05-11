import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/sections/hero-section"
import { ProblemSection } from "@/components/sections/problem-section"
import { SolutionSection } from "@/components/sections/solution-section"
import { FeaturesSection } from "@/components/sections/features-section"
import { TargetUsersSection } from "@/components/sections/target-users-section"
import { OutputPreviewSection } from "@/components/sections/output-preview-section"
import { CTASection } from "@/components/sections/cta-section"
import { Footer } from "@/components/footer"
import { ScrollProgress } from "@/components/scroll-progress"

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-x-hidden">
      <ScrollProgress />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-[28rem] -left-32 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute bottom-24 right-0 h-96 w-96 rounded-full bg-foreground/5 blur-3xl" />
      </div>
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <TargetUsersSection />
      <OutputPreviewSection />
      <CTASection />
      <Footer />
    </main>
  )
}
