import { FileText, Search, Printer, Calendar, BarChart2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';


export function Sidebar() {
  const [activeRoute, setActiveRoute] = useState('/');
    const navigate = useNavigate();


  const navItems = [
    { icon: FileText, label: 'Project', route: '/project' },
    { icon: Search, label: 'Person Search', route: '/scans' },
    { icon: BarChart2, label: 'Risk Report', route: '/report' },
    { icon: Printer, label: 'Print', route: '/print' },
  ];

  const handleNavClick = async(route: string) => {
    setActiveRoute(route);
    await navigate({to: route});
    console.log('Navigate to:', route);
  };

  return (
    <div className="w-16 shrink-0 bg-white flex flex-col items-center py-4 border-r border-gray-200">
      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.route;

          return (
            <button
              key={item.route}
              onClick={() => handleNavClick(item.route)}
              className={`
                w-full h-12 rounded-lg flex items-center justify-center
                transition-colors duration-150
                ${isActive
                  ? 'border-2 border-gray-500 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-200'
                }
              `}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      {/* Bottom Icon */}
      <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
        <Calendar className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}