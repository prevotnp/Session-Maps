import { MapPin, Zap, Shield, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Session Maps
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed">
            Explore 3D drone imagery maps that give you unparalleled perspective and connect your teams GPS locations in real time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/login"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Sign In to See The Map
            </a>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <MapPin className="h-12 w-12 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">High-Resolution Drone Imagery</h3>
            <p className="text-slate-400">
              Upload and overlay custom drone imagery with GPS precision for detailed site analysis.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <Zap className="h-12 w-12 text-emerald-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Real-Time Collaboration</h3>
            <p className="text-slate-400">
              Share location data and waypoints with your team in real-time for coordinated operations.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <Shield className="h-12 w-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Offline Mapping</h3>
            <p className="text-slate-400">
              Download map areas for offline use in remote locations without internet connectivity.
            </p>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <Users className="h-12 w-12 text-orange-400 mb-4" />
            <h3 className="text-xl font-semibold mb-3">Professional Tools</h3>
            <p className="text-slate-400">
              Advanced annotation tools, measurement capabilities, and administrative controls.
            </p>
          </div>
        </div>
      </div>


      {/* Footer */}
      <div className="container mx-auto px-4 py-8 border-t border-slate-800">
        <div className="text-center text-slate-400">
          <p>&copy; 2025 Session Maps. Professional drone mapping platform.</p>
        </div>
      </div>
    </div>
  );
}