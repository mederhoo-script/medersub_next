import Navbar from '@/components/landing/navbar';
import Hero from '@/components/landing/hero';
import Features from '@/components/landing/features';
import Footer from '@/components/landing/footer';
import TrustSection from '@/components/landing/trust_section';
import PricingCards from '@/components/landing/pricing_cards';
import HowItWorks from '@/components/landing/how_it_works';
import ApiIntegration from '@/components/landing/api_integration';

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900 relative overflow-hidden">
      <Navbar />
      <div className="relative z-10">
        <Hero />
        <TrustSection />
        <Features />
        <HowItWorks />
        <ApiIntegration />
        <PricingCards />
        <Footer />
      </div>
    </main>
  );
}

