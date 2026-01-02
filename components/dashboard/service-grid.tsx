import { Smartphone, Wifi, Tv, Zap, GraduationCap, Ticket, Receipt, Gamepad2 } from 'lucide-react';
import Link from 'next/link';

const services = [
    { icon: Smartphone, label: 'Airtime', color: 'bg-orange-100 text-orange-600', href: '/dashboard/airtime' },
    { icon: Wifi, label: 'Data', color: 'bg-green-100 text-green-600', href: '/dashboard/data' },
    { icon: Tv, label: 'TV', color: 'bg-purple-100 text-purple-600', href: '/dashboard/cable' },
    { icon: Zap, label: 'Electricity', color: 'bg-yellow-100 text-yellow-600', href: '/dashboard/electricity' },
    { icon: Gamepad2, label: 'Betting', color: 'bg-red-100 text-red-600', href: '/dashboard/coming-soon?feature=Betting+Topup' },
    { icon: GraduationCap, label: 'Education', color: 'bg-blue-100 text-blue-600', href: '/dashboard/education' },
    { icon: Ticket, label: 'Pins', color: 'bg-pink-100 text-pink-600', href: '/dashboard/coming-soon?feature=Recharge+Pins' },
    { icon: Receipt, label: 'More', color: 'bg-gray-100 text-gray-600', href: '/dashboard' },
];

export default function ServiceGrid() {
    return (
        <div className="grid grid-cols-4 gap-y-6 gap-x-2 sm:gap-6 mt-8">
            {services.map((service, idx) => (
                <Link
                    key={idx}
                    href={service.href}
                    className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                    <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center transition-transform transform group-hover:scale-110 ${service.color}`}>
                        <service.icon className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700 text-center">{service.label}</span>
                </Link>
            ))}
        </div>
    );
}
