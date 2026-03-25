"use client"

import { motion } from "framer-motion"
import { Building2, Calculator, Users, User } from "lucide-react"
import { SectionWrapper } from "../section-wrapper"

const users = [
  {
    icon: Building2,
    title: "Small Businesses",
    description: "Streamline bookkeeping",
  },
  {
    icon: Calculator,
    title: "Accountants",
    description: "Process client data faster",
  },
  {
    icon: Users,
    title: "Finance Teams",
    description: "Automate reconciliation",
  },
  {
    icon: User,
    title: "Individuals",
    description: "Track personal spending",
  },
]

export function TargetUsersSection() {
  return (
    <SectionWrapper id="users">
      <div className="text-center mb-12">
        <motion.span 
          className="inline-block bg-primary text-primary-foreground px-4 py-1 font-bold text-sm mb-4 border-3 border-foreground"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          WHO IT&apos;S FOR
        </motion.span>
        <h2 className="text-3xl md:text-4xl font-black text-balance">
          Made for Anyone Who Handles Money
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {users.map((user, index) => (
          <motion.div
            key={user.title}
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <motion.div 
              className="w-20 h-20 md:w-24 md:h-24 bg-card border-3 border-foreground mx-auto mb-4 flex items-center justify-center"
              whileHover={{ 
                rotate: index % 2 === 0 ? 5 : -5, 
                scale: 1.05,
                boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)"
              }}
              transition={{ duration: 0.2 }}
            >
              <user.icon className="w-10 h-10 md:w-12 md:h-12" strokeWidth={2} />
            </motion.div>
            <h3 className="font-black text-lg mb-1">{user.title}</h3>
            <p className="text-muted-foreground text-sm">{user.description}</p>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  )
}
