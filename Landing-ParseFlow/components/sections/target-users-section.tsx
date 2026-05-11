"use client"

import { motion } from "framer-motion"
import { Building2, Calculator, Users, User } from "lucide-react"
import { SectionWrapper } from "../section-wrapper"

const users = [
  {
    icon: Building2,
    title: "Enterprises handling large document volumes",
    description: "Scale classification across teams and locations",
  },
  {
    icon: Calculator,
    title: "Financial institutions",
    description: "Reduce manual review and speed processing",
  },
  {
    icon: Users,
    title: "Legal and compliance teams",
    description: "Quickly identify and route sensitive documents",
  },
  {
    icon: Building2,
    title: "Government and admin systems",
    description: "Automate records handling and reduce backlog",
  },
  {
    icon: User,
    title: "Businesses managing records",
    description: "Keep document stores searchable and organized",
  },
]

export function TargetUsersSection() {
  return (
    <SectionWrapper id="users" contentClassName="bg-card border-3 border-foreground shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] p-6 md:p-10">
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
