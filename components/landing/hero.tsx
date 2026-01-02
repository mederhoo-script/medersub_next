'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Smartphone, Shield, Zap, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const backgroundImages = [
    '/assets/background.png',
    '/assets/background_ribbons_blue.png',
    '/assets/human_asset.png'
];

export default function Hero() {
    const [currentImage, setCurrentImage] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImage((prev) => (prev + 1) % backgroundImages.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-950">
            {/* Sliding Background */}
            <div className="absolute inset-0 z-0">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={currentImage}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 0.5, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="absolute inset-0"
                    >
                        <img
                            src={backgroundImages[currentImage]}
                            alt="Background"
                            className="w-full h-full object-cover"
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Overlays for better contrast */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-slate-950/90 z-10" />

                {/* Subtle Grid Overlay */}
                <div className="absolute inset-0 opacity-[0.2] z-10"
                    style={{
                        backgroundImage: `radial-gradient(#22c55e 0.5px, transparent 0.5px)`,
                        backgroundSize: '40px 40px'
                    }}
                />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center lg:text-left relative z-20"
                    >
                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-white mb-10 leading-[0.9] uppercase">
                            INSTANT AIRTIME, <br />
                            DATA AND <br />
                            <span className="text-green-500">BILL PAYMENTS</span>
                        </h1>

                        <p className="text-xl text-slate-300 mb-12 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                            Purchase airtime, data, pay bills, buy exam pin, data pin, airtime pin, send bulk sms and many more with ease!
                        </p>

                        <div className="flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-row gap-4 items-stretch lg:items-center">
                            <Link href="/login" className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-green-600/20 flex items-center justify-center gap-3">
                                <ArrowRight className="h-5 w-5" />
                                Login
                            </Link>
                            <Link href="/register" className="px-8 py-4 bg-white/10 backdrop-blur-md text-white border-2 border-white/20 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 hover:bg-white/20">
                                <Smartphone className="h-5 w-5" />
                                Register
                            </Link>
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row gap-4">
                            <div className="relative group">
                                <button disabled className="px-6 py-3 bg-white/5 text-slate-400 rounded-lg font-bold text-xs uppercase cursor-not-allowed flex items-center gap-2 border border-white/10">
                                    <Zap className="h-4 w-4" />
                                    Android App
                                </button>
                                <span className="absolute -top-3 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">COMING SOON</span>
                            </div>
                            <div className="relative group">
                                <button disabled className="px-6 py-3 bg-white/5 text-slate-400 rounded-lg font-bold text-xs uppercase cursor-not-allowed flex items-center gap-2 border border-white/10">
                                    <CreditCard className="h-4 w-4" />
                                    iOS App
                                </button>
                                <span className="absolute -top-3 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">COMING SOON</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="relative mt-20 lg:mt-0"
                    >
                        <div className="relative z-20 max-w-[500px] lg:max-w-none mx-auto group">
                            <div className="absolute -inset-10 bg-gradient-to-tr from-green-600/20 to-blue-600/20 blur-[80px] -z-10 animate-pulse" />
                            <div className="relative overflow-hidden rounded-[40px] lg:rounded-[60px] border border-white/10 shadow-2xl bg-white/5 backdrop-blur-sm p-4">
                                <img
                                    src="/assets/ui_bubbles.png"
                                    alt="Instant VTU Payments"
                                    className="w-full h-auto object-cover rounded-[30px] lg:rounded-[50px]"
                                />
                            </div>

                            {/* Floating UI Elements */}
                            <motion.div
                                animate={{ y: [0, -20, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -top-10 -right-4 lg:-right-10 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl shadow-2xl z-30"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                                        <Shield className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">Secure</p>
                                        <p className="text-slate-400 text-xs">256-bit SSL</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>

                {/* Sub Features / Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    viewport={{ once: true }}
                    className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border border-white/10 bg-white/5 backdrop-blur-md rounded-[32px] px-8 shadow-2xl shadow-black/20"
                >
                    {[
                        { label: "Uptime", value: "99.9%" },
                        { label: "Processing", value: "< 5s" },
                        { label: "Coverage", value: "National" },
                        { label: "Encryption", value: "256-bit" }
                    ].map((stat, idx) => (
                        <div key={idx} className="text-center">
                            <div className="text-2xl md:text-3xl font-black text-white mb-1">{stat.value}</div>
                            <div className="text-xs md:text-sm text-green-500 font-bold uppercase tracking-widest">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}


