import { Home, Mail, Phone, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Home className="w-6 h-6 text-indigo-400" />
              <span className="text-xl font-semibold text-white">TownRent</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Find your perfect rental home with no broker fees. Direct contact with verified property owners.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* For Tenants */}
          <div>
            <h3 className="text-white font-semibold mb-4">For Tenants</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm hover:text-indigo-400 transition-colors">
                  Browse Properties
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-indigo-400 transition-colors">
                  Search by Location
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-indigo-400 transition-colors">
                  Filter by Budget
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-indigo-400 transition-colors">
                  How it Works
                </a>
              </li>
            </ul>
          </div>

          {/* For Owners */}
          <div>
            <h3 className="text-white font-semibold mb-4">For Owners</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm hover:text-indigo-400 transition-colors">
                  Post Property
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-indigo-400 transition-colors">
                  Pricing Plans
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-indigo-400 transition-colors">
                  Owner Dashboard
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-indigo-400 transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-center text-sm">
                <Mail className="w-4 h-4 mr-2 text-indigo-400" />
                <a href="mailto:support@townrent.com" className="hover:text-indigo-400 transition-colors">
                  support@townrent.com
                </a>
              </li>
              <li className="flex items-center text-sm">
                <Phone className="w-4 h-4 mr-2 text-indigo-400" />
                <a href="tel:+919876543210" className="hover:text-indigo-400 transition-colors">
                  +91 98765 43210
                </a>
              </li>
            </ul>
            <div className="mt-4">
              <h4 className="text-white text-sm font-semibold mb-2">Business Hours</h4>
              <p className="text-xs text-gray-400">Mon - Sat: 9:00 AM - 6:00 PM</p>
              <p className="text-xs text-gray-400">Sunday: Closed</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p className="text-sm text-gray-400">
              © {currentYear} TownRent. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                Cookie Policy
              </a>
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">
                Sitemap
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
