'use client';
import Link from 'next/link';
import { Wallet, Tv, Lightbulb, GraduationCap, Wifi, Phone, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

const services = [
    { image: '/assets/airtime3.png', title: 'Airtime Purchase', desc: 'Instantly buy airtime for all networks, ensuring convenience and speed.' },
    { image: '/assets/data2.png', title: 'Data Purchase', desc: 'Get affordable data bundles tailored to your needs, available 24/7.' },
    { image: '/assets/cabletv2.webp', title: 'Cable TV Subscription', desc: 'Renew your Cable TV subscription across all platforms with ease.' },
    { image: '/assets/electricity1.jpg', title: 'Electricity Bill', desc: 'Settle your electricity bills in seconds with our seamless solution.' },
    { image: '/assets/exam1.jpeg', title: 'Exam Pin Purchase', desc: 'Purchase exam checker and registration pins conveniently and securely.' },
    { image: '/assets/datapin2.jpeg', title: 'Data Pin Purchase', desc: 'Buy data cards tailored to your needs for immediate use.' },
    { image: '/assets/rechargepin.jpg', title: 'Recharge Card', desc: 'Purchase recharge cards and airtime pins for all networks.' },
    { image: '/assets/bulksms2.webp', title: 'Send Bulk SMS', desc: 'Send bulk SMS to multiple recipients with our efficient service.' },
    { image: '/assets/photo-collage.png.png', title: 'Internet Bundles', desc: 'Get the best internet bundles tailored to your needs.' },
];

export default function Features() {
    return (
        <section id="features" className="py-32 relative overflow-hidden bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-24">
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-5xl md:text-6xl font-black text-slate-900 mb-6"
                    >
                        Our <span className="text-green-600">Services</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-500 text-xl max-w-2xl mx-auto"
                    >
                        We provide a wide range of digital services to keep you connected and your bills paid.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.05 }}
                            className="group bg-white p-8 rounded-3xl border border-slate-100 hover:border-green-500/30 hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300"
                        >
                            <div className="aspect-video mb-8 overflow-hidden rounded-2xl bg-slate-50">
                                <img
                                    src={service.image}
                                    alt={service.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>

                            <h3 className="text-2xl font-bold text-slate-900 mb-4 group-hover:text-green-600 transition-colors">
                                {service.title}
                            </h3>
                            <p className="text-slate-500 leading-relaxed font-medium mb-8">
                                {service.desc}
                            </p>

                            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-green-600 uppercase tracking-widest group/link">
                                Get Started
                                <ArrowUpRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1 group-hover/link:-translate-y-1" />
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

