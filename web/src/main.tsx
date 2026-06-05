import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from "convex/react"
import { convex } from "./lib/convex"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <TooltipProvider>
        <App />
        <Toaster theme="dark" />
      </TooltipProvider>
    </ConvexProvider>
  </StrictMode>,
)
