'use client';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

const features = [
    'RESTful API for easy integration',
    'Comprehensive documentation',
    '24/7 Developer support',
    'Sandbox environment for testing',
    'Real-time transaction webhooks',
    'Secure and scalable infrastructure',
];

export default function ApiIntegration() {
    return (
        <section className="py-24 bg-white overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-8">
                            Empowering Your <br />
                            <span className="text-green-600">Business via API</span>
                        </h2>
                        <p className="text-slate-600 text-lg mb-10 leading-relaxed font-medium">
                            Our robust and scalable API allows you to integrate airtime and bill payment services directly into your own applications or websites.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {features.map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span className="text-slate-700 font-bold text-sm tracking-tight">{feature}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12">
                            <button className="px-8 py-4 bg-green-600 text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20">
                                View API Documentation
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="relative"
                    >
                        <div className="absolute -inset-4 bg-green-100 rounded-[40px] blur-3xl -z-10" />
                        <div className="bg-slate-900 rounded-[40px] p-8 border border-white/10 shadow-2xl relative overflow-hidden">
                            <img
                                src="/assets/apidiagram.webp"
                                alt="API Integration Diagram"
                                className="w-full h-auto rounded-2xl"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent" />
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
