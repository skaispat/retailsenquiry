"use client";

import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from '../App';
import logo from '../../public/logo.jpeg';

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);
  const { login, requestAccess } = useContext(AuthContext);
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
      } else if (result.accessDenied) {
        setShowAccessRequest(true);
        setError("You have already logged out today. Please request access from admin to login again.");
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

  const handleAccessRequest = async () => {
    if (!username) {
      setError("Username is required to request access");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const success = await requestAccess(username);
      if (success) {
        setAccessRequested(true);
        setError("");
      } else {
        setError("Failed to send access request. Please try again.");
      }
    } catch (err) {
      setError("An error occurred while sending access request.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setShowAccessRequest(false);
    setAccessRequested(false);
    setError("");
    setUsername("");
    setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex flex-col items-center justify-center space-y-4">
            {/* Title */}
            <h1 className="font-bold text-transparent text-2xl bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 transition-all duration-300">
              Leads To Retail EMS
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 ">
            <div className="flex items-center justify-center">
              <img 
                src={logo} 
                alt="Leads To Retail EMS Logo" 
                className="h-18 w-40 mb-3 object-cover"
              />
            </div>
            <h2 className="text-2xl font-bold mb-6 text-center">
              {showAccessRequest ? "Access Request" : ""}
            </h2>

            {error && (
              <div className={`mb-4 p-3 rounded-md ${
                error.includes("denied") || error.includes("request") 
                  ? "bg-yellow-100 border border-yellow-200 text-yellow-700"
                  : "bg-red-100 border border-red-200 text-red-700"
              }`}>
                {error}
              </div>
            )}

            {!showAccessRequest ? (
              // Login Form
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter your username"
                    disabled={isLoading}
                  />
                </div>

                <div className="mb-6">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-2 px-4 rounded-md transition-colors ${
                    isLoading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </button>
              </form>
            ) : (
              // Access Request Section (Only for regular users who logged out before 9 hours)
              <div className="space-y-4">
                {!accessRequested ? (
                  <>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <p className="text-yellow-800 text-sm">
                        You have already logged out today. To login again, you need to request access from the administrator.
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-md">
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>Username:</strong> {username}
                      </p>
                      <p className="text-xs text-gray-600">
                        Your access request will be sent to the admin for approval.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleAccessRequest}
                        disabled={isLoading}
                        className={`flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors ${
                          isLoading ? "opacity-70 cursor-not-allowed" : ""
                        }`}
                      >
                        {isLoading ? "Sending Request..." : "Request Access"}
                      </button>
                      <button
                        onClick={resetForm}
                        disabled={isLoading}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  // Request Sent Confirmation
                  <div className="text-center space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                      <svg 
                        className="w-12 h-12 text-green-500 mx-auto mb-3" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                        />
                      </svg>
                      <h3 className="text-lg font-medium text-green-800 mb-2">
                        Access Request Sent!
                      </h3>
                      <p className="text-green-700 text-sm">
                        Your access request has been sent to the administrator. 
                        You will be able to login once your request is approved.
                      </p>
                    </div>
                    
                    <button
                      onClick={resetForm}
                      className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
                    >
                      Back to Login
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Information Box */}
        {!showAccessRequest && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-blue-800 text-sm">
                  <strong>Note for Users:</strong> Regular users can login once per day. If you logout before completing 9 hours, 
                  you'll need to request access from the administrator to login again. <strong>Admin users have unlimited access.</strong>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;