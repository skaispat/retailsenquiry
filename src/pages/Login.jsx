"use client";

import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from '../App';
import { Eye, EyeOff } from "lucide-react";
import logo from '../../public/retail2.png';

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(username, password);

      if (result.success) {
        navigate("/");

      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setError("");
    setUsername("");
    setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md md:max-w-4xl">
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden flex flex-col md:flex-row">

          {/* Desktop Left Side - Image */}
          <div className="hidden md:flex md:w-1/2 bg-gray-50 items-center justify-center p-8 border-r border-gray-100 overflow-hidden">
            <img
              src={logo}
              alt="Logo"
              className="w-[85%] h-auto object-contain hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Right Side / Mobile Layout */}
          <div className="p-8 md:w-1/2 flex flex-col justify-center">
            <div className="text-center mb-4 md:hidden">
              <div className="flex flex-col items-center justify-center">
                <img
                  src={logo}
                  alt="Logo"
                  className="h-auto w-auto object-contain"
                />
              </div>
            </div>
            <h1 className="font-bold text-2xl text-center mb-1 transition-all duration-300">
              Welcome Back
            </h1>
            <h1 className="font-bold text-[#800000] text-lg text-center mb-1 transition-all duration-300">
              Ready to close more deals?
            </h1>
            <h1 className="font-bold text-xs text-center mb-4 transition-all duration-300">
              Login to access your dashboard
            </h1>

            {error && (
              <div className={`mb-4 p-3 rounded-md ${error.includes("denied") || error.includes("request")
                ? "bg-yellow-100 border border-yellow-200 text-yellow-700"
                : "bg-red-100 border border-red-200 text-red-700"
                }`}>
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="w-full max-w-[280px] mx-auto">
              <div className="mb-3">
                <label
                  htmlFor="username"
                  className="block text-xs font-medium text-gray-700 mb-0.5"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#800000]"
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-gray-700 mb-0.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-1.5 pr-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#800000]"
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  type="submit"
                  className={`w-3/4 bg-[#800000] hover:bg-[#600000] text-white text-sm font-medium py-1.5 px-4 rounded-full transition-colors ${isLoading ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;