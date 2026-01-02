import Link from 'next/link';
import { Zap, Smartphone, CreditCard } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-black text-white pt-24 pb-12 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
                    <div className="lg:col-span-1">
                        <div className="flex items-center gap-3 mb-8">
                            <span className="font-bold text-3xl tracking-tight text-white">MEDERSUB</span>
                        </div>
                        <p className="text-slate-400 font-medium leading-relaxed mb-8">
                            Your one-stop solution for bills payment and service purchases. Experience seamless and secure transactions every time.
                        </p>
                        <div className="flex gap-4">
                            {/* Social Icons Placeholder */}
                            <div className="h-10 w-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors cursor-pointer border border-white/10">
                                <Zap className="h-5 w-5" />
                            </div>
                            <div className="h-10 w-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors cursor-pointer border border-white/10">
                                <Smartphone className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-8">Services</h4>
                        <ul className="space-y-4">
                            {['Airtime Top-up', 'Data Bundles', 'Cable Subscription', 'Electricity Bills', 'Exam Pins', 'Bulk SMS'].map((item) => (
                                <li key={item}>
                                    <Link href="/login" className="text-slate-400 hover:text-green-400 transition-colors font-medium">{item}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-8">Company</h4>
                        <ul className="space-y-4">
                            {['About Us', 'Contact Us', 'Privacy Policy', 'Terms of Service', 'Support'].map((item) => (
                                <li key={item}>
                                    <Link href="#" className="text-slate-400 hover:text-green-400 transition-colors font-medium">{item}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-8">Mobile App</h4>
                        <p className="text-slate-400 font-medium mb-6">Experience faster payments on our mobile app.</p>
                        <div className="space-y-4">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-not-allowed group relative">
                                <Zap className="h-6 w-6 text-green-500" />
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500">Download for</div>
                                    <div className="text-sm font-bold">Android</div>
                                </div>
                                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">SOON</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-not-allowed group relative">
                                <CreditCard className="h-6 w-6 text-green-500" />
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500">Download for</div>
                                    <div className="text-sm font-bold">iOS Devices</div>
                                </div>
                                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">SOON</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-slate-500 font-medium text-sm">
                        © 2025 MEDERSUB. All rights reserved.
                    </div>
                    <div className="flex items-center gap-6 grayscale-0 hover:grayscale hover:opacity-100 transition-all">
                        <img src="/assets/nigerianbanks.jpeg" alt="Banks" className="h-6" />
                        <img src="/assets/mastercard.jpeg" alt="MasterCard" className="h-6" />
                        <img src="/assets/visa.jpeg" alt="Visa" className="h-6" />
                        <img src="/assets/verve.png" alt="Verve" className="h-6" />
                    </div>
                </div>
            </div>
            <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />
        </footer>
    );
}

