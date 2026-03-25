import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/sections/hero-section"
import { ProblemSection } from "@/components/sections/problem-section"
import { SolutionSection } from "@/components/sections/solution-section"
import { FeaturesSection } from "@/components/sections/features-section"
import { TargetUsersSection } from "@/components/sections/target-users-section"
import { OutputPreviewSection } from "@/components/sections/output-preview-section"
import { CTASection } from "@/components/sections/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
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
