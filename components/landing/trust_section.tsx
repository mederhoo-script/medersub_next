'use client';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function TrustSection() {
    return (
        <section className="py-20 bg-white border-y border-slate-100 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center text-center mb-16">
                    <motion.h3
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-black text-slate-900 mb-4 uppercase"
                    >
                        Over <span className="text-green-600">480,000</span> people trust us
                    </motion.h3>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Our Network Partners</p>
                </div>

                {/* Partner Logos */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-700"
                >
                    <img src="/assets/partner_logos.png" alt="Trusted Partners" className="h-12 md:h-16 w-auto object-contain" />
                </motion.div>

                {/* Minimalist Waitlist CTA */}
                <div className="mt-20 p-8 bg-slate-50 rounded-[32px] border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-xl group hover:border-green-500/30 transition-colors">
                    <div className="flex items-center gap-6">
                        <div className="h-14 w-1 flex bg-green-600 rounded-full" />
                        <h4 className="text-2xl font-black text-slate-900 uppercase">Join Our Community</h4>
                    </div>
                    <button className="px-10 py-4 bg-green-600 text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg shadow-green-600/20">
                        Get Started Today <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center"><ArrowRight className="h-3 w-3 text-white" /></div>
                    </button>
                </div>
            </div>
        </section>
    );
}
