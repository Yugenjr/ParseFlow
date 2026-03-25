"use client"

import { motion } from "framer-motion"
import { Zap, Shield, Globe, FileOutput, RefreshCw, Lock } from "lucide-react"
import { SectionWrapper } from "../section-wrapper"
import { BrutalCard } from "../brutal-card"

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Process statements in seconds, not hours. Our AI works at machine speed.",
  },
  {
    icon: Shield,
    title: "99.9% Accuracy",
    description: "Machine learning trained on millions of transactions for reliable extraction.",
  },
  {
    icon: Globe,
    title: "Multi-Bank Support",
    description: "Works with statements from any bank, anywhere in the world.",
  },
  {
    icon: FileOutput,
    title: "Flexible Export",
    description: "Export to CSV, Excel, JSON, or connect directly via API.",
  },
  {
    icon: RefreshCw,
    title: "Auto-Categorization",
    description: "Transactions are automatically categorized for instant insights.",
  },
  {
    icon: Lock,
    title: "Bank-Grade Security",
    description: "Your data is encrypted end-to-end. We never store your statements.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function FeaturesSection() {
  return (
    <SectionWrapper id="features" className="bg-muted">
      <div className="text-center mb-12">
        <motion.span 
          className="inline-block bg-foreground text-background px-4 py-1 font-bold text-sm mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          FEATURES
        </motion.span>
        <h2 className="text-3xl md:text-4xl font-black text-balance">
          Built for Speed, Accuracy, and Security
        </h2>
      </div>

      <motion.div 
        className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {features.map((feature) => (
          <motion.div key={feature.title} variants={itemVariants}>
            <BrutalCard className="h-full">
              <feature.icon className="w-10 h-10 mb-4 text-secondary" strokeWidth={2.5} />
              <h3 className="text-xl font-black mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </BrutalCard>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  )
}
